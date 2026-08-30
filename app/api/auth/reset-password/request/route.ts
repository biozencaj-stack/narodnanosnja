import { after } from "next/server";
import { prisma } from "@/lib/db";
import { generateResetToken } from "@/lib/auth/password";
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
      generateToken: generateResetToken,
      now: () => new Date(),
      replaceTokensForRequest: async ({ userId, token, expires }) => {
        await prisma.$transaction(async (transaction) => {
          await transaction.passwordReset.deleteMany({ where: { userId } });
          await transaction.passwordReset.create({
            data: { userId, token, expires },
          });
        });
      },
      sendResetEmail: sendPasswordResetEmail,
      reportFailure,
    }),
  reportFailure,
});
