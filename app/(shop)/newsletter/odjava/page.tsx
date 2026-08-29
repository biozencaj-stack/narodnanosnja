import type { Metadata } from "next";
import Link from "next/link";
import {
  NewsletterUnsubscribeConfigurationError,
  verifyNewsletterUnsubscribeToken,
} from "@/lib/newsletter/unsubscribe";
import { UnsubscribeForm } from "./UnsubscribeForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Odjava sa newsletter-a",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface NewsletterUnsubscribePageProps {
  searchParams: Promise<{
    email?: string | string[];
    token?: string | string[];
    status?: string | string[];
  }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function MessageCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="font-display text-3xl text-text">{title}</h1>
      <div className="mt-4 text-text-muted">{children}</div>
      <Link
        href="/"
        className="mt-6 inline-flex font-semibold text-primary underline-offset-4 hover:underline"
      >
        Povratak na početnu stranu
      </Link>
    </div>
  );
}

export default async function NewsletterUnsubscribePage({
  searchParams,
}: NewsletterUnsubscribePageProps) {
  const params = await searchParams;
  const status = firstValue(params.status);

  if (status === "success") {
    return (
      <section className="container mx-auto max-w-xl px-4 py-16 sm:py-24">
        <MessageCard title="Odjava je uspešna">
          Više vam nećemo slati newsletter poruke. Ako se predomislite, možete
          se ponovo prijaviti preko formulara na sajtu.
        </MessageCard>
      </section>
    );
  }

  const email = firstValue(params.email);
  const token = firstValue(params.token);
  let normalizedEmail: string | null = null;
  let configurationUnavailable = false;

  try {
    normalizedEmail = verifyNewsletterUnsubscribeToken(email, token);
  } catch (error) {
    configurationUnavailable =
      error instanceof NewsletterUnsubscribeConfigurationError;
    console.error("Newsletter unsubscribe page validation failed");
  }

  if (configurationUnavailable) {
    return (
      <section className="container mx-auto max-w-xl px-4 py-16 sm:py-24">
        <MessageCard title="Odjava trenutno nije dostupna">
          Pokušajte ponovo kasnije. Vaša prijava nije promenjena.
        </MessageCard>
      </section>
    );
  }

  if (status === "invalid" || !normalizedEmail || !token) {
    return (
      <section className="container mx-auto max-w-xl px-4 py-16 sm:py-24">
        <MessageCard title="Link nije važeći">
          Link za odjavu je neispravan ili više nije važeći. Vaša prijava nije
          promenjena.
        </MessageCard>
      </section>
    );
  }

  return (
    <section className="container mx-auto max-w-xl px-4 py-16 sm:py-24">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-3xl text-text">
          Odjava sa newsletter-a
        </h1>
        <div className="mt-5">
          <UnsubscribeForm email={normalizedEmail} token={token} />
        </div>
      </div>
    </section>
  );
}
