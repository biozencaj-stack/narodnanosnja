"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useStoreIdentity } from "@/components/StoreIdentityProvider";
import { safeLoginCallbackPath } from "@/lib/security/navigation";

export default function LoginPage() {
  const { name: storeName } = useStoreIdentity();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeLoginCallbackPath(searchParams.get("callbackUrl"));
  const error = searchParams.get("error");
  const registered = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Handle different error types including verification errors
  const getErrorMessage = (err: string | null) => {
    if (!err) return "";
    switch (err) {
      case "CredentialsSignin":
        return "Neispravan email ili lozinka";
      case "invalid_token":
        return "Link za verifikaciju nije važeći. Proverite da li ste otvorili ceo link iz najnovijeg emaila.";
      case "expired_token":
        return "Link za verifikaciju je istekao. Ako je email već potvrđen, prijavite se; u suprotnom kontaktirajte podršku.";
      case "verification_failed":
        return "Verifikacija nije uspela. Pokušajte ponovo ili kontaktirajte podršku.";
      default:
        return "";
    }
  };

  const [errorMessage, setErrorMessage] = useState(getErrorMessage(error));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setErrorMessage("Neispravan email ili lozinka");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setErrorMessage("Greška pri prijavi. Pokušajte ponovo.");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden">
      <div className="h-1 bg-linear-to-r from-primary via-primary-hover to-primary-dark" />
      <div className="p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text">Prijavite se</h1>
          <p className="text-text-muted mt-2">
            Pristupite vašem {storeName} nalogu
          </p>
        </div>

        {registered && (
          <div className="mb-6 p-4 bg-success-light border border-success/20 rounded-xl text-success text-sm">
            <strong>Nalog uspešno kreiran!</strong>
            <p className="mt-1">
              Za aktivaciju je potrebna email potvrda. Proverite prijemno
              sanduče i spam; ako poruka ne stigne, kontaktirajte podršku.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-error-light border border-error/20 rounded-xl text-error text-sm">
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-border rounded-xl bg-background-alt/50
                         focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                         text-text placeholder:text-text-light"
              placeholder="vas@email.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text"
              >
                Lozinka
              </label>
              <Link
                href="/reset-password"
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                Zaboravili ste lozinku?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 border border-border rounded-xl bg-background-alt/50
                           focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                           text-text placeholder:text-text-light"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light
                           hover:text-text-muted transition-colors p-1"
                aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary text-white rounded-xl font-medium
                       hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2
                       focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all shadow-sm hover:shadow-md"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Prijava...
              </span>
            ) : (
              "Prijavite se"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-text-muted">
            Nemate nalog?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Registrujte se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
