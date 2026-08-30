import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { createCredentialTokenLookupKeys } from "@/lib/auth/credential-token";
import {
  commitPasswordResetConfirmation,
  type PasswordResetConfirmDatabase,
} from "@/lib/auth/password-reset-confirm";
import {
  PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
  createPasswordResetConfirmHandler,
  type PasswordResetConfirmFailure,
} from "@/lib/auth/password-reset-confirm-route";

function reportFailure({ stage }: PasswordResetConfirmFailure): void {
  // Deliberately log only a coarse stage. Never include request data, the
  // token/hash, account identity, password or a raw database/bcrypt error.
  console.error("Password reset confirmation internal failure", { stage });
}

const database: PasswordResetConfirmDatabase = {
  $transaction: (work) =>
    prisma.$transaction((transaction) => work(transaction)),
};

export const POST = createPasswordResetConfirmHandler({
  checkRateLimit,
  validatePassword,
  createLookupKeys: (submittedToken) =>
    createCredentialTokenLookupKeys("password-reset", submittedToken),
  findByCurrentHash: (currentHash) =>
    prisma.passwordReset.findUnique({
      where: { tokenHash: currentHash },
      select: {
        id: true,
        userId: true,
        token: true,
        tokenHash: true,
        expires: true,
      },
    }),
  findByLegacyToken: (legacyPlaintext) =>
    prisma.passwordReset.findFirst({
      where: {
        token: legacyPlaintext,
        tokenHash: null,
      },
      select: {
        id: true,
        userId: true,
        token: true,
        tokenHash: true,
        expires: true,
      },
    }),
  hashPassword,
  prepareSuccessResponse: () =>
    NextResponse.json({
      message: PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
    }),
  commitReset: (claim, passwordHash, resetAt) =>
    commitPasswordResetConfirmation(database, claim, passwordHash, resetAt),
  reportFailure,
});
