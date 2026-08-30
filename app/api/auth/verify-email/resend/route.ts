import { after } from "next/server";
import { processEmailVerificationResendRequest } from "@/lib/auth/email-verification-resend-service";
import { createEmailVerificationResendHandler } from "@/lib/auth/email-verification-resend-route";
import { checkRateLimit } from "@/lib/rate-limit";

function reportFailure({ stage }: { stage: string }): void {
  // Never log the submitted address, raw token or internal error details.
  console.error("Email verification resend internal failure", { stage });
}

export const POST = createEmailVerificationResendHandler({
  checkRateLimit,
  schedule: (task) => after(task),
  processRequest: (email) =>
    processEmailVerificationResendRequest(email, reportFailure),
  reportFailure,
});
