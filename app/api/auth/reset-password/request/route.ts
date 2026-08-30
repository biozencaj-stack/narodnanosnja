import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateRawCredentialToken,
  hashCredentialToken,
} from "@/lib/auth/credential-token";
import { processPasswordResetRequest } from "@/lib/auth/password-reset-request";
import { createPasswordResetRequestHandler } from "@/lib/auth/password-reset-request-route";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/auth-emails";

function reportFailure({ stage }: { stage: string }): void {
  // Never log the submitted email, token, or internal error details here.
  console.error("Password reset request internal failure", { stage });
}

export const POST = createPasswordResetRequestHandler({
  checkRateLimit,
  schedule: (task) => after(task),
  processRequest: (email) =>
    processPasswordResetRequest(email, {
      findUserByEmail: (normalizedEmail) =>
        prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, firstName: true },
        }),
      generateToken: generateRawCredentialToken,
      hashToken: (token) => hashCredentialToken("password-reset", token),
      now: () => new Date(),
      replaceTokensForRequest: async ({
        userId,
        legacyPlaintextToken,
        tokenHash,
        expires,
      }) => {
        await prisma.passwordReset.upsert({
          where: { userId },
          create: {
            userId,
            token: legacyPlaintextToken,
            tokenHash,
            expires,
          },
          update: {
            token: legacyPlaintextToken,
            tokenHash,
            expires,
          },
        });
      },
      sendResetEmail: sendPasswordResetEmail,
      reportFailure,
    }),
  reportFailure,
});
