import "server-only";

import { prisma } from "@/lib/db";
import {
  generateRawCredentialToken,
  hashCredentialToken,
} from "@/lib/auth/credential-token";
import {
  commitEmailVerificationResend,
  processEmailVerificationResend,
  type EmailVerificationResendFailure,
} from "@/lib/auth/email-verification-resend";
import { prepareVerificationEmail } from "@/lib/email/auth-emails";

/** Shared production composition used by both explicit resend and register retry. */
export function processEmailVerificationResendRequest(
  normalizedEmail: string,
  reportFailure: (failure: EmailVerificationResendFailure) => void,
): Promise<void> {
  return processEmailVerificationResend(normalizedEmail, {
    findUserByEmail: (email) =>
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          emailVerified: true,
        },
      }),
    generateToken: generateRawCredentialToken,
    hashToken: (token) =>
      hashCredentialToken("email-verification", token),
    prepareDelivery: prepareVerificationEmail,
    replaceTokenIfEligible: (input) =>
      commitEmailVerificationResend(prisma, input),
    reportFailure,
  });
}
