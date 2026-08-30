"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";

const ACCEPTED_MESSAGE =
  "Ako nalog zahteva potvrdu i slanje je trenutno dozvoljeno, novi link će biti poslat na unetu adresu.";
const UI_RETRY_DELAY_SECONDS = 90;

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAccepted) return;

    const interval = window.setInterval(() => {
      setRetryAfterSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isAccepted]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        if (response.status === 400) {
          setErrorMessage("Unesite ispravnu email adresu.");
        } else if (response.status === 429) {
          setErrorMessage("Previše pokušaja. Sačekajte malo i pokušajte ponovo.");
        } else {
          setErrorMessage("Slanje trenutno nije dostupno. Pokušajte ponovo kasnije.");
        }
        return;
      }

      // Set the conservative UI delay before revealing the accepted state so
      // there is no enabled retry frame. The extra margin accounts for private
      // `after()` work starting only after the HTTP response is committed.
      setRetryAfterSeconds(UI_RETRY_DELAY_SECONDS);
      setIsAccepted(true);
    } catch {
      setErrorMessage("Slanje trenutno nije dostupno. Pokušajte ponovo kasnije.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden">
      <div className="h-1 bg-linear-to-r from-primary via-primary-hover to-primary-dark" />
      <div className="p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-text">
            Novi link za potvrdu
          </h1>
          <p className="text-text-muted mt-2">
            Unesite email adresu korišćenu pri registraciji.
          </p>
          <p className="text-xs text-text-light mt-2">
            Između zahteva sačekajte najmanje jedan minut. Ranije primljen,
            neistekao link ostaje važeći.
          </p>
        </div>

        {isAccepted ? (
          <>
            <div
              className="p-4 bg-success-light border border-success/20 rounded-xl text-success text-sm"
              role="status"
            >
              <strong>Zahtev je primljen.</strong>
              <p className="mt-1">{ACCEPTED_MESSAGE}</p>
            </div>
            <button
              type="button"
              disabled={retryAfterSeconds > 0}
              onClick={() => {
                setRetryAfterSeconds(0);
                setIsAccepted(false);
              }}
              className="mt-4 w-full py-3 px-4 border border-border rounded-xl font-medium
                         text-text-muted hover:border-primary hover:text-primary disabled:opacity-60
                         disabled:cursor-not-allowed transition-colors"
            >
              {retryAfterSeconds > 0
                ? `Novi zahtev možete poslati za ${retryAfterSeconds} s`
                : "Pošaljite drugi zahtev"}
            </button>
          </>
        ) : (
          <>
            {errorMessage && (
              <div
                className="mb-6 p-4 bg-error-light border border-error/20 rounded-xl text-error text-sm"
                role="alert"
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text mb-1.5"
                >
                  Email adresa
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-border rounded-xl bg-background-alt/50
                             focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                             text-text placeholder:text-text-light"
                  placeholder="vas@email.com"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-primary text-white rounded-xl font-medium
                           hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2
                           focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all shadow-sm hover:shadow-md"
              >
                {isLoading ? "Slanje..." : "Pošaljite novi link"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            Nazad na prijavu
          </Link>
        </div>
      </div>
    </div>
  );
}
