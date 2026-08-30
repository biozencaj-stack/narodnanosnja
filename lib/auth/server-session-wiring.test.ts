import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const STATE_KEY = "__serverSessionWiringTestState";
const authOptions = Object.freeze({ testMarker: "exact-auth-options" });
const calls: unknown[][] = [];
const legacyResults: unknown[] = [
  {
    user: {
      id: "wired-user",
      email: "wired@example.invalid",
      firstName: "Wired",
      lastName: "Reader",
      role: "CUSTOMER",
      requiresEmailVerification: false,
    },
  },
  null,
];

Object.assign(globalThis, {
  [STATE_KEY]: {
    authOptions,
    async getServerSession(...args: unknown[]) {
      calls.push(args);
      return legacyResults.shift();
    },
  },
});

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "mock:server-only", shortCircuit: true };
    }
    if (
      specifier === "next-auth" &&
      context.parentURL?.endsWith("/lib/auth/server-session.ts")
    ) {
      return { url: "mock:next-auth", shortCircuit: true };
    }
    if (
      specifier === "./index" &&
      context.parentURL?.endsWith("/lib/auth/server-session.ts")
    ) {
      return { url: "mock:auth-index", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "mock:server-only") {
      return { format: "module", source: "export {};", shortCircuit: true };
    }
    if (url === "mock:next-auth") {
      return {
        format: "module",
        source: `export const getServerSession = (...args) => globalThis.${STATE_KEY}.getServerSession(...args);`,
        shortCircuit: true,
      };
    }
    if (url === "mock:auth-index") {
      return {
        format: "module",
        source: `export const authOptions = globalThis.${STATE_KEY}.authOptions;`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

test("production facade passes the exact authOptions object to its sole legacy reader", async () => {
  const { resolveServerSession } = await import("./server-session");

  const authenticated = await resolveServerSession();
  const anonymous = await resolveServerSession();

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.length, 1);
    assert.equal(call[0], authOptions);
  }
  assert.deepEqual(authenticated, {
    status: "authenticated",
    principal: {
      id: "wired-user",
      email: "wired@example.invalid",
      firstName: "Wired",
      lastName: "Reader",
      name: "Wired Reader",
      role: "CUSTOMER",
      requiresEmailVerification: false,
    },
  });
  assert.deepEqual(anonymous, { status: "anonymous" });
});
