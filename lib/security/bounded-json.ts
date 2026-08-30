export type BoundedJsonError =
  | "UNSUPPORTED_CONTENT_TYPE"
  | "UNSUPPORTED_CONTENT_ENCODING"
  | "INVALID_CONTENT_LENGTH"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_BODY"
  | "INVALID_UTF8"
  | "INVALID_JSON";

export type BoundedJsonResult =
  | { ok: true; value: unknown; byteLength: number }
  | {
      ok: false;
      error: BoundedJsonError;
      status: 400 | 413 | 415;
    };

export interface BoundedJsonRequest {
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
}

const JSON_CONTENT_TYPE_PATTERN =
  /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i;
const CONTENT_LENGTH_PATTERN = /^\d+$/;

function failure(
  error: BoundedJsonError,
  status: 400 | 413 | 415,
): BoundedJsonResult {
  return { ok: false, error, status };
}

function hasSupportedContentType(value: string | null): boolean {
  return value !== null && JSON_CONTENT_TYPE_PATTERN.test(value.trim());
}

function hasSupportedContentEncoding(value: string | null): boolean {
  return value === null || value.trim().toLowerCase() === "identity";
}

/**
 * Reads a JSON request without allowing Fetch's convenience helpers to buffer
 * an unbounded body. The limit is enforced against bytes, before UTF-8 decode
 * or JSON parsing, and applies even when Content-Length is absent or dishonest.
 */
export async function readBoundedJson(
  request: BoundedJsonRequest,
  maxBytes: number,
): Promise<BoundedJsonResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  if (!hasSupportedContentType(request.headers.get("content-type"))) {
    return failure("UNSUPPORTED_CONTENT_TYPE", 415);
  }

  if (!hasSupportedContentEncoding(request.headers.get("content-encoding"))) {
    return failure("UNSUPPORTED_CONTENT_ENCODING", 415);
  }

  const declaredLengthHeader = request.headers.get("content-length");
  if (declaredLengthHeader !== null) {
    const normalizedLength = declaredLengthHeader.trim();
    if (!CONTENT_LENGTH_PATTERN.test(normalizedLength)) {
      return failure("INVALID_CONTENT_LENGTH", 400);
    }

    const declaredLength = Number(normalizedLength);
    if (!Number.isSafeInteger(declaredLength)) {
      return failure("PAYLOAD_TOO_LARGE", 413);
    }
    if (declaredLength > maxBytes) {
      return failure("PAYLOAD_TOO_LARGE", 413);
    }
  }

  if (request.body === null) {
    return failure("INVALID_BODY", 400);
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return failure("INVALID_BODY", 400);
  }

  const bytes = new Uint8Array(maxBytes);
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value.byteLength > maxBytes - byteLength) {
        try {
          await reader.cancel("Request body exceeds the configured limit");
        } catch {
          // The size decision is final even if the producer rejects cancel().
        }
        return failure("PAYLOAD_TOO_LARGE", 413);
      }

      byteLength += value.byteLength;
      bytes.set(value, byteLength - value.byteLength);
    }
  } catch {
    try {
      await reader.cancel("Request body stream failed");
    } catch {
      // Preserve the generic invalid-body result.
    }
    return failure("INVALID_BODY", 400);
  } finally {
    reader.releaseLock();
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(0, byteLength),
    );
  } catch {
    return failure("INVALID_UTF8", 400);
  }

  try {
    return {
      ok: true,
      value: JSON.parse(text) as unknown,
      byteLength,
    };
  } catch {
    return failure("INVALID_JSON", 400);
  }
}
