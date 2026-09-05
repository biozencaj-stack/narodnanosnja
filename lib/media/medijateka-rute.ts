/**
 * Rukovaoci admin ruta nad medijatekom, kao fabrike sa ubrizganim zavisnostima.
 *
 * Oblik je isti kao kod ruta nad sekcijama i iz istog razloga:
 * `lib/auth/server-session-callsite-inventory.test.ts` dozvoljava
 * `resolveServerSession` samo rutama koje su tako napisane i upisane u njegov
 * spisak.
 */

import type { ServerSessionResolution } from "../auth/server-session-contract";
import { DOZVOLJENI_FOLDERI } from "./profili";

export const ZAGLAVLJA_ADMINA = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

export type MetodMedijateke = "GET" | "DELETE";
export type FazaNeuspehaMedijateke = "SESSION" | "DATABASE";

export interface NeuspehMedijateke {
  metod: MetodMedijateke;
  faza: FazaNeuspehaMedijateke;
}

export interface UpotrebaAsseta {
  sectionId: string;
  pageKey: string;
  kind: string;
  polje: string;
}

interface ZavisnostiSesije {
  resolveSession: () => Promise<ServerSessionResolution>;
  reportFailure: (
    neuspeh: Readonly<NeuspehMedijateke>,
  ) => void | Promise<unknown>;
}

function odgovor(telo: unknown, status: number): Response {
  return Response.json(telo, { status, headers: ZAGLAVLJA_ADMINA });
}

function prijaviTiho(
  reportFailure: ZavisnostiSesije["reportFailure"],
  metod: MetodMedijateke,
  faza: FazaNeuspehaMedijateke,
): void {
  try {
    void Promise.resolve(reportFailure(Object.freeze({ metod, faza }))).catch(
      () => undefined,
    );
  } catch {
    // Beleženje nikad ne sme da zameni fail-closed odgovor.
  }
}

function odgovorNedostupno(): Response {
  return odgovor(
    { error: "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo." },
    503,
  );
}

type IshodPrijave =
  | Readonly<{ status: "admin"; korisnikId: string }>
  | Readonly<{ status: "odgovor"; odgovor: Response }>;

async function prijaviAdmina(
  zavisnosti: ZavisnostiSesije,
  metod: MetodMedijateke,
): Promise<IshodPrijave> {
  try {
    const ishod = await zavisnosti.resolveSession();

    if (ishod.status === "anonymous") {
      return Object.freeze({
        status: "odgovor",
        odgovor: odgovor({ error: "Prijava je obavezna." }, 401),
      });
    }
    if (ishod.status === "unavailable") {
      return Object.freeze({ status: "odgovor", odgovor: odgovorNedostupno() });
    }
    if (ishod.status !== "authenticated") {
      throw new TypeError("Neispravan ishod sesije");
    }

    const principal = ishod.principal;
    if (typeof principal !== "object" || principal === null) {
      throw new TypeError("Neispravan principal sesije");
    }
    if (principal.role !== "ADMIN") {
      return Object.freeze({
        status: "odgovor",
        odgovor: odgovor(
          { error: "Nemate dozvolu za ovu administrativnu akciju." },
          403,
        ),
      });
    }
    if (typeof principal.id !== "string" || principal.id.length === 0) {
      throw new TypeError("Neispravan principal sesije");
    }

    return Object.freeze({ status: "admin", korisnikId: principal.id });
  } catch {
    prijaviTiho(zavisnosti.reportFailure, metod, "SESSION");
    return Object.freeze({ status: "odgovor", odgovor: odgovorNedostupno() });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/admin/medijateka
 * ------------------------------------------------------------------ */

export const MAX_PO_STRANI = 60;

export interface ZavisnostiSpiskaMedija extends ZavisnostiSesije {
  nadjiAssete: (upit: {
    folder: string | null;
    limit: number;
  }) => Promise<readonly unknown[]>;
}

export function createMedijatekaGetHandler(
  zavisnosti: ZavisnostiSpiskaMedija,
) {
  return async function GET(request: Request): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "GET");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const parametri = new URL(request.url).searchParams;
    const trazenFolder = parametri.get("folder");

    // Folder se proverava prema zatvorenom spisku, a ne prosleđuje u upit
    // kakav je stigao: vrednost iz adrese nikad ne ulazi u filter neproverena.
    if (trazenFolder !== null && !DOZVOLJENI_FOLDERI.includes(trazenFolder)) {
      return odgovor({ error: "Nepoznata fascikla." }, 400);
    }

    try {
      const assets = await zavisnosti.nadjiAssete({
        folder: trazenFolder,
        limit: MAX_PO_STRANI,
      });
      return odgovor({ assets }, 200);
    } catch {
      prijaviTiho(zavisnosti.reportFailure, "GET", "DATABASE");
      return odgovorNedostupno();
    }
  };
}

/* ------------------------------------------------------------------ *
 * DELETE /api/admin/medijateka/[id]
 * ------------------------------------------------------------------ */

export interface ZavisnostiBrisanjaMedija extends ZavisnostiSesije {
  nadjiUpotrebe: (assetId: string) => Promise<readonly UpotrebaAsseta[]>;
  obrisiAsset: (assetId: string) => Promise<number>;
}

export function createMedijatekaDeleteHandler(
  zavisnosti: ZavisnostiBrisanjaMedija,
) {
  return async function DELETE(
    _request: Request,
    kontekst: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "DELETE");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const { id } = await kontekst.params;

    try {
      // Provera reference ide PRE brisanja i vraća spisak sekcija, ne golo
      // „ne može”. Bez tog spiska administrator ne zna gde da ukloni sliku, pa
      // je jedini put ka brisanju pogađanje po ekranima.
      const upotrebe = await zavisnosti.nadjiUpotrebe(id);
      if (upotrebe.length > 0) {
        return odgovor(
          {
            error:
              "Slika je u upotrebi i ne može se obrisati. Prvo je ukloni iz navedenih sekcija.",
            upotrebe,
          },
          409,
        );
      }

      const obrisano = await zavisnosti.obrisiAsset(id);
      if (obrisano === 0) {
        return odgovor({ error: "Slika ne postoji." }, 404);
      }

      return odgovor({ obrisano: true }, 200);
    } catch {
      prijaviTiho(zavisnosti.reportFailure, "DELETE", "DATABASE");
      return odgovorNedostupno();
    }
  };
}
