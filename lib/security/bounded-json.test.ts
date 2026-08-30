import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedJson, type BoundedJsonRequest } from "./bounded-json";

const encoder = new TextEncoder();

function bodyThatMustNotBeRead(onRead: () => void): ReadableStream<Uint8Array> {
  return {
    getReader() {
      onRead();
      throw new Error("Body must not be read");
    },
  } as unknown as ReadableStream<Uint8Array>;
}

function requestFromChunks(
  chunks: Uint8Array[],
  headers: Record<string, string> = { "content-type": "application/json" },
  onCancel?: (reason: unknown) => void,
): BoundedJsonRequest {
  let index = 0;
  return {
    headers: new Headers(headers),
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[index];
        index += 1;
        if (chunk) {
          controller.enqueue(chunk);
          return;
        }
        controller.close();
      },
      cancel(reason) {
        onCancel?.(reason);
      },
    }),
  };
}

test("bounded JSON accepts application/json UTF-8 within the byte limit", async () => {
  const source = '{"email":"kupac@example.com"}';
  const result = await readBoundedJson(
    requestFromChunks(
      [encoder.encode(source.slice(0, 9)), encoder.encode(source.slice(9))],
      { "content-type": "Application/JSON; charset=\"UTF-8\"" },
    ),
    encoder.encode(source).byteLength,
  );

  assert.deepEqual(result, {
    ok: true,
    value: { email: "kupac@example.com" },
    byteLength: encoder.encode(source).byteLength,
  });
});

test("declared oversized body fails before the stream is pulled", async () => {
  let pulls = 0;
  const request: BoundedJsonRequest = {
    headers: new Headers({
      "content-type": "application/json",
      "content-length": "1025",
    }),
    body: bodyThatMustNotBeRead(() => {
      pulls += 1;
    }),
  };

  const result = await readBoundedJson(request, 1024);

  assert.deepEqual(result, {
    ok: false,
    error: "PAYLOAD_TOO_LARGE",
    status: 413,
  });
  assert.equal(pulls, 0);
});

test("streamed body is cancelled as soon as its real size crosses the limit", async () => {
  let cancelled = false;
  const result = await readBoundedJson(
    requestFromChunks(
      [encoder.encode('{"value":"'), encoder.encode("x".repeat(32))],
      { "content-type": "application/json" },
      () => {
        cancelled = true;
      },
    ),
    16,
  );

  assert.deepEqual(result, {
    ok: false,
    error: "PAYLOAD_TOO_LARGE",
    status: 413,
  });
  assert.equal(cancelled, true);
});

test("actual byte limit remains authoritative when declared length is smaller", async () => {
  let cancelled = false;
  const result = await readBoundedJson(
    requestFromChunks(
      [encoder.encode("x".repeat(17))],
      {
        "content-type": "application/json",
        "content-length": "2",
      },
      () => {
        cancelled = true;
      },
    ),
    16,
  );

  assert.equal(result.ok, false);
  if (result.ok) assert.fail("Expected an oversized result");
  assert.equal(result.error, "PAYLOAD_TOO_LARGE");
  assert.equal(cancelled, true);
});

test("unsupported media type and content encoding are rejected without reading", async () => {
  const unsupportedHeaders: Array<Record<string, string>> = [
    {},
    { "content-type": "text/plain" },
    { "content-type": "application/json", "content-encoding": "gzip" },
    { "content-type": "application/problem+json" },
  ];

  for (const headers of unsupportedHeaders) {
    let pulls = 0;
    const request: BoundedJsonRequest = {
      headers: new Headers(headers),
      body: bodyThatMustNotBeRead(() => {
        pulls += 1;
      }),
    };

    const result = await readBoundedJson(request, 1024);

    assert.equal(result.ok, false);
    if (result.ok) assert.fail("Expected unsupported request metadata");
    assert.equal(result.status, 415);
    assert.equal(pulls, 0);
  }
});

test("invalid Content-Length is rejected before reading", async () => {
  const result = await readBoundedJson(
    requestFromChunks([encoder.encode("{}")], {
      "content-type": "application/json",
      "content-length": "1, 2",
    }),
    1024,
  );

  assert.deepEqual(result, {
    ok: false,
    error: "INVALID_CONTENT_LENGTH",
    status: 400,
  });
});

test("malformed UTF-8 is rejected before JSON parsing", async () => {
  const result = await readBoundedJson(
    requestFromChunks([new Uint8Array([0x7b, 0x22, 0x80, 0x22, 0x7d])]),
    1024,
  );

  assert.deepEqual(result, {
    ok: false,
    error: "INVALID_UTF8",
    status: 400,
  });
});

test("empty and malformed JSON bodies return bounded validation failures", async () => {
  for (const chunks of [[], [encoder.encode("{")]]) {
    const result = await readBoundedJson(requestFromChunks(chunks), 1024);

    assert.equal(result.ok, false);
    if (result.ok) assert.fail("Expected invalid JSON");
    assert.equal(result.error, "INVALID_JSON");
    assert.equal(result.status, 400);
  }
});
