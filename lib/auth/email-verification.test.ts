import assert from "node:assert/strict";
import test from "node:test";
import { prepareVerificationSuccessBeforeCommit } from "./email-verification";

test("verification prepares the complete response before committing user mutations", async () => {
  const calls: string[] = [];

  const response = await prepareVerificationSuccessBeforeCommit(
    async () => {
      calls.push("session");
      return "signed-session";
    },
    async (sessionToken) => {
      calls.push("response");
      return { sessionToken };
    },
    async () => {
      calls.push("commit");
    },
  );

  assert.deepEqual(response, { sessionToken: "signed-session" });
  assert.deepEqual(calls, ["session", "response", "commit"]);
});

test("verification never mutates the database when session encoding fails", async () => {
  let prepared = false;
  let committed = false;

  await assert.rejects(
    prepareVerificationSuccessBeforeCommit(
      async () => {
        throw new Error("encode failed");
      },
      async () => {
        prepared = true;
        return "response";
      },
      async () => {
        committed = true;
      },
    ),
    /encode failed/,
  );

  assert.equal(prepared, false);
  assert.equal(committed, false);
});

test("verification never mutates the database when response preparation fails", async () => {
  let committed = false;

  await assert.rejects(
    prepareVerificationSuccessBeforeCommit(
      async () => "signed-session",
      async () => {
        throw new Error("response failed");
      },
      async () => {
        committed = true;
      },
    ),
    /response failed/,
  );

  assert.equal(committed, false);
});

test("verification does not return a response when the atomic commit fails", async () => {
  await assert.rejects(
    prepareVerificationSuccessBeforeCommit(
      async () => "signed-session",
      async () => "prepared-response",
      async () => {
        throw new Error("commit failed");
      },
    ),
    /commit failed/,
  );
});
