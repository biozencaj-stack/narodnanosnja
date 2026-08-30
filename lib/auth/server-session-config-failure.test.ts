import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const STATE_KEY = "__serverSessionConfigFailureTestState";

Object.assign(globalThis, {
  [STATE_KEY]: { legacyCalls: 0 },
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
      return { url: "mock:failing-auth-index", shortCircuit: true };
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
        source: `export const getServerSession = () => { globalThis.${STATE_KEY}.legacyCalls += 1; return null; };`,
        shortCircuit: true,
      };
    }
    if (url === "mock:failing-auth-index") {
      return {
        format: "module",
        source: `throw new Error("private auth configuration failure");`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

test("lazy authOptions evaluation failure becomes unavailable", async (t) => {
  const reports: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    reports.push(args);
  });
  const { resolveServerSession } = await import("./server-session");

  const resolution = await resolveServerSession();

  assert.deepEqual(resolution, { status: "unavailable" });
  assert.equal(
    (globalThis as typeof globalThis & {
      __serverSessionConfigFailureTestState: { legacyCalls: number };
    }).__serverSessionConfigFailureTestState.legacyCalls,
    0,
  );
  assert.deepEqual(reports, [
    [
      "Transitional server session unavailable",
      { stage: "LEGACY_SESSION_READ" },
    ],
  ]);
  assert.equal(JSON.stringify(reports).includes("private"), false);
});
