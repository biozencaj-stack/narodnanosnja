import Link from "next/link";
import { notFound } from "next/navigation";
import { zahtevajAdminaNaStranici } from "@/lib/auth/admin-stranica";
import { RenderSekcije } from "@/components/sekcije/RenderSekcije";
import { OBRAZAC_KLJUCA_STRANICE } from "@/lib/sekcije/polja";

/**
 * Pregled nacrta — pravi renderer nad nacrt-vrednostima.
 *
 * Ne pravi se poseban „pregledni” prikaz. Da postoji, pokazivao bi nešto što
 * javni sajt nikad neće nacrtati, pa bi pregled lagao baš u trenutku kad je
 * najpotrebniji.
 *
 * `force-dynamic`: pregled mora da pokaže poslednje snimljeno stanje odmah, a
 * ne verziju iz keša.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pregled nacrta | Admin",
  robots: { index: false, follow: false },
};

export default async function PregledNacrtaPage({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}) {
  const { pageKey } = await params;

  await zahtevajAdminaNaStranici(`/admin/sekcije/pregled/${pageKey}`);

  // Isti obrazac kao CHECK u bazi. Bez ovoga bi proizvoljan segment iz adrese
  // otišao pravo u upit.
  if (!OBRAZAC_KLJUCA_STRANICE.test(pageKey)) notFound();

  return (
    <div className="-mx-4 -my-6 lg:-mx-8">
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 border-b border-amber-300">
        <span className="font-medium">
          Pregled nacrta — nije objavljeno. Posetioci ovo ne vide.
        </span>
        <Link
          href="/admin/sekcije"
          className="rounded border border-amber-400 bg-white/60 px-2.5 py-1 text-xs font-medium"
        >
          Nazad na uređivanje
        </Link>
      </div>

      <RenderSekcije pageKey={pageKey} nacrt />
    </div>
  );
}
