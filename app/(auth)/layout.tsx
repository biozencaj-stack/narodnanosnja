import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getStoreIdentity } from "@/lib/config/store-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: "Korisnički nalog",
    description: `Prijava i registracija korisničkog naloga u ${name} prodavnici.`,
    robots: { index: false, follow: false },
  };
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { name: storeName } = await getStoreIdentity();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-primary-light/40 flex flex-col">
      <header className="py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-block">
            <Image
              src="/logo.svg"
              alt={storeName}
              width={140}
              height={40}
              priority
            />
          </Link>
        </div>
      </header>

      <main id="glavni-sadrzaj" tabIndex={-1} className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="py-6 px-4 text-center text-sm text-text-muted">
        <p>&copy; {new Date().getFullYear()} {storeName}. Sva prava zadržana.</p>
        <div className="mt-2 space-x-4">
          <Link href="/politika-privatnosti" className="hover:text-primary transition-colors">
            Politika privatnosti
          </Link>
          <Link href="/uslovi-koriscenja" className="hover:text-primary transition-colors">
            Uslovi korišćenja
          </Link>
        </div>
      </footer>
    </div>
  );
}
