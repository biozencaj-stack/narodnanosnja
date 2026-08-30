import assert from "node:assert/strict";
import test from "node:test";
import type { ServerSessionResolution } from "../auth/server-session-contract";
import {
  CHECKOUT_DATA_PRIVATE_HEADERS,
  CHECKOUT_DATA_UNAVAILABLE_MESSAGE,
  createCheckoutDataGetHandler,
  type CheckoutDataFailure,
  type CheckoutDataHandlerDependencies,
  type CheckoutDataRecord,
} from "./checkout-data-route";

const PRINCIPAL = Object.freeze({
  id: "user-1",
  email: "session@example.test",
  firstName: "Session",
  lastName: "Profile",
  name: "Session Profile",
  role: "CUSTOMER" as const,
  requiresEmailVerification: false,
});

const AUTHENTICATED = Object.freeze({
  status: "authenticated" as const,
  principal: PRINCIPAL,
});

const DEFAULT_ADDRESS = Object.freeze({
  street: "Knez Mihailova 1",
  apartment: "5",
  city: "Beograd",
  postalCode: "11000",
  country: "Srbija",
});

const ADAPTER_ADDRESS_WITH_PRIVATE_FIELDS = Object.freeze({
  ...DEFAULT_ADDRESS,
  internalNote: "PII-LEAK",
  userId: "private-user-id",
  toJSON: () => ({
    ...DEFAULT_ADDRESS,
    internalNote: "PII-LEAK",
    userId: "private-user-id",
  }),
});

const USER: CheckoutDataRecord = Object.freeze({
  id: "user-1",
  email: "fresh@example.test",
  firstName: "Sveže",
  lastName: "Ime",
  phone: "+381601234567",
  addresses: Object.freeze([ADAPTER_ADDRESS_WITH_PRIVATE_FIELDS]),
});

interface Harness {
  dependencies: CheckoutDataHandlerDependencies;
  lookupIds: string[];
  reports: Readonly<CheckoutDataFailure>[];
}

function createHarness(
  overrides: Partial<CheckoutDataHandlerDependencies> = {},
): Harness {
  const lookupIds: string[] = [];
  const reports: Readonly<CheckoutDataFailure>[] = [];
  return {
    lookupIds,
    reports,
    dependencies: {
      resolveSession: async () => AUTHENTICATED,
      findUserById: async (userId) => {
        lookupIds.push(userId);
        return USER;
      },
      reportFailure: (failure) => {
        reports.push(failure);
      },
      ...overrides,
    },
  };
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

function assertPrivate(response: Response): void {
  for (const [name, value] of Object.entries(CHECKOUT_DATA_PRIVATE_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
}

test("anonymous and unavailable sessions stay distinct and never query a user", async () => {
  for (const fixture of [
    {
      resolution: Object.freeze({ status: "anonymous" as const }),
      status: 401,
      body: { error: "Unauthorized" },
    },
    {
      resolution: Object.freeze({ status: "unavailable" as const }),
      status: 503,
      body: { error: CHECKOUT_DATA_UNAVAILABLE_MESSAGE },
    },
  ]) {
    const harness = createHarness({
      resolveSession: async () => fixture.resolution,
    });
    const response = await createCheckoutDataGetHandler(
      harness.dependencies,
    )();

    assert.equal(response.status, fixture.status);
    assert.deepEqual(await json(response), fixture.body);
    assert.deepEqual(harness.lookupIds, []);
    assert.deepEqual(harness.reports, []);
    assertPrivate(response);
  }
});

test("authenticated lookup uses only the principal id and returns fresh database profile", async () => {
  const harness = createHarness();
  const response = await createCheckoutDataGetHandler(harness.dependencies)();

  assert.equal(response.status, 200);
  assert.deepEqual(harness.lookupIds, [PRINCIPAL.id]);
  assert.deepEqual(harness.reports, []);
  assert.deepEqual(await json(response), {
    user: {
      email: USER.email,
      firstName: USER.firstName,
      lastName: USER.lastName,
      phone: USER.phone,
    },
    defaultAddress: DEFAULT_ADDRESS,
  });
  assertPrivate(response);
});

test("the same handler resolves the session and database profile for every request", async () => {
  let sessionReads = 0;
  const harness = createHarness({
    resolveSession: async () => {
      sessionReads += 1;
      return AUTHENTICATED;
    },
  });
  const handler = createCheckoutDataGetHandler(harness.dependencies);

  const firstResponse = await handler();
  const secondResponse = await handler();

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.equal(sessionReads, 2);
  assert.deepEqual(harness.lookupIds, [PRINCIPAL.id, PRINCIPAL.id]);
  assert.deepEqual(harness.reports, []);
  assertPrivate(firstResponse);
  assertPrivate(secondResponse);
});

test("an authenticated user without a default address returns explicit null", async () => {
  const harness = createHarness({
    findUserById: async (userId) => {
      assert.equal(userId, PRINCIPAL.id);
      return Object.freeze({ ...USER, addresses: Object.freeze([]) });
    },
  });
  const response = await createCheckoutDataGetHandler(harness.dependencies)();

  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), {
    user: {
      email: USER.email,
      firstName: USER.firstName,
      lastName: USER.lastName,
      phone: USER.phone,
    },
    defaultAddress: null,
  });
  assertPrivate(response);
});

test("a missing database user preserves the existing private 404 contract", async () => {
  const harness = createHarness({ findUserById: async () => null });
  const response = await createCheckoutDataGetHandler(harness.dependencies)();

  assert.equal(response.status, 404);
  assert.deepEqual(await json(response), { error: "User not found" });
  assertPrivate(response);
});

test("resolver failures and malformed results become coarse 503 without a lookup", async () => {
  const fixtures: Array<() => Promise<ServerSessionResolution>> = [
    async () => {
      throw new Error("secret session failure");
    },
    async () =>
      ({ status: "authenticated", principal: null }) as unknown as ServerSessionResolution,
  ];

  for (const resolveSession of fixtures) {
    const harness = createHarness({ resolveSession });
    const response = await createCheckoutDataGetHandler(
      harness.dependencies,
    )();

    assert.equal(response.status, 503);
    assert.deepEqual(await json(response), {
      error: CHECKOUT_DATA_UNAVAILABLE_MESSAGE,
    });
    assert.deepEqual(harness.lookupIds, []);
    assert.deepEqual(harness.reports, [{ stage: "SESSION" }]);
    assertPrivate(response);
  }
});

test("lookup and reporter failures remain a coarse private 500", async () => {
  const reports: Readonly<CheckoutDataFailure>[] = [];
  const handler = createCheckoutDataGetHandler({
    resolveSession: async () => AUTHENTICATED,
    findUserById: async () => {
      throw new Error("secret database failure for user-1");
    },
    reportFailure: (failure) => {
      reports.push(failure);
      throw new Error("reporter unavailable");
    },
  });
  const response = await handler();

  assert.equal(response.status, 500);
  assert.deepEqual(await json(response), { error: "Internal server error" });
  assert.deepEqual(reports, [{ stage: "LOOKUP" }]);
  assertPrivate(response);
});

test("an asynchronously rejected reporter cannot replace session unavailability", async () => {
  const handler = createCheckoutDataGetHandler({
    resolveSession: async () => {
      throw new Error("secret session failure");
    },
    findUserById: async () => {
      throw new Error("must not run");
    },
    reportFailure: async () => {
      throw new Error("async reporter unavailable");
    },
  });
  const response = await handler();

  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), {
    error: CHECKOUT_DATA_UNAVAILABLE_MESSAGE,
  });
  assertPrivate(response);
});
