import assert from "node:assert/strict";
import test from "node:test";
import type { ServerSessionResolution } from "../auth/server-session-contract";
import { podrazumevanaKonfiguracija } from "./registar";
import {
  createObjaviPostHandler,
  createRedosledPostHandler,
  createSekcijaPutHandler,
  createSekcijePostHandler,
  procitajStavkeRedosleda,
  SukobRedosleda,
  type RedSekcije,
} from "./rute";

/**
 * Rukovaoci su fabrike sa ubrizganim zavisnostima, pa se statusi i granice
 * proveravaju ovde — bez PostgreSQL-a, bez Next runtime-a i bez pretvaranja da
 * je HTTP odgovor dokaz da je upit tačan.
 */

const ADMIN: ServerSessionResolution = Object.freeze({
  status: "authenticated",
  principal: Object.freeze({
    id: "admin-1",
    email: "a@example.com",
    firstName: "A",
    lastName: "B",
    name: "A B",
    role: "ADMIN" as const,
    requiresEmailVerification: false,
  }),
});

const OPERATER: ServerSessionResolution = Object.freeze({
  status: "authenticated",
  principal: { ...ADMIN.principal, role: "OPERATOR" as const },
});

function zahtev(telo: unknown, url = "http://x/api/admin/sekcije"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(telo),
  });
}

function kontekst(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** PUT traži ispravnu konfiguraciju pre nego što uopšte dođe do verzije. */
const VALJANA = podrazumevanaKonfiguracija("naslov");

const SEKCIJA: RedSekcije = {
  id: "s1",
  kind: "naslov",
  pageKey: "home",
  version: 3,
  publishedAt: new Date(),
};

function putRukovalac(nadgradnja: Partial<Parameters<typeof createSekcijaPutHandler>[0]> = {}) {
  return createSekcijaPutHandler({
    resolveSession: async () => ADMIN,
    nadjiSekciju: async () => SEKCIJA,
    izmeniUslovno: async () => 1,
    ucitaj: async () => ({ id: "s1" }),
    ponistiKes: async () => undefined,
    reportFailure: () => undefined,
    ...nadgradnja,
  });
}

test("bez prijave rukovalac vraća 401, ne sadržaj", async () => {
  const odgovor = await putRukovalac({
    resolveSession: async () => ({ status: "anonymous" }),
  })(zahtev({ version: 3 }), kontekst("s1"));

  assert.equal(odgovor.status, 401);
});

test("nedostupna sesija je 503, ne 401", async () => {
  // Razlika je bitna: 401 bi posetioca poslao na prijavu koja bi pala isto.
  const odgovor = await putRukovalac({
    resolveSession: async () => ({ status: "unavailable" }),
  })(zahtev({ version: 3 }), kontekst("s1"));

  assert.equal(odgovor.status, 503);
});

test("OPERATOR ne sme da menja sekcije", async () => {
  const odgovor = await putRukovalac({ resolveSession: async () => OPERATER })(
    zahtev({ version: 3 }),
    kontekst("s1"),
  );

  assert.equal(odgovor.status, 403);
});

test("izmena bez `version` dobija 428, a ne 400", async () => {
  // Klijentu nedostaje preduslov; nije poslao smeće. 428 mu kaže da ponovo
  // učita sekciju, dok bi 400 sugerisao da je telo pogrešno sastavljeno.
  const odgovor = await putRukovalac()(zahtev({}), kontekst("s1"));

  assert.equal(odgovor.status, 428);
});

test("izmena sa zastarelom verzijom dobija 409, ne tiho prepisivanje", async () => {
  // Nula pogođenih redova znači da je drugi tab već snimio. Bez ovoga bi važilo
  // „poslednji pobeđuje” i prvi snimak bi nestao bez ijedne poruke.
  const odgovor = await putRukovalac({ izmeniUslovno: async () => 0 })(
    zahtev({ version: 1, config: VALJANA }),
    kontekst("s1"),
  );

  assert.equal(odgovor.status, 409);
});

test("negativna ili razlomljena verzija je 400", async () => {
  for (const version of [-1, 1.5, "3", true]) {
    const odgovor = await putRukovalac()(zahtev({ version }), kontekst("s1"));
    assert.equal(odgovor.status, 400, String(version));
  }
});

test("čuvanje nacrta ne poništava keš, objava poništava", async () => {
  const pozivi: string[] = [];
  const rukovalac = putRukovalac({
    ponistiKes: async (razlog) => {
      pozivi.push(razlog);
    },
  });

  await rukovalac(zahtev({ version: 3, config: VALJANA }), kontekst("s1"));
  await rukovalac(
    zahtev({ version: 3, config: VALJANA, nacrt: false }),
    kontekst("s1"),
  );

  assert.deepEqual(pozivi, ["nacrt", "objava"]);
});

test("granica po tipu se sprovodi u ruti, ne samo u obrascu", async () => {
  // Obrazac sakrije dugme, ali ruta prima i direktan zahtev.
  const rukovalac = createSekcijePostHandler({
    resolveSession: async () => ADMIN,
    prebrojTipNaStrani: async () => 3,
    poslednjiRedosled: async () => 0,
    napravi: async () => {
      throw new Error("ne sme se stići dovde");
    },
    reportFailure: () => undefined,
  });

  const odgovor = await rukovalac(zahtev({ kind: "proizvodi" }));
  assert.equal(odgovor.status, 409);
});

test("nepoznat tip sekcije se odbija pre ijednog upisa", async () => {
  const rukovalac = createSekcijePostHandler({
    resolveSession: async () => ADMIN,
    prebrojTipNaStrani: async () => 0,
    poslednjiRedosled: async () => null,
    napravi: async () => {
      throw new Error("ne sme se stići dovde");
    },
    reportFailure: () => undefined,
  });

  assert.equal((await rukovalac(zahtev({ kind: "nepostojeci" }))).status, 400);
});

test("nova sekcija se pravi kao neobjavljena, na kraj spiska", async () => {
  let zabelezeno: { order: number } | null = null;
  const rukovalac = createSekcijePostHandler({
    resolveSession: async () => ADMIN,
    prebrojTipNaStrani: async () => 0,
    poslednjiRedosled: async () => 4,
    napravi: async (podaci) => {
      zabelezeno = { order: podaci.order };
      return { id: "novo" };
    },
    reportFailure: () => undefined,
  });

  const odgovor = await rukovalac(zahtev({ kind: "naslov" }));
  assert.equal(odgovor.status, 201);
  assert.deepEqual(zabelezeno, { order: 5 });
});

test("redosled prima parove, a ne go niz identifikatora", () => {
  assert.equal(procitajStavkeRedosleda(["a", "b"]), null);
  assert.equal(procitajStavkeRedosleda([]), null);
  assert.equal(procitajStavkeRedosleda([{ id: "a" }]), null);
  // Isti id dvaput značio bi dva različita redna broja za istu sekciju.
  assert.equal(
    procitajStavkeRedosleda([
      { id: "a", version: 0 },
      { id: "a", version: 1 },
    ]),
    null,
  );
  assert.deepEqual(procitajStavkeRedosleda([{ id: "a", version: 2 }]), [
    { id: "a", version: 2 },
  ]);
});

test("sukob pri preslagivanju vraća 409 i ne poništava keš", async () => {
  let kesPonisten = false;
  const rukovalac = createRedosledPostHandler({
    resolveSession: async () => ADMIN,
    presloziUTransakciji: async () => {
      throw new SukobRedosleda();
    },
    ponistiKes: async () => {
      kesPonisten = true;
    },
    reportFailure: () => undefined,
  });

  const odgovor = await rukovalac(
    zahtev({ stavke: [{ id: "a", version: 0 }] }),
  );

  assert.equal(odgovor.status, 409);
  assert.equal(kesPonisten, false);
});

test("objava se odbija za neispravan ključ stranice", async () => {
  const rukovalac = createObjaviPostHandler({
    resolveSession: async () => ADMIN,
    objaviStranicu: async () => {
      throw new Error("ne sme se stići dovde");
    },
    ponistiKes: async () => undefined,
    reportFailure: () => undefined,
  });

  // Dvotačka je zabranjena i u bazi (CHECK) i ovde, dok odluka o dometu
  // `stranica:<slug>` ne bude doneta.
  const odgovor = await rukovalac(zahtev({ pageKey: "stranica:o-nama" }));
  assert.equal(odgovor.status, 400);
});

test("telo koje nije JSON objekat se odbija", async () => {
  const rukovalac = putRukovalac();

  const niz = new Request("http://x/", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "[1,2,3]",
  });
  assert.equal((await rukovalac(niz, kontekst("s1"))).status, 400);

  const bezTipa = new Request("http://x/", {
    method: "PUT",
    body: "{}",
  });
  assert.equal((await rukovalac(bezTipa, kontekst("s1"))).status, 415);
});

test("odgovori admin ruta se ne keširaju", async () => {
  const odgovor = await putRukovalac()(
    zahtev({ version: 3, config: VALJANA }),
    kontekst("s1"),
  );
  assert.equal(
    odgovor.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});
