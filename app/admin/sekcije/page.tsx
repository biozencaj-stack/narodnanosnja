import Link from "next/link";
import { zahtevajAdminaNaStranici } from "@/lib/auth/admin-stranica";
import { EkranSekcija } from "@/components/admin/sekcije/EkranSekcija";
import { OPISI_STRANICA, opisStranice } from "@/lib/sekcije/registar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sekcije stranica | Admin",
};

/**
 * Uređivanje sekcija, po zonama.
 *
 * Zona se bira kroz `?stranica=`, a ne kroz stanje u pregledaču: adresa zone je
 * tada deljiva, a povratak dugmetom „nazad” vraća na istu zonu. Nepoznata
 * vrednost pada na početnu umesto da obori stranicu — parametar dolazi iz
 * adrese, dakle od bilo koga.
 */
export default async function AdminSekcijePage({
  searchParams,
}: {
  searchParams: Promise<{ stranica?: string }>;
}) {
  await zahtevajAdminaNaStranici("/admin/sekcije");

  const parametri = await searchParams;
  const izabrana = opisStranice(parametri.stranica ?? "") ?? OPISI_STRANICA[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-900">
          Sekcije stranica
        </h1>
        <p className="text-sm text-stone-500">
          Izmene se čuvaju kao nacrt i ne vide se na sajtu dok se ne pritisne
          „Objavi stranicu”. Svaka zona se objavljuje zasebno.
        </p>
      </div>

      <nav aria-label="Zone stranica" className="flex flex-wrap gap-2">
        {OPISI_STRANICA.map((stranica) => {
          const aktivna = stranica.kljuc === izabrana.kljuc;
          return (
            <Link
              key={stranica.kljuc}
              href={`/admin/sekcije?stranica=${stranica.kljuc}`}
              aria-current={aktivna ? "page" : undefined}
              className={
                aktivna
                  ? "rounded-lg border border-stone-800 bg-stone-800 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:border-stone-400"
              }
            >
              {stranica.naziv}
            </Link>
          );
        })}
      </nav>

      <p className="text-sm text-stone-500">{izabrana.opis}</p>

      {/* `key` je obavezan: bez njega bi `EkranSekcija` pri promeni zone
          zadržala učitane sekcije prethodne i prikazala tuđi spisak. */}
      <EkranSekcija key={izabrana.kljuc} pageKey={izabrana.kljuc} />
    </div>
  );
}
