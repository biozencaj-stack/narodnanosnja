"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface UnsubscribeFormProps {
  email: string;
  token: string;
}

export function UnsubscribeForm({ email, token }: UnsubscribeFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
        cache: "no-store",
      });

      if (!response.ok) {
        setErrorMessage(
          response.status >= 500
            ? "Odjava trenutno nije dostupna. Pokušajte ponovo."
            : "Link za odjavu nije važeći.",
        );
        return;
      }

      // Remove the bearer token and email address from browser history/URL.
      router.replace("/newsletter/odjava?status=success");
    } catch {
      setErrorMessage("Odjava trenutno nije dostupna. Pokušajte ponovo.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-text-muted">
        Da li želite da prestanemo da šaljemo newsletter poruke na adresu{" "}
        <strong className="break-all text-text">{email}</strong>?
      </p>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-error/20 bg-error/5 p-4 text-sm text-error"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" isLoading={isLoading} fullWidth>
        Potvrdi odjavu
      </Button>
      <p aria-live="polite" className="sr-only">
        {isLoading ? "Odjava je u toku" : errorMessage}
      </p>
    </form>
  );
}
