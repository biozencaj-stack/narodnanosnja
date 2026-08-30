import type { PrismaClient } from "@prisma/client";
import type { CredentialsLoginDependencies } from "./credentials-login";

export type PrismaCredentialsLoginDatabase = Pick<
  CredentialsLoginDependencies,
  "findCredentialByEmail" | "readPolicySnapshot"
>;

interface LockedUserRow {
  id: string;
}

interface DatabaseClockRow {
  evaluatedAt: Date;
}

/**
 * Prisma persistence adapter for the privacy-preserving credentials flow.
 *
 * The password lookup intentionally selects no profile or verification data.
 * Policy state is loaded only after the caller has completed a successful
 * bcrypt comparison. A shared row lock keeps that fresh state stable until
 * the transaction ends, and the database clock is sampled only after the
 * lock has been acquired.
 */
export function createPrismaCredentialsLoginDatabase(
  prisma: PrismaClient,
): PrismaCredentialsLoginDatabase {
  return {
    findCredentialByEmail(normalizedEmail) {
      return prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          passwordHash: true,
        },
      });
    },

    readPolicySnapshot(userId) {
      return prisma.$transaction(async (transaction) => {
        const lockedUsers = await transaction.$queryRaw<LockedUserRow[]>`
          SELECT "id"
          FROM public."User"
          WHERE "id" = ${userId}
          FOR SHARE
        `;

        if (lockedUsers.length === 0) return null;
        if (
          lockedUsers.length !== 1 ||
          lockedUsers[0]?.id !== userId
        ) {
          throw new Error("Invalid credentials policy lock result");
        }

        const snapshot = await transaction.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
            emailVerified: true,
            emailVerificationLoginGraceUntil: true,
          },
        });
        if (!snapshot) return null;

        const clockRows = await transaction.$queryRaw<DatabaseClockRow[]>`
          SELECT clock_timestamp()::timestamptz(3) AS "evaluatedAt"
        `;
        const evaluatedAt = clockRows[0]?.evaluatedAt;
        if (
          clockRows.length !== 1 ||
          !(evaluatedAt instanceof Date) ||
          !Number.isFinite(evaluatedAt.getTime())
        ) {
          throw new Error("Invalid credentials policy database clock");
        }

        return {
          ...snapshot,
          evaluatedAt,
        };
      });
    },
  };
}
