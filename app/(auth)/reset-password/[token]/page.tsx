"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Lozinke se ne poklapaju");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setErrorMessage("Greška pri promeni lozinke. Pokušajte ponovo.");
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-4">
          Lozinka promenjena!
        </h1>
        <p className="text-stone-600 mb-6">
          Vaša lozinka je uspešno promenjena. Bićete preusmereni na stranicu za
          prijavu...
        </p>
        <Link
          href="/login"
          className="inline-block py-3 px-6 bg-stone-900 text-white rounded-lg font-medium
                     hover:bg-stone-800 transition-all"
        >
          Prijavite se
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-stone-900">Nova lozinka</h1>
        <p className="text-stone-600 mt-2">Unesite novu lozinku za vaš nalog</p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-stone-700 mb-1"
          >
            Nova lozinka
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2
                       focus:ring-stone-900 focus:border-transparent transition-all"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-stone-500">
            Min 8 karaktera, veliko slovo, broj i specijalni znak
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-stone-700 mb-1"
          >
            Potvrdite lozinku
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2
                       focus:ring-stone-900 focus:border-transparent transition-all"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-stone-900 text-white rounded-lg font-medium
                     hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-offset-2
                     focus:ring-stone-900 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all"
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
              Promena...
            </span>
          ) : (
            "Promenite lozinku"
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-stone-600 hover:text-stone-900">
          ← Nazad na prijavu
        </Link>
      </div>
    </div>
  );
}
