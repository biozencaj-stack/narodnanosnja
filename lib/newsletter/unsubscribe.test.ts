import assert from "node:assert/strict";
import test from "node:test";
import {
  NewsletterUnsubscribeConfigurationError,
  createNewsletterUnsubscribeToken,
  createNewsletterUnsubscribeUrl,
  unsubscribeNewsletterWithToken,
  verifyNewsletterUnsubscribeToken,
} from "./unsubscribe";

const NEXTAUTH_SECRET = "nextauth-secret-with-at-least-32-bytes";
const DEDICATED_SECRET = "newsletter-secret-with-at-least-32-bytes";
const ROTATED_SECRET = "rotated-newsletter-secret-at-least-32";

test("token creation fails closed without a strong signing secret", () => {
  assert.throws(
    () => createNewsletterUnsubscribeToken("kupac@example.com", {}),
    NewsletterUnsubscribeConfigurationError,
  );
  assert.throws(
    () =>
      createNewsletterUnsubscribeToken("kupac@example.com", {
        NEXTAUTH_SECRET: "prekratko",
      }),
    NewsletterUnsubscribeConfigurationError,
  );
});

test("a configured weak dedicated secret never silently falls back", () => {
  assert.throws(
    () =>
      createNewsletterUnsubscribeToken("kupac@example.com", {
        NEWSLETTER_UNSUBSCRIBE_SECRET: "prekratko",
        NEXTAUTH_SECRET,
      }),
    NewsletterUnsubscribeConfigurationError,
  );
});

test("a strong NEXTAUTH_SECRET remains compatible when no dedicated secret exists", () => {
  const environment = { NEXTAUTH_SECRET };
  const token = createNewsletterUnsubscribeToken(
    "  KUPAC@Example.COM ",
    environment,
  );

  assert.equal(
    verifyNewsletterUnsubscribeToken(
      "kupac@example.com",
      token,
      environment,
    ),
    "kupac@example.com",
  );
});

test("dedicated secret signs new links and accepts strong NEXTAUTH legacy tokens", () => {
  const legacyToken = createNewsletterUnsubscribeToken("kupac@example.com", {
    NEXTAUTH_SECRET,
  });
  const environment = {
    NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET,
    NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY: "true",
    NEXTAUTH_SECRET,
  };
  const currentToken = createNewsletterUnsubscribeToken(
    "kupac@example.com",
    environment,
  );

  assert.notEqual(currentToken, legacyToken);
  assert.equal(
    verifyNewsletterUnsubscribeToken(
      "kupac@example.com",
      currentToken,
      environment,
    ),
    "kupac@example.com",
  );
  assert.equal(
    verifyNewsletterUnsubscribeToken(
      "kupac@example.com",
      legacyToken,
      environment,
    ),
    "kupac@example.com",
  );
});

test("NEXTAUTH legacy verification is disabled by default and can be sunset", () => {
  const legacyToken = createNewsletterUnsubscribeToken("kupac@example.com", {
    NEXTAUTH_SECRET,
  });

  for (const configuredValue of [undefined, "false"]) {
    assert.equal(
      verifyNewsletterUnsubscribeToken("kupac@example.com", legacyToken, {
        NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET,
        NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY: configuredValue,
        NEXTAUTH_SECRET,
      }),
      null,
    );
  }
});

test("invalid legacy migration flag fails closed", () => {
  assert.throws(
    () =>
      createNewsletterUnsubscribeToken("kupac@example.com", {
        NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET,
        NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY: "da",
        NEXTAUTH_SECRET,
      }),
    NewsletterUnsubscribeConfigurationError,
  );
});

test("weak NEXTAUTH legacy secret is ignored when the dedicated secret is strong", () => {
  const environment = {
    NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET,
    NEXTAUTH_SECRET: "prekratko",
  };
  const token = createNewsletterUnsubscribeToken(
    "kupac@example.com",
    environment,
  );

  assert.equal(
    verifyNewsletterUnsubscribeToken(
      "kupac@example.com",
      token,
      environment,
    ),
    "kupac@example.com",
  );
});

test("malformed, wrong and rotated tokens are rejected", () => {
  const originalEnvironment = {
    NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET,
  };
  const token = createNewsletterUnsubscribeToken(
    "kupac@example.com",
    originalEnvironment,
  );

  assert.equal(
    verifyNewsletterUnsubscribeToken(
      "kupac@example.com",
      "not-a-token",
      originalEnvironment,
    ),
    null,
  );
  assert.equal(
    verifyNewsletterUnsubscribeToken(
      "drugi@example.com",
      token,
      originalEnvironment,
    ),
    null,
  );
  assert.equal(
    verifyNewsletterUnsubscribeToken("kupac@example.com", token, {
      NEWSLETTER_UNSUBSCRIBE_SECRET: ROTATED_SECRET,
    }),
    null,
  );
});

test("URL builder emits the canonical confirmation path and a valid token", () => {
  const environment = { NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET };
  const result = new URL(
    createNewsletterUnsubscribeUrl(
      new URL("https://narodnanosnja.rs/stara-putanja"),
      " KUPAC+vesti@Example.COM ",
      environment,
    ),
  );

  assert.equal(result.origin, "https://narodnanosnja.rs");
  assert.equal(result.pathname, "/newsletter/odjava");
  assert.equal(result.searchParams.get("email"), "kupac+vesti@example.com");
  assert.equal(
    verifyNewsletterUnsubscribeToken(
      result.searchParams.get("email"),
      result.searchParams.get("token"),
      environment,
    ),
    "kupac+vesti@example.com",
  );
});

test("missing or invalid authorization never invokes the deactivation callback", async () => {
  let calls = 0;
  const deactivate = async () => {
    calls += 1;
  };
  const environment = { NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET };

  const missingToken = await unsubscribeNewsletterWithToken(
    { email: "kupac@example.com", token: undefined },
    deactivate,
    environment,
  );
  const invalidToken = await unsubscribeNewsletterWithToken(
    { email: "kupac@example.com", token: "0".repeat(32) },
    deactivate,
    environment,
  );

  assert.equal(missingToken, false);
  assert.equal(invalidToken, false);
  assert.equal(calls, 0);
});

test("valid authorization invokes deactivation once with normalized email", async () => {
  const environment = { NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET };
  const token = createNewsletterUnsubscribeToken(
    "kupac@example.com",
    environment,
  );
  const emails: string[] = [];

  const authorized = await unsubscribeNewsletterWithToken(
    { email: " KUPAC@EXAMPLE.COM ", token },
    async (email) => {
      emails.push(email);
    },
    environment,
  );

  assert.equal(authorized, true);
  assert.deepEqual(emails, ["kupac@example.com"]);
});

test("deactivation failures propagate and a retry remains possible", async () => {
  const environment = { NEWSLETTER_UNSUBSCRIBE_SECRET: DEDICATED_SECRET };
  const token = createNewsletterUnsubscribeToken(
    "kupac@example.com",
    environment,
  );
  let attempts = 0;
  const deactivate = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("privremena greska baze");
  };

  await assert.rejects(
    unsubscribeNewsletterWithToken(
      { email: "kupac@example.com", token },
      deactivate,
      environment,
    ),
    /privremena greska baze/,
  );
  assert.equal(
    await unsubscribeNewsletterWithToken(
      { email: "kupac@example.com", token },
      deactivate,
      environment,
    ),
    true,
  );
  assert.equal(attempts, 2);
});
