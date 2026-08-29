import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const DEFAULT_SMTP_PORT = 587;

type SmtpEnvironment = Readonly<Record<string, string | undefined>>;

function firstNonEmpty(
  env: SmtpEnvironment,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function firstNonBlankValue(
  env: SmtpEnvironment,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value?.trim()) return value;
  }
  return undefined;
}

function resolveSmtpPort(env: SmtpEnvironment): number {
  const rawPort = firstNonEmpty(env, ["SMTP_SERVER_PORT", "SMTP_PORT"]);
  if (!rawPort) return DEFAULT_SMTP_PORT;

  if (!/^\d+$/.test(rawPort)) {
    throw new Error("SMTP port mora biti ceo broj između 1 i 65535.");
  }

  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP port mora biti ceo broj između 1 i 65535.");
  }

  return port;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized === "::ffff:127.0.0.1"
  );
}

function resolveRejectUnauthorized(
  env: SmtpEnvironment,
  host: string,
): boolean {
  const configured = env.SMTP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  if (!configured || configured === "true") return true;

  if (configured !== "false") {
    throw new Error(
      "SMTP_TLS_REJECT_UNAUTHORIZED mora biti postavljen na true ili false.",
    );
  }

  if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
    throw new Error(
      "SMTP_TLS_REJECT_UNAUTHORIZED=false je dozvoljen samo u development/test okruženju.",
    );
  }

  if (!isLoopbackHost(host)) {
    throw new Error(
      "SMTP_TLS_REJECT_UNAUTHORIZED=false je dozvoljen samo za lokalni loopback SMTP host.",
    );
  }

  return false;
}

/**
 * Resolve one fail-closed SMTP policy for every email sender.
 * Port 465 uses implicit TLS; every other port must successfully negotiate
 * STARTTLS before credentials or message content are sent.
 */
export function resolveSmtpTransportOptions(
  env: SmtpEnvironment = process.env,
): SMTPTransport.Options {
  const port = resolveSmtpPort(env);
  const secure = port === 465;
  const host = firstNonEmpty(env, [
    "SMTP_SERVER_HOST",
    "SMTP_SERVER",
    "SMTP_HOST",
  ]);
  const user = firstNonEmpty(env, ["SMTP_SERVER_USERNAME", "SMTP_USER"]);
  const pass = firstNonBlankValue(env, [
    "SMTP_SERVER_PASSWORD",
    "SMTP_PASS",
  ]);

  if (!host) {
    throw new Error("SMTP host mora biti podešen.");
  }

  if (!user || !pass) {
    throw new Error(
      "SMTP korisničko ime i lozinka moraju biti podešeni.",
    );
  }

  return {
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: resolveRejectUnauthorized(env, host),
      minVersion: "TLSv1.2",
    },
  };
}

export function createSmtpTransport() {
  return nodemailer.createTransport(resolveSmtpTransportOptions(process.env));
}
