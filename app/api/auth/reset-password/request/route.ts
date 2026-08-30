import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateRawCredentialToken,
  hashCredentialToken,
} from "@/lib/auth/credential-token";
import {
  createPrismaPasswordResetRequestDatabase,
  processPasswordResetRequest,
} from "@/lib/auth/password-reset-request";
import { createPasswordResetRequestHandler } from "@/lib/auth/password-reset-request-route";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/auth-emails";

function reportFailure({ stage }: { stage: string }): void {
  // Never log the submitted email, token, or internal error details here.
  console.error("Password reset request internal failure", { stage });
}

const passwordResetDatabase =
  createPrismaPasswordResetRequestDatabase(prisma);

export const POST = createPasswordResetRequestHandler({
  checkRateLimit,
  schedule: (task) => after(task),
  processRequest: (email) =>
    processPasswordResetRequest(email, {
      ...passwordResetDatabase,
      generateToken: generateRawCredentialToken,
      hashToken: (token) => hashCredentialToken("password-reset", token),
      sendResetEmail: sendPasswordResetEmail,
      reportFailure,
    }),
  reportFailure,
});
