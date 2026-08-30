import { randomInt } from "node:crypto";

export const REGISTRATION_PRIVATE_RESPONSE_FLOOR_MS = 900;
export const REGISTRATION_PRIVATE_RESPONSE_JITTER_MS = 200;

interface RegistrationResponseTimingDependencies {
  now: () => number;
  randomJitter: () => number;
  wait: (milliseconds: number) => Promise<void>;
}

const defaultDependencies: RegistrationResponseTimingDependencies = {
  now: () => performance.now(),
  randomJitter: () =>
    randomInt(REGISTRATION_PRIVATE_RESPONSE_JITTER_MS + 1),
  wait: (milliseconds) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
};

/**
 * Pads valid account-dependent registration responses to a common randomized
 * floor. This narrows practical email-enumeration timing differences between
 * the successful INSERT path and the unique-conflict lookup path. It is a
 * defense in depth until account work can move to a durable queue.
 */
export async function protectRegistrationResponseTiming(
  startedAt: number,
  dependencies: RegistrationResponseTimingDependencies = defaultDependencies,
): Promise<void> {
  const finishedAt = dependencies.now();
  const jitter = dependencies.randomJitter();
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(finishedAt) ||
    !Number.isInteger(jitter) ||
    jitter < 0 ||
    jitter > REGISTRATION_PRIVATE_RESPONSE_JITTER_MS
  ) {
    throw new Error("Invalid registration response timing input");
  }

  const remaining =
    REGISTRATION_PRIVATE_RESPONSE_FLOOR_MS +
    jitter -
    Math.max(0, finishedAt - startedAt);
  if (remaining > 0) await dependencies.wait(remaining);
}
