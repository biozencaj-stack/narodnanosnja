/**
 * Rukovaoci admin ruta nad sekcijama, kao fabrike sa ubrizganim zavisnostima.
 *
 * Oblik nije stvar ukusa: `lib/auth/server-session-callsite-inventory.test.ts`
 * dozvoljava `resolveServerSession` samo rutama koje su ovako napisane i
 * upisane u njegov spisak. Sirovi `getServerSession(authOptions)` stoji na
 * spisku koji se namerno smanjuje, pa bi nova ruta sa njim vratila projekat
 * unazad.
 *
 * Uz to, ovako se logika verzija, granica po tipu i statusa može testirati bez
 * baze i bez Next runtime-a — što je ovde bitno, jer se prvi stvarni prolaz
 * kroz PostgreSQL dešava tek u CI-ju.
 */

import type { ServerSessionResolution } from "../auth/server-session-contract";
import { readBoundedJson } from "../security/bounded-json";
import { OBRAZAC_KLJUCA_STRANICE } from "./polja";
import { podrazumevanaKonfiguracija, tipJeDostupan, tipSekcije } from "./registar";
import { storeCapabilities } from "../config/capabilities";
import {
  MAX_BAJTOVA_KONFIGURACIJE,
  sanitizujSekciju,
  validirajSekciju,
} from "./validacija";

/** Telo nosi i `version`, `pageKey` i slično, pa je granica nešto šira od same konfiguracije. */
export const MAX_BAJTOVA_TELA = MAX_BAJTOVA_KONFIGURACIJE + 8 * 1024;

export const ZAGLAVLJA_ADMINA = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

export type MetodSekcija = "GET" | "POST" | "PUT" | "DELETE";
export type FazaNeuspeha = "SESSION" | "BODY" | "DATABASE";

export interface NeuspehSekcija {
  metod: MetodSekcija;
  faza: FazaNeuspeha;
}

export interface RedSekcije {
  id: string;
  kind: string;
  pageKey: string;
  version: number;
  publishedAt: Date | null;
}

interface ZavisnostiSesije {
  resolveSession: () => Promise<ServerSessionResolution>;
  reportFailure: (neuspeh: Readonly<NeuspehSekcija>) => void | Promise<unknown>;
}

function odgovor(telo: unknown, status: number): Response {
  return Response.json(telo, { status, headers: ZAGLAVLJA_ADMINA });
}

function prijaviTiho(
  reportFailure: ZavisnostiSesije["reportFailure"],
  metod: MetodSekcija,
  faza: FazaNeuspeha,
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

/**
 * Provera uloge stoji u SVAKOJ ruti, ne samo u `proxy.ts`. Middleware je prva
 * kapija, ali nije jedina: matcher se menja, a ruta koja se osloni samo na
 * njega ostaje otvorena čim je neko izuzme.
 *
 * `unavailable` je zaseban ishod, ne isto što i „nije prijavljen”: znači da se
 * sesija nije mogla pročitati. Odgovor je 503 i fail-closed — pristup se ne
 * odobrava, ali se ni ne tvrdi da je posetilac anoniman, jer bi ga to poslalo
 * na prijavu koja bi pala isto.
 */
async function prijaviAdmina(
  zavisnosti: ZavisnostiSesije,
  metod: MetodSekcija,
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

type IshodTela =
  | Readonly<{ status: "telo"; telo: Record<string, unknown> }>
  | Readonly<{ status: "odgovor"; odgovor: Response }>;

async function procitajTelo(
  request: Request,
  zavisnosti: ZavisnostiSesije,
  metod: MetodSekcija,
): Promise<IshodTela> {
  const ishod = await readBoundedJson(request, MAX_BAJTOVA_TELA);

  if (!ishod.ok) {
    prijaviTiho(zavisnosti.reportFailure, metod, "BODY");
    return Object.freeze({
      status: "odgovor",
      odgovor: odgovor(
        { error: "Telo zahteva nije prihvatljivo.", razlog: ishod.error },
        ishod.status,
      ),
    });
  }

  if (
    typeof ishod.value !== "object" ||
    ishod.value === null ||
    Array.isArray(ishod.value)
  ) {
    return Object.freeze({
      status: "odgovor",
      odgovor: odgovor({ error: "Očekuje se JSON objekat." }, 400),
    });
  }

  return Object.freeze({
    status: "telo",
    telo: ishod.value as Record<string, unknown>,
  });
}

/**
 * `version` je token optimističkog zaključavanja i mora stići uz svaku izmenu.
 * Kad ga nema — 428 (Precondition Required), ne 400: klijentu nedostaje
 * preduslov, nije poslao smeće. Kad se ne poklapa — 409: neko drugi je snimio.
 */
type IshodVerzije =
  | Readonly<{ status: "verzija"; verzija: number }>
  | Readonly<{ status: "odgovor"; odgovor: Response }>;

function procitajVerziju(telo: Record<string, unknown>): IshodVerzije {
  const sirova = telo.version;

  if (sirova === undefined || sirova === null) {
    return Object.freeze({
      status: "odgovor",
      odgovor: odgovor(
        {
          error:
            "Nedostaje `version`. Učitaj sekciju ponovo pa pošalji izmenu sa njenom verzijom.",
        },
        428,
      ),
    });
  }

  if (typeof sirova !== "number" || !Number.isSafeInteger(sirova) || sirova < 0) {
    return Object.freeze({
      status: "odgovor",
      odgovor: odgovor(
        { error: "`version` mora biti ceo broj koji nije negativan." },
        400,
      ),
    });
  }

  return Object.freeze({ status: "verzija", verzija: sirova });
}

function odgovorSukoba(): Response {
  return odgovor(
    {
      error:
        "Sekcija je u međuvremenu izmenjena. Učitaj je ponovo pa primeni izmenu.",
    },
    409,
  );
}

function kljucStranice(telo: Record<string, unknown>): string | null {
  const vrednost = typeof telo.pageKey === "string" ? telo.pageKey : "home";
  return OBRAZAC_KLJUCA_STRANICE.test(vrednost) ? vrednost : null;
}

/* ------------------------------------------------------------------ *
 * GET /api/admin/sekcije
 * ------------------------------------------------------------------ */

export interface ZavisnostiSpiska extends ZavisnostiSesije {
  nadjiSekcije: (pageKey: string) => Promise<readonly unknown[]>;
}

export function createSekcijeGetHandler(zavisnosti: ZavisnostiSpiska) {
  return async function GET(request: Request): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "GET");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const pageKey = new URL(request.url).searchParams.get("pageKey") ?? "home";
    if (!OBRAZAC_KLJUCA_STRANICE.test(pageKey)) {
      return odgovor({ error: "Neispravan ključ stranice." }, 400);
    }

    try {
      return odgovor({ sekcije: await zavisnosti.nadjiSekcije(pageKey) }, 200);
    } catch {
      prijaviTiho(zavisnosti.reportFailure, "GET", "DATABASE");
      return odgovorNedostupno();
    }
  };
}

/* ------------------------------------------------------------------ *
 * POST /api/admin/sekcije — nova sekcija
 * ------------------------------------------------------------------ */

export interface ZavisnostiPravljenja extends ZavisnostiSesije {
  prebrojTipNaStrani: (pageKey: string, kind: string) => Promise<number>;
  poslednjiRedosled: (pageKey: string) => Promise<number | null>;
  napravi: (podaci: {
    pageKey: string;
    kind: string;
    order: number;
    config: Record<string, unknown>;
    korisnikId: string;
  }) => Promise<unknown>;
}

export function createSekcijePostHandler(zavisnosti: ZavisnostiPravljenja) {
  return async function POST(request: Request): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "POST");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const telo = await procitajTelo(request, zavisnosti, "POST");
    if (telo.status === "odgovor") return telo.odgovor;

    const pageKey = kljucStranice(telo.telo);
    if (pageKey === null) {
      return odgovor({ error: "Neispravan ključ stranice." }, 400);
    }

    const kind = telo.telo.kind;
    if (typeof kind !== "string") {
      return odgovor({ error: "`kind` je obavezan." }, 400);
    }

    const tip = tipSekcije(kind);
    if (!tip) {
      return odgovor({ error: `Nepoznat tip sekcije: ${kind}` }, 400);
    }

    // Onemogućen izbor u obrascu nije ovlašćenje. Tip koji zavisi od ugašenog
    // prekidača prodavnice ne sme da uđe u bazu ni direktnim zahtevom: sekcija
    // bi postojala, a na sajtu se nikad ne bi pojavila.
    if (!tipJeDostupan(kind, storeCapabilities as unknown as Record<string, boolean>)) {
      return odgovor(
        {
          error:
            `Tip „${kind}” zavisi od funkcije koja je isključena u podešavanjima prodavnice.`,
        },
        409,
      );
    }

    try {
      // Granica po tipu se sprovodi ovde, ne samo u obrascu: obrazac sakrije
      // dugme, ali ruta prima i direktan zahtev. Broje se i neobjavljene, inače
      // bi se granica zaobišla tako što se sekcije naprave a ne objave.
      if (tip.maxPoStrani !== undefined) {
        const koliko = await zavisnosti.prebrojTipNaStrani(pageKey, kind);
        if (koliko >= tip.maxPoStrani) {
          return odgovor(
            {
              error: `Tip „${kind}” sme da postoji najviše ${tip.maxPoStrani} puta na stranici.`,
            },
            409,
          );
        }
      }

      const ishod = validirajSekciju(
        kind,
        telo.telo.config ?? podrazumevanaKonfiguracija(kind),
      );
      if (Object.keys(ishod.greske).length > 0) {
        return odgovor(
          { error: "Konfiguracija nije ispravna.", greske: ishod.greske },
          400,
        );
      }

      // Sanitizacija na granici upisa. Druga ide na granici prikaza; obe su
      // obavezne i nijedna ne zamenjuje drugu.
      const config = sanitizujSekciju(kind, ishod.vrednosti);
      const poslednji = await zavisnosti.poslednjiRedosled(pageKey);

      // Nova sekcija je NEOBJAVLJENA. Pravljenje sekcije tako nikad ne menja
      // javnu stranicu — menja je tek „Objavi”.
      const sekcija = await zavisnosti.napravi({
        pageKey,
        kind,
        order: (poslednji ?? -1) + 1,
        config,
        korisnikId: prijava.korisnikId,
      });

      return odgovor({ sekcija }, 201);
    } catch {
      prijaviTiho(zavisnosti.reportFailure, "POST", "DATABASE");
      return odgovorNedostupno();
    }
  };
}

/* ------------------------------------------------------------------ *
 * PUT /api/admin/sekcije/[id]
 * ------------------------------------------------------------------ */

export interface ZavisnostiIzmene extends ZavisnostiSesije {
  nadjiSekciju: (id: string) => Promise<RedSekcije | null>;
  izmeniUslovno: (podaci: {
    id: string;
    verzija: number;
    config: Record<string, unknown>;
    vidljiva: boolean | undefined;
    nacrt: boolean;
    korisnikId: string;
  }) => Promise<number>;
  ucitaj: (id: string) => Promise<unknown>;
  ponistiKes: (razlog: "nacrt" | "objava", pageKey: string) => Promise<void>;
}

export function createSekcijaPutHandler(zavisnosti: ZavisnostiIzmene) {
  return async function PUT(
    request: Request,
    kontekst: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "PUT");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const { id } = await kontekst.params;

    const telo = await procitajTelo(request, zavisnosti, "PUT");
    if (telo.status === "odgovor") return telo.odgovor;

    const verzija = procitajVerziju(telo.telo);
    if (verzija.status === "odgovor") return verzija.odgovor;

    try {
      const postojeca = await zavisnosti.nadjiSekciju(id);
      if (!postojeca) {
        return odgovor({ error: "Sekcija ne postoji." }, 404);
      }

      const ishod = validirajSekciju(postojeca.kind, telo.telo.config);
      if (Object.keys(ishod.greske).length > 0) {
        return odgovor(
          { error: "Konfiguracija nije ispravna.", greske: ishod.greske },
          400,
        );
      }

      const nacrt = telo.telo.nacrt !== false;
      const pogodjeno = await zavisnosti.izmeniUslovno({
        id,
        verzija: verzija.verzija,
        config: sanitizujSekciju(postojeca.kind, ishod.vrednosti),
        vidljiva:
          typeof telo.telo.isActive === "boolean"
            ? telo.telo.isActive
            : undefined,
        nacrt,
        korisnikId: prijava.korisnikId,
      });

      // Nula pogođenih redova znači da je neko drugi već snimio. To je razlika
      // između vidljivog sukoba i tihog „poslednji pobeđuje”.
      if (pogodjeno === 0) return odgovorSukoba();

      await zavisnosti.ponistiKes(
        nacrt ? "nacrt" : "objava",
        postojeca.pageKey,
      );
      return odgovor({ sekcija: await zavisnosti.ucitaj(id) }, 200);
    } catch {
      prijaviTiho(zavisnosti.reportFailure, "PUT", "DATABASE");
      return odgovorNedostupno();
    }
  };
}

/* ------------------------------------------------------------------ *
 * DELETE /api/admin/sekcije/[id]
 * ------------------------------------------------------------------ */

export interface ZavisnostiBrisanja extends ZavisnostiSesije {
  nadjiSekciju: (id: string) => Promise<RedSekcije | null>;
  obrisiUslovno: (id: string, verzija: number) => Promise<number>;
  ponistiKes: (razlog: "nacrt" | "brisanje", pageKey: string) => Promise<void>;
}

export function createSekcijaDeleteHandler(zavisnosti: ZavisnostiBrisanja) {
  return async function DELETE(
    request: Request,
    kontekst: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "DELETE");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const { id } = await kontekst.params;

    const telo = await procitajTelo(request, zavisnosti, "DELETE");
    if (telo.status === "odgovor") return telo.odgovor;

    const verzija = procitajVerziju(telo.telo);
    if (verzija.status === "odgovor") return verzija.odgovor;

    try {
      const postojeca = await zavisnosti.nadjiSekciju(id);
      if (!postojeca) {
        return odgovor({ error: "Sekcija ne postoji." }, 404);
      }

      const obrisano = await zavisnosti.obrisiUslovno(id, verzija.verzija);
      if (obrisano === 0) return odgovorSukoba();

      // Brisanje neobjavljene sekcije ne menja javnu stranicu, pa keš ostaje.
      await zavisnosti.ponistiKes(
        postojeca.publishedAt === null ? "nacrt" : "brisanje",
        postojeca.pageKey,
      );
      return odgovor({ obrisano: true }, 200);
    } catch {
      prijaviTiho(zavisnosti.reportFailure, "DELETE", "DATABASE");
      return odgovorNedostupno();
    }
  };
}

/* ------------------------------------------------------------------ *
 * POST /api/admin/sekcije/redosled
 * ------------------------------------------------------------------ */

export interface StavkaRedosleda {
  id: string;
  version: number;
}

/**
 * Prima parove `{ id, version }`, ne go niz `ids`. Go niz bi značio „poslednji
 * pobeđuje”: dva otvorena taba bi se tiho pregazila, a rezultat bi bio redosled
 * koji nijedan od njih nije video.
 */
export function procitajStavkeRedosleda(
  vrednost: unknown,
): StavkaRedosleda[] | null {
  if (!Array.isArray(vrednost) || vrednost.length === 0) return null;
  if (vrednost.length > 200) return null;

  const stavke: StavkaRedosleda[] = [];
  const videni = new Set<string>();

  for (const red of vrednost) {
    if (typeof red !== "object" || red === null || Array.isArray(red)) {
      return null;
    }
    const { id, version } = red as Record<string, unknown>;

    if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
    if (
      typeof version !== "number" ||
      !Number.isSafeInteger(version) ||
      version < 0
    ) {
      return null;
    }
    // Isti id dvaput značio bi dva različita redna broja za istu sekciju.
    if (videni.has(id)) return null;
    videni.add(id);

    stavke.push({ id, version });
  }

  return stavke;
}

/** Baca se iz transakcije: jedini način da se preslagivanje poništi u celini. */
export class SukobRedosleda extends Error {
  constructor() {
    super("Redosled je u međuvremenu izmenjen.");
    this.name = "SukobRedosleda";
  }
}

export interface ZavisnostiRedosleda extends ZavisnostiSesije {
  presloziUTransakciji: (podaci: {
    pageKey: string;
    stavke: readonly StavkaRedosleda[];
    nacrt: boolean;
    korisnikId: string;
  }) => Promise<void>;
  ponistiKes: (razlog: "nacrt" | "redosled", pageKey: string) => Promise<void>;
}

export function createRedosledPostHandler(zavisnosti: ZavisnostiRedosleda) {
  return async function POST(request: Request): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "POST");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const telo = await procitajTelo(request, zavisnosti, "POST");
    if (telo.status === "odgovor") return telo.odgovor;

    const pageKey = kljucStranice(telo.telo);
    if (pageKey === null) {
      return odgovor({ error: "Neispravan ključ stranice." }, 400);
    }

    const stavke = procitajStavkeRedosleda(telo.telo.stavke);
    if (!stavke) {
      return odgovor(
        { error: "Očekuje se niz parova `{ id, version }` bez ponavljanja." },
        400,
      );
    }

    const nacrt = telo.telo.nacrt !== false;

    try {
      // Sve izmene u jednoj transakciji. Delimično preslagan spisak je gori od
      // neizmenjenog: redni brojevi bi se ponavljali ili preskakali, a stranica
      // bi se prikazala u redosledu koji niko nije tražio.
      await zavisnosti.presloziUTransakciji({
        pageKey,
        stavke,
        nacrt,
        korisnikId: prijava.korisnikId,
      });
    } catch (greska) {
      if (greska instanceof SukobRedosleda) return odgovorSukoba();
      prijaviTiho(zavisnosti.reportFailure, "POST", "DATABASE");
      return odgovorNedostupno();
    }

    await zavisnosti.ponistiKes(nacrt ? "nacrt" : "redosled", pageKey);
    return odgovor({ preslozeno: stavke.length }, 200);
  };
}

/* ------------------------------------------------------------------ *
 * POST /api/admin/sekcije/objavi
 * ------------------------------------------------------------------ */

export interface ZavisnostiObjave extends ZavisnostiSesije {
  objaviStranicu: (pageKey: string, korisnikId: string) => Promise<number>;
  ponistiKes: (razlog: "objava", pageKey: string) => Promise<void>;
}

/**
 * Objava ide po STRANICI, ne po sekciji.
 *
 * Nacrt je slika celog rasporeda. Da se sekcije objavljuju jedna po jedna,
 * posetilac bi između dva klika video mešavinu starog i novog — novi naslov
 * iznad starog rasporeda. Verzije se ne šalju: objava ne menja sadržaj nego
 * potvrđuje ono što je pročitano unutar iste transakcije.
 */
export function createObjaviPostHandler(zavisnosti: ZavisnostiObjave) {
  return async function POST(request: Request): Promise<Response> {
    const prijava = await prijaviAdmina(zavisnosti, "POST");
    if (prijava.status === "odgovor") return prijava.odgovor;

    const telo = await procitajTelo(request, zavisnosti, "POST");
    if (telo.status === "odgovor") return telo.odgovor;

    const pageKey = kljucStranice(telo.telo);
    if (pageKey === null) {
      return odgovor({ error: "Neispravan ključ stranice." }, 400);
    }

    let objavljeno: number;
    try {
      objavljeno = await zavisnosti.objaviStranicu(pageKey, prijava.korisnikId);
    } catch {
      prijaviTiho(zavisnosti.reportFailure, "POST", "DATABASE");
      return odgovorNedostupno();
    }

    await zavisnosti.ponistiKes("objava", pageKey);
    return odgovor({ objavljeno }, 200);
  };
}
