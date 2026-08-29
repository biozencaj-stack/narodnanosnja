# V2 rollout: bezbedan prelazak

Ova grana menja Prisma šemu i **ne sme** direktno na postojeću produkcionu
bazu. Kod je kompatibilno proširen, ali baza prvo mora dobiti nove
order/payment kolone, payment event dnevnik i expand-only kataloške tabele.

## Šta šema dodaje

- `Order.checkoutIdempotencyKey`, `Order.currency`,
  `Order.inventoryAllocated` i `OrderItem.inventoryStockId` za replay-safe
  checkout, pouzdan payment/inventory tok i precizno vraćanje rezervisane
  zalihe;
- `PROCESSING`/`REVIEW` payment statuse i neizmenjivi `PaymentEvent` dnevnik;
- opcioni `Product.productTypeId`;
- modele generičkog kataloga navedene u `CATALOG-MIGRATION-PLAN.md`.

Ništa postojeće se ne uklanja. `ProductSize` ostaje aktivni izvor zalihe dok
se generičke varijante ne popune i ne provere.

## Obavezan redosled

1. Napraviti proverljiv PostgreSQL backup i testirati restore.
2. Klonirati produkcionu bazu u izolovano staging okruženje.
3. Popisati realnu šemu i napraviti Prisma baseline; postojeća istorija sadrži
   samo parcijalnu localized-JSON migraciju.
4. Generisati expand SQL diff, ručno ga pregledati i sačuvati kao novu
   migraciju. Ne koristiti `prisma db push`.
5. Primeniti migraciju na klonu i pokrenuti Prisma validate/generate,
   TypeScript i produkcijski build.
6. Smoke testirati: anonimnu i prijavljenu porudžbinu, izgubljen/replayed
   create-order odgovor, kupon, nedovoljnu zalihu, istovremene porudžbine
   poslednjeg komada, otkazivanje, decline/release kupona i ponovljen ili
   kontradiktoran payment callback.
7. Seedovati tipove/atribute i pokrenuti idempotentni backfill iz zasebnog
   budućeg PR-a. Uporediti legacy i novi model pre uključivanja dual-read-a.
8. Tek tada zakazati produkcijski prozor, ponoviti backup, primeniti pregledanu
   migraciju i objaviti kod.

## Environment pre puštanja

- postaviti jak, zaseban `ORDER_ACCESS_SECRET`;
- postaviti i proveriti oba reCAPTCHA v3 ključa; production checkout je
  namerno fail-closed bez njih;
- ostaviti `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED=false` do sertifikacije banke;
- za NestPay podesiti oba HPP URL-a i tačne `NESTPAY_OK_URL` /
  `NESTPAY_FAIL_URL` HTTPS callback putanje na istom origin-u kao
  `NEXT_PUBLIC_SITE_URL`; ovaj tok prihvata isključivo RSD (`941`) i `Auth`;
- proveriti javni site URL, email, dostavu i capability flagove iz
  `.env.example`;
- `APPLY_DATABASE_MIGRATIONS=true` koristiti samo u kontrolisanom izdanju sa
  kompletnim migration chain-om. U redovnom deployu ostaje isključeno.

## Dodatni uslovi pre uključivanja kartica

- banka mora potvrditi stvarna imena/pokrivenost potpisanih callback polja;
- admin mora dobiti operativni inbox za `REVIEW` i reconciliation sa bankom;
- mora postojati cleanup za napuštene PENDING/PROCESSING rezervacije koji u
  jednoj transakciji vraća zalihu i kupon;
- email potvrde i ostali sporedni efekti treba da pređu na idempotentni outbox;
- staging mora dokazati preflight → kratkotrajni handoff → provider → callback
  tok, uključujući više tabova, refresh, 429/5xx i izgubljen odgovor.

Dok ove stavke nisu završene, capability ostaje isključen i javne stranice ne
obećavaju kartično plaćanje.

## Rollback

Expand migracija ne briše legacy podatke. Ako aplikacioni smoke test ne prođe,
vratiti prethodni build i ostaviti nove, neiskorišćene tabele/kolone na mestu;
njihovo hitno brisanje nije potrebno. Ako sama migracija ne prođe, ne podizati
novi build i vratiti staging/produkciju iz proverenog backupa prema unapred
uvežbanoj restore proceduri.
