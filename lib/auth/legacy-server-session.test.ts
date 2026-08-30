import assert from "node:assert/strict";
import test from "node:test";
import {
  createLegacyServerSessionResolver,
  type LegacyServerSessionDependencies,
} from "./legacy-server-session";
import {
  ANONYMOUS_SERVER_SESSION,
  UNAVAILABLE_SERVER_SESSION,
} from "./server-session-contract";

const LEGACY_SESSION = {
  user: {
    id: "user-1",
    email: "user@example.invalid",
    name: "untrusted legacy display name",
    firstName: "Current",
    lastName: "User",
    role: "CUSTOMER",
    requiresEmailVerification: false,
    internalOnly: "never-project",
    sid: "never-project-sid",
    token: "never-project-token",
    secret: "never-project-secret",
  },
  expires: "2099-01-01T00:00:00.000Z",
};

function createHarness(
  overrides: Partial<LegacyServerSessionDependencies> = {},
) {
  const reports: unknown[] = [];
  const dependencies: LegacyServerSessionDependencies = {
    async read() {
      return LEGACY_SESSION;
    },
    report(event) {
      reports.push(event);
    },
    ...overrides,
  };
  return { resolver: createLegacyServerSessionResolver(dependencies), reports };
}

test("legacy adapter projects only one frozen normalized principal", async () => {
  const harness = createHarness();
  const resolution = await harness.resolver.resolve();

  assert.deepEqual(resolution, {
    status: "authenticated",
    principal: {
      id: "user-1",
      email: "user@example.invalid",
      firstName: "Current",
      lastName: "User",
      name: "Current User",
      role: "CUSTOMER",
      requiresEmailVerification: false,
    },
  });
  assert.equal(Object.isFrozen(resolution), true);
  if (resolution.status === "authenticated") {
    assert.equal(Object.isFrozen(resolution.principal), true);
    assert.deepEqual(Object.keys(resolution.principal).sort(), [
      "email",
      "firstName",
      "id",
      "lastName",
      "name",
      "requiresEmailVerification",
      "role",
    ]);
    assert.equal("expires" in resolution.principal, false);
    assert.equal("internalOnly" in resolution.principal, false);
    assert.equal("sid" in resolution.principal, false);
    assert.equal("token" in resolution.principal, false);
    assert.equal("secret" in resolution.principal, false);
  }
  assert.equal(JSON.stringify(resolution).includes("never-project"), false);
  assert.deepEqual(harness.reports, []);
});

test("exact null is anonymous without an outage report", async () => {
  const harness = createHarness({
    async read() {
      return null;
    },
  });

  assert.equal(await harness.resolver.resolve(), ANONYMOUS_SERVER_SESSION);
  assert.deepEqual(harness.reports, []);
});

test("each resolve performs one fresh legacy read without cross-request caching", async () => {
  let reads = 0;
  const harness = createHarness({
    async read() {
      reads += 1;
      return {
        user: {
          ...LEGACY_SESSION.user,
          firstName: reads === 1 ? "Before" : "After",
        },
      };
    },
  });

  const first = await harness.resolver.resolve();
  const second = await harness.resolver.resolve();

  assert.equal(reads, 2);
  assert.equal(
    first.status === "authenticated" ? first.principal.firstName : null,
    "Before",
  );
  assert.equal(
    second.status === "authenticated" ? second.principal.firstName : null,
    "After",
  );
  assert.deepEqual(harness.reports, []);
});

test("read failures are unavailable and expose only a coarse report", async () => {
  for (const read of [
    async () => {
      throw new Error("private legacy session failure");
    },
    async () =>
      new Proxy(
        {},
        {
          get(): never {
            throw new Error("private thenable failure");
          },
        },
      ),
  ]) {
    const harness = createHarness({ read });
    const resolution = await harness.resolver.resolve();

    assert.equal(resolution, UNAVAILABLE_SERVER_SESSION);
    assert.deepEqual(harness.reports, [{ stage: "LEGACY_SESSION_READ" }]);
    assert.equal(JSON.stringify(resolution).includes("private"), false);
  }
});

test("malformed legacy profiles fail closed and never become anonymous", async () => {
  const throwingSessionUser = Object.defineProperty({}, "user", {
    get(): never {
      throw new Error("private session getter failure");
    },
  });
  const malformed: unknown[] = [
    undefined,
    {},
    { user: null },
    { user: [] },
    { user: { ...LEGACY_SESSION.user, id: "" } },
    { user: { ...LEGACY_SESSION.user, email: " padded@example.invalid " } },
    { user: { ...LEGACY_SESSION.user, firstName: "Bad\nName" } },
    { user: { ...LEGACY_SESSION.user, lastName: 42 } },
    { user: { ...LEGACY_SESSION.user, role: "SUPERADMIN" } },
    {
      user: {
        ...LEGACY_SESSION.user,
        requiresEmailVerification: "false",
      },
    },
    throwingSessionUser,
    {
      get user(): never {
        throw new Error("must not execute top-level user accessor");
      },
    },
    {
      user: Object.create(LEGACY_SESSION.user),
    },
    {
      user: new Proxy(
        {},
        {
          get(): never {
            throw new Error("private user getter failure");
          },
        },
      ),
    },
  ];

  for (const value of malformed) {
    const harness = createHarness({
      async read() {
        return value;
      },
    });

    assert.equal(await harness.resolver.resolve(), UNAVAILABLE_SERVER_SESSION);
    assert.deepEqual(harness.reports, [{ stage: "LEGACY_SESSION_SHAPE" }]);
  }
});

test("a Proxy revoked during Promise resolution remains fail closed", async () => {
  let revoke = () => {};
  const revocable = Proxy.revocable(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          revoke();
          return undefined;
        }
        return undefined;
      },
    },
  );
  revoke = revocable.revoke;
  const harness = createHarness({
    async read() {
      return revocable.proxy;
    },
  });

  assert.equal(await harness.resolver.resolve(), UNAVAILABLE_SERVER_SESSION);
  assert.deepEqual(harness.reports, [{ stage: "LEGACY_SESSION_SHAPE" }]);
});

test("properties are read once before the principal is projected", async () => {
  const reads = new Map<string, number>();
  const user = new Proxy(LEGACY_SESSION.user, {
    getOwnPropertyDescriptor(target, property) {
      const key = String(property);
      reads.set(key, (reads.get(key) ?? 0) + 1);
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  const harness = createHarness({
    async read() {
      return { user };
    },
  });

  const resolution = await harness.resolver.resolve();

  assert.equal(resolution.status, "authenticated");
  for (const property of [
    "id",
    "email",
    "firstName",
    "lastName",
    "role",
    "requiresEmailVerification",
  ]) {
    assert.equal(reads.get(property), 1, property);
  }
  assert.equal(reads.has("name"), false);
  assert.equal(reads.has("sid"), false);
  assert.equal(reads.has("token"), false);
  assert.equal(reads.has("secret"), false);
  assert.deepEqual(harness.reports, []);
});

test("ignored accessors are never executed", async () => {
  const user = {
    ...LEGACY_SESSION.user,
    get name(): never {
      throw new Error("untrusted display accessor");
    },
    get unknown(): never {
      throw new Error("untrusted unknown accessor");
    },
  };
  const harness = createHarness({
    async read() {
      return { user };
    },
  });

  const resolution = await harness.resolver.resolve();

  assert.equal(resolution.status, "authenticated");
  assert.deepEqual(harness.reports, []);
});

test("reporter exceptions never alter an unavailable result", async () => {
  const resolver = createLegacyServerSessionResolver({
    async read() {
      throw new Error("private read failure");
    },
    report() {
      throw new Error("private reporter failure");
    },
  });

  assert.equal(await resolver.resolve(), UNAVAILABLE_SERVER_SESSION);
  assert.equal(Object.isFrozen(ANONYMOUS_SERVER_SESSION), true);
  assert.equal(Object.isFrozen(UNAVAILABLE_SERVER_SESSION), true);
});

test("a throwing report property getter never escapes the resolver", async () => {
  const dependencies = {
    async read() {
      return undefined;
    },
    get report(): never {
      throw new Error("private report getter failure");
    },
  } satisfies LegacyServerSessionDependencies;
  const resolver = createLegacyServerSessionResolver(dependencies);

  assert.equal(await resolver.resolve(), UNAVAILABLE_SERVER_SESSION);
});

test("rejected async reporters are absorbed without changing the result", async () => {
  const resolver = createLegacyServerSessionResolver({
    async read() {
      return undefined;
    },
    async report() {
      throw new Error("private async reporter failure");
    },
  });

  assert.equal(await resolver.resolve(), UNAVAILABLE_SERVER_SESSION);
  await new Promise<void>((resolve) => setImmediate(resolve));
});
