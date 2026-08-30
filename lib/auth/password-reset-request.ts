import type { Prisma, PrismaClient } from "@prisma/client";
import {
  hashCredentialToken,
  isCurrentCredentialTokenHash,
  normalizeRawCredentialToken,
} from "./credential-token";
import { normalizeEmailAddress } from "./email-address";

export const PASSWORD_RESET_ACCEPTED_MESSAGE =
  "Ako nalog postoji, uputstva za reset lozinke biće poslata na unetu email adresu.";
export const PASSWORD_RESET_UNAVAILABLE_MESSAGE =
  "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo.";

export const PASSWORD_RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export type PasswordResetFailureStage =
  | "LOOKUP"
  | "TOKEN_REPLACEMENT"
  | "DELIVERY"
  | "SCHEDULING"
  | "BACKGROUND";

export interface PasswordResetFailure {
  stage: PasswordResetFailureStage;
}

export interface PasswordResetUser {
  id: string;
  email: string;
  role: PasswordResetUserRole;
  /** Opaque PostgreSQL tuple revision used only for a short stale-read check. */
  rowVersion: string;
}

export const PASSWORD_RESET_USER_ROLES = [
  "CUSTOMER",
  "OPERATOR",
  "ADMIN",
] as const;
export type PasswordResetUserRole =
  (typeof PASSWORD_RESET_USER_ROLES)[number];

export interface PasswordResetTokenInput {
  expectedUser: PasswordResetUser;
  /** Temporary rollback-compatible plaintext copy; remove after the grace window. */
  legacyPlaintextToken: string;
  /** Preferred, versioned lookup value used by current application code. */
  tokenHash: string;
}

export interface PasswordResetRecipient {
  email: string;
  firstName: string;
}

export interface PasswordResetLockedUser extends PasswordResetUser {
  firstName: string;
}

export interface PasswordResetTokenWrite {
  userId: string;
  legacyPlaintextToken: string;
  tokenHash: string;
  expires: Date;
}

export interface PasswordResetRequestTransaction {
  /** The first persistence lock in the write transaction. */
  lockUserById: (userId: string) => Promise<PasswordResetLockedUser | null>;
  /** Must be read only after lockUserById has completed. */
  readDatabaseTime: () => Promise<Date>;
  replacePasswordReset: (input: PasswordResetTokenWrite) => Promise<void>;
}

export interface PasswordResetRequestDatabase {
  transaction: <T>(
    work: (transaction: PasswordResetRequestTransaction) => Promise<T>,
  ) => Promise<T>;
}

export interface PasswordResetRequestDependencies {
  findUserByEmail: (email: string) => Promise<PasswordResetUser | null>;
  generateToken: () => string;
  hashToken: (token: string) => string | null;
  replaceTokensForRequest: (
    input: PasswordResetTokenInput,
  ) => Promise<PasswordResetRecipient>;
  sendResetEmail: (
    email: string,
    firstName: string,
    token: string,
  ) => Promise<void>;
  reportFailure: (failure: PasswordResetFailure) => void;
}

export interface PasswordResetAcceptanceDependencies {
  schedule: (task: () => Promise<void>) => void;
  work: () => Promise<void>;
  reportFailure: (failure: PasswordResetFailure) => void;
}

export interface PasswordResetAcceptedResponse {
  status: 202;
  body: {
    message: typeof PASSWORD_RESET_ACCEPTED_MESSAGE;
  };
}

export interface PasswordResetUnavailableResponse {
  status: 503;
  body: {
    error: typeof PASSWORD_RESET_UNAVAILABLE_MESSAGE;
  };
}

export function normalizePasswordResetEmail(value: unknown): string | null {
  return normalizeEmailAddress(value);
}

function isPasswordResetUserRole(
  value: unknown,
): value is PasswordResetUserRole {
  return PASSWORD_RESET_USER_ROLES.some((role) => role === value);
}

function isValidUserSnapshot(value: PasswordResetUser): boolean {
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    normalizeEmailAddress(value.email) === value.email &&
    isPasswordResetUserRole(value.role) &&
    /^[0-9]+$/.test(value.rowVersion)
  );
}

export class PasswordResetRequestConflictError extends Error {
  constructor() {
    super("Password reset request snapshot conflict");
    this.name = "PasswordResetRequestConflictError";
  }
}

/**
 * Replaces one user's reset credential under the shared User-first lock.
 *
 * The PostgreSQL tuple revision closes the gap between the public lookup and
 * this transaction. Any intervening email, role, password or privileged
 * provisioning update changes xmin and makes the private request a no-op.
 */
export async function replacePasswordResetTokenForRequest(
  database: PasswordResetRequestDatabase,
  input: PasswordResetTokenInput,
): Promise<PasswordResetRecipient> {
  const normalizedToken = normalizeRawCredentialToken(
    input.legacyPlaintextToken,
  );
  const expectedTokenHash = hashCredentialToken(
    "password-reset",
    normalizedToken,
  );
  if (
    !isValidUserSnapshot(input.expectedUser) ||
    normalizedToken !== input.legacyPlaintextToken ||
    !isCurrentCredentialTokenHash(input.tokenHash) ||
    expectedTokenHash !== input.tokenHash
  ) {
    throw new PasswordResetRequestConflictError();
  }

  return database.transaction(async (transaction) => {
    const lockedUser = await transaction.lockUserById(input.expectedUser.id);
    if (
      !lockedUser ||
      !isValidUserSnapshot(lockedUser) ||
      typeof lockedUser.firstName !== "string" ||
      lockedUser.id !== input.expectedUser.id ||
      lockedUser.email !== input.expectedUser.email ||
      lockedUser.role !== input.expectedUser.role ||
      lockedUser.rowVersion !== input.expectedUser.rowVersion
    ) {
      throw new PasswordResetRequestConflictError();
    }

    // PostgreSQL time is sampled only after any User row-lock wait. Node's
    // wall clock is deliberately not part of credential validity.
    const issuedAt = await transaction.readDatabaseTime();
    const issuedAtMs =
      issuedAt instanceof Date ? issuedAt.getTime() : Number.NaN;
    const expires = new Date(issuedAtMs + PASSWORD_RESET_TOKEN_LIFETIME_MS);
    if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expires.getTime())) {
      throw new PasswordResetRequestConflictError();
    }

    await transaction.replacePasswordReset({
      userId: lockedUser.id,
      legacyPlaintextToken: input.legacyPlaintextToken,
      tokenHash: input.tokenHash,
      expires,
    });

    return {
      email: lockedUser.email,
      firstName: lockedUser.firstName,
    };
  });
}

export function passwordResetAcceptedResponse(): PasswordResetAcceptedResponse {
  return {
    status: 202,
    body: { message: PASSWORD_RESET_ACCEPTED_MESSAGE },
  };
}

function reportFailureSafely(
  reportFailure: (failure: PasswordResetFailure) => void,
  stage: PasswordResetFailureStage,
): void {
  try {
    reportFailure({ stage });
  } catch {
    // Observability must never turn an enumeration-safe response into an oracle.
  }
}

/**
 * Schedules all account-dependent work and returns the public response without
 * waiting for a lookup, token write, or SMTP delivery. The scheduler used by
 * the route is Next.js `after()`, not a durable queue; a process crash can still
 * lose scheduled work until a transactional outbox is introduced.
 */
export function acceptPasswordResetRequest(
  dependencies: PasswordResetAcceptanceDependencies,
): PasswordResetAcceptedResponse | PasswordResetUnavailableResponse {
  try {
    dependencies.schedule(async () => {
      try {
        await dependencies.work();
      } catch {
        reportFailureSafely(dependencies.reportFailure, "BACKGROUND");
      }
    });
  } catch {
    reportFailureSafely(dependencies.reportFailure, "SCHEDULING");
    return {
      status: 503,
      body: { error: PASSWORD_RESET_UNAVAILABLE_MESSAGE },
    };
  }

  return passwordResetAcceptedResponse();
}

/**
 * Performs the private account lookup, per-request atomic token replacement,
 * and email delivery. Every expected failure is reduced to a stage-only
 * observation.
 */
export async function processPasswordResetRequest(
  normalizedEmail: string,
  dependencies: PasswordResetRequestDependencies,
): Promise<void> {
  let user: PasswordResetUser | null;

  try {
    user = await dependencies.findUserByEmail(normalizedEmail);
  } catch {
    reportFailureSafely(dependencies.reportFailure, "LOOKUP");
    return;
  }

  if (!user) return;

  let token: string;
  let recipient: PasswordResetRecipient;

  try {
    token = dependencies.generateToken();
    const tokenHash = dependencies.hashToken(token);
    if (!tokenHash) throw new Error("Password reset credential is invalid");

    recipient = await dependencies.replaceTokensForRequest({
      expectedUser: user,
      legacyPlaintextToken: token,
      tokenHash,
    });
  } catch {
    reportFailureSafely(dependencies.reportFailure, "TOKEN_REPLACEMENT");
    return;
  }

  try {
    await dependencies.sendResetEmail(
      recipient.email,
      recipient.firstName,
      token,
    );
  } catch {
    // SMTP failure can be ambiguous after remote acceptance. Keep the
    // committed, one-hour token so a possibly delivered link remains valid.
    reportFailureSafely(dependencies.reportFailure, "DELIVERY");
  }
}

interface RawPasswordResetUserRow {
  id: unknown;
  email: unknown;
  firstName?: unknown;
  role: unknown;
  rowVersion: unknown;
}

interface DatabaseClockRow {
  currentTimestamp: unknown;
}

function parsePasswordResetUserRow(
  row: RawPasswordResetUserRow | undefined,
  requireFirstName: false,
): PasswordResetUser | null;
function parsePasswordResetUserRow(
  row: RawPasswordResetUserRow | undefined,
  requireFirstName: true,
): PasswordResetLockedUser | null;
function parsePasswordResetUserRow(
  row: RawPasswordResetUserRow | undefined,
  requireFirstName: boolean,
): PasswordResetUser | PasswordResetLockedUser | null {
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.email !== "string" ||
    !isPasswordResetUserRole(row.role) ||
    typeof row.rowVersion !== "string" ||
    (requireFirstName && typeof row.firstName !== "string")
  ) {
    return null;
  }

  const user: PasswordResetUser = {
    id: row.id,
    email: row.email,
    role: row.role,
    rowVersion: row.rowVersion,
  };
  if (!requireFirstName) return user;
  return { ...user, firstName: row.firstName as string };
}

function prismaPasswordResetTransactionAdapter(
  transaction: Prisma.TransactionClient,
): PasswordResetRequestTransaction {
  return {
    async lockUserById(userId) {
      const rows = await transaction.$queryRaw<RawPasswordResetUserRow[]>`
        SELECT
          account."id",
          account."email",
          account."firstName",
          account."role"::text AS "role",
          account.xmin::text AS "rowVersion"
        FROM public."User" AS account
        WHERE account."id" = ${userId}
        FOR UPDATE
      `;
      if (rows.length > 1) {
        throw new PasswordResetRequestConflictError();
      }
      const lockedUser = parsePasswordResetUserRow(rows[0], true);
      if (rows.length === 1 && !lockedUser) {
        throw new PasswordResetRequestConflictError();
      }
      return lockedUser;
    },

    async readDatabaseTime() {
      const rows = await transaction.$queryRaw<DatabaseClockRow[]>`
        SELECT clock_timestamp()::timestamptz(3) AS "currentTimestamp"
      `;
      const currentTimestamp = rows[0]?.currentTimestamp;
      if (
        rows.length !== 1 ||
        !(currentTimestamp instanceof Date) ||
        !Number.isFinite(currentTimestamp.getTime())
      ) {
        throw new PasswordResetRequestConflictError();
      }
      return currentTimestamp;
    },

    async replacePasswordReset(input) {
      await transaction.passwordReset.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          token: input.legacyPlaintextToken,
          tokenHash: input.tokenHash,
          expires: input.expires,
        },
        update: {
          token: input.legacyPlaintextToken,
          tokenHash: input.tokenHash,
          expires: input.expires,
        },
      });
    },
  };
}

export type PrismaPasswordResetRequestDatabase = Pick<
  PasswordResetRequestDependencies,
  "findUserByEmail" | "replaceTokensForRequest"
>;

/** Prisma/PostgreSQL adapter for the private password-reset request work. */
export function createPrismaPasswordResetRequestDatabase(
  database: Pick<PrismaClient, "$queryRaw" | "$transaction">,
): PrismaPasswordResetRequestDatabase {
  const replacementDatabase: PasswordResetRequestDatabase = {
    transaction: (work) =>
      database.$transaction((transaction) =>
        work(prismaPasswordResetTransactionAdapter(transaction)),
      ),
  };

  return {
    async findUserByEmail(normalizedEmail) {
      if (normalizeEmailAddress(normalizedEmail) !== normalizedEmail) {
        throw new PasswordResetRequestConflictError();
      }
      const rows = await database.$queryRaw<RawPasswordResetUserRow[]>`
        SELECT
          account."id",
          account."email",
          account."role"::text AS "role",
          account.xmin::text AS "rowVersion"
        FROM public."User" AS account
        WHERE account."email" = ${normalizedEmail}
      `;
      if (rows.length > 1) {
        throw new PasswordResetRequestConflictError();
      }
      const user = parsePasswordResetUserRow(rows[0], false);
      if (rows.length === 1 && (!user || !isValidUserSnapshot(user))) {
        throw new PasswordResetRequestConflictError();
      }
      return user;
    },

    replaceTokensForRequest(input) {
      return replacePasswordResetTokenForRequest(
        replacementDatabase,
        input,
      );
    },
  };
}
