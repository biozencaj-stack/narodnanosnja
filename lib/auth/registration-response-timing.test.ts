import assert from "node:assert/strict";
import test from "node:test";
import {
  REGISTRATION_PRIVATE_RESPONSE_FLOOR_MS,
  protectRegistrationResponseTiming,
} from "./registration-response-timing";

test("registration timing protection waits only for the remaining private window", async () => {
  const waits: number[] = [];

  await protectRegistrationResponseTiming(100, {
    now: () => 350,
    randomJitter: () => 75,
    async wait(milliseconds) {
      waits.push(milliseconds);
    },
  });

  assert.deepEqual(waits, [
    REGISTRATION_PRIVATE_RESPONSE_FLOOR_MS + 75 - 250,
  ]);
});

test("registration timing protection never adds delay after the floor", async () => {
  let waited = false;

  await protectRegistrationResponseTiming(100, {
    now: () => 1_500,
    randomJitter: () => 0,
    async wait() {
      waited = true;
    },
  });

  assert.equal(waited, false);
});

test("registration timing protection rejects invalid entropy", async () => {
  await assert.rejects(
    protectRegistrationResponseTiming(100, {
      now: () => 200,
      randomJitter: () => Number.NaN,
      async wait() {
        throw new Error("must not wait");
      },
    }),
    /Invalid registration response timing input/,
  );
});
