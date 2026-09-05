import assert from "node:assert/strict";
import test from "node:test";
import { evaluateVerifiedLoginPolicy } from "./verified-login-policy";

/**
 * Redosled vremena u snimku korisnika nije formalnost.
 *
 * `assertValidPolicyState` odbija stanje u kome je `emailVerified` raniji od
 * `createdAt`. Ako nalog ikad bude upisan tako, prijava puca sa
 * `POLICY_DECISION / INTERNAL_FAILURE` — što u dnevniku izgleda kao kvar
 * politike, a zapravo je nemoguć redosled u podacima.
 *
 * Test postoji da ta veza bude vidljiva: ko ubuduće menja pravljenje naloga,
 * ovde vidi koje pravilo sme da prekrši.
 */

const OSNOVA = {
  role: "ADMIN" as const,
  policy: "audit" as const,
  emailVerificationLoginGraceUntil: null,
  stagedGraceDeadline: null,
};

test("verifikacija ne sme biti ranija od pravljenja naloga", () => {
  const napravljen = new Date("2026-09-04T10:00:00.500Z");

  assert.throws(() =>
    evaluateVerifiedLoginPolicy({
      ...OSNOVA,
      createdAt: napravljen,
      // Samo jedan milisekund ranije — dovoljno da stanje bude nemoguće.
      emailVerified: new Date(napravljen.getTime() - 1),
      evaluatedAt: new Date("2026-09-04T10:00:05.000Z"),
    }),
  );
});

test("verifikacija u istom trenutku ili kasnije prolazi", () => {
  const napravljen = new Date("2026-09-04T10:00:00.500Z");
  const ocenjen = new Date("2026-09-04T10:00:05.000Z");

  for (const pomak of [0, 1, 1000]) {
    const ishod = evaluateVerifiedLoginPolicy({
      ...OSNOVA,
      createdAt: napravljen,
      emailVerified: new Date(napravljen.getTime() + pomak),
      evaluatedAt: ocenjen,
    });
    assert.equal(ishod.allowed, true, `pomak ${pomak}`);
    assert.equal(ishod.reason, "VERIFIED", `pomak ${pomak}`);
  }
});

test("verifikacija posle trenutka ocene se takođe odbija", () => {
  assert.throws(() =>
    evaluateVerifiedLoginPolicy({
      ...OSNOVA,
      createdAt: new Date("2026-09-04T10:00:00.000Z"),
      emailVerified: new Date("2026-09-04T10:00:10.000Z"),
      evaluatedAt: new Date("2026-09-04T10:00:05.000Z"),
    }),
  );
});

test("pod politikom audit neverifikovan nalog i dalje prolazi", () => {
  // Zato odbijanje NIJE moguć uzrok pada pod `audit` — jedino provera stanja.
  const ishod = evaluateVerifiedLoginPolicy({
    ...OSNOVA,
    createdAt: new Date("2026-09-04T10:00:00.000Z"),
    emailVerified: null,
    evaluatedAt: new Date("2026-09-04T10:00:05.000Z"),
  });
  assert.equal(ishod.allowed, true);
  assert.equal(ishod.reason, "AUDIT_WOULD_DENY");
});
