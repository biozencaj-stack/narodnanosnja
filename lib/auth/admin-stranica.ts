import "server-only";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * ADMIN provera za serversku admin stranicu.
 *
 * Postoji zato što `app/admin/layout.tsx` propušta i OPERATOR-a — `isAdminRole`
 * obuhvata obe uloge — pa ekran koji sme samo ADMIN mora da proveri sam.
 * `proxy.ts` to takođe radi, ali middleware je prva kapija, ne jedina: matcher
 * se menja, a stranica koja se osloni samo na njega ostaje otvorena čim je
 * neko izuzme.
 *
 * Namerno je jedan zajednički pomoćnik, a ne poziv prepisan u svaku stranicu.
 * `lib/auth/server-session-callsite-inventory.test.ts` drži spisak fajlova koji
 * čitaju sesiju i taj spisak se **smanjuje**; ovako on raste za jedan unos
 * umesto za svaku novu admin stranicu, a postojeće stranice mogu kasnije da
 * pređu na njega i time ga smanje.
 *
 * Ovo nije zamena za proveru u API rutama. Stranica bez podataka je bezopasna;
 * granica koja stvarno štiti podatke je ona u `lib/sekcije/rute.ts`.
 */
export async function zahtevajAdminaNaStranici(povratnaPutanja: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(povratnaPutanja)}`);
  }

  if (session.user.role !== "ADMIN") {
    // OPERATOR se vraća u svoj deo, kao i u `proxy.ts` — ne na prijavu, jer
    // jeste prijavljen, samo nema pravo na ovaj ekran.
    redirect(session.user.role === "OPERATOR" ? "/admin/orders" : "/");
  }
}
