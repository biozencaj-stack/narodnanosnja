# CLAUDE.md

Uputstvo za Claude Code na ovom projektu. Pročitaj ga pre bilo kakve izmene.

## Šta je ovo

Prodavnica ručno tkanih proizvoda narodne nošnje. Next.js 16 + Prisma +
PostgreSQL, sa ugrađenim CMS-om. Nastalo iz `ecommerce-cms-template`.

Prezentacioni deo (priča o nošnjama, pojmovnik, tehnike) za sada živi kao
zaseban statički sajt i objavljuje se na GitHub Pages. Plan je da se ta građa
preseli ovde, u Articles.

## ⚠️ Ovaj projekat deli repozitorijum sa prezentacionim sajtom

Oba dela guraju u `biozencaj-stack/narodnanosnja`, ali su im istorije
**nepovezane** — prodavnica je počela kao zaseban `git init`, pa repo ima dva
korena.

| Grana | Šta je | Objavljivanje |
| --- | --- | --- |
| `main` | prezentacioni statički sajt | GitHub Pages |
| `verzija/v2.0-univerzalna-platforma` | **ova prodavnica** | `objavi.yml` iz ove grane |

**Nikada ne spajaj ovu granu u `main`.** Push na `main` objavljuje
prezentacioni sajt; spajanje bi oborilo njegov build ili objavilo pogrešan
sadržaj na javnu adresu. Git odbija spajanje bez
`--allow-unrelated-histories`, ali to je slučajna zaštita — ne oslanjati se
na nju.

Kad se u dokumentaciji pominje „spajanje prezentacionog dela u prodavnicu“,
misli se na **prenos sadržaja** u Articles, ne na git merge.

---

## ⚠️ Pravilo broj jedan: svaka nova verzija ide na svoju granu

**Nikada ne radi direktno na `main`.** Svaki put kad kreneš u novu verziju,
novu funkcionalnost ili veću izmenu, prvo napravi granu:

```bash
git checkout main && git pull
git checkout -b verzija/v1.1-galerija-proizvoda
```

| Vrsta posla        | Oblik imena                | Primer                        |
| ------------------ | -------------------------- | ----------------------------- |
| Nova verzija       | `verzija/vX.Y-kratak-opis` | `verzija/v1.1-fotografije`    |
| Nova funkcionalnost| `dodatak/kratak-opis`      | `dodatak/nestpay-kartice`     |
| Ispravka greške    | `ispravka/kratak-opis`     | `ispravka/zbir-u-korpi`       |
| Samo sadržaj       | `sadrzaj/kratak-opis`      | `sadrzaj/opisi-proizvoda`     |

Push na `main` znači objavljivanje, pa `main` mora u svakom trenutku biti ispravan.

## ⚠️ Pravilo broj dva: održavaj ovaj fajl

Kad dodaš stranicu, model u bazi, skript ili promeniš način rada —
**dopuni CLAUDE.md u istom commit-u**.

---

## Naredbe

```bash
npm install --legacy-peer-deps   # OBAVEZNO --legacy-peer-deps, vidi zamke
npx prisma generate
npm run dev                      # razvojni server
npm run build                    # produkcijski build
npm run lint                     # ESLint 9 flat config; greške blokiraju CI
npm run typecheck                # stroga TypeScript provera bez emitovanja
npm test                         # automatski pronalazi sve lib/**/*.test.ts
npm run test:e2e                 # Playwright; samo nad jasno označenom test bazom
npx tsx scripts/uvoz-nosnja.ts   # uvoz kategorija i proizvoda iz podaci/
npx tsx scripts/create-admin.ts --email … --password … --role ADMIN
```

## Zamke koje su već jednom pojele vreme

- **`npm install` bez `--legacy-peer-deps` puca.** `next-auth@4` još ne
  prihvata React 19 kao peer zavisnost. Nije pokvareno — samo mora zastavica.
- **npm 11 blokira install skripte paketa.** Posle instalacije ručno pokreni
  `npx prisma generate`, inače Prisma klijent ne postoji.
- **Fontovima treba `latin-ext`.** Bez tog podskupa srpske dijakritike
  (č, ć, š, ž, đ) tiho padnu na rezervni font. Ako dodaješ ćirilicu, treba i
  `cyrillic`. Zatečeni `Libre_Baskerville` je imao samo `latin`.
- **Podrazumevana paleta stoji u CSS-u, runtime paleta u Settings.** Admin
  vrednosti se postavljaju kao CSS promenljive iz `app/layout.tsx`; pri
  dodavanju novog semantičkog tokena dopuni i registry i `storeThemeStyle`.
- **Portovi na serveru su zauzeti.** 3000 (shopdemo), 3001 (kore), 3002, 8000,
  8080. Ova prodavnica radi na **3007**, nginx je izlaže na **8090**.

## Struktura

```
app/            Next.js App Router
  (shop)/         prodavnica: katalog, proizvod, korpa, checkout
  (user)/         nalog kupca: porudžbine, adrese, favoriti
  (legal)/        pravne stranice propisane za webshop u Srbiji
  admin/          CMS — proizvodi, porudžbine, kategorije, članci, statistika
  api/            REST rute
components/     React komponente
lib/            poslovna logika
  email/smtp.ts   jedina SMTP transport/TLS konfiguracija
prisma/         schema.prisma i migracije
podaci/         izvorni podaci o nošnji — kategorije i proizvodi (JSON)
scripts/        uvoz-nosnja.ts, create-admin.ts, backup.sh, restore.sh
messages/       prevodi (sr, en)
```

## Podaci o proizvodima

Izvor istine za početno punjenje je `podaci/` — isti JSON koji koristi i
statički sajt. `scripts/uvoz-nosnja.ts` ih upisuje preko `slug`-a, pa se može
pokretati više puta bez dupliranja i **ništa ne briše**.

Posle prvog uvoza proizvode uređuj kroz admin panel, ne kroz JSON — inače
ponovni uvoz pregazi izmene urađene u panelu.

Mapiranje koje nije očigledno:
- sniženje: puna cena ide u `price`, snižena u `salePrice`, `onSale = true`
- `stanje: rasprodato` → veličina „Univerzalna“ sa zalihom 0
- `stanje: po-porudzbini` → zaliha 99 (može se naručiti, samo se duže čeka)
- engleski prevodi **ne postoje** — u `{ sr, en }` poljima svuda stoji srpski

## Generički katalog (v2, expand-only)

Arhitektonske granice platforme i redosled narednih faza su u
`docs/ARCHITECTURE-V2.md`.

`prisma/schema.prisma` sadrži novu, opcionu osnovu za više branši:

- `ProductType` i tipizovane definicije/vrednosti atributa određuju dinamička
  polja proizvoda;
- `ProductOption` / `ProductOptionValue` predstavljaju prodajne ose kao što su
  veličina, boja, pakovanje i ukus;
- `ProductVariantOptionValue` povezuje te vrednosti sa postojećim
  `ProductVariant` modelom.

Legacy `ProductSize` i specifična polja proizvoda se i dalje koriste. Ne
uklanjaj ih i ne prebacuj storefront na novi model bez planiranog backfilla i
dual-read provere. Potpun redosled je u
`docs/CATALOG-MIGRATION-PLAN.md`. Admin API za tipove i atribute postoji, ali
se ne poziva pre eksplicitne expand migracije baze.

## Checkout i porudžbine (v2)

- Browser šalje samo identitet artikla/opcije i količinu. `buildCheckoutQuote`
  iz baze računa cenu, popuste, dostavu i total.
- `createSecureOrder` u Serializable transakciji ponovo proverava cenu,
  atomarno skida zalihu i upisuje snapshot porudžbine.
- Svaki browser checkout pokušaj šalje stabilan `Idempotency-Key`, a
  `Order.checkoutIdempotencyKey` je unique. Ne uklanjaj ga: izgubljen odgovor
  inače pravi duple porudžbine i rezervacije.
- Otkazivanje/decline vraća zalihu i rezervisani kupon najviše jednom.
- Gost pristupa detaljima porudžbine kratkotrajnim HMAC tokenom u zasebnom
  HttpOnly/SameSite cookie-ju po porudžbini; CUID nije autentifikacija.
  Recovery idempotency ključ je ograničen na minimalni CARD PENDING/PROCESSING
  snapshot i dva sata. Podesi zaseban `ORDER_ACCESS_SECRET`.
- reCAPTCHA token se proverava u samom order handleru neposredno pre quote-a i
  rezervacije zalihe; zasebna klijentska verifikacija nije autorizacija.
- Kartice su capability flagom isključene dok banka i NestPay tok nisu
  sertifikovani. Iznos payment zahteva uvek se čita iz porudžbine u bazi;
  preflight izdaje kratkotrajan handoff za pravi top-level POST banci.

## Centralna podešavanja (v2)

`Setting` tabela je dozvoljeni, tipizovani runtime registry. Admin stranica
`/admin/settings` uređuje identitet, kontakt, SEO, semantičku paletu, radno
vreme, dostavu i minimalnu porudžbinu. `.env` vrednosti su samo fallback za
prvo pokretanje; tajne baze, emaila i plaćanja nikada ne idu u `Setting`.

`lib/config/capabilities.ts` kontroliše module koji smeju da budu javno
vidljivi. Ne prikazuj kartice, lokacije, dokumente, jezike ili chat ako njihov
capability nije uključen i stvarna usluga nije spremna.

## SMTP i slanje emaila (v2)

Svaki email tok mora praviti transport isključivo kroz
`lib/email/smtp.ts`; ne dodavati zaseban `nodemailer.createTransport` u ruti ili
template modulu. Port 465 koristi implicitni TLS, a svaki drugi port zahteva
uspešan STARTTLS. Validacija sertifikata je podrazumevana i obavezna van
`development`/`test` okruženja. Lokalni self-signed izuzetak dodatno prihvata
samo loopback SMTP host. Host, korisničko ime, lozinka, boolean TLS zastavica i
port proveravaju se pre pravljenja transporta; produkcija ne sme tiho pasti na
localhost, plaintext ili no-auth slanje.

## Admin uloge (v2)

Politika je deny-by-default u `lib/auth/admin-policy.ts` i sprovodi se u
`proxy.ts`. `ADMIN` ima pun pristup. `OPERATOR` ima samo porudžbine/status i
poruke kupaca. Svaka nova admin ruta mora dobiti eksplicitnu odluku u politici
i sopstvenu serversku proveru; skrivanje linka nije autorizacija.

## Rich HTML i browser bezbednost (v2)

Javni rich HTML nikada ne prosleđuj direktno u `dangerouslySetInnerHTML`.
Članci, FAQ odgovori i lokalizovani opisi proizvoda prolaze kroz allow-list
helper-e u `lib/security/html.ts` pri admin upisu i ponovo na javnoj read/render
granici. Novi HTML sink mora koristiti isti sloj i dobiti negativan XSS test.
JSON-LD se serijalizuje isključivo kroz `serializeJsonLd`.

Globalni browser headeri su u `next.config.ts`. `ENABLE_HSTS=true` se uključuje
tek kada javni domen i svi poddomeni zaista rade isključivo preko HTTPS-a.
Unsafe API write zahtevi moraju proći same-origin proveru u `proxy.ts`; javni
payment-provider callback ostaje eksplicitno izuzet pre te provere.

## Browser E2E (v2)

`e2e/purchase-flow.spec.ts` proverava mobilni tok katalog → proizvod → korpa →
checkout → uspešna COD porudžbina. `scripts/seed-e2e.ts` je idempotentan, ali
namerno odbija svaku bazu čiji naziv jasno ne sadrži `e2e`, `test` ili
`provera`. Nikada ne zaobilazi tu zaštitu i nikada ne pokreći E2E seed nad
produkcijskom bazom. CI koristi zaseban PostgreSQL service i instalira Chromium
pre browser testa.

## Server

Hetzner VPS `SERVER_HOST`, pristup preko `SSH_KEY_PATH` kao `SERVER_USER`.

```
/var/www/narodnanosnja     kod
PM2 proces: narodnanosnja  port 3007
nginx: /etc/nginx/sites-available/narodnanosnja  port 8090
baza: narodnanosnja_db, korisnik nosnja
```

Na istom serveru rade i `shopdemo`, `kore` i `kockica` — **ne diraj ih.**

`.env` postoji samo na serveru i nije u gitu. Šablon je `.env.example`.

## Šta još nije urađeno

- [ ] Fotografije proizvoda — sve su prazne, stoje sivi mestodržači
- [ ] Pravi domen i HTTPS (sada samo IP i port 8090)
- [ ] Prenos građe o nošnjama iz statičkog sajta u Articles
- [ ] Baseline + expand migracija generičkog kataloga na klonu produkcione baze
- [ ] Backfill i dual-read generičkih atributa/opcija u ProductForm/storefrontu
- [ ] Dinamički filteri izvedeni iz `AttributeDefinition` umesto legacy polja
- [ ] Page builder za početnu, zajednička medijateka i redirect/404 SEO centar
- [ ] Zone/težinska pravila i integracija kurirske službe
- [ ] NestPay kartice — tek kad postoji ugovor sa bankom; do tada radi pouzeće
- [ ] Cleanup napuštenih payment rezervacija, REVIEW reconciliation i email outbox

## Bezbedno objavljivanje šeme

`scripts/deploy.sh` više nikada ne pada nazad na `prisma db push`. Automatske
migracije su podrazumevano isključene i zahtevaju
`APPLY_DATABASE_MIGRATIONS=true`. Za v2 prvo pratiti
`docs/V2-ROLL-OUT.md`; ne spajati/deployovati ovu granu na postojeću bazu pre
baseline probe i eksplicitne expand migracije.
