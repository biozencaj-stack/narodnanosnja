"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useStoreIdentity } from "@/components/StoreIdentityProvider";

export default function RegisterPage() {
  const { name: storeName } = useStoreIdentity();
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Lozinke se ne poklapaju");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error);
        setIsLoading(false);
        return;
      }

      // Redirect to login with success message
      // User must verify email before logging in
      router.push("/login?registered=true");
    } catch {
      setErrorMessage("Greška pri registraciji. Pokušajte ponovo.");
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text">Kreirajte nalog</h1>
          <p className="text-text-muted mt-2">
            Pridružite se {storeName} porodici
          </p>
        </div>

        {errorMessage && (
          <div
            className="mb-6 p-4 bg-error-light border border-error/20 rounded-xl text-error text-sm"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-text mb-1.5"
              >
                Ime
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                required
                maxLength={100}
                className="w-full px-4 py-3 border border-border rounded-xl bg-background-alt/50
                           focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                           text-text placeholder:text-text-light"
                placeholder="Petar"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-text mb-1.5"
              >
                Prezime
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                required
                maxLength={100}
                className="w-full px-4 py-3 border border-border rounded-xl bg-background-alt/50
                           focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                           text-text placeholder:text-text-light"
                placeholder="Petrović"
              />
            </div>
          </div>

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
              value={formData.email}
              onChange={handleChange}
              required
              maxLength={254}
              autoComplete="email"
              className="w-full px-4 py-3 border border-border rounded-xl bg-background-alt/50
                         focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                         text-text placeholder:text-text-light"
              placeholder="petar@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-text mb-1.5"
            >
              Telefon{" "}
              <span className="text-text-light font-normal">(opciono)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              maxLength={32}
              autoComplete="tel"
              className="w-full px-4 py-3 border border-border rounded-xl bg-background-alt/50
                         focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                         text-text placeholder:text-text-light"
              placeholder="+381 60 123 4567"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text mb-1.5"
            >
              Lozinka
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
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
            <p className="mt-1.5 text-xs text-text-light">
              Min 8 karaktera, veliko slovo, broj i specijalni znak
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-text mb-1.5"
            >
              Potvrdite lozinku
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-12 border border-border rounded-xl bg-background-alt/50
                           focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
                           text-text placeholder:text-text-light"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light
                           hover:text-text-muted transition-colors p-1"
                aria-label={showConfirmPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
              >
                {showConfirmPassword ? (
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
                       transition-all shadow-sm hover:shadow-md mt-6"
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
                Kreiranje...
              </span>
            ) : (
              "Kreirajte nalog"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-text-muted">
            Već imate nalog?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Prijavite se
            </Link>
          </p>
        </div>

        <p className="mt-6 text-xs text-text-light text-center">
          Kreiranjem naloga prihvatate naše{" "}
          <Link href="/uslovi-koriscenja" className="underline hover:text-primary transition-colors">
            Uslove korišćenja
          </Link>{" "}
          i{" "}
          <Link href="/politika-privatnosti" className="underline hover:text-primary transition-colors">
            Politiku privatnosti
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
