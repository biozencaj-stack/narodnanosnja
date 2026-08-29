import assert from "node:assert/strict";
import test from "node:test";

import { resolveSmtpTransportOptions } from "./smtp";

const BASE_ENV = {
  NODE_ENV: "production",
  SMTP_SERVER_HOST: "smtp.example.com",
  SMTP_SERVER_USERNAME: "mailer@example.com",
  SMTP_SERVER_PASSWORD: "test-password",
} as const;

test("SMTP uses verified mandatory STARTTLS by default", () => {
  const options = resolveSmtpTransportOptions(BASE_ENV);

  assert.equal(options.host, "smtp.example.com");
  assert.equal(options.port, 587);
  assert.equal(options.secure, false);
  assert.equal(options.requireTLS, true);
  assert.deepEqual(options.auth, {
    user: "mailer@example.com",
    pass: "test-password",
  });
  assert.deepEqual(options.tls, {
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
});

test("SMTP port 465 uses implicit TLS instead of STARTTLS", () => {
  const options = resolveSmtpTransportOptions({
    ...BASE_ENV,
    SMTP_SERVER_PORT: "465",
  });

  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.requireTLS, false);
  assert.equal(options.tls?.rejectUnauthorized, true);
});

test("untrusted SMTP certificates can be enabled only for local development or tests", () => {
  for (const nodeEnv of ["development", "test"] as const) {
    const options = resolveSmtpTransportOptions({
      ...BASE_ENV,
      NODE_ENV: nodeEnv,
      SMTP_SERVER_HOST: "localhost",
      SMTP_TLS_REJECT_UNAUTHORIZED: "false",
    });
    assert.equal(options.tls?.rejectUnauthorized, false);
    assert.equal(options.requireTLS, true);
  }

  for (const nodeEnv of ["production", "staging", undefined] as const) {
    assert.throws(
      () =>
        resolveSmtpTransportOptions({
          ...BASE_ENV,
          NODE_ENV: nodeEnv,
          SMTP_TLS_REJECT_UNAUTHORIZED: "false",
        }),
      /development\/test/,
    );
  }

  assert.throws(
    () =>
      resolveSmtpTransportOptions({
        ...BASE_ENV,
        NODE_ENV: "development",
        SMTP_TLS_REJECT_UNAUTHORIZED: "false",
      }),
    /loopback/,
  );
});

test("invalid SMTP TLS flags and ports fail closed", () => {
  assert.throws(
    () =>
      resolveSmtpTransportOptions({
        ...BASE_ENV,
        SMTP_TLS_REJECT_UNAUTHORIZED: "yes",
      }),
    /true ili false/,
  );

  for (const port of ["0", "65536", "587.5", "587x"]) {
    assert.throws(
      () =>
        resolveSmtpTransportOptions({
          ...BASE_ENV,
          SMTP_SERVER_PORT: port,
        }),
      /1 i 65535/,
    );
  }
});

test("legacy SMTP aliases use the same TLS policy", () => {
  const options = resolveSmtpTransportOptions({
    NODE_ENV: "production",
    SMTP_HOST: "legacy.example.com",
    SMTP_PORT: "2525",
    SMTP_USER: "legacy-user",
    SMTP_PASS: "legacy-password",
  });

  assert.equal(options.host, "legacy.example.com");
  assert.equal(options.port, 2525);
  assert.equal(options.secure, false);
  assert.equal(options.requireTLS, true);
  assert.deepEqual(options.auth, {
    user: "legacy-user",
    pass: "legacy-password",
  });
});

test("missing SMTP host and credentials fail before creating a transporter", () => {
  for (const host of [undefined, "   "] as const) {
    assert.throws(
      () =>
        resolveSmtpTransportOptions({
          NODE_ENV: "production",
          SMTP_SERVER_HOST: host,
          SMTP_SERVER_USERNAME: "mailer@example.com",
          SMTP_SERVER_PASSWORD: "test-password",
        }),
      /SMTP host/,
    );
  }

  for (const credentials of [
    {},
    { SMTP_SERVER_USERNAME: "mailer@example.com" },
    { SMTP_SERVER_PASSWORD: "test-password" },
    {
      SMTP_SERVER_USERNAME: "mailer@example.com",
      SMTP_SERVER_PASSWORD: "   ",
    },
    {
      SMTP_SERVER_USERNAME: "   ",
      SMTP_SERVER_PASSWORD: "test-password",
    },
  ]) {
    assert.throws(
      () =>
        resolveSmtpTransportOptions({
          NODE_ENV: "production",
          SMTP_SERVER_HOST: "smtp.example.com",
          ...credentials,
        }),
      /moraju biti podešeni/,
    );
  }
});
