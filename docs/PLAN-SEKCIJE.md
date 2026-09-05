# Sekcije stranica kojima upravlja admin

Plan da prodavnica dobije funkcionalnosti WordPress teme **WoodMart**, tako da ih
vlasnik sam dodaje i podešava iz admin panela.

- **Nastalo:** 2. i 3. septembra 2026.
- **Osnova:** `origin/verzija/v2.0-univerzalna-platforma`, SHA `2efbb76`, 31. 8. 2026.
- **Status:** istraživanje i plan. **Ni jedan red koda nije promenjen.**
- **Povod:** korisnik je poslao snimak ekrana sa spiskom WoodMart elemenata
  (Titles, Banners, Sliders, Carousels, Infobox, Countdown, Testimonials,
  Instagram, Products Grid, Product Filters, Brands, Image Hotspot, Video,
  Accordion, Marquee, Parallax, Animations i ostali) i tražio istraživanje,
  pa plan izrade.

---

## Sadržaj

1. [Sažetak](#1-sažetak)
2. [Dnevnik rada — šta je tačno urađeno](#2-dnevnik-rada--šta-je-tačno-urađeno)
3. [Ispravke ranijih tvrdnji](#3-ispravke-ranijih-tvrdnji)
4. [Zatečeno stanje koda](#4-zatečeno-stanje-koda)
5. [Arhitektura rešenja](#5-arhitektura-rešenja)
6. [Katalog tipova sekcija](#6-katalog-tipova-sekcija)
7. [Faze isporuke](#7-faze-isporuke)
8. [Pokrivenost WoodMart elemenata](#8-pokrivenost-woodmart-elemenata)
9. [Izvan obima](#9-izvan-obima)
10. [Rizici](#10-rizici)
11. [Odluke koje čekaju vlasnika](#11-odluke-koje-čekaju-vlasnika)
12. [Prvi korak](#12-prvi-korak)
13. [Poznate nedoslednosti ovog plana](#13-poznate-nedoslednosti-ovog-plana)
14. [Gde stoji ostatak građe](#14-gde-stoji-ostatak-građe)

---

## 1. Sažetak

WoodMart nudi četrdesetak zasebnih widgeta, ali oni se ponavljaju. Sedam elemenata
za proizvode (Recent, Featured, Sale, Top Rated, Products Grid, Product Widgets,
AJAX tabs) je **jedan upit sa drugim filterom**. Naslovi, razdelnici, gradijenti,
animacije i karusel su **opcije koje tema kači na svaki element**, a ne zasebni
elementi. Prevedeno u ovaj kod, to je jedan model sekcije u bazi, jedan registar
tipova sa šemom polja, i jedan renderer — **18 tipova sekcija umesto 42 posla**.

Prodavnica pritom nije prazna. U `components/home/` stoji šesnaest komponenti iz
šablona `ecommerce-cms-template` koje **nijedna stranica ne renderuje**: odbrojavanje,
brojači, parallax, Instagram, brendovi, utisci, hero karusel. Žive su samo radionička
početna, koja je hardkodovan JSX, i trakica sa porukama. Baneri imaju ceo CMS iza
sebe, ali ih storefront ne čita nigde.

Zato prvi korak nije nova funkcija nego **prevođenje postojeće početne u podatak**.
Kad ona prođe kroz registar i renderer bez ijednog piksela razlike, sve ostalo je
dodavanje `kind` vrednosti u ugovor koji već stoji.

Plan ima osam faza, ukupno oko **50 radnih dana** jednog programera, svaka faza na
svojoj grani i nezavisno isporučiva. Posle faze 2 vlasnik sam menja tekst, redosled
i vidljivost sekcija početne, sa nacrtom i pregledom pre objave.

---

## 2. Dnevnik rada — šta je tačno urađeno

Rad je izveden kroz četiri orkestrirana toka sa ukupno **61 agentom** i oko
**6,9 miliona tokena**. Sve je bilo isključivo čitanje: nijedan agent nije imao
pravo da menja fajlove, pokreće build, testove, dev server niti bilo koju git
komandu koja menja stanje.

### 2.1 Istraživanje WoodMart teme

Osam paralelnih istraživača podelilo je korisnikov spisak po grupama (naslovi i
baneri; slike i mediji; sadržajni blokovi; ljudi i društvene mreže; dinamika i
efekti; dugmad i interakcija; WooCommerce proizvodi; kategorije, filteri i brendovi),
plus dva istraživača za globalne funkcije teme (header builder, layouts builder,
theme settings, quick view, swatches, sticky add to cart, size guide i ostalo).

Izvori nisu bili opisi iz sećanja nego stvarne stranice: zvanična dokumentacija na
`xtemos.com/docs`, demo sajt `woodmart.xtemos.com`, Elementor izvozi demo stranica
i, gde je bilo dostupno, **izvorni PHP kod teme** (`class-infobox.php`,
`class-accordion.php`, `class-table.php`, `class-pricing-tables.php`,
`vc-functions.php`, `elementor_video.php` i drugi). Zbog toga popis opcija po
elementu nije uopšten — sadrži stvarne ključeve widgeta, na primer da baner ima
devet pozicija sadržaja i šest hover efekata, ili da svi elementi sa slajderom dele
isti skup opcija karusela (`woodmart_get_owl_atts`).

Rezultat: **58 elemenata** i **55 globalnih funkcija**, sa opcijama, varijantama
dizajna, potrebnim podacima i procenom složenosti implementacije od nule.

Kad prvi prolaz nije uspeo da potvrdi 21 element (potrošen budžet pretrage), pokrenut
je drugi prolaz sa drugačijim upitima i direktnim čitanjem demo stranica. Posle njega
nijedan element nije ostao nepotvrđen.

### 2.2 Popis zatečenog koda

Paralelno, četiri agenta su čitala ovaj repozitorijum:

- **Admin obrasci** — kako su napravljene admin stranice i rute, kako se validira
  unos, kako se čuvaju slike, kako radi autorizacija, kako se dodaje stavka u
  navigaciju, postoji li medijateka.
- **Storefront** — sve komponente u `components/home/`, `components/product/`,
  `components/layout/`, `components/filter/`, `components/ui/`, sa odgovorom na
  pitanje da li se svaka uopšte renderuje na nekoj stranici.
- **Podaci i infrastruktura** — Prisma šema, lanac migracija, keširanje, politika
  slika, CSP, lokalizacija, CI kapije, deploy.
- **Dokumentacija** — šta `CLAUDE.md`, `docs/ARCHITECTURE-V2.md`,
  `docs/CATALOG-MIGRATION-PLAN.md`, `docs/V2-ROLL-OUT.md` i `IZMENE.md` već kažu o
  page builderu, medijateci i sekcijama, da plan ne bi bio u sukobu sa ranijim
  odlukama.

### 2.3 Mapiranje i provera

Nalazi iz 2.1 i 2.2 spojeni su u **97 redova mapiranja** — po jedan za svaki od 42
elementa sa korisnikove liste i za 55 globalnih funkcija. Svaki red nosi: status
(postoji / delimično / ne postoji), postojeće fajlove, šta postoji, šta nedostaje,
potrebne podatke, polja koja bi admin podešavao, prioritet i procenu napora.

Prvi pokušaj provere tih redova pao je na limit sesije. Ponovljen je u sledećem
toku: deset paralelnih proveravača otvorilo je navedene fajlove i tražilo greške,
uz zadatak da pretpostave da greške postoje. Rezultat: **156 ispravki** i 138
dodatnih nalaza. Primeri ispravki:

- Red za naslove tvrdio je da sve sekcije početne imaju nadnaslov — nemaju ga dve
  od pet, i to je nedoslednost koju plan sada uklanja.
- Red za „Product Widgets“ tvrdio je da storefront nema sidebar zonu — ima je i na
  katalogu i na kategoriji; ono što ne postoji je pojam widget zone.
- Red za „Frequently bought together“ pozivao se na `PromotionType BUNDLE` koji ne
  postoji u šemi.
- Nekoliko redova navodilo je putanje modula koje su pogrešne
  (`useCartPricing` nije u `lib/hooks`, nego u `components/checkout/`).

### 2.4 Četiri predloga, tri sudije, sinteza

Da izbor arhitekture ne bi bio proizvoljan, napisana su **četiri nezavisna predloga
plana** iz različitih uglova:

| Predlog | Teza | Zbir ocena |
| --- | --- | --- |
| **Temelj pre elemenata** | prvo model, registar i medijateka, pa elementi | **27** |
| Radionica u rukama vlasnika | prvo pusti u rad ono što već postoji | 24 |
| Sekcije kao sloj platforme | tipovi dolaze kroz industrijski paket | 19 |
| Pet koraka kupovine | rangiraj po doprinosu prodaji, ne po WoodMart-u | 17 |

Ocenjivale su ih tri sudije sa različitim kriterijumima — izvodljivost u ovom kodu
(uz obavezu da svaka otvori bar tri tvrdnje i proveri ih), vrednost za vlasnika, i
rizik sa dugoročnošću. Konačan plan je sinteza pobednika sa preuzetim najboljim
idejama iz ostalih; najvažnija preuzeta ideja je iz drugoplasiranog predloga —
**faza 1 ne dira bazu** nego dokazuje apstrakciju nad postojećom početnom.

### 2.5 Tri recenzije i dorada

Sintetisan plan je zatim recenziran iz tri ugla: usklađenost sa pravilima projekta,
tačnost tvrdnji o kodu, i potpunost. Recenzenti su vratili **48 primedbi**, od toga
**6 blokirajućih**:

1. Plan je tvrdio da se sanitizacija pri prikazu „ne radi nigde i ne uvodi se“ —
   `CLAUDE.md` izričito traži sanitizaciju i pri upisu **i** na render granici.
2. Plan je umirujuće tvrdio da auth migracije ne blokiraju sekcijsku — blokiraju je.
3. Faze 2 do 6 gradile su CI kapije na admin E2E harnesu **koji ne postoji**.
4. Cela faza 0 počivala je na tvrdnji da `lib/security/bounded-json.ts` ne postoji.
5. Tvrdnja da kanonska grana ima četiri migracije — ima ih osam.
6. Faza 3 je brisala fallback raspored bez ijedne garancije da produkcijska baza
   ima objavljene sekcije, što bi dalo **praznu javnu početnu**.

Dorada je ugradila sve primedbe. Završni kontrolor je potvrdio da je svih šest
blokirajućih rešeno, uz dokaz iz teksta plana i iz koda.

### 2.6 Šta je palo i kako je popravljeno

Ovo se beleži jer je deo istorije rada:

| Šta | Zašto | Ishod |
| --- | --- | --- |
| Prva provera mapiranja (9 agenata) | limit sesije | ponovljena kasnije, uspešno |
| Prva dorada plana (1 agent) | odgovor prešao 64 000 tokena | podeljena na četiri dela |
| Dva od četiri dela dorade | agenti se zaglavili posle 6 pokušaja | razbijeni na manje zadatke |

### 2.7 Šta je proizvedeno

| Artefakt | Gde |
| --- | --- |
| Ovaj dokument | `docs/PLAN-SEKCIJE.md`, grana `dokumentacija/plan-sekcije` |
| Objavljena stranica sa planom | `https://claude.ai/code/artifact/8f6ec1ea-e591-446c-955e-d4c98b84ecf7` |
| Pun plan u JSON obliku | `~/Desktop/plan-sekcije-prodavnica.json` |
| Trajna beleška o zamci sa zastarelim refom | memorija projekta |

### 2.8 Šta NIJE dirano

- Nijedan fajl u `~/Desktop/narodnanosnja-prodavnica` nije menjan. Jedina izmena u
  radnom stablu (`IZMENE.md`) postojala je **pre** početka ovog rada.
- Nijedna grana nije prebačena, ništa nije commit-ovano na postojeće grane, ništa
  nije gurnuto na GitHub.
- Baza nije čitana ni menjana. Server nije diran.
- Ovaj dokument je napisan u **izdvojenom radnom stablu** (`git worktree`) da
  postojeća grana `ispravka/v2-db-authoritative-sessions` i njena nezavršena izmena
  `IZMENE.md` ostanu netaknute.

---

## 3. Ispravke ranijih tvrdnji

**Ovo je najvažniji odeljak za svakoga ko nastavlja rad.**

Lokalni ref `verzija/v2.0-univerzalna-platforma` stoji na `8d22116` i **zaostaje
tačno 33 commita** za `origin/verzija/v2.0-univerzalna-platforma` (`2efbb76`), bez
ijednog svog commita. Radno stablo je pritom na trećoj grani,
`ispravka/v2-db-authoritative-sessions`. Grane se razlikuju u **163 fajla i 40 317
dodatih linija**, među njima i `next.config.ts`, `.github/workflows/objavi.yml`,
`scripts/db-invariant-smoke.sql` i `prisma/schema.prisma`.

Zbog toga su tri istraživača izvela pogrešne zaključke koje je recenzija oborila:

| Pogrešna tvrdnja | Stvarno stanje na kanonskoj grani |
| --- | --- |
| `lib/security/bounded-json.ts` ne postoji | **Postoji**, zajedno sa svojim testom. Ne piše se novi čitač tela zahteva. |
| Lanac ima četiri migracije | **Osam.** Sve četiri `20260830*` auth expand migracije su tu. |
| Sekcijska migracija je peta u dokazanom lancu | **Deveta**, i ispred nje stoje četiri neprimenjene. |

Tačne tvrdnje koje su takođe otkrivene u ovom radu i ostaju:

- `revalidateTag` u ovoj verziji Next-a ima **obavezan drugi argument**. Poziv sa
  jednim argumentom ne prolazi `npm run typecheck`, koji je CI kapija. Za sekcije se
  koristi `{ expire: 0 }`, jedini oblik koji gasi keš odmah.
- `zod` **nije** u `package.json`, a `app/api/admin/ticker/route.ts` ga uvozi. Ne
  dolazi preko Prisme nego preko lanca `eslint-config-next` → `eslint-plugin-react-hooks`,
  pa je okidač promene podizanje Next-a. Registar sekcija se zato **ne gradi na zod-u**.

**Pravilo koje iz ovoga sledi:** svaka tvrdnja o stanju koda mora se proveriti
kroz `git show origin/verzija/v2.0-univerzalna-platforma:<putanja>`, nikad kroz
radno stablo. Posle grananja obavezno `git rev-parse --short HEAD`, koje mora
vratiti `2efbb76`.

---

## 4. Zatečeno stanje koda

Dvadeset nalaza koji određuju plan. Svaki je proveren na kanonskoj grani.

### 4.1 Šta radi, a šta samo izgleda da radi

1. **Trakica je jedini kompletan lanac.** `TickerMessage` → `app/admin/ticker/page.tsx`
   → `app/api/admin/ticker/route.ts` → `getCachedTickerMessages` (`unstable_cache`
   sa tagom `ticker`) → `NavBarWrapper`. To je šablon koji se kopira. Ali njegov
   reorder radi `Promise.all` nad zasebnim `update` pozivima, pa delimičan pad
   ostavlja trajno izmešan redosled — ta greška se **ne prepisuje**, ide
   `prisma.$transaction`.

2. **Baneri su mrtva grana.** `getCachedBanners` i `getCachedAllBanners` nemaju
   nijednog pozivaoca u repou i ne koriste `unstable_cache`; komentar u
   `lib/db/cache.ts` doslovno kaže da su slike prevelike za limit od 2 MB. Tri
   poziva `revalidateTag("banners", "default")` su dokazan no-op. Uzrok je base64 u
   `Banner.imageData`.

3. **Šesnaest nemontiranih komponenti.** `components/home/index.ts` re-eksportuje
   `HeroSection`, `HeroCarousel`, `CategoryCards`, `CategoryBanners`,
   `MissionStatement`, `FeaturedCarousel`, `InstagramFeed`, `TrustBar`,
   `BrandSlider`, `Testimonials`, `FeaturesStrip`, `CountdownSale`, `NewArrivals`,
   `ParallaxBanner`, `StatsSection` — od kojih se na stranicama koristi jedino
   `NewsletterSection`. Vezane su za nepostojeće slike u `public/images/`, za legacy
   tip proizvoda iz `types/product.ts`, ili za hardkodovane podatke.

4. **Sadržaj u šablonima je neistinit.** „Podrška 24/7“, „Besplatna dostava“,
   „30 dana za zamenu“ i četiri izmišljena kupca u `Testimonials.tsx` krše pravilo
   projekta da se podaci ne izmišljaju. Ne prelaze u registar — brišu se.

5. **Početna nema nijednu fotografiju.** Svuda stoji `MestodrzacProizvoda` iz
   `components/ukras`. Faza 3 daje alat, ne sadržaj.

### 4.2 Podaci i migracije

6. **Nema modela za sekcije.** U `prisma/schema.prisma` nema ni `Section`, ni
   `Page`, ni `Block`, ni `Layout`, ni `MediaAsset`. Najbliži obrasci su `Banner`
   (`position`/`order`/`isActive` uz `{sr,en}` Json polja) i `Setting`.

7. **`Setting` registry ne može da nosi sekcije.** `lib/config/store-settings.ts`
   odbacuje sve ključeve van allow-liste, a `StoreSettingInputType` poznaje samo
   `text`, `email`, `url`, `textarea`, `color`, `number` — nema ni boolean, ni
   select, ni niz, kamoli listu sa redosledom.

8. **Sekcijska migracija je deveta.** Produkcija je dokazana na četiri; ispred
   sekcijske stoje četiri neprimenjene auth expand migracije koje
   `prisma migrate deploy` primenjuje u istom pozivu.

9. **Deploy ne primenjuje migracije i ne pokreće seed.** `objavi.yml` šalje
   `APPLY_DATABASE_MIGRATIONS=false`; odmah zatim `prisma migrate diff --exit-code`
   obara deploy ako baza nije usklađena sa šemom. Reč `seed` se u `scripts/deploy.sh`
   ne pojavljuje.

10. **Ime aplikacione DB role nije zapisano u repou.** `scripts/db-setup.sql` je
    prima kao `:app_user`, a jedini `GRANT` u celom projektu je
    `GRANT ALL ON SCHEMA public`. Korak sa grantom se piše sa promenljivom, ne sa
    izmišljenim literalom.

### 4.3 Mediji

11. **Disk je već dokazan obrazac.** `scripts/deploy.sh` obara deploy ako release
    sadrži `public/uploads`, pravi trajni direktorijum van release-a i simlinkuje ga;
    `objavi.yml` ga isključuje iz rsync-a. Medijateka na disku ne traži nijednu
    izmenu deploy skripte.

12. **Upload ruta je usko grlo.** Zatvorena lista foldera
    (`products|articles|categories|brands`), limit 1 MB, obavezan resize na 800×800 i
    WebP q75, bez rate-limita, i **bez ijednog metapodatka** — iako `sharp` dimenzije
    već ima u ruci. Uz to `PUT /api/admin/banners/[id]` prima `imageData` bez provere
    kakvu ima `POST`.

13. **`/uploads` prolazi kroz middleware.** Matcher u `proxy.ts` isključuje
    `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`,
    `images` i `logo`, ali **ne** `uploads`. Svaki zahtev za sliku danas radi
    `getToken`, dakle dekodiranje JWT-a.

14. **Backup uploada nije dokazan.** `scripts/backup.sh` ima tvrdo upisane putanje
    za drugi projekat (`/var/www/planika`, `planika_shop`, `planika_user`), a stvarni
    `DEPLOY_PATH` je `/var/www/narodnanosnja`. Nijedan CI ni deploy korak je ne
    poziva; instalacija je opisana samo kao ručni cron unos. **Dok se to ne potvrdi
    na serveru, fotografije nisu u backup-u.**

### 4.4 Bezbednost i granice

15. **Admin je deny-by-default.** `lib/auth/admin-policy.ts` taksativno nabraja šta
    `OPERATOR` sme; sve ostalo je `ADMIN`. Nove rute su time automatski zaštićene —
    ali postojeći test nabraja putanje poimenično, pa nova ruta danas ne bi bila
    pokrivena nijednim testom.

16. **Sanitizer ima 21 tag i to je granica.** `p`, `br`, `strong`, `b`, `em`, `i`,
    `u`, `s`, `blockquote`, `ul`, `ol`, `li`, `h1`–`h4`, `hr`, `a`, `code`, `pre`,
    `img`. Nema `table`, `iframe`, `video`, `style`. Video, tabela i hotspot moraju
    biti strukturirana Json polja sa namenskim komponentama.

17. **CSP dozvoljava samo YouTube.** `frame-src` pušta `'self'`, `www.google.com`,
    `recaptcha.google.com` i `www.youtube.com`. Vimeo i `youtube-nocookie.com`
    otkazuju **tiho**. `media-src 'self' https:` propušta MP4.

18. **`next/image` prima samo kvalitet 70 ili 75.** Svaka druga vrednost obara
    `npm run build`, dakle poslednju CI kapiju.

### 4.5 Testovi i lokalizacija

19. **`npm test` vidi samo `lib/`.** Skripta glasi
    `node --import tsx --test "lib/**/*.test.ts"`. Testovi u `app/api/admin/...` se
    ne izvršavaju. Zato svaka logika koja se testira mora fizički živeti pod `lib/`,
    a rute samo pozivaju testirane funkcije.

20. **Admin E2E harnes ne postoji.** `e2e/` ima tačno jedan spec
    (`purchase-flow.spec.ts`, anonimni mobilni tok kupovine), `scripts/seed-e2e.ts`
    ne pravi nijednog korisnika, a jedini Playwright projekat emulira Pixel 7. Uz to
    je `npm run test:e2e` **obavezna CI kapija**.

**Lokalizacija:** `locale` dolazi iz kolačića `NEXT_LOCALE`, ne iz URL-a. Zato se
keširaju sirovi, jezički neutralni redovi, a lokalizuje se pri renderu — jedan keš
unos opslužuje i `sr` i `en`.

---

## 5. Arhitektura rešenja

### 5.1 Slojevi

Šest slojeva sa jednim smerom zavisnosti:

```
admin ekran  →  registar tipova  →  validacija  →  PageSection  →  keš  →  renderer
                (šema polja)        (+ sanitizacija)   (config Json)         (storefront)
                                          ↓                ↑
                                    public/uploads na disku
                                    MediaAsset: putanja, dimenzije, alt
```

Registar je **jedini autoritet nad oblikom konfiguracije** i ne uvozi ni React ni
Prismu, pa ga admin obrazac može uvesti direktno — isti trik koji već koristi
`StoreSettingsPanel`.

### 5.2 Model podataka

Tri nova modela, dve expand migracije, **nula izmena nad postojećim tabelama**.

```prisma
model PageSection {
  id            String    @id @default(cuid())
  pageKey       String    // "home" u fazama 1-6
  kind          String    // ključ iz lib/sekcije/registar.ts
  order         Int       @default(0)     // OBJAVLJENI redosled
  isActive      Boolean   @default(true)  // OBJAVLJENA vidljivost
  config        Json      // objavljena konfiguracija, validirana registrom
  draftConfig   Json?     // radna kopija sadržaja
  draftOrder    Int?      // radna kopija redosleda
  draftIsActive Boolean?  // radna kopija vidljivosti
  schemaVersion Int       @default(1)     // oslonac za buduću promenu oblika config-a
  version       Int       @default(0)     // token optimističkog zaključavanja
  publishedAt   DateTime? // null = storefront je ne renderuje
  updatedById   String?   // bez FK, da brisanje admin naloga ne obori sekciju
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  usages        MediaAssetUsage[]

  @@index([pageKey, isActive, order])
  @@index([kind])
}

model MediaAsset {
  id          String   @id @default(cuid())
  path        String   @unique // "/uploads/sekcije/<ts>-<rand>.webp"
  folder      String
  mimeType    String
  width       Int
  height      Int
  bytes       Int
  alt         Json?           // { sr, en } — PREDLOG koji birač nudi
  createdById String?
  createdAt   DateTime @default(now())

  usages      MediaAssetUsage[]

  @@index([folder, createdAt])
}

model MediaAssetUsage {
  id        String      @id @default(cuid())
  assetId   String
  sectionId String
  polje     String       // putanja polja u config-u, npr. "stavke[2].ikona"
  asset     MediaAsset  @relation(fields: [assetId], references: [id], onDelete: Cascade)
  section   PageSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)

  @@unique([sectionId, polje])
  @@index([assetId])
}
```

**Zašto `draftOrder` i `draftIsActive`, a ne samo `draftConfig`:** bez njih
preslagivanje i gašenje sekcija menjaju javni sajt **uživo**, dok pregled nacrta tu
promenu ne pokazuje — što ruši celu svrhu nacrta. Keširani čitač koristi
`order`/`isActive`, pregled `draftOrder ?? order` i `draftIsActive ?? isActive`, a
„Objavi“ preslikava sve tri nacrt-kolone u objavljene i vraća ih na `null`.

**Zašto `MediaAssetUsage`:** putanja medija stoji na proizvoljnoj dubini `config`-a
i pod različitim ključevima po tipu (`stavke[2].ikona`, `slike[3].slika`), a nijedan
Prisma jsonb filter ne nalazi string na proizvoljnoj dubini. Bez tabele upotrebe
provera reference ili tiho promaši i dozvoli brisanje slike sa žive početne, ili
odbija brisanje svega. Sa njom je to običan `count` upit.

### 5.3 Migracija i rollout

Fajl `prisma/migrations/20260902120000_expand_page_sections/migration.sql`, ručno
pisan, expand-only: samo `CREATE TABLE`, `CREATE INDEX` i
`ALTER TABLE ... ADD CONSTRAINT ... CHECK`. Nijedan `ALTER` nad postojećom tabelom,
nijedan DML.

```sql
-- Kompatibilan expand: samo nove tabele, indeksi i CHECK ograničenja.
-- Nijedan ALTER nad postojećom tabelom, nijedan DML. Bezbedno za rollback koda.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';
-- CREATE TABLE "PageSection" ... / CREATE TABLE "MediaAsset" ...
-- CREATE INDEX ... / ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)
COMMIT;
```

Redosled `pg_catalog, public` je namerno obrnut u odnosu na
`20260829020000_expand_v2_platform` (`public, pg_catalog`): tako korisnički objekat u
`public` ne može da zaseni sistemsku funkciju tokom migracije. Ta razlika se upisuje
kao komentar u samoj migraciji da ne izgleda kao previd.

**Osam CHECK ograničenja** — jedino što baza uopšte može da proveri nad Json
konfiguracijom:

| Ograničenje | Uslov |
| --- | --- |
| `PageSection_order_nonnegative_check` | `"order" >= 0` |
| `PageSection_version_nonnegative_check` | `"version" >= 0` |
| `PageSection_draft_order_check` | `"draftOrder" IS NULL OR "draftOrder" >= 0` |
| `PageSection_pageKey_format_check` | `"pageKey" ~ '^[a-z][a-z0-9_-]{0,63}$'` |
| `PageSection_kind_format_check` | `"kind" ~ '^[a-z][a-zA-Z0-9]{0,39}$'` |
| `PageSection_config_object_check` | `jsonb_typeof("config") = 'object'` |
| `PageSection_draft_object_check` | `"draftConfig" IS NULL OR jsonb_typeof("draftConfig") = 'object'` |
| `MediaAsset_path_format_check` | `"path" ~ '^/uploads/[a-z0-9-]{1,32}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'` |
| `MediaAsset_dimensions_check` | `"width" > 0 AND "height" > 0 AND "bytes" > 0` |

Regex za `pageKey` je regex, a **ne zatvorena `IN` lista**, jer bi lista tražila novu
migraciju za svaku novu stranicu i time protivrečila samom razlogu za Json. Dvotačka
se ne dozvoljava dok odluka o dometu ne bude doneta. Regex za putanju medija traži da
prvi znak imena fajla bude alfanumerik, pa `.` i `..` ne mogu proći.

**GRANT** se piše kao imenovan korak u `docs/V2-ROLL-OUT.md`, ne u migraciju
(nijedna postojeća migracija nema GRANT), i to sa promenljivom:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public."PageSection", public."MediaAsset", public."MediaAssetUsage"
  TO :"app_user";
```

U trenutnoj postavci je to no-op jer je aplikaciona rola vlasnik baze. Piše se
svejedno, jer je jedina zaštita ako migraciju ikad primeni druga rola — superuser
tokom restore-a je realan scenario — a bez njega bi `prisma validate`, `migrate diff`
i `build` prolazili dok runtime pada.

**Redosled objave, obavezan i upisan u `docs/V2-ROLL-OUT.md`:**

1. Operater **ručno** primeni migracije na produkciju.
2. **Verifikuje** — `prisma migrate status` i `psql -f scripts/db-invariant-smoke.sql`.
3. **Tek onda** se gurne release tag.

Obrnut redosled ne daje tihu grešku nego zaustavljen deploy: `scripts/deploy.sh`
odmah posle instalacije pokreće `prisma migrate diff --exit-code`, koji vraća 2 i
obara objavu. Pre svakog prozora: backup i pun prolaz na **restore klonu** produkcione
baze, sa merenjem trajanja **svake** migracije zasebno.

### 5.4 Registar tipova i validacija

Novi modul `lib/sekcije/`, po ugledu na `lib/config/store-settings-schema.ts`:

| Fajl | Sadržaj |
| --- | --- |
| `lib/sekcije/polja.ts` | tipovi polja i njihove definicije |
| `lib/sekcije/okvir.ts` | četiri presečne grupe opcija |
| `lib/sekcije/registar.ts` | `tipoviSekcija: TipSekcije[]` |
| `lib/sekcije/validacija.ts` | tri čiste funkcije |
| `lib/sekcije/invalidacija.ts` | `tagoviZaStranicu(pageKey)` |
| `components/sekcije/index.tsx` | mapa `kind → komponenta` |

Tip sekcije je `{ kind, naziv, opis, grupa, faza, polja, podrazumevano, stranice, skeleton, maxPoStrani? }`.

**Četiri presečne grupe opcija** koje jednom napisane pokrivaju desetine WoodMart
redova:

1. **`zaglavlje`** — nadnaslov, naslov sa istaknutom rečju, podtekst, poravnanje,
   semantički tag `h1`–`h6`. Uklanja zatečenu nedoslednost gde tri postojeće sekcije
   imaju nadnaslov a dve nemaju.
2. **`pozadina/okvir`** — boja iz palete, gradijent, tkana šara preko postojeće
   `Podloga`, ili slika sa overlay-em; shema svetla/tamna; razmak; širina; ivica.
3. **`razdelnik`** — gore i dole zasebno: bez, tkana traka preko postojeće `Traka`,
   talas ili dijagonala, sa visinom i bojom iz palete.
4. **`karusel`** — stavki po ekranu za desktop/tablet/mobilni, razmak, loop, autoplay
   sa brzinom, strelice, tačke, isključi na mobilnom.

**Sedamnaest tipova polja:** `tekst`, `tekstLok`, `viselinijskiLok`, `bogatTekstLok`,
`broj`, `prekidac`, `izbor`, `bojaTokena`, `medij`, `medijLista`, `veza`, `dekor`,
`video`, `upitProizvoda`, `refKategorija`, `refBrend`, `lista`.

Tip `medij` od prvog dana nosi oblik `{ putanja, alt: { sr, en }, dekorativna }` —
**alt nije zasebno polje koje se zaboravi**; validator odbija medij bez alt teksta
osim kad je `dekorativna: true`, kada se renderuje `alt=""`. Tip `lista` je repeater
sa ugnježdenom šemom; taj jedan tip je razlog zašto Infobox, Timeline, harmonika,
brojači i galerija nisu pet mehanizama nego jedan.

**Validacija je ručna, bez zod-a**, sve serverski autoritativno:

- `validirajSekciju(kind, config)` — nepoznat `kind` se odbija; nepoznati ključevi
  se **tiho odbacuju** (kompatibilnost unapred i bezbedan rollback koda ispred
  podataka), isto kao `lib/config/store-settings.ts`.
- `normalizujSekciju(kind, config)` — popunjava podrazumevane vrednosti i `string`
  pretvara u `{sr, en: sr}`; poziva se i pri **čitanju**, pa red upisan pre dodavanja
  novog polja i dalje renderuje.
- `sanitizujSekciju(kind, config)` — svako `bogatTekstLok` polje kroz
  `sanitizeLocalizedRichText`, pri upisu.

**Pravila po tipu polja** koja su vredela pisanja:

- `veza`: interna grana kroz `lib/security/navigation.ts` — izdvaja se zajednička
  `safeInternalPath` pored postojeće `safeLoginCallbackPath`. Sopstvena provera tipa
  „počinje sa `/` i ne sadrži `//`“ se **ne piše**, jer propušta `/\evil.com`,
  `/%2f%2fevil.com`, kontrolne znakove i `..` segmente.
- `bojaTokena`: vrednost iz zatvorene liste tokena palete; slobodan HEX se ne
  dozvoljava. Uz to **kontrastna provera po sekciji** — postojeći `colorContrastRatio`
  se izdvaja i proverava svaki par (tekst, pozadina) koji ta sekcija stvarno koristi,
  jer `validateStoreThemeContrast` proverava samo fiksne parove tema-nivoa.
- `medij`: regex putanje **i** postojanje reda u `MediaAsset` — jedno pravilo koje
  istovremeno sprečava path traversal i mrtve reference.
- `refKategorija`/`refBrend`: izbor iz liste, nikad slobodan tekst.
- `quality` za slike je zatvoren izbor sa tačno dve vrednosti, 70 i 75.
- Ukupna serijalizovana veličina `config`-a ograničena na 64 KB; telo zahteva na
  128 KB kroz postojeći `readBoundedJson(request, 128 * 1024)`.

**Testovi stoje fizički pod `lib/`.** Minimalni skup: za svaki `kind` podrazumevana
konfiguracija prolazi sopstvenu šemu; obavezno polje prazno; prekoračena dužina;
nepoznat ključ tiho odbačen; nepoznat `kind` odbijen; lista preko `maxStavki`;
`<script>` u `bogatTekstLok` nestaje; `bojaTokena` van liste odbijena; kontrastni par
ispod 4.5:1 odbijen; `veza` odbija `javascript:`, `//evil.com`, `/\evil.com`,
`/%2f%2fevil.com`, `/a/../../b`; `medij` bez `MediaAsset` reda odbijen; `medij` bez
alt teksta odbijen; normalizator popunjava polje dodato posle upisa reda.

### 5.5 Render, keš i invalidacija

```ts
export function getCachedPageSections(pageKey: string) {
  return unstable_cache(
    async () =>
      prisma.pageSection.findMany({
        where: { pageKey, isActive: true, publishedAt: { not: null } },
        orderBy: { order: "asc" },
        select: { id: true, kind: true, config: true, order: true, schemaVersion: true },
      }),
    ["page-sections", pageKey],
    { revalidate: 300, tags: ["sekcije", `sekcije:${pageKey}`] },
  )();
}
```

`draftConfig`, `draftOrder` i `draftIsActive` **nikad** ne smeju u `select` keširanog
čitača — inače nacrt curi u javni keš. Pregled nacrta je zasebna stranica
`/admin/sekcije/pregled/[pageKey]` sa `force-dynamic`, bez keširanog čitača. Nema
javnog `?pregled=1`, nema preview tokena, **nula nove javne površine**.

Invalidacija:

```ts
revalidateTag(`sekcije:${pageKey}`, { expire: 0 });
revalidateTag("sekcije", { expire: 0 });
```

Tagovi se ne sklapaju u ruti nego u `lib/sekcije/invalidacija.ts`, da bi ih
`npm test` uopšte pokrenuo — poseban test tvrdi da funkcija vraća tačne tagove, da se
ne ponovi tihi no-op sa banerima.

**Strimovanje i otpornost.** Svaka asinhrona sekcija ide u **sopstveni** `<Suspense>`
sa fallback-om iz registra, a `try/catch` stoji **unutar** te granice. Bez toga se
dve postojeće Suspense granice početne gube, sekcije se serijalizuju i stranica
prestaje da strimuje iako bi finalni screenshot bio identičan. Jedna pokvarena
sekcija renderuje ništa i ne obara stranicu; nepoznat `kind` — normalno stanje posle
rollback-a koda ispred podataka — preskače se uz `console.warn`. Svaka komponenta
mora imati definisano ponašanje **bez slike** (tkana šara iz `components/ukras`).

**Druga granica sanitizacije.** `sanitizeLocalizedRichText` se poziva **ponovo** u
komponenti koja puni `dangerouslySetInnerHTML`. Razlog je konkretan: svaki red koji u
bazu uđe mimo validatora — kroz seed, ručni SQL, restore starijeg dampa ili kasniju
izmenu allow-liste — inače bi se renderovao neproveren. Negativan XSS test postoji na
**obe** granice.

**Cena nikad ne stoji u konfiguraciji.** Kešira se samo `config`; proizvodi se
dohvataju svakim zahtevom, a `app/(shop)/page.tsx` ostaje `force-dynamic`. Posledica
koja se plaća: admin može sam da napravi sporu početnu, pa je `maxPoStrani: 3` za
`kind: "proizvodi"` **tvrdo ograničenje sprovedeno u ruti** (409 sa objašnjenjem), a
svi upiti blokova idu kroz React `cache()`.

### 5.6 Mediji

**Odluka: `public/uploads` je kanonski obrazac za sve slike**, izvedena iz koda a ne
iz ukusa. Deploy obara release koji sadrži `public/uploads`, pravi trajni direktorijum
van release-a i simlinkuje ga. Nasuprot tome, base64 je već jednom koštao projekat
keša, a `data:` URI prolazi kroz `next/image` neizmenjen — bez resize-a i bez
konverzije.

**Šta biva sa base64 banerima:** ništa se ne migrira, jer nema čitaoca. Dve mrtve
funkcije i tri no-op poziva `revalidateTag` se brišu; `model Banner` i ekran
`/admin/banners` ostaju netaknuti (expand-only), ekran se označava kao legacy sa
uputom „koristite Sekcije stranica“, a brisanje modela je zaseban contract korak.

### 5.7 Bezbednosna pravila koja se ne razblažuju

1. Bogati tekst prolazi kroz sanitizer **dvaput** — pri upisu i na render granici,
   sa negativnim XSS testom na obe.
2. U bazi nema CSS klasa ni slobodnog HTML-a. Boje i gradijenti su nabrojane
   vrednosti koje renderer mapira u fiksne klase.
3. Cena se nikad ne upisuje u konfiguraciju sekcije.
4. Telo admin zahteva čita postojeći `readBoundedJson` sa izričitim limitom.
5. Nove rute su ADMIN-only po deny-by-default politici, uz **dopunjen**
   `lib/auth/admin-policy.test.ts` negativnim slučajevima.
6. Unsafe write rute prolaze postojeću same-origin proveru u `proxy.ts`.
7. Interne veze idu kroz `safeInternalPath`, spoljne kroz `new URL` sa proverom šeme.
8. Sanitizer se **ne proširuje** za `iframe`, `video`, `table` ni `style`.
9. Brisanje medija proverava upotrebu kroz `MediaAssetUsage`; ako DELETE briše i
   fajl, `path.resolve` pa provera prefiksa pre `unlink`, sve u istoj transakciji.
10. Rate limit i semafor nad istovremenim `sharp` obradama na upload ruti, uz
    izričit zapis da procesni LRU **nije** zaštita od namernog DoS-a.
11. JSON-LD isključivo kroz postojeći `serializeJsonLd`.
12. Pregled nacrta stoji pod `/admin`, bez ijedne nove javne površine.

---

## 6. Katalog tipova sekcija

Osamnaest tipova. Svaki nosi četiri presečne grupe opcija iz odeljka 5.4, pa naslovi,
razdelnici, gradijenti i karusel nisu zasebni poslovi.

| Šifra | Naziv | WoodMart ekvivalent | Izvor sadržaja | Faza | Napor |
| --- | --- | --- | --- | :-: | :-: |
| `naslov` | Naslov sekcije | Title, Section divider | ručni tekst | 1 | S |
| `hero` | Uvodni blok | Promo banner, Slider sa jednim slajdom | ručno + slika | 1 | M |
| `stavke` | Ponavljajuće stavke | Infobox, List, Timeline, Accordion | ručno, ili FAQ iz baze | 1 | M |
| `taksonomija` | Kategorije i brendovi | Product categories, Brands | `Category`, `Brand` | 1 | M |
| `tekst` | Bogati tekst | HTML block | Tiptap, sanitizovano | 1 | S |
| `poziv` | Poziv na akciju | Button, Call to action | ručni tekst i veza | 2 | S |
| `medij` | Slike i baneri | Banners, Banner carousel, Sliders, Gallery, Compare images, Parallax | medijateka | 3 | L |
| `proizvodi` | Blok proizvoda | Products grid, Recent, Featured, Sale, Top rated, Product widgets, AJAX tabs | `Product`, upit po parametru | 1 i 4 | L |
| `clanci` | Iz radionice | Blog element | `Article` | 5 | S |
| `utisci` | Utisci kupaca | Testimonials | `ProductReview` | 5 | M |
| `odbrojavanje` | Odbrojavanje | Countdown timer | `Promotion.endDate` | 5 | S |
| `traka` | Pokretna traka | Marquee | ručni tekst | 5 | S |
| `tabela` | Tabela | Table | strukturirani redovi | 5 | M |
| `cenovnik` | Cenovnik | Pricing tables, Menu price | ručne stavke | 5 | M |
| `newsletter` | Prijava na novosti | postojeća sekcija prodavnice | `NewsletterSubscriber` | 5 | S |
| `video` | Video | Video | YouTube ID ili MP4 | 6 | M |
| `hotspot` | Tačke na slici | Image hotspot | slika + veza ka proizvodu | 6 | M |
| `instagram` | Instagram | Instagram | ručno unete slike | 6 | M |

Uz njih ide osamnaest **globalnih funkcija** koje nisu tipovi sekcija: registar sa
šemom polja, okvir sekcije, medijateka, nacrt i objava, keširano čitanje sa tagom,
optimističko zaključavanje, karusel omotač, profili obrade uploada, animacijski sloj,
zajednička komponenta za bogati tekst, `uploads` u proxy matcheru, gašenje mrtvog
banner keša, i tri usputne ispravke postojećih grešaka (reorder tickera u
transakciji, `where.OR` u `fetchProducts`, `endDate` u `getProductPromotions`).

---

## 7. Faze isporuke

Ukupno **osam faza, oko 50 radnih dana**. Redosled je obavezujući do faze 3; posle
toga se faze mogu presložiti, a faza 7 se sme i preskočiti.

### Faza 0 — Poravnanje, lanac migracija i E2E harnes za admina

- **Grana:** `dodatak/e2e-admin-harnes`, uz dve prateće ispravke u svojim granama:
  `ispravka/zod-zavisnost` i `ispravka/zastarela-uputstva`
- **Trajanje:** 4 radna dana (2 na E2E harnes, 0,5 na `zod`, 0,5 na dokumentaciju)
- **Zavisnosti:** nema
- **Admin dobija:** ništa vidljivo. Dobija se ispravna osnova i, prvi put, mogućnost
  da se admin ekran uopšte automatski proveri.

**Zadaci**

1. Granati isključivo sa `origin/verzija/v2.0-univerzalna-platforma` (`2efbb76`) i
   taj SHA doslovno upisati u opis PR-a.
2. Ponovo izvesti sve `fajl:linija` reference nad kanonskom granom i zameniti ih.
3. Obrisati odluku o telu zahteva iz nacrta — koristi se postojeći
   `readBoundedJson(request, 128 * 1024)`; drugi argument je obavezan jer modul
   unapred alocira `Uint8Array(maxBytes)`.
4. Zapisati poziciju u lancu migracija kao operativni preduslov: osam migracija na
   grani, četiri dokazane na produkciji, sekcijska je deveta.
5. Zapisati redosled objave u `docs/V2-ROLL-OUT.md`: migracija → verifikacija → tag.
6. Zapisati uslov za objavu sekcija: ili su četiri auth migracije već primenjene i
   potvrđene, ili se ceo lanac ide u jednom pregledanom prozoru sa
   `scripts/auth-session-expand-preflight.sql` kapijom.
7. Odluka o `zod`-u u zasebnom PR-u: deklarisati ga u `dependencies` pinovan na
   major 4. Registar sekcija se u svakom slučaju **ne** gradi na njemu.
8. E2E harnes (a): ADMIN nalog u `scripts/seed-e2e.ts`, iza istog guarda, kroz
   postojeći `provisionPrivilegedAccount` i `hashPassword` — ne ručnim bcrypt
   pozivom. `emailVerified` se postavlja da verified-login politika ne obori prijavu.
9. E2E harnes (b): `e2e/fixtures/admin.ts` sa `storageState` u `e2e/.auth/admin.json`
   (dodati u `.gitignore`), plus suprotan slučaj sa praznim stanjem za anonimne
   provere.
10. E2E harnes (c): drugi Playwright projekat `desktop-chromium`; postojeći
    `mobile-chromium` ostaje netaknut. `workers: 1` i `fullyParallel: false` se ne
    diraju. U `webServer.env` dodati `DEMO_MODE=false`.
11. E2E harnes (d): `e2e/admin-smoke.spec.ts` koji dokazuje samo harnes.
12. Dokumentacija u zasebnom PR-u: ispraviti zastarela uputstva u `IZMENE.md`
    (paleta se ne menja u `tailwind.config.ts` jer ga Tailwind 4 ne učitava; funkcija
    se zove `uUri`, ne `dataUri`) i `CLAUDE.md` (osam migracija, ne sedam).
13. U `docs/ARCHITECTURE-V2.md` upisati svesno odstupanje: ovaj plan izvršava fazu 4
    roadmapa pre faza 2 i 3.

**Provera**

- Ceo CI lanac prolazi na kanonskoj osnovi.
- Ako je `zod` deklarisan: `npm ci` nad obrisanim `node_modules`, pa typecheck i lint.
- `npm run test:e2e` prolazi sa **oba** projekta.
- Prijava kao ADMIN otvara `/admin`; anonimni zahtev daje preusmerenje.
- Negativna provera seed guarda zadržana posle dodavanja admina.
- `migrate deploy` na praznu bazu primeni svih osam migracija bez drifta.
- `docs/V2-ROLL-OUT.md` sadrži imenovan korak sa redosledom migracija → tag.

### Faza 1 — Registar, validator, okvir, animacijski sloj i renderer

- **Grana:** `dodatak/sekcije-registar`
- **Trajanje:** 5 radnih dana
- **Zavisnosti:** faza 0
- **Admin dobija:** još ništa. Ali početna je od ove faze **podatak, a ne JSX**.

**Cilj** je dokazati apstrakciju pre nego što se plati migracijom. Ako izgled ili
ponašanje strimovanja odstupe, apstrakcija se menja dok je promena besplatna.

**Zadaci**

1. `lib/sekcije/polja.ts` — tipovi polja; `medij` od prvog dana nosi alt tekst.
2. `lib/sekcije/okvir.ts` — četiri presečne grupe. Ulazna animacija ulazi u grupu
   `raspored` **samo zato što se u istoj fazi isporučuje i njena implementacija**;
   opcija bez implementacije se ne isporučuje.
3. `lib/sekcije/registar.ts` — šest tipova: `naslov`, `hero`, `stavke`,
   `taksonomija`, `tekst` i **minimalan** `proizvodi` (izvori `izdvojeno` i
   `snizeno`, broj, mreža, naslov, tekst) — bez njega faza 1 ne može da reprodukuje
   živu početnu.
4. Podrazumevane vrednosti prepisati **doslovno** iz `components/home/nosnja.tsx`.
   Nikada iz mrtvih šablona.
5. `lib/sekcije/validacija.ts` — tri funkcije; `veza` kroz izdvojenu
   `safeInternalPath` sa dopunjenim `navigation.test.ts`.
6. Kontrastna provera po sekciji, sa pragom 4.5:1 za normalan i 3:1 za krupan tekst.
7. `lib/sekcije/registar.test.ts` i `lib/sekcije/validacija.test.ts` — fizički pod
   `lib/`.
8. `components/sekcije/OkvirSekcije.tsx` — pozadina, shema, razmak, razdelnik,
   širina. Omotač ne sme uvesti dodatni DOM sloj koji lomi `container-wide`.
9. `components/sekcije/ZaglavljeSekcije.tsx` — uklanja nedoslednost sa nadnaslovom.
10. `components/sekcije/index.tsx` i `RenderSekcije.tsx` — po jedan `<Suspense>` po
    asinhronoj sekciji, `try/catch` unutar granice, `force-dynamic` se ne dira.
11. Sanitizacija na **obe** granice, uz negativan XSS test na render granici.
12. Animacijski sloj: `hooks/useUOkviru.ts` (IntersectionObserver, jednokratno) sa
    obaveznim početnim `opacity-0` i `animation-fill-mode: both` — bez toga se
    ponavlja greška iz `HeroSection.tsx` gde element prvo bljesne — i sa **sopstvenom**
    proverom `prefers-reduced-motion`, jer globalni CSS blok gasi samo trajanja, ne
    JavaScript. Uz to nedostajući `@keyframes` u `@theme` bloku.
13. `lib/sekcije/podrazumevani-raspored.ts`; `app/(shop)/page.tsx` se svodi na
    `<RenderSekcije pageKey="home" />`.
14. Brisanje mrtvih komponenti koje su ovoj fazi bile osnova, sa re-eksportima:
    `HeroSection`, `MissionStatement`, `TrustBar`, `FeaturesStrip`, `CategoryCards`,
    `StatsSection` i `components/home/nosnja.tsx`. Obavezan `grep` pre brisanja.
15. Dopuna `CLAUDE.md` u **istom commit-u**.

**Provera**

- Screenshot početne pre i posle: **nula piksela razlike** na 1440, 768 i 390 px.
- Provera strimovanja koja se ne oslanja na screenshot: usporiti upit za 2 s i
  potvrditi da se skeleton i dalje pojavljuje i da ostatak stranice ne čeka.
- Testovi registra i validatora; posebno da za svaki `kind` podrazumevana
  konfiguracija prolazi sopstvenu šemu.
- Negativan XSS test na render granici, sa payload-om upisanim mimo validatora.
- `navigation.test.ts` dopunjen sa `/\evil.com`, `/%2f%2fevil.com`, `//evil.com`,
  `/a/../../b`.
- Sa `prefers-reduced-motion: reduce` nijedna animacija se ne pokreće; bez nje
  nijedan element ne bljesne.
- Pokvarena sekcija renderuje ostatak stranice, ne praznu stranu.
- `grep` za obrisane komponente vraća nulu.

### Faza 2 — Model, admin ekran, nacrt i objava

- **Grana:** `dodatak/sekcije-model-i-admin`
- **Trajanje:** 9 radnih dana (2a: 4–5, 2b: 4–5)
- **Zavisnosti:** faze 1 i 0
- **Admin dobija:** menja svaki tekst na početnoj, redosled dugmadima gore/dole, gasi
  i pali sekcije, sprema izmenu kao nacrt — uključujući redosled i vidljivost —
  pogleda je pod `/admin`, pa objavi.

Faza je podeljena jer se u pet dana ne može isporučiti obrazac generisan iz registra
za sedamnaest tipova polja: poređenja radi, `StoreSettingsPanel.tsx` ima 350 linija i
pokriva šest ravnih skalara bez ijedne liste.

**Zadaci (2a)**

1. Modeli `PageSection` i `MediaAsset`; nacrt-kolone ulaze u **prvu** migraciju.
2. Ručno pisana deveta migracija sa preambulom napisanom doslovno u samoj migraciji.
3. `CREATE TABLE`/`INDEX` plus osam CHECK ograničenja.
4. **Prvo pročitati** kanonsku verziju `scripts/db-invariant-smoke.sql` pa je
   dopuniti pozitivnim fixture-om i negativnim scenarijima u PL/pgSQL subtransakcijama.
5. GRANT korak u `docs/V2-ROLL-OUT.md` sa promenljivom.
6. `lib/db/sekcije.ts` — keširani čitač bez nacrt-kolona u `select`-u.
7. `lib/sekcije/invalidacija.ts` — logika invalidacije pod `lib/` da je test vidi.
8. `app/api/admin/sekcije/route.ts` — GET i POST; POST tvrdo sprovodi `maxPoStrani`
   i vraća 409.
9. `app/api/admin/sekcije/[id]/route.ts` — PUT i DELETE; **428** kad `version`
   nedostaje, **409** kad se ne poklapa.
10. `app/api/admin/sekcije/redosled/route.ts` — prima `{ id, version }` parove, ne go
    niz `ids`; uslovni UPDATE u jednoj transakciji.
11. Sve rute: inline provera uloge, `readBoundedJson`, validacija kroz registar,
    `revalidateTag(tag, { expire: 0 })`.
12. Dopuna `lib/auth/admin-policy.test.ts` negativnim slučajevima za svih šest novih
    putanja.
13. Minimalni deo medijateke se seli ovde, jer faza 1 registruje `hero.slika` kao
    `medij`: folder `sekcije` u belu listu, jedan profil obrade, prost birač.

**Zadaci (2b)**

14. `app/admin/sekcije/page.tsx` — dve kolone: levo lista sa prekidačem vidljivosti,
    dugmadima ▲▼, dupliraj i obriši, oznakom „ima nacrt“; desno obrazac **generisan
    iz registra**. Prevlačenja nema i ne obećava se.
15. `refKategorija`/`refBrend` su izbor iz liste; ako izvor ne postoji, sekcija se
    snima ali odgovor nosi upozorenje, a lista prikazuje oznaku „izvor ne postoji“.
16. `app/admin/sekcije/pregled/[pageKey]/page.tsx` — pravi renderer nad nacrtom,
    `force-dynamic`, traka „Pregled nacrta — nije objavljeno“.
17. Stavka „Sekcije stranica“ u admin navigaciji, grupa „Sadržaj“, iznad „Baneri“.
18. Tiptap izdvojen u zajedničku `components/admin/BogatiTekst.tsx`.
19. Tip `poziv` kao izlaz u nuždi.
20. Gašenje mrtvog banner keša: brišu se dve funkcije i tri no-op poziva; model i
    ekran ostaju, ekran se označava kao legacy.
21. Usputna ispravka: reorder tickera u `prisma.$transaction`.
22. Dopuna `scripts/seed-e2e.ts` sekcijama za `pageKey="home"`.
23. Dopuna `CLAUDE.md`, `docs/ARCHITECTURE-V2.md` i `docs/V2-ROLL-OUT.md` u istom
    commit-u.

**Provera**

- `migrate deploy` na **restore klonu** produkcione baze: klon dobija ceo lanac od
  devet migracija, meri se trajanje svake zasebno, a `auth-session-expand-preflight.sql`
  mora vratiti nulti nalaz **pre** toga.
- `db-invariant-smoke.sql` na tom klonu; `migrate diff --exit-code` bez drifta.
- Testovi invalidacije i politike pristupa.
- E2E: prijava → izmena naslova → „Sačuvaj nacrt“ → javna početna **još ne** prikazuje
  izmenu → pregled prikazuje → „Objavi“ → javna početna prikazuje.
- E2E: anonimni na `/admin/sekcije/pregled/home` dobija preusmerenje.
- E2E: promena redosleda i gašenje u nacrtu ne menjaju javnu početnu.
- Ručno: dva otvorena taba — drugi dobija 409; zahtev bez `version` dobija 428.

### Faza 3 — Medijateka, fotografije i gašenje dve istine o početnoj

- **Grana:** `dodatak/sekcije-medijateka`
- **Trajanje:** 7 radnih dana
- **Zavisnosti:** faze 2 i 0
- **Admin dobija:** otprema fotografije, drži ih na jednom mestu, ubacuje ih u hero,
  banere, slajder i galeriju, i piše im alt tekst. Početna prvi put ima fotografiju.

**Zadaci**

1. `scripts/seed-sekcije.ts` — **idempotentan** upis današnjeg rasporeda; drugo
   pokretanje ne menja ništa, i skripta odbija da prepiše red koji je vlasnik već
   objavio ili izmenio.
2. `db:seed-sekcije` u `package.json`.
3. Imenovan, obavezan korak u `docs/V2-ROLL-OUT.md` pre objave ove faze.
4. Brisanje fallback rasporeda **uslovljeno proverom nad produkcijom**:
   `SELECT count(*) FROM "PageSection" WHERE "pageKey"='home' AND "publishedAt" IS NOT NULL`
   mora biti veće od nule, i rezultat se lepi u opis PR-a.
5. Profili obrade `hero` (4 MB / 2000×1200), `kartica` (800×800), `ikona` (256×256).
   Postojeći folderi ostaju na 1 MB i 800×800.
6. `lib/media/upload-ulaz.ts` — zajednička provera pod `lib/`.
7. `checkRateLimit` plus semafor nad istovremenim `sharp` obradama, uz izričit zapis
   da procesni LRU nije zaštita od namernog DoS-a.
8. Dimenzije nisu besplatan podatak nego izmena poziva: `.toBuffer()` postaje
   `.toBuffer({ resolveWithObject: true })`.
9. Model `MediaAssetUsage` — **deseta** migracija, ista preambula.
10. Odluka koja se upisuje: da li DELETE briše i fajl sa diska i ko čisti siročiće.
    Ako briše — `path.resolve` pa provera prefiksa pre `unlink`, sve u istoj
    transakciji.
11. `app/admin/medijateka/page.tsx` i `app/api/admin/medijateka/route.ts` sa
    odbijanjem brisanja referisanog asseta i porukom koja nabraja sekcije.
12. `components/admin/MedijatekaPicker.tsx` — nadogradnja prostog birača u galeriju.
13. `components/sekcije/Karusel.tsx` — jedan omotač nad embla; zamenjuje tri
    mehanizma u kodu. **Obavezno dugme pauza/pokreni** kad god je autoplay uključen,
    sa `aria-pressed`; nije admin opcija. Bez toga svaki autoplay duži od 5 s pada
    WCAG 2.2.2, na sajtu koji je taj problem već bio rešio u trakici.
14. Tip `medij` sa prikazima `baner`, `slajder`, `galerija`; `hero` dobija mobilnu
    varijantu, sa obaveznim `priority` na prvoj slici i `sizes` po rasporedu.
15. `uploads/` u izuzetke proxy matchera — sa kosom crtom, jer negativni lookahead
    nije vezan za granicu segmenta pa bi go `uploads` isključio i `/uploadsX`.
16. Brisanje `HeroCarousel` i `CategoryBanners`.
17. `/admin/banners` označen kao legacy.
18. Pravilo u `CLAUDE.md`: nijedna komponenta ne sme proslediti `quality` van
    `[70, 75]`.

**Provera**

- Seed proizvodi tačno današnji raspored; drugo pokretanje ne menja nijedan red.
- Produkcijski upit vraća broj veći od nule **pre** brisanja fallback-a.
- Merenje LCP-a početne pre i posle prve fotografije — obavezna kapija, ne „ako
  postane problem“.
- Upload 3 MB JPEG-a u `sekcije/hero` prolazi, isti fajl u `products` pada.
- Brisanje slike koja je u upotrebi vraća spisak sekcija koje je koriste.
- Karusel ima vidljivo dugme pauza/pokreni; uz `prefers-reduced-motion` starta
  pauziran.
- E2E: admin doda `medij` sekciju sa slikom i objavi; anonimni vidi `<img>` sa
  `width`/`height` i nepraznim `alt`.
- Na kloniranom VPS okruženju: `deploy.sh` prolazi i slike preživljavaju deploy.
- **Provera pretpostavke o backup-u** pre nego što medijateka postane jedini nosilac
  fotografija.

### Faza 4 — Jedan blok proizvoda umesto osam elemenata

- **Grana:** `dodatak/sekcije-blok-proizvoda`
- **Trajanje:** 5 radnih dana, plus pola dana za zasebnu ispravku
- **Zavisnosti:** faze 3 i 0, i spojena grana `ispravka/where-or-u-fetch-products`
- **Admin dobija:** do tri bloka proizvoda po stranici, svaki sa svojim naslovom,
  izvorom, brojem i rasporedom. Kartice brendova i kategorija konačno prikazuju logo
  i sliku koje admin već unosi.

**Zadaci**

1. **Zasebna grana pre ove:** `lib/products.ts` postavlja `where.OR` za kategoriju pa
   ga niže bezuslovno prepisuje za pretragu, pa kombinacija kategorije i pojma tiho
   vraća pogrešan skup. Isti obrazac postoji i u `fetchSimilarProducts`. Ispravka sa
   sopstvenim testom i sopstvenim PR-om — **ne skriveno** unutar posla sa sekcijama.
2. `lib/db/blok-proizvoda.ts` — novi upiti **van** `lib/products.ts`, koji ima
   `"use server"` na prvoj liniji, pa bi svaki nov izvoz postao javna Server Action.
3. Proširenje tipa `proizvodi`: izvori
   `izdvojeno | snizeno | novo | najnovije | kategorija | brend | izabrani`, sort,
   broj 1–24, mreža ili karusel, kolone po uređaju, bedževi.
4. `maxPoStrani: 3` tvrdo sprovedeno u ruti; preporuka u UI-ju nije ograničenje.
5. Upiti kroz React `cache()` da se dva bloka sa istim upitom ne izvrše dvaput.
6. Javna ruta `/api/products` dobija prosleđivanje za `novo`, `colors`, `types` i
   `brandIds` — to je mapiranje opcija koje `fetchProducts` već podržava.
7. Tabovi kao isti tip sa nizom upita, sa kešom po indeksu.
8. Odluka u `CLAUDE.md`: kanonska kartica je `LocalProductCard` i tip
   `ProductCardData`; legacy `ProductCard` se ne širi. **Sekcija nikad ne čuva cenu.**
9. Tip `taksonomija` dopunjen brendovima i `Category.image`.
10. Brisanje `FeaturedCarousel`, `NewArrivals`, `BrandSlider`, `BrandGrid`.

**Provera**

- Test za `where.OR` ispravku; test da novi modul nema `"use server"`; test da POST
  odbija četvrti blok proizvoda sa 409.
- Dva bloka sa istim upitom proizvode **jedan** upit ka bazi.
- E2E: blok sa izvorom `snizeno` prikazuje tačnu cenu sa servera.
- Promena cene u adminu se odmah vidi na početnoj.

### Faza 5 — Jeftini tipovi nad postojećim podacima

- **Grana:** `dodatak/sekcije-jeftini-tipovi`
- **Trajanje:** 7 radnih dana
- **Zavisnosti:** faze 2, 3 i 0
- **Admin dobija:** pitanja i odgovore, utiske iz stvarnih recenzija, članke,
  odbrojavanje, pokretnu traku, cenovnik, tabelu, timeline i brojače.

**Zadaci**

1. Tip `stavke` dopunjen prikazima `harmonika`, `linija` i `brojaci`; izvor `ChatFAQ`
   sa **obaveznim** filterom po kategoriji, da isti zapis ne izlazi i u chat widžetu;
   FAQPage JSON-LD kroz postojeći `serializeJsonLd`.
2. `tabela` i `cenovnik` kao **zasebne** `kind` vrednosti. Stavka repeatera ne može
   da nosi redove × kolone sa zaglavljem, ni cenu, valutu, sufiks, listu osobina,
   oznaku „istaknuto“ i dugme.
3. Tip `clanci` — bez nasleđivanja `stone-*` boja iz bloga; nelokalizovan naslov
   dokumentovan kao poznat nedostatak, jer je `Article.title` obična kolona.
4. Tip `odbrojavanje` — vezan za `Promotion.endDate`; `getProductPromotions` mora
   dopuniti mapiranje sa `endDate`, koji danas ne vraća.
5. Tip `traka` nad postojećim `@keyframes marquee`, sa **obaveznim** dugmetom za
   pauzu. „Pauza na hover“ nije pristupačnost, jer hover ne postoji na dodiru ni na
   tastaturi.
6. Tip `utisci` nad `ProductReview`; filter `productId: { not: null }` je **obavezan**,
   jer je kolona nullable pa bi recenzije vezane samo za ERP kod napravile null bucket.
   Pažnja: `getProductReviewStats` agregira po `productCode` — nije isti ključ.
7. Tip `newsletter` — postojeća sekcija prelazi u tip; u adminu prikazan kao
   onemogućen izbor kad je capability ugašen, umesto tihog nestajanja sa sajta.
8. Brisanje `Testimonials` i `CountdownSale`; izmišljena imena se **brišu**, ne
   prenose.

**Provera**

- Test da `stavke` sa izvorom `ChatFAQ` bez kategorije odbija validaciju.
- Test da `getProductPromotions` vraća `endDate`.
- Test da upit za `utisci` nosi `productId: { not: null }`.
- Promena FAQ zapisa menja samo izabranu kategoriju, ne i chat widžet.
- `grep` za „Podrška 24/7“, „Besplatna dostava“ i izmišljena imena vraća nulu.

### Faza 6 — Mediji koji dodiruju CSP i sanacija mrtvih animacija

- **Grana:** `dodatak/sekcije-mediji-rizicni`
- **Trajanje:** 6 radnih dana
- **Zavisnosti:** faze 3, 1 i 0
- **Admin dobija:** video, klikabilne tačke preko fotografije, pre/posle poređenje, i
  izbor ulazne animacije po sekciji.

**Zadaci**

1. **Odluka o MP4 pre isporuke tipa `video`:** ili se `MediaAsset` proširuje na
   `video/mp4` (bez `sharp`, sa sopstvenim limitom i proverom magic bajtova, i bez
   `width`/`height` iz sharpa), ili MP4 ispada iz tipa i to se upisuje u izvan obima.
   Danas upload ruta prima samo četiri image MIME tipa i svaki fajl obavezno prolazi
   kroz `sharp(...).webp()`, pa MP4 nikad ne bi dobio `MediaAsset` red.
2. Tip `video` — strukturirano polje, nikad HTML iz editora. Za YouTube poster dodati
   `i.ytimg.com` u `images.remotePatterns`. Vimeo traži izmenu `frame-src` i to je
   **zasebna bezbednosna odluka**.
3. Tip `hotspot` — tačke u procentima, vizuelno postavljanje klikom u adminu; mini
   kartica uzima cenu sa servera.
4. Tip `medij` dopunjen prikazima `uporedi` i `parallax`. Parallax preko `transform`,
   ne `bg-fixed` (ne radi na iOS Safariju), isključen ispod 1024 px.
5. Tip `instagram` — ručne slike kao **podrazumevani** izvor. API put je danas
   `force-dynamic` sa `cache: 'no-store'`, pa svaki pogodak ide na Graph API; dobija
   sopstveni keš pre nego što se ponudi kao izvor.
6. Katalog ulaznih animacija po sekciji nad slojem iz faze 1.
7. Sanacija mrtvih animacija: klase `animate-in`, `slide-in-from-*` i
   `animate-accordion-*` u `Dialog`, `Drawer` i `Accordion` **nemaju definiciju**, jer
   `tailwindcss-animate` nije zavisnost a `tailwind.config.ts` se ne učitava.
8. Brisanje `InstagramFeed` i `ParallaxBanner`. Time `components/home/index.ts` ostaje
   prazan i **cela fascikla se briše** — čekirana stavka, ne namera.

**Provera**

- `curl -I` potvrđuje da se CSP nije promenio ako Vimeo nije tražen.
- Video radi na Chrome-u, Safariju i mobilnom; parallax isključen ispod 1024 px.
- Dialog, Drawer i Accordion imaju animaciju i ništa se nije pomerilo.
- Test da `video` polje odbija proizvoljan URL.
- Instagram izvor ne udara Graph API na svaki pogodak.
- E2E: hotspot sa proizvodom prikazuje cenu koja se poklapa sa stranicom proizvoda.

### Faza 7 — Druge stranice, proizvoljne stranice i podnožje

- **Grana:** `dodatak/sekcije-druge-stranice`
- **Trajanje:** 7 radnih dana, procena manje pouzdana od ostalih
- **Zavisnosti:** faze 4, 3 i 0
- **Admin dobija:** sekcije iznad i ispod kataloga, na stranici proizvoda i na 404;
  nove stranice sa svojim slugom i SEO podacima; tekst podnožja bez programera.

**Ovo je jedina faza koja se sme odložiti bez posledica po ostatak plana.**

**Zadaci**

1. `pageKey` za `catalog`, `category`, `product` i `not-found`.
2. Proizvoljne stranice `stranica:<slug>` uz rutu `app/(shop)/[slug]/page.tsx` — ili
   se isporučuju, ili se `stranica:<slug>` uklanja iz CHECK regexa da u shemi ne stoji
   neispunjeno obećanje. Vidi odeljak 13.
3. `app/sitemap.ts` ima tvrdo upisan niz statičkih stranica koji **već** ne odgovara
   stvarnim rutama — ispraviti ga.
4. Podešavanja po stranici: sakrij trakicu, sakrij podnožje, LCP slika.
5. Blokovi u prefooter zoni. Mapa ostaje poseban slučaj, jer `iframe` ne prolazi kroz
   sanitizer.
6. Filter blok ograničen na `sale`, `novo` i `sort` — jedine parametre koji ne zavise
   od kataloga atributa — i to se upisuje kao poznat dug.
7. Objedinjavanje `app/(shop)/layout.tsx` i `app/(legal)/layout.tsx`, koji danas
   dupliraju isti okvir.

**Provera**

- Sekcija na `pageKey=catalog` pojavljuje se na `/catalog` a ne na početnoj.
- Proizvoljna stranica je dostupna na `/<slug>` i prisutna u `sitemap.xml`;
  neobjavljena vraća 404.
- 404 stranica prikazuje admin-uređen tekst i **i dalje vraća HTTP 404**.
- Objedinjeni layout ne menja skup montiranih komponenti.

---

## 8. Pokrivenost WoodMart elemenata

Svih 42 elementa sa poslate slike. „Okvir“ znači da je element opcija koju nosi svaki
tip sekcije, a ne zaseban tip.

| Element | Pokriva | Faza | Napomena |
| --- | --- | :-: | --- |
| Titles | `naslov` + okvir | 1 | Grupa zaglavlja ugrađena u svaki tip |
| Banners | `medij` | 3 | `hero` pokriva baner preko cele širine već u fazi 1 |
| Sliders | `medij` | 3 | Desktop i mobilna slika po slajdu |
| Carousels | okvir | 3 | Jedan mehanizam umesto današnja tri |
| Section dividers | okvir | 1 | Iscrtan postojećom šarom `Traka` |
| Compare images | `medij` | 6 | Klizač preko `clip-path` |
| Images gallery | `medij` | 3 | Mreža i masonry, alt obavezan |
| Video | `video` | 6 | YouTube, i MP4 ako se odobri |
| Image Hotspot | `hotspot` | 6 | Cena mini kartice sa servera |
| 360 degree | — | — | Izvan obima: 18–36 kadrova po komadu |
| Infobox | `stavke` | 1 | Podrazumevano iz današnje trake vrednosti |
| Pricing tables | `cenovnik` | 5 | Zaseban tip, nizak prioritet |
| Table | `tabela` | 5 | Strukturirani podatak, ne HTML |
| Menu price | `cenovnik` | 5 | Ista komponenta, varijanta liste |
| List element | `stavke` | 5 | Položaj ikone je polje okvira stavke |
| Accordion | `stavke` | 5 | Nad postojećom `Accordion.tsx`, izvor FAQ |
| Instagram | `instagram` | 6 | Ručne slike; API traži token i svoj posao |
| Social buttons | — | — | Izvan obima: `SocialShare` nije montiran uživo |
| Team member | — | — | Izvan obima: radionica nema tim koji se predstavlja |
| Testimonials | `utisci` | 5 | Iz stvarnih recenzija |
| Timeline | `stavke` | 1 i 5 | Koraci izrade u fazi 1, linija u fazi 5 |
| Blog element | `clanci` | 5 | Iz modela `Article` |
| Portfolio element | — | — | Izvan obima: `Article` već pokriva priču |
| Countdown timer | `odbrojavanje` | 5 | Traži ispravku `getProductPromotions` |
| Animated counter | `stavke` | 5 | Brojevi ručno, ne iz baze |
| Marquee | `traka` | 5 | Sa obaveznim dugmetom za pauzu |
| Parallax Scrolling | `medij` | 6 | Preko `transform`, ne `bg-fixed` |
| Animations | okvir | 1 i 6 | Sloj u fazi 1, izbor u adminu u fazi 6 |
| Gradients | okvir | 1 | Nabrojane vrednosti, u bazi nema CSS-a |
| Buttons | `poziv` | 2 | Ista grupa ugrađena i u `hero` i u `medij` |
| Button with popup | `poziv` | 2 | Samo dugme sa vezom; popup je izvan obima |
| Product Widgets | `proizvodi` | 4 | Kompaktna lista kao raspored |
| AJAX Product tabs | `proizvodi` | 4 | Do pet tabova, prebacivanje kroz javni API |
| Recent Products | `proizvodi` | 4 | Izvor u istom bloku |
| Featured Products | `proizvodi` | 1 i 4 | Minimalno već u fazi 1 |
| Sale Products | `proizvodi` | 1 i 4 | Isto |
| Top Rated Products | `proizvodi` | 4 | Jedini izvor koji traži nov upit nad recenzijama |
| Products Grid | `proizvodi` | 4 | Jedan blok umesto osam redova |
| Products Category | `taksonomija` | 4 | Navigacija podkategorija |
| Products Categories | `taksonomija` | 1 | Kategorije konačno prikazuju sliku |
| Product Filters | `filter` | 7 | Samo `sale`, `novo`, `sort`; ostalo čeka atribute |
| Brands element | `taksonomija` | 4 | Traka logotipa nad `Brand.logo` |

**Globalne funkcije oko kojih treba doneti odluku:**

| Funkcija | Ishod |
| --- | --- |
| Wishlist | Radi; dodaje se prekidač vidljivosti na karticama (faza 4) |
| Product labels | Prekidač vidljivosti postojećih oznaka (faza 4) |
| HTML Block | Tip `tekst` (faza 2) |
| Layouts builder | Podatkovni sloj da, vizuelni builder ne (faze 2 i 7) |
| Header builder, Mega menu | Izvan obima; zaglavlje ostaje kod |
| Quick view, Compare | Izvan obima |
| Variation swatches, Product attributes tabela, AJAX filteri | Izvan obima: čekaju katalog atributa |
| Size guide, Sticky add to cart, Waitlist, Estimated delivery, Recently viewed | Izvan obima: svaka ide na svoju granu |
| Frequently bought together | Izvan obima: traži nov tip promocije i serverski obračun |
| Cookie notice | Izvan obima, **ali potrebno hitno** — analitika se danas učitava bez pristanka |
| Maintenance mode, Catalog mode, Promo popup, Infinite scroll | Izvan obima |

---

## 9. Izvan obima

Svaka stavka ima razlog i može da se vrati kasnije, na svojoj grani.

1. **Vizuelni builder sa prevlačenjem** i bilo kakvo prevlačenje redosleda. Admin
   dobija listu sa obrascem i dugmad ▲▼. To se kaže unapred.
2. **Ugnježdene strukture** — redovi, kolone, sekcija u sekciji. Svaka sekcija je
   jedna horizontalna traka; kolone postoje kao parametar.
3. **Sopstveni CSS i JavaScript po elementu**, koje WoodMart nudi. CSP dozvoljava
   skripte samo sa tri hosta, a sanitizer odbacuje stilove.
4. **Proširenje sanitizera** za `table`, `iframe`, `video`, `figure`, `style`. To je
   bezbednosna granica, ne nedostatak.
5. **Vimeo i `youtube-nocookie.com`** kao izvori videa — zasebna bezbednosna izmena.
6. **360 degree view** — traži 18–36 kadrova po komadu i medijski model kojeg nema.
7. **Compare i Portfolio** — dva ručno tkana šala razlikuju se upravo po tome što se
   ne porede; `Article` već pokriva portfolio.
8. **Team member** — traži svoju šemu stavke; radionica nema tim koji se predstavlja.
9. **Social buttons kao tip sekcije** — postojeća komponenta nije montirana uživo.
10. **Login to see prices i Age verify** — skrivanje cene je najveća prepreka
    konverziji; na tkanini nema uzrasnog ograničenja.
11. **Preloader** — `app/loading.tsx` i skeletoni već pokrivaju potrebu.
12. **Stock progress bar** — kod unikata je zaliha po veličini često 1, pa bi traka
    bila lažna hitnost.
13. **Maintenance mode kao admin prekidač** — middleware ne čita bazu.
14. **Prebacivanje capability flagova iz env-a u bazu** — zaseban zahvat.
15. **Sve što zavisi od kataloga atributa** — dinamički filteri, swatch varijacije,
    atributska tabela, linked variations.
16. **Horizontalna forma filtera nad katalogom** — gradila bi drugu admin površinu nad
    legacy poljima koja po roadmapu treba da nestanu.
17. **Proizvoljne stranice** — vidi odeljak 13.
18. **Frequently bought together** — traži nov `PromotionType` i serversku validaciju
    zbirne cene.
19. **Kolačić traka i uslovljeno učitavanje analitike** — potrebno, ali pravni posao.
20. **Waitlist, sticky add to cart, traka besplatne dostave, procena isporuke** —
    korisno i nevezano za page builder.
21. **Popravka mrtvih lanaca stranice proizvoda** — deljenje, vodič za veličine,
    slični proizvodi, nedavno gledano.
22. **Migracija base64 banera i brisanje tabele** — nema šta da se migrira jer nema
    čitaoca; brisanje modela je zaseban contract korak.
23. **Istorija verzija i vraćanje na proizvoljno prethodno stanje**, šabloni sekcija,
    uvoz/izvoz konfiguracije, preseti teme.
24. **Sloj industrijskih paketa i bilo kakav multi-tenant** — `ARCHITECTURE-V2.md` to
    izričito odbija za ovu fazu.

---

## 10. Rizici

| Rizik | Posledica | Mera |
| --- | --- | --- |
| **Lanac migracija** | Ko na osnovu „jedan CREATE TABLE“ zakaže kratak prozor, dobija pet migracija u istom pozivu | Klon dobija ceo lanac; auth preflight mora proći pre sekcijske |
| **Prazna javna početna** | Brisanje fallback-a pre nego što u bazi postoje objavljene sekcije | Idempotentan seed i produkcijski upit zalepljen u opis PR-a |
| **Tihe zamke pri prepisivanju WoodMart primera** | Vimeo, pogrešan `quality` ili tag van bele liste ne prijavljuju grešku — samo ne rade | Registar unapred zabranjuje te vrednosti; svaka pokrivena testom |
| **Admin napravi sporu početnu** | Početna je `force-dynamic`, svaki blok je upit po zahtevu na deljenom VPS-u | `maxPoStrani: 3` sprovedeno u ruti; upiti kroz `cache()` |
| **Nacrt curi u javni keš** | Neobjavljen sadržaj vidljiv posetiocima, ili preslagivanje menja sajt uživo | Nacrt-kolone za redosled i vidljivost; keš čita samo objavljene |
| **`Json config` nije proverljiv u bazi** | Propust u validatoru vidi se tek u rendereru | Osam CHECK ograničenja; `normalizujSekciju` i pri čitanju |
| **Backup fotografija nije dokazan** | Slike žive samo na disku jednog servera | Provera i uspostavljanje backupa pre faze 3 |
| **Podizanje limita uploada** | Duže `sharp` obrade na jednom PM2 procesu koji deli mašinu sa tri aplikacije | Novi limit samo za folder `sekcije`, uz semafor |
| **Brisanje medija koji je u upotrebi** | Slika nestane sa žive početne | `MediaAssetUsage` kao izvor istine o referencama |
| **Promena oblika `config`-a posle nekoliko meseci** | Postojeći redovi ne odgovaraju novoj šemi | `schemaVersion` i normalizator koji popunjava dodata polja |
| **Vizuelna i kontrastna regresija** | Početna je jedina stranica koju vlasnik gleda svaki dan | Screenshot pre/posle i kontrastna provera po sekciji |
| **Pokretni sadržaj bez pauze** | WCAG 2.2.2 pad na sajtu koji je taj problem već bio rešio | Dugme za pauzu je obavezno, nije admin opcija |
| **Alt tekst se zaboravi** | Slike bez opisa | Alt je deo vrednosti polja `medij`, ne zasebno polje |
| **Preslaganje iz dva otvorena taba** | Izmešan redosled | Ruta za redosled prima `{id, version}` parove u transakciji |
| **GRANT sa izmišljenim imenom role** | Runtime pada dok CI prolazi | Korak se piše sa promenljivom `:app_user` |
| **Mrtvi duplikati posle prelaska** | Isti dug zbog kog se ovo i radi | Svaka faza briše komponentu koja joj je bila osnova |
| **Testovi koje plan navodi kao kapiju ne mogu da se pokrenu** | Lažan osećaj pokrivenosti | Sva logika pod `lib/`; rute pozivaju testirane funkcije |
| **Admin E2E harnes ne postoji** | Faze 2–7 ne mogu da ispune svoje kapije | Faza 0 ga gradi i dokazuje pre svega ostalog |
| **Preklapanje sa nezavršenim katalogom atributa** | Dupli rad koji kasnije treba rušiti | Sve što zavisi od atributa je izričito izvan obima |
| **Sanitizacija samo pri upisu** | Red koji uđe mimo validatora renderuje se neproveren | Druga granica u rendereru, sa sopstvenim negativnim testom |

---

## 11. Odluke koje čekaju vlasnika

Sve ostalo je izvedeno iz koda. Ovo je devet mesta gde kod ne može da odluči.

### 1. Redosled migracija

Pušta li se sekcijska migracija tek pošto četiri auth expand migracije budu primenjene
i potvrđene, ili se svih pet ide u jednom prozoru?

**Preporuka:** auth prvo, po sopstvenom rollout postupku sa preflight kapijom, pa tek
onda sekcijska. Jedan neuspeh po prozoru, ne pet odjednom.

### 2. Medijateka na disku

Prihvata li se `public/uploads` kao kanonski obrazac, i šta biva sa `Banner` tabelom?

**Preporuka:** da. Disk je već dokazan obrazac u deploy skripti. `MediaAsset` je jedini
registar slika, `Banner` ostaje netaknut a ekran se označava kao legacy. **Pre toga
proveriti da backup tog direktorijuma stvarno postoji na serveru.**

### 3. Engleski prevodi

Popunjavaju li se `en` vrednosti stvarnim prevodom, ili `en` ostaje kopija srpskog?

**Preporuka:** `en` ostaje **opciono** i pri renderu pada na `sr`, nikad na prazan
string. Admin obrazac prikazuje engleski tab sa oznakom „nije prevedeno“, a lista
sekcija broji koliko polja čeka prevod. Obavezan `en` bi zaustavljao vlasnika na
svakom snimanju i garantovano proizveo kopije srpskog teksta.

### 4. Domet

Staje li plan na početnoj, ili obuhvata i katalog, kategoriju, proizvod i 404, ili ide
do proizvoljnih stranica?

**Preporuka:** početna plus faza 7 kao **odloživa**. Proizvoljne stranice ostaju van
obima i `stranica:<slug>` se briše iz CHECK regexa da u shemi ne stoji neispunjeno
obećanje.

### 5. Odstupanje od roadmapa

Potvrđuje li vlasnik da se ovim planom izvršava faza 4 iz `ARCHITECTURE-V2.md` pre
faza 2 i 3?

**Preporuka:** da — vidljiva korist bez dodirivanja commerce jezgra. Posledica
(type-driven editor i filteri po atributima se odlažu) upisuje se u dokument sa
datumom, ne prećutkuje.

### 6. Fotografije

Ko ih obezbeđuje i do kada? Faza 3 daje alat, ne sadržaj.

**Preporuka:** ako fotografija neće biti do kraja faze 3, tipovi `medij`, `hero` i
`galerija` isporučuju se sa ponašanjem bez slike (tkana šara), i to treba znati kao
**planirano** stanje, ne kao grešku.

### 7. Podizanje limita uploada na 4 MB i 2000 px

Prihvata li se trošak na resursu? Odluka je o tuđoj mašini, ne o kodu.

**Preporuka:** da, ali samo za novi folder `sekcije`, uz semafor nad istovremenim
`sharp` obradama i prethodnu proveru memorije PM2 procesa.

### 8. Moderacija recenzija

Dobija li `ProductReview` kolonu za odobrenje javnog prikaza? `verified` znači samo
verifikovanu kupovinu i nije zamena za moderaciju.

**Preporuka:** bez nove kolone — samo recenzije sa komentarom i ocenom iznad praga,
uz ručni izvor kao siguran put. Ako se želi prava moderacija, to je još jedna
migracija i treba je odobriti **sada**, dok je lanac ionako otvoren.

### 9. Vimeo u CSP-u

Treba li `frame-src` proširiti van `www.youtube.com`?

**Preporuka:** ne. Video radi sa YouTube-om i sa MP4 iz medijateke. Ako je Vimeo
poslovno potreban, to je zasebna bezbednosna izmena sa svojim pregledom.

---

## 12. Prvi korak

Ceo posao se radi u repou prodavnice i grana se **isključivo sa udaljenog refa**:

```bash
cd ~/Desktop/narodnanosnja-prodavnica
git fetch origin verzija/v2.0-univerzalna-platforma
git switch --no-track -c dodatak/sekcije-registar \
  origin/verzija/v2.0-univerzalna-platforma
git rev-parse --short HEAD    # MORA vratiti 2efbb76
npm ci --legacy-peer-deps --no-audit --no-fund
```

Ako `git rev-parse` vrati `8d22116`, grana je krenula sa zastarelog lokalnog refa i
sve dalje je nevažeće.

Prvi commit **ne dira** ni `prisma/`, ni `.github/`, ni `package.json`, i ne pravi
nijednu novu javnu površinu. Piše se `lib/sekcije/polja.ts`, `okvir.ts`, `registar.ts`
sa šest tipova, `validacija.ts`, plus testovi pod `lib/`; zatim
`components/sekcije/OkvirSekcije.tsx`, `ZaglavljeSekcije.tsx`, `index.tsx` i
`RenderSekcije.tsx`; na kraju `lib/sekcije/podrazumevani-raspored.ts` i svođenje
`app/(shop)/page.tsx` na `<RenderSekcije pageKey="home" />` uz zadržan
`force-dynamic`.

Pre commit-a:

```bash
npm run lint -- --quiet && npm run typecheck && npm test && npm run build
```

pa screenshot početne pre i posle na 1440, 768 i 390 px sa nula piksela razlike.

**Napomena o redosledu:** po fazi 0, pre ove grane se spaja `dodatak/e2e-admin-harnes`,
bez koje faze 2–7 ne mogu da ispune svoje E2E kapije.

---

## 13. Poznate nedoslednosti ovog plana

Tri mesta gde plan još nije sam sa sobom usaglašen. Svako traži jednu odluku:

1. **Social buttons.** Katalog tipova ih nema i odeljak „izvan obima“ ih isključuje,
   ali opis faze 5 ih još pominje. Razlog za isključivanje je da `SocialShare.tsx`
   danas nije montiran nigde uživo, pa bi tip sekcije bio drugi po redu posao nad
   komponentom koja se ne vidi. **Predlog:** ostaju izvan obima; montiranje postojeće
   komponente ide na svoju granu.

2. **Top Rated Products.** Katalog za tip `proizvodi` nabraja izvor
   „najbolje ocenjeni“, ali lista zadataka faze 4 taj izvor ne pominje izričito.
   **Predlog:** dopisati ga u fazu 4 kao `groupBy` nad `ProductReview` sa obaveznim
   `productId: { not: null }`.

3. **Proizvoljne stranice `stranica:<slug>`.** Faza 7 ih isporučuje, „izvan obima“ ih
   isključuje, a odluka 4 preporučuje isključivanje. **Predlog:** izvan obima za sada,
   i `stranica:<slug>` se briše iz CHECK regexa; ako se prihvate, dvotačka ulazi
   zasebnom jedanaestom migracijom koja menja samo taj CHECK.

---

## 14. Gde stoji ostatak građe

| Šta | Gde |
| --- | --- |
| Objavljena stranica sa planom | `https://claude.ai/code/artifact/8f6ec1ea-e591-446c-955e-d4c98b84ecf7` |
| Pun plan u JSON obliku, sa svim poljima | `~/Desktop/plan-sekcije-prodavnica.json` |
| Istraživanje 58 WoodMart elemenata sa opcijama | isti JSON, uz radnu fasciklu sesije |
| Mapiranje 97 redova sa dokazima | isti JSON |

Ovaj dokument je napisan u izdvojenom radnom stablu (`git worktree`) na grani
`dokumentacija/plan-sekcije`, da postojeća grana `ispravka/v2-db-authoritative-sessions`
i njena nezavršena izmena ostanu netaknute. Kad se grana spoji ili odbaci, radno
stablo se uklanja sa:

```bash
git worktree remove ~/Desktop/narodnanosnja-prodavnica-docs
```
