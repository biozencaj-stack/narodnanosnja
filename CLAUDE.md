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
| `verzija/v2.0-univerzalna-platforma` | **ova prodavnica** | CI bez deploya |
| `prodavnica-v2-YYYYMMDD-N` tag | pregledani V2 release | jedini dozvoljeni VPS deploy okidač |

**Nikada ne spajaj ovu granu u `main`.** Push na `main` objavljuje
prezentacioni sajt; spajanje bi oborilo njegov build ili objavilo pogrešan
sadržaj na javnu adresu. Git odbija spajanje bez
`--allow-unrelated-histories`, ali to je slučajna zaštita — ne oslanjati se
na nju.

Kad se u dokumentaciji pominje „spajanje prezentacionog dela u prodavnicu“,
misli se na **prenos sadržaja** u Articles, ne na git merge.

---

## ⚠️ Pravilo broj jedan: svaka izmena ide sa kanonske V2 grane

**Nikada ne radi direktno na `main` niti na kanonskoj V2 grani.** Svaki put kad
kreneš u novu verziju, funkcionalnost ili ispravku, napravi novu granu sa
aktuelnog remote V2 stanja:

```bash
git fetch origin verzija/v2.0-univerzalna-platforma
git switch --no-track -c dodatak/kratak-opis \
  origin/verzija/v2.0-univerzalna-platforma
```

| Vrsta posla        | Oblik imena                | Primer                        |
| ------------------ | -------------------------- | ----------------------------- |
| Nova verzija       | `verzija/vX.Y-kratak-opis` | `verzija/v1.1-fotografije`    |
| Nova funkcionalnost| `dodatak/kratak-opis`      | `dodatak/nestpay-kartice`     |
| Ispravka greške    | `ispravka/kratak-opis`     | `ispravka/zbir-u-korpi`       |
| Samo sadržaj       | `sadrzaj/kratak-opis`      | `sadrzaj/opisi-proizvoda`     |

Pull request se otvara ka `verzija/v2.0-univerzalna-platforma`. Push na tu
granu pokreće CI, ali nikada produkcijski deploy. Ručni `workflow_dispatch`
takođe je verification-only. Produkciju može da pokrene isključivo push
pregledanog taga oblika `prodavnica-v2-YYYYMMDD-N`, i to tek na poslednjoj
odobrenoj rollout fazi.

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
- Cleanup rezervacija automatski otkazuje i oslobađa zalihu/kupon samo za
  istekao `CARD` order koji je i dalje `PENDING`, ima payment `PENDING`,
  `inventoryAllocated=true` i nema ni `Transaction` ni `PaymentEvent` trag.
  `CASH` porudžbine se nikada ne otkazuju ovim tokom.
- Stara rezervacija sa bilo kakvom payment aktivnošću, kao i stari
  `PROCESSING`, prelazi u `REVIEW` i zadržava zalihu i kupon do ručnog
  reconciliation-a. Pending/recovery prozor je dva sata; processing review
  prozor je podrazumevano 24 sata i može se ograničeno podesiti kroz
  `ORDER_PROCESSING_REVIEW_MINUTES`.
- Maintenance endpoint je isključivo `POST /api/cron/order-reservations`,
  zahteva zaseban Bearer secret od najmanje 32 znaka i podrazumevano radi
  dry-run. Serverski poziv mora poslati i `Origin` jednak javnom origin-u jer
  unsafe API rute ostaju iza fail-closed same-origin provere. Svaki kandidat
  koji ostane `failed` obara poziv sa HTTP 500 da scheduler ne prijavi lažan
  uspeh.
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

## Newsletter odjava (v2)

Tokeni i URL za odjavu nastaju isključivo kroz
`lib/newsletter/unsubscribe.ts`. U produkciji podesi jak, zaseban
`NEWSLETTER_UNSUBSCRIBE_SECRET`; jaki `NEXTAUTH_SECRET` se prihvata samo kao
prelazna kompatibilnost za ranije poslate linkove kada je
`NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY=true`; po završetku migracionog
perioda vrati flag na `false`. Ne uvodi javni fallback ključ. GET link nikada
ne menja stanje: vodi na `noindex`/`no-referrer` stranicu za potvrdu, a tek
potpisani POST nakon izričitog klika atomarno deaktivira korisničku i gostujuću
pretplatu. Uspešan odgovor je idempotentan i ne otkriva da li email postoji u
bazi.

## Autentifikacija i email verifikacija (v2)

`lib/auth/config.ts` je jedini izvor `NEXTAUTH_SECRET`, auth session/JWT roka i
izbora secure session cookie-ja. Ne uvoditi fallback secret niti ponavljati
NextAuth cookie heuristiku u ruti ili proxy-ju. Secret mora biti najmanje 32
UTF-8 bajta, bez okolnih razmaka, nov i kriptografski nasumičan; poznati javni
placeholder-i su namerno odbijeni. U produkciji su obavezni `NEXTAUTH_URL` i
HTTPS, dok `NEXT_PUBLIC_SITE_URL` prolazi kroz `getStorefrontUrl()`.

Standardna sesija, JWT i sesija iz email-verification toka imaju isti rok od 24
sata. `proxy.ts`, NextAuth i verify ruta moraju koristiti isti secret, isti
secure-cookie izbor i isto ime cookie-ja. Verifikaciona ruta mora pre DB
mutacije validirati konfiguraciju i redirect URL, potpisati sesiju i potpuno
pripremiti odgovor sa cookie-jem. Tek zatim jedna transakcija conditional
`deleteMany` claim-om troši još važeći token, postavlja `emailVerified` i briše
sve sibling verification tokene. Svaka izmena tog redosleda mora zadržati unit
testove za encode/response/commit greške i opt-in PostgreSQL concurrency test.

Email verification je trajno prefetch-safe pravilo, ne privremeni UI detalj.
Kanonski link iz emaila vodi na serversku `/verify-email/[token]` stranicu koja
ne čita bazu, ne menja nalog, ne troši token i ne izdaje sesiju. Stranica mora
ostati upotrebljiva kao običan HTML: eksplicitni native same-origin `POST` se
šalje tek nakon korisničkog klika. Legacy API `GET` i `HEAD` smeju samo da vrate
`303 See Other` ka toj confirmation stranici, bez tela, session cookie-ja ili
DB/session/token rada. Prefetch, link preview i email skener nikada ne smeju
postati mutirajući signal; nova potvrda ili magic-login tok ne smeju vratiti
mutaciju na `GET`.

Mutirajući `POST /api/auth/verify-email/[token]` mora lokalno proveriti trusted
same-origin write pre čitanja parametara, auth konfiguracije, sesije ili baze,
jer je širi `/api/auth` prostor izuzet od globalnog origin guard-a zbog
NextAuth callbackova. Prihvata se samo tačno 64 heksadecimalna znaka, uz
lowercase kanonizaciju. Posle te lokalne provere, ali pre auth konfiguracije,
session čitanja i baze, zahtev mora biti i na kanonskom storefront originu.
Trusted alias-host POST sme samo da vrati `303` ka kanonskoj confirmation
stranici, bez lookup-a, commita ili cookie-ja; inače bi host-only session cookie
nestao pri redirectu na kanonski domen. Istekli token se prijavljuje bez
brisanja. Ako je u pregledaču aktivna sesija drugog korisnika, potvrda mora biti
odbijena bez izdavanja sesije i bez potrošnje tokena; ista ili odsutna sesija
sme da nastavi.

Uspešan redosled ostaje: session encode → potpuno pripremljen `303` odgovor sa
24-časovnim centralno imenovanim cookie-jem → atomski conditional token claim,
`emailVerified` upis i brisanje sibling tokena. Prepared odgovor se vraća tek
posle uspešnog commita. Conflict ili bilo koja kasnija greška ne smeju poslati
prepared cookie; neuspeh ostaje retryable ili invalid-token ishod sa stage-only
logom. Tako se magic-login dobija tek posle eksplicitnog klika, nikada samim
otvaranjem email URL-a.

Confirmation stranica i API ishodi moraju ostati `private, no-store`,
`no-referrer`, `noindex/nofollow/noarchive`, a `/verify-email` putanje isključene
iz svih third-party skripti. Zajednički sensitive-credential guard mora da
isključi i Google Analytics i globalni reCAPTCHA provider na
`/verify-email/*`, token putanji `/reset-password/*` i
`/newsletter/odjava`; nepoznat pathname je private-by-default. Reset-token i
newsletter odjava page/API granice koriste ista privacy zaglavlja. GA događaji
na dozvoljenim stranicama smeju da šalju samo origin + pathname, bez query-ja
ili hash-a u `page_location`. Ovo smanjuje browser, cache, crawler i analytics
curenje, ali ne uklanja prvi URL iz reverse-proxy/access logova; dok tokeni ne
budu hashovani, URL i DB vrednost su i dalje poverljivi podaci.

Ovo pravilo još ne znači da login sme globalno da odbije svaki nalog sa
`emailVerified = NULL`. Pre verified-login enforcementa potrebni su audit i
kontrolisani backfill postojećih naloga, atomska registracija, stvarni resend
tok i bezbedan oporavak od SMTP greške.

## Zahtev za reset lozinke (v2)

Za svaki sintaksno validan email čiji je callback uspešno registrovan
`POST /api/auth/reset-password/request` mora imati isti account-independent
javni ugovor: neposredni HTTP 202, generičku poruku i `no-store`/`no-cache`
zaglavlja. Lookup naloga, zamena tokena i SMTP ne smeju se vratiti u sinhroni
response put; produkcijska ruta ih registruje kroz Next.js `after()` tek kao
callback, nikada kao već pokrenut Promise. Nevalidan input, rate limit i
sinhroni kvar samog scheduler-a mogu imati 400/429/503 jer nastaju pre lookup-a
i ne zavise od postojanja naloga.

Logovi ovog toka smeju da sadrže samo kontrolisanu fazu (`LOOKUP`,
`TOKEN_REPLACEMENT`, `DELIVERY`, `SCHEDULING` ili `BACKGROUND`). Ne logovati
email, token ili originalnu DB/SMTP grešku. Brisanje ranijih i kreiranje novog
tokena ostaju jedna DB transakcija. SMTP greška ne sme automatski obrisati novi
token, jer poruka može biti prihvaćena pre gubitka SMTP odgovora i korisnik bi
dobio već poništen link.

`after()` je lifecycle pomoć, ne durable delivery queue. Trenutna transakcija
je atomska za jedan zahtev, ali bez unique/CAS/Serializable zaštite ne garantuje
jedan token pod paralelnim zahtevima. Pre produkcije još su potrebni
transactional outbox i runtime smoke, shared limiter i trusted-proxy client IP,
hashovani tokeni, exactly-once reset confirm i PostgreSQL concurrency test.

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

Login `callbackUrl` je nepoverljiv browser input. Pre prosleđivanja u
`router.push` uvek mora proći kroz `safeLoginCallbackPath` iz
`lib/security/navigation.ts`. Dozvoljene su samo kanonske root-relative
putanje; URL šeme, protocol-relative URL-ovi, backslash, kodirani separatori i
nekanonski segmenti padaju na fiksni `/` fallback. Svaka promena ovog pravila
mora dobiti pozitivne i negativne testove u `navigation.test.ts`.

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
GitHub deploy workflow ne instalira niti menja VPS systemd timer za cleanup
rezervacija. Timer, njegov Bearer secret, prvi dry-run i prvi apply smoke su
zasebna operativna radnja koja zahteva eksplicitno odobrenje. U ovoj izmeni
VPS nije menjan.

V2 workflow ne reaguje na presentation `main`. PR i push kanonske V2 grane
rade samo proveru. `workflow_dispatch` ne deployuje čak ni kada se ručno izabere
release tag. Tag deploy dodatno zahteva da je označeni commit već deo kanonske
V2 grane, da tag ima strogi oblik `prodavnica-v2-YYYYMMDD-N`, da production
Environment dozvoljava isti tag obrazac i da je odobren required reviewer.
Poseban `Potvrdi V2 release` job proverava identitet pre otvaranja Environment
gate-a, a produkcijski job proveru ponavlja pre SSH-a.
Release tag se ne pravi tokom običnog razvoja; live puštanje je poslednji korak.

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
- [ ] Instalacija i provera VPS cleanup timera; kod endpointa postoji, ali još
      nije operativno zakazan niti smoke-testiran na serveru
- [ ] REVIEW reconciliation, refund tok i email outbox
- [ ] Transactional auth-email outbox i runtime dokaz da `after()` posao nije
      izgubljen pri shutdown/redeploy granici
- [ ] Hashovani verification/reset tokeni, exactly-once reset confirm i
      concurrency-safe jedan aktivni reset token po korisniku
- [ ] Atomska registracija, stvarni verification resend/cooldown i kontrolisani
      `emailVerified` login rollout sa auditom/backfill-om
- [ ] Session revocation posle resetovanja lozinke i sveža role provera
- [ ] Shared auth/reset limiter i eksplicitan trusted-proxy/client-IP ugovor

## Bezbedno objavljivanje šeme

`scripts/deploy.sh` više nikada ne pada nazad na `prisma db push`. Automatske
migracije su podrazumevano isključene i zahtevaju
`APPLY_DATABASE_MIGRATIONS=true`. Za v2 prvo pratiti
`docs/V2-ROLL-OUT.md`; ne spajati/deployovati ovu granu na postojeću bazu pre
baseline probe i eksplicitne expand migracije.
