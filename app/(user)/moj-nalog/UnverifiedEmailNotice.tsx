import Link from "next/link";
import { ShieldAlert } from "lucide-react";

interface UnverifiedEmailNoticeProps {
  show: boolean;
}

/**
 * Persistent recovery notice for a password-valid unverified account that is
 * temporarily admitted by audit, or for a reviewed CUSTOMER grace. It says
 * nothing about whether any submitted mailbox exists in the database.
 */
export function UnverifiedEmailNotice({
  show,
}: UnverifiedEmailNoticeProps) {
  if (!show) return null;

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-light p-4 text-text"
      role="status"
    >
      <ShieldAlert
        className="h-5 w-5 shrink-0 text-warning"
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold">Potvrdite email adresu naloga.</p>
        <p className="mt-1 text-sm text-text-muted">
          Privremeni pristup ne zamenjuje potvrdu mailbox-a. Zatražite novi
          link i završite potvrdu što pre.
        </p>
        <Link
          href="/verify-email/resend"
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
        >
          Pošaljite novi link za potvrdu
        </Link>
      </div>
    </div>
  );
}
