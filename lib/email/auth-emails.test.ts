import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import nodemailer from "nodemailer";

// Next.js treats this marker as a compile-time boundary. The standalone Node
// test runner does not resolve it, so provide a no-op module only in this test
// worker before loading the server email module.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "mock:server-only", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "mock:server-only") {
      return {
        format: "commonjs",
        source: "module.exports = {};",
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const TOKEN = "a".repeat(64);

test("prepared verification email escapes HTML and sends only when invoked", async (t) => {
  const previousEnvironment = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SMTP_SERVER_HOST: process.env.SMTP_SERVER_HOST,
    SMTP_SERVER_USERNAME: process.env.SMTP_SERVER_USERNAME,
    SMTP_SERVER_PASSWORD: process.env.SMTP_SERVER_PASSWORD,
  };
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";
  process.env.SMTP_SERVER_HOST = "smtp.example.com";
  process.env.SMTP_SERVER_USERNAME = "mailer@example.com";
  process.env.SMTP_SERVER_PASSWORD = "test-password";

  t.after(() => {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const deliveries: Array<Record<string, unknown>> = [];
  t.mock.method(
    nodemailer,
    "createTransport",
    () =>
      ({
        sendMail: async (mailOptions: Record<string, unknown>) => {
          deliveries.push(mailOptions);
        },
      }) as never,
  );

  const { prepareVerificationEmail } = await import("./auth-emails");
  const deliver = prepareVerificationEmail(
    "customer@example.com",
    '<img src=x onerror="alert(1)"> O\'Reilly & partneri',
    TOKEN,
  );

  assert.equal(deliveries.length, 0);

  await deliver();

  assert.equal(deliveries.length, 1);
  assert.deepEqual(deliveries[0].to, {
    name: "",
    address: "customer@example.com",
  });
  const html = String(deliveries[0].html);
  const text = String(deliveries[0].text);
  assert.match(
    html,
    /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; O&#39;Reilly &amp; partneri/,
  );
  assert.doesNotMatch(html, /<img src=x onerror=/);
  assert.match(
    html,
    new RegExp(`href="https://shop\\.example\\.com/verify-email/${TOKEN}"`),
  );
  assert.match(
    text,
    /<img src=x onerror="alert\(1\)"> O'Reilly & partneri/,
  );

  assert.throws(
    () =>
      prepareVerificationEmail(
        "group:customer@example.com;",
        "Kupac",
        TOKEN,
      ),
    /recipient is invalid/,
  );
  assert.equal(deliveries.length, 1);
});
