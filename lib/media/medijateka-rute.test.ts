import assert from "node:assert/strict";
import test from "node:test";
import type { ServerSessionResolution } from "../auth/server-session-contract";
import {
  createMedijatekaDeleteHandler,
  createMedijatekaGetHandler,
} from "./medijateka-rute";

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

function zahtev(adresa = "http://x/api/admin/medijateka") {
  return new Request(adresa, { method: "GET" });
}

test("OPERATOR ne vidi medijateku, anoniman dobija 401", async () => {
  const nadji = async () => {
    throw new Error("ne sme se stići dovde");
  };

  const operater = createMedijatekaGetHandler({
    resolveSession: async () => OPERATER,
    nadjiAssete: nadji,
    reportFailure: () => undefined,
  });
  assert.equal((await operater(zahtev())).status, 403);

  const anoniman = createMedijatekaGetHandler({
    resolveSession: async () => ({ status: "anonymous" }),
    nadjiAssete: nadji,
    reportFailure: () => undefined,
  });
  assert.equal((await anoniman(zahtev())).status, 401);
});

test("nepoznata fascikla se odbija pre upita", async () => {
  // Vrednost iz adrese nikad ne ulazi u filter neproverena.
  const rukovalac = createMedijatekaGetHandler({
    resolveSession: async () => ADMIN,
    nadjiAssete: async () => {
      throw new Error("ne sme se stići dovde");
    },
    reportFailure: () => undefined,
  });

  const odgovor = await rukovalac(
    zahtev("http://x/api/admin/medijateka?folder=../etc"),
  );
  assert.equal(odgovor.status, 400);
});

test("brisanje slike koja je u upotrebi vraća 409 i spisak sekcija", async () => {
  // Golo „ne može” ostavlja administratora da pogađa po ekranima gde je slika.
  let obrisano = false;
  const rukovalac = createMedijatekaDeleteHandler({
    resolveSession: async () => ADMIN,
    nadjiUpotrebe: async () => [
      { sectionId: "s1", pageKey: "home", kind: "hero", polje: "slike[0]" },
    ],
    obrisiAsset: async () => {
      obrisano = true;
      return 1;
    },
    reportFailure: () => undefined,
  });

  const odgovor = await rukovalac(zahtev(), {
    params: Promise.resolve({ id: "a1" }),
  });

  assert.equal(odgovor.status, 409);
  assert.equal(obrisano, false, "slika u upotrebi ne sme biti obrisana");

  const telo = (await odgovor.json()) as { upotrebe: unknown[] };
  assert.equal(telo.upotrebe.length, 1);
});

test("neupotrebljena slika se briše, nepostojeća daje 404", async () => {
  const napravi = (koliko: number) =>
    createMedijatekaDeleteHandler({
      resolveSession: async () => ADMIN,
      nadjiUpotrebe: async () => [],
      obrisiAsset: async () => koliko,
      reportFailure: () => undefined,
    });

  const kontekst = { params: Promise.resolve({ id: "a1" }) };
  assert.equal((await napravi(1)(zahtev(), kontekst)).status, 200);
  assert.equal(
    (await napravi(0)(zahtev(), {
      params: Promise.resolve({ id: "a1" }),
    })).status,
    404,
  );
});

test("odgovori medijateke se ne keširaju", async () => {
  const rukovalac = createMedijatekaGetHandler({
    resolveSession: async () => ADMIN,
    nadjiAssete: async () => [],
    reportFailure: () => undefined,
  });

  const odgovor = await rukovalac(zahtev());
  assert.equal(
    odgovor.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});
