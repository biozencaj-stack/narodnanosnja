import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateRawCredentialToken,
  hashCredentialToken,
} from "@/lib/auth/credential-token";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { registerAccount } from "@/lib/auth/registration";
import { protectRegistrationResponseTiming } from "@/lib/auth/registration-response-timing";
import {
  createRegistrationHandler,
  type RegistrationFailure,
} from "@/lib/auth/registration-route";
import { processEmailVerificationResendRequest } from "@/lib/auth/email-verification-resend-service";
import { prepareVerificationEmail } from "@/lib/email/auth-emails";
import { checkRateLimit } from "@/lib/rate-limit";

function reportFailure({ stage }: RegistrationFailure): void {
  // Never log submitted account data, credentials or raw persistence/SMTP
  // failures. A coarse stage is sufficient for operational monitoring.
  console.error("Registration internal failure", { stage });
}

async function readRegistrationDatabaseTime(): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ currentTimestamp: Date }>>`
    SELECT clock_timestamp()::timestamptz(3) AS "currentTimestamp"
  `;
  const currentTimestamp = rows[0]?.currentTimestamp;
  if (rows.length !== 1 || !(currentTimestamp instanceof Date)) {
    throw new Error("Invalid registration database clock");
  }
  return currentTimestamp;
}

export const POST = createRegistrationHandler({
  checkRateLimit,
  validatePassword,
  generateToken: generateRawCredentialToken,
  hashToken: (token) => hashCredentialToken("email-verification", token),
  prepareDelivery: prepareVerificationEmail,
  hashPassword,
  now: readRegistrationDatabaseTime,
  register: (input) =>
    registerAccount(input, {
      transaction: (work) =>
        prisma.$transaction((transaction) =>
          work({
            createUser: (user) =>
              transaction.user.create({
                data: {
                  email: user.email,
                  passwordHash: user.passwordHash,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  phone: user.phone,
                  role: "CUSTOMER",
                  emailVerificationLoginGraceUntil:
                    user.emailVerificationLoginGraceUntil,
                  verificationEmailNextAllowedAt:
                    user.verificationEmailNextAllowedAt,
                  verificationEmailResendWindowStartedAt:
                    user.verificationEmailResendWindowStartedAt,
                  verificationEmailResendCount:
                    user.verificationEmailResendCount,
                },
                select: { id: true },
              }),
            createEmailVerification: async (verification) => {
              await transaction.emailVerification.create({
                data: {
                  userId: verification.userId,
                  token: verification.legacyPlaintextToken,
                  tokenHash: verification.tokenHash,
                  expires: verification.expires,
                },
              });
            },
          }),
        ),
      findUserByEmail: (normalizedEmail) =>
        prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        }),
    }),
  recoverExistingVerification: (normalizedEmail) =>
    processEmailVerificationResendRequest(normalizedEmail, () =>
      reportFailure({ stage: "RECOVERY" }),
    ),
  schedule: (task) => after(task),
  protectResponseTiming: protectRegistrationResponseTiming,
  reportFailure,
});
