import assert from "node:assert/strict";
import test from "node:test";
import { uPromocijuZaPrikaz } from "./promotions-prikaz";

const RED = {
  id: "p1",
  name: "Zimska akcija",
  type: "PERCENT_OFF",
  value: "15.00",
  description: null,
  code: null,
  minQuantity: null,
  endDate: new Date("2026-12-31T22:00:00.000Z"),
};

test("promocija za prikaz nosi trenutak isteka", () => {
  // Bez `endDate` odbrojavanje nema do čega da broji. Ranije se NIJE vraćao, pa
  // je tip `odbrojavanje` morao da ga čita zaobilazno.
  assert.equal(uPromocijuZaPrikaz(RED).endDate, "2026-12-31T22:00:00.000Z");
});

test("`Decimal` vrednost prelazi granicu kao broj, ne kao objekat", () => {
  assert.equal(uPromocijuZaPrikaz(RED).value, 15);
  assert.equal(typeof uPromocijuZaPrikaz(RED).value, "number");
});

test("`endDate` je string, ne `Date`", () => {
  // `Date` bi se pri serijalizaciji ka klijentu tiho pretvorio u string; bolje
  // da granica bude izričita nego da zavisi od toga ko je serijalizuje.
  assert.equal(typeof uPromocijuZaPrikaz(RED).endDate, "string");
});
