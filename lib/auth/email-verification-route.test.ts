import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { EmailVerificationConflictError } from "./email-verification";
import {
  applyEmailVerificationPrivateHeaders,
  createEmailVerificationJsonResponse,
  createEmailVerificationRedirectResponse,
  createEmailVerificationRouteHandlers,
  isCanonicalEmailVerificationRequest,
  type EmailVerificationRouteContext,
  type EmailVerificationRouteDependencies,
  type EmailVerificationRouteFailure,
  type EmailVerificationRouteFailureStage,
  type EmailVerificationRouteRecord,
} from "./email-verification-route";

const ENDPOINT =
  "https://shop.example.com/api/auth/verify-email/legacy-token";
const TOKEN = "a".repeat(64);
const UPPERCASE_TOKEN = "A".repeat(64);
const VERIFIED_AT = new Date("2026-08-30T12:00:00.000Z");

interface TestVerification extends EmailVerificationRouteRecord {
  email: string;
}

const ACTIVE_VERIFICATION: TestVerification = {
  id: "verification-1",
  userId: "user-1",
  email: "kupac@example.com",
  expires: new Date("2026-08-31T12:00:00.000Z"),
};

function request(
  method: "GET" | "HEAD" | "POST",
  headers: Record<string, string> = {
    origin: "https://shop.example.com",
  },
): NextRequest {
  return new NextRequest(ENDPOINT, {
    method,
    headers: {
      host: "shop.example.com",
      ...headers,
    },
  });
}

function context(token: string = TOKEN): EmailVerificationRouteContext {
  return { params: Promise.resolve({ token }) };
}

function outcome(kind: string, status: number): NextResponse {
  return NextResponse.json({ kind }, { status });
}

function assertProtected(response: NextResponse): void {
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(
    response.headers.get("x-robots-tag"),
    "noindex, nofollow, noarchive",
  );
}

function dependencies(
  calls: string[],
  failures: EmailVerificationRouteFailure[],
  overrides: Partial<
    EmailVerificationRouteDependencies<TestVerification>
  > = {},
): EmailVerificationRouteDependencies<TestVerification> {
  return {
    getConfirmationUrl(token, verificationRequest) {
      calls.push(`confirmation:${verificationRequest.method}`);
      return `https://shop.example.com/verify-email/${encodeURIComponent(token)}`;
    },
    async findVerification(token) {
      calls.push(`lookup:${token}`);
      return ACTIVE_VERIFICATION;
    },
    async getCurrentSessionUserId() {
      calls.push("current-session");
      return null;
    },
    async issueSessionToken() {
      calls.push("issue-session");
      return "signed-session-token";
    },
    prepareSuccessResponse(sessionToken) {
      calls.push("prepare-success");
      const response = NextResponse.redirect(
        "https://shop.example.com/moj-nalog?verified=true",
        303,
      );
      response.cookies.set("auth-session", sessionToken, {
        httpOnly: true,
      });
      return response;
    },
    async commitVerification() {
      calls.push("commit");
    },
    untrustedWriteResponse() {
      calls.push("untrusted");
      return outcome("untrusted", 403);
    },
    invalidTokenResponse() {
      calls.push("invalid");
      return outcome("invalid", 400);
    },
    expiredTokenResponse() {
      calls.push("expired");
      return outcome("expired", 410);
    },
    sessionMismatchResponse() {
      calls.push("session-mismatch");
      return outcome("session-mismatch", 409);
    },
    retryResponse() {
      calls.push("retry");
      return outcome("retry", 503);
    },
    reportFailure(failure) {
      failures.push(failure);
    },
    now: () => VERIFIED_AT,
    ...overrides,
  };
}

test("response helpers apply the complete private verification policy", async () => {
  const plain = applyEmailVerificationPrivateHeaders(
    NextResponse.json({ ok: true }),
  );
  const json = createEmailVerificationJsonResponse({ retry: true }, 503);
  const redirect = createEmailVerificationRedirectResponse(
    "https://shop.example.com/login",
  );

  for (const response of [plain, json, redirect]) {
    assertProtected(response);
  }
  assert.equal(json.status, 503);
  assert.deepEqual(await json.json(), { retry: true });
  assert.equal(redirect.status, 303);
  assert.equal(
    redirect.headers.get("location"),
    "https://shop.example.com/login",
  );
});

test("canonical verification origin rejects a trusted alias before token use", () => {
  const canonicalUrl = new URL("https://shop.example.com");

  assert.equal(
    isCanonicalEmailVerificationRequest(
      new Headers({
        host: "shop.example.com",
        origin: "https://shop.example.com",
      }),
      canonicalUrl,
    ),
    true,
  );
  assert.equal(
    isCanonicalEmailVerificationRequest(
      new Headers({
        host: "alias.example.com",
        origin: "https://alias.example.com",
      }),
      canonicalUrl,
    ),
    false,
  );
  assert.equal(
    isCanonicalEmailVerificationRequest(
      new Headers({
        host: "shop.example.com",
        "sec-fetch-site": "same-origin",
      }),
      canonicalUrl,
    ),
    true,
  );
  assert.equal(
    isCanonicalEmailVerificationRequest(
      new Headers({
        host: "alias.example.com",
        "sec-fetch-site": "same-origin",
      }),
      canonicalUrl,
    ),
    false,
  );
});

test("legacy GET and HEAD are exact read-only 303 redirects", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationRouteFailure[] = [];
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, failures, {
      async findVerification() {
        throw new Error("GET must never look up a token");
      },
      async getCurrentSessionUserId() {
        throw new Error("GET must never inspect a session");
      },
      async issueSessionToken() {
        throw new Error("GET must never issue a session");
      },
      async commitVerification() {
        throw new Error("GET must never commit");
      },
    }),
  );

  const getResponse = await handlers.GET(request("GET", {}), context());
  const headResponse = await handlers.HEAD(request("HEAD", {}), context());

  for (const response of [getResponse, headResponse]) {
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      `https://shop.example.com/verify-email/${TOKEN}`,
    );
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("set-cookie"), null);
    assertProtected(response);
  }
  assert.deepEqual(calls, ["confirmation:GET", "confirmation:HEAD"]);
  assert.deepEqual(failures, []);
});

test("POST enforces its local trusted-write guard before params and lookup", async () => {
  const untrustedHeaders: Array<Record<string, string>> = [
    { origin: "https://attacker.example" },
    {},
  ];

  for (const headers of untrustedHeaders) {
    const calls: string[] = [];
    const failures: EmailVerificationRouteFailure[] = [];
    const handlers = createEmailVerificationRouteHandlers(
      dependencies(calls, failures),
    );

    const response = await handlers.POST(
      request("POST", headers),
      context("not-a-token"),
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { kind: "untrusted" });
    assert.deepEqual(calls, ["untrusted"]);
    assert.deepEqual(failures, []);
    assertProtected(response);
  }
});

test("valid POST prepares session and full response before the commit", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationRouteFailure[] = [];
  let committedClaim: unknown;
  let committedAt: Date | undefined;
  let committedRecord: TestVerification | undefined;
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, failures, {
      async commitVerification(claim, verifiedAt, verification) {
        calls.push("commit");
        committedClaim = claim;
        committedAt = verifiedAt;
        committedRecord = verification;
      },
    }),
  );

  const response = await handlers.POST(
    request("POST"),
    context(UPPERCASE_TOKEN),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://shop.example.com/moj-nalog?verified=true",
  );
  assert.match(response.headers.get("set-cookie") ?? "", /auth-session=/);
  assertProtected(response);
  assert.deepEqual(calls, [
    `lookup:${TOKEN}`,
    "current-session",
    "issue-session",
    "prepare-success",
    "commit",
  ]);
  assert.deepEqual(committedClaim, {
    id: ACTIVE_VERIFICATION.id,
    userId: ACTIVE_VERIFICATION.userId,
    token: TOKEN,
  });
  assert.equal(committedAt, VERIFIED_AT);
  assert.equal(committedRecord, ACTIVE_VERIFICATION);
  assert.deepEqual(failures, []);
});

test("commit remains deferred until asynchronous response preparation finishes", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationRouteFailure[] = [];
  let releaseResponse!: (response: NextResponse) => void;
  let signalPreparationStarted!: () => void;
  const preparationStarted = new Promise<void>((resolve) => {
    signalPreparationStarted = resolve;
  });
  const preparedResponse = new Promise<NextResponse>((resolve) => {
    releaseResponse = resolve;
  });
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, failures, {
      prepareSuccessResponse() {
        calls.push("prepare-success-started");
        signalPreparationStarted();
        return preparedResponse;
      },
    }),
  );

  const pendingResult = handlers.POST(request("POST"), context());
  await preparationStarted;

  assert.equal(calls.includes("commit"), false);
  assert.deepEqual(calls, [
    `lookup:${TOKEN}`,
    "current-session",
    "issue-session",
    "prepare-success-started",
  ]);

  releaseResponse(
    NextResponse.redirect("https://shop.example.com/moj-nalog", 303),
  );
  const response = await pendingResult;

  assert.equal(response.status, 303);
  assert.equal(calls.at(-1), "commit");
  assertProtected(response);
  assert.deepEqual(failures, []);
});

test("malformed and absent tokens are invalid without later work", async () => {
  {
    const calls: string[] = [];
    const failures: EmailVerificationRouteFailure[] = [];
    const handlers = createEmailVerificationRouteHandlers(
      dependencies(calls, failures),
    );
    const response = await handlers.POST(
      request("POST"),
      context("f".repeat(63)),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(calls, ["invalid"]);
    assertProtected(response);
  }

  {
    const calls: string[] = [];
    const failures: EmailVerificationRouteFailure[] = [];
    const handlers = createEmailVerificationRouteHandlers(
      dependencies(calls, failures, {
        async findVerification(token) {
          calls.push(`lookup:${token}`);
          return null;
        },
      }),
    );
    const response = await handlers.POST(request("POST"), context());

    assert.equal(response.status, 400);
    assert.deepEqual(calls, [`lookup:${TOKEN}`, "invalid"]);
    assertProtected(response);
  }
});

test("expired tokens are reported read-only and boundary expiry is closed", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationRouteFailure[] = [];
  const expiredVerification = {
    ...ACTIVE_VERIFICATION,
    expires: VERIFIED_AT,
  };
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, failures, {
      async findVerification(token) {
        calls.push(`lookup:${token}`);
        return expiredVerification;
      },
    }),
  );

  const response = await handlers.POST(request("POST"), context());

  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { kind: "expired" });
  assert.deepEqual(calls, [`lookup:${TOKEN}`, "expired"]);
  assert.equal(calls.includes("commit"), false);
  assertProtected(response);
  assert.deepEqual(failures, []);
});

test("a different current session cannot consume a valid token", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationRouteFailure[] = [];
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, failures, {
      async getCurrentSessionUserId() {
        calls.push("current-session");
        return "different-user";
      },
    }),
  );

  const response = await handlers.POST(request("POST"), context());

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { kind: "session-mismatch" });
  assert.deepEqual(calls, [
    `lookup:${TOKEN}`,
    "current-session",
    "session-mismatch",
  ]);
  assert.equal(calls.includes("issue-session"), false);
  assert.equal(calls.includes("commit"), false);
  assert.equal(response.headers.get("set-cookie"), null);
  assertProtected(response);
  assert.deepEqual(failures, []);
});

test("the same current session may complete verification", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationRouteFailure[] = [];
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, failures, {
      async getCurrentSessionUserId() {
        calls.push("current-session");
        return ACTIVE_VERIFICATION.userId;
      },
    }),
  );

  const response = await handlers.POST(request("POST"), context());

  assert.equal(response.status, 303);
  assert.equal(calls.at(-1), "commit");
  assert.deepEqual(failures, []);
});

test("every operational failure is stage-only and returns a retryable response", async () => {
  const scenarios: Array<{
    stage: EmailVerificationRouteFailureStage;
    context?: EmailVerificationRouteContext;
    override: Partial<
      EmailVerificationRouteDependencies<TestVerification>
    >;
  }> = [
    {
      stage: "PARAMS",
      context: { params: Promise.reject(new Error("sensitive params")) },
      override: {},
    },
    {
      stage: "LOOKUP",
      override: {
        async findVerification() {
          throw new Error("sensitive lookup");
        },
      },
    },
    {
      stage: "EXPIRY_CHECK",
      override: {
        now() {
          throw new Error("sensitive clock");
        },
      },
    },
    {
      stage: "CURRENT_SESSION",
      override: {
        async getCurrentSessionUserId() {
          throw new Error("sensitive session read");
        },
      },
    },
    {
      stage: "SESSION_ISSUE",
      override: {
        async issueSessionToken() {
          throw new Error("sensitive JWT");
        },
      },
    },
    {
      stage: "RESPONSE_PREPARATION",
      override: {
        prepareSuccessResponse() {
          throw new Error("sensitive cookie");
        },
      },
    },
    {
      stage: "COMMIT",
      override: {
        async commitVerification() {
          throw new Error("sensitive database");
        },
      },
    },
  ];

  for (const scenario of scenarios) {
    const calls: string[] = [];
    const failures: EmailVerificationRouteFailure[] = [];
    const handlers = createEmailVerificationRouteHandlers(
      dependencies(calls, failures, scenario.override),
    );

    const response = await handlers.POST(
      request("POST"),
      scenario.context ?? context(),
    );
    const body = await response.text();

    assert.equal(response.status, 503, scenario.stage);
    assert.equal(body, JSON.stringify({ kind: "retry" }), scenario.stage);
    assert.equal(body.toLowerCase().includes("sensitive"), false);
    assert.deepEqual(failures, [{ stage: scenario.stage }]);
    assert.equal(response.headers.get("set-cookie"), null);
    assertProtected(response);
  }
});

test("a commit conflict discards the prepared success cookie", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationRouteFailure[] = [];
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, failures, {
      invalidTokenResponse() {
        calls.push("invalid");
        const response = outcome("invalid", 400);
        response.cookies.set("must-not-survive", "failure-cookie");
        return response;
      },
      async commitVerification() {
        calls.push("commit-conflict");
        throw new EmailVerificationConflictError();
      },
    }),
  );

  const response = await handlers.POST(request("POST"), context());

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { kind: "invalid" });
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(calls, [
    `lookup:${TOKEN}`,
    "current-session",
    "issue-session",
    "prepare-success",
    "commit-conflict",
    "invalid",
  ]);
  assert.deepEqual(failures, [{ stage: "COMMIT" }]);
  assertProtected(response);
});

test("reporting failure cannot replace the generic retry outcome", async () => {
  const calls: string[] = [];
  const handlers = createEmailVerificationRouteHandlers(
    dependencies(calls, [], {
      async findVerification() {
        throw new Error("database detail");
      },
      reportFailure(failure) {
        assert.deepEqual(Object.keys(failure), ["stage"]);
        throw new Error("logger unavailable");
      },
    }),
  );

  const response = await handlers.POST(request("POST"), context());

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { kind: "retry" });
  assertProtected(response);
});
