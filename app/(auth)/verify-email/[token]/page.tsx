import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, MailCheck, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Potvrdite email",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

interface VerifyEmailPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    error?: string | string[];
  }>;
}

const VERIFICATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function InvalidTokenMessage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <XCircle className="h-16 w-16 text-error mx-auto" aria-hidden="true" />
        <h1 className="text-2xl font-display text-text">
          Link za potvrdu nije važeći
        </h1>
        <p className="text-text-muted">
          Proverite da li ste otvorili ceo link iz najnovijeg emaila. Ako je
          email već potvrđen, možete odmah da se prijavite.
        </p>
        <div className="space-y-3">
          <Link
            href="/verify-email/resend"
            className="block bg-primary text-white px-6 py-3 rounded-lg
                       hover:bg-primary-hover transition-colors font-medium"
          >
            Pošalji novi link za potvrdu
          </Link>
          <Link
            href="/login"
            className="inline-block text-primary hover:text-primary-hover transition-colors"
          >
            Idi na prijavu
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: VerifyEmailPageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);

  if (!VERIFICATION_TOKEN_PATTERN.test(token)) {
    return <InvalidTokenMessage />;
  }

  const error = firstQueryValue(query.error);
  const isTemporaryError = error === "temporary";
  const isSessionMismatch = error === "session_mismatch";
  const action = `/api/auth/verify-email/${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <MailCheck className="h-16 w-16 text-primary mx-auto" aria-hidden="true" />
        <div className="space-y-3">
          <h1 className="text-2xl font-display text-text">
            Potvrdite vašu email adresu
          </h1>
          <p className="text-text-muted">
            Otvaranje ovog linka nije promenilo vaš nalog. Potvrda će biti
            izvršena tek kada izaberete dugme ispod, nakon čega ćete biti
            prijavljeni na potvrđeni nalog.
          </p>
        </div>

        {(isTemporaryError || isSessionMismatch) && (
          <div
            className="flex gap-3 rounded-xl border border-warning/30 bg-warning-light p-4 text-left text-sm text-text"
            role="alert"
          >
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-warning"
              aria-hidden="true"
            />
            <p>
              {isSessionMismatch
                ? "U ovom pregledaču je prijavljen drugi nalog. Radi zaštite nijedan token nije iskorišćen. Odjavite se i ponovo otvorite link iz emaila, ili ga otvorite u privatnom prozoru."
                : "Trenutno ne možemo da završimo potvrdu. Sačekajte trenutak i pokušajte ponovo."}
            </p>
          </div>
        )}

        {!isSessionMismatch && (
          <form action={action} method="post">
            <button
              type="submit"
              className="w-full bg-primary text-white px-6 py-3 rounded-lg
                         hover:bg-primary-hover focus:outline-none focus:ring-2
                         focus:ring-primary focus:ring-offset-2 transition-colors font-medium"
            >
              {isTemporaryError
                ? "Pokušaj ponovo"
                : "Potvrdi email i prijavi me"}
            </button>
          </form>
        )}

        {isSessionMismatch && (
          <Link
            href="/api/auth/signout"
            className="inline-block w-full bg-primary text-white px-6 py-3 rounded-lg
                       hover:bg-primary-hover focus:outline-none focus:ring-2
                       focus:ring-primary focus:ring-offset-2 transition-colors font-medium"
          >
            Odjavi trenutni nalog
          </Link>
        )}

        <Link
          href="/login"
          className="inline-block text-primary hover:text-primary-hover transition-colors"
        >
          Već ste potvrdili email? Prijavite se
        </Link>
        <Link
          href="/verify-email/resend"
          className="block text-sm text-primary hover:text-primary-hover transition-colors"
        >
          Link nije stigao ili je istekao? Pošaljite novi
        </Link>
      </div>
    </div>
  );
}
