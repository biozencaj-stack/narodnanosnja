# Detaljan izveštaj rada — sekcije stranica i prateće ispravke

**Presek:** 4. septembar 2026.
**Polazna tačka:** `verzija/v2.0-univerzalna-platforma` @ `2efbb76`
**Povod:** zahtev da se funkcionalnosti WoodMart teme prenesu u prodavnicu tako
da ih **administrator dodaje sam iz admin panela**, uz istraživanje pre plana i
plan pre izrade.

Ovaj dokument opisuje **sve** što je urađeno u tom poslu: devet grana, šta svaka
nosi, zašto je tako rešena, šta je pri tom nađeno u zatečenom kodu, koje su
tvrdnje ispravljene, i — jednako važno — **šta nije provereno**.

Plan i istraživanje su u `docs/PLAN-SEKCIJE.md` (grana
`dokumentacija/plan-sekcije`). Ovaj dokument je dnevnik izvršenja, ne plan.

---

## Sadržaj

1. [Stanje grana na dan preseka](#1-stanje-grana-na-dan-preseka)
2. [Zavisnosti i redosled spajanja](#2-zavisnosti-i-redosled-spajanja)
3. [Grana po grana](#3-grana-po-grana)
4. [Nalazi u zatečenom kodu](#4-nalazi-u-zatečenom-kodu)
5. [Ispravke ranijih tvrdnji](#5-ispravke-ranijih-tvrdnji)
6. [Zamke zabeležene u CLAUDE.md](#6-zamke-zabeležene-u-claudemd)
7. [Šta je provereno, a šta nije](#7-šta-je-provereno-a-šta-nije)
8. [Šta iz plana nije urađeno i zašto](#8-šta-iz-plana-nije-urađeno-i-zašto)
9. [Sledeći koraci](#9-sledeći-koraci)

---

## 1. Stanje grana na dan preseka

Nijedna grana nije spojena. `verzija/v2.0-univerzalna-platforma` je i dalje na
`2efbb76`.

| Grana | Commit-a | Izmena | CI | Osnova |
| --- | ---: | --- | --- | --- |
| `dokumentacija/plan-sekcije` | 1 | 2 fajla, +1417 | ✅ | kanonska |
| `ispravka/tkana-traka-u-podnozju` | 1 | 5 fajlova, +106 −5 | ✅ | kanonska |
| `ispravka/where-or-u-fetch-products` | 1 | 4 fajla, +300 −134 | ✅ | kanonska |
| `dodatak/sekcije-registar` (faza 1) | 2 | 38 fajlova, +3593 −1025 | ✅ | kanonska |
| `dodatak/e2e-admin-harnes` (faza 0) | 2 | 7 fajlova, +269 −1 | ❌ | kanonska |
| `ispravka/zod-zavisnost` | 1 | 2 fajla, +2 −1 | — nema PR-a | kanonska |
| `ispravka/zastarela-uputstva` | 1 | 4 fajla, +31 −19 | — nema PR-a | kanonska |
| `dodatak/sekcije-model-i-admin` (faza 2) | 3 | 34 fajla, +3696 −55 | — nema PR-a | **faza 1** |
| `dodatak/medijateka-obrada` (deo faze 3) | 1 | 16 fajlova, +785 −63 | — nema PR-a | kanonska |

**CI se pokreće samo na pull request** ka `verzija/v2.0-univerzalna-platforma`
(ili na push te grane, ili ručno). Push na običnu granu ne pokreće ništa — zato
četiri grane nemaju nijednu proveru: za njih PR još nije otvoren.

Broj test fajlova pod `lib/`: kanonska 85 → faza 1: 88 → faza 2: 90.
Broj testova koji se izvršava: kanonska 425 → faza 2: **489**; grana medijateke
(granata sa kanonske) 440.

---

## 2. Zavisnosti i redosled spajanja

Osam od devet grana su granate sa kanonske grane i **međusobno nezavisne**.
Jedina koja se naslanja je faza 2.

```
verzija/v2.0-univerzalna-platforma (2efbb76)
├── dokumentacija/plan-sekcije            nezavisna
├── ispravka/tkana-traka-u-podnozju       nezavisna
├── ispravka/where-or-u-fetch-products    nezavisna
├── ispravka/zod-zavisnost                nezavisna
├── ispravka/zastarela-uputstva           nezavisna  ⚠ dodiruje V2-ROLL-OUT.md
├── dodatak/e2e-admin-harnes              nezavisna
├── dodatak/medijateka-obrada             nezavisna
└── dodatak/sekcije-registar (faza 1)
    └── dodatak/sekcije-model-i-admin (faza 2)   ⚠ dodiruje V2-ROLL-OUT.md
```

**Poznat sudar:** i `ispravka/zastarela-uputstva` i faza 2 menjaju
`docs/V2-ROLL-OUT.md`. Faza 2 opisuje pun lanac od **devet** migracija i
nadjačava tekst sa grane ispravke (koja govori o osam). Ko spaja drugu po redu,
zadržava verziju iz faze 2.

Predloženi redosled: prvo pet zelenih/sitnih nezavisnih grana, pa harnes kad
postane zelen, pa faza 1, pa faza 2.

---

## 3. Grana po grana

### 3.1 `dokumentacija/plan-sekcije` — istraživanje i plan

**Commit:** `084fe81` — *docs(sekcije): plan admin-konfigurabilnih sekcija stranica*

`docs/PLAN-SEKCIJE.md`, 1403 linije, 14 odeljaka: dnevnik istraživanja, popis
zatečenog koda, arhitektura, katalog tipova, osam faza sa zadacima i proverama,
tabela pokrivenosti 42 WoodMart elementa, 24 stavke izvan obima, 20 rizika,
devet odluka koje čekaju vlasnika.

Ključna sinteza: **42 WoodMart elementa → 18 tipova sekcija + 4 presečne grupe
opcija**. Elementi se preklapaju više nego što izgleda — „Recent/Featured/Sale/
Top Rated Products“ su četiri elementa u temi, a jedan tip sekcije sa poljem
„izvor“. Mapiranje je izvedeno u tabeli sa 97 redova, proverenoj prema kodu.

Uz plan je dopunjen `CLAUDE.md` pokazivačem na njega.

---

### 3.2 `ispravka/tkana-traka-u-podnozju` — šara bez boje

**Commit:** `16a46f3`

**Šta je bilo pokvareno.** Šare i trake iz `components/ukras` crtaju se kao SVG
upakovan u `background-image: url('data:image/svg+xml,...')`. Taj SVG je
**zaseban dokument** — CSS promenljive stranice u njemu ne postoje. Vrednost
`var(--color-zlatna)` tamo nije boja nego neispravan paint: linija sa `stroke`
nestane, oblik sa `fill` padne na crno. Ništa se ne prijavljuje; šara se
jednostavno ne vidi kako treba.

`components/layout/Footer.tsx:94` je prosleđivao baš takve vrednosti.

**Kako je rešeno.** Umesto ispravke na jednom mestu, čuvar:

```
lib/ukras/boja.ts   jeHeksBoja() / sigurnaBoja(vrednost, podrazumevana)
```

`sigurnaBoja` propušta isključivo doslovan HEX (`#rgb`, `#rgba`, `#rrggbb`,
`#rrggbbaa`); sve ostalo pada na podrazumevanu vrednost i u razvoju javlja u
konzoli. Podrazumevane vrednosti su namerno **jednake** vrednostima promenljivih
(`#b98f21`, `#a4161a`), pa i pozivi koje nisam dirao od sada crtaju ispravno.

`saraZa`, `sara` i `Traka` u `components/ukras/index.tsx` sve prolaze kroz
čuvara. Četiri testa u `lib/ukras/boja.test.ts`.

---

### 3.3 `ispravka/where-or-u-fetch-products` — pretraga briše filter

**Commit:** `b274cbc`

**Šta je bilo pokvareno.** U `fetchProducts` se `where.OR` postavljao za
kategoriju, pa ga je pojam pretrage **bezuslovno prepisivao**:

```ts
if (categorySlug) where.OR = [ /* uslovi kategorije */ ];
if (search)       where.OR = [ /* uslovi pretrage */ ];   // briše prethodni
```

Posledica: na `/category/salovi` sa unetim pojmom vraćali su se pogoci iz celog
kataloga. Korisnik vidi rezultate i nema razloga da posumnja da filter više ne
važi.

**Kako je rešeno.** Sklapanje uslova je izdvojeno u čistu funkciju:

```
lib/products-filter.ts   buildProductWhere() / buildProductOrderBy()
```

OR-grupe se sada skupljaju u `where.AND` niz, pa svaka ostaje na snazi.
Trinaest testova u `lib/products-filter.test.ts`, uključujući regresioni za
tačno ovaj slučaj.

**Provereno usput:** `fetchSimilarProducts` **nema** istu grešku, suprotno
onome što je pisalo u ranijoj belešci — on namerno gradi jedan OR niz.

---

### 3.4 `ispravka/zod-zavisnost` — produkcijski kod na razvojnom paketu

**Commit:** `4070057`

**Nalaz.** Dve produkcijske admin rute uvoze `zod`:

```
app/api/admin/ticker/route.ts:6
app/api/admin/ticker/[id]/route.ts:6
```

`zod` **nije bio naveden** u `package.json`. U `node_modules` je stizao isključivo
posredno, i to preko **lint dodatka**: jedini paketi koji ga deklarišu su
`eslint-plugin-react-hooks` (zavisnost) i `zod-validation-error` (peer). U
`package-lock.json` je zato stajao označen `"dev": true` — svrstan među razvojne
pakete, a koristi ga kod koji se izvršava u produkciji.

**Zašto se to ne primećuje.** I CI i `scripts/deploy.sh` instaliraju punim
`npm ci --legacy-peer-deps`, pa se razvojni paketi ipak nađu na disku. Oslonac je
slučajan: podizanje `eslint-config-next` koje izbaci ili preimenuje taj dodatak,
ili bilo koja instalacija bez razvojnih paketa, obara izgradnju obe rute. A
`npm run typecheck` to **ne bi prijavio**, jer tipovi postoje dok god paket stoji
u `node_modules`.

**Ispravka.** Unos u `dependencies`, prikovan na `^4.3.6` — tačno onu verziju
koja je već bila u upotrebi, da commit bude samo o deklaraciji i ne povuče
uzgredno podizanje na 4.5.x. Izmena su svega dva reda: unos u `package.json` i
nestanak `"dev": true` iz lock fajla.

---

### 3.5 `ispravka/zastarela-uputstva` — pogrešan broj migracija

**Commit:** `98e395a`

**Nalaz.** `prisma/migrations/` sadrži **osam** migracija, od kojih su četiri
auth expand. Osma (`20260830030000_expand_authoritative_sessions`) je ušla u
lanac, ali prateća proza nije osvežena, pa je pet mesta i dalje tvrdilo „sedam
migracija“ i „tri auth expand promene“:

```
CLAUDE.md              opis lanca; kontrolna lista pred primenu
docs/GITHUB-DEPLOY.md  definicija „usklađene šeme“; pregled preduslova
docs/V2-ROLL-OUT.md    uvodni pasus
```

**Zašto je to bitno.** Ta uputstva se čitaju baš u trenutku kad neko sprema
kontrolisanu primenu na produkciju. Ko bi ih pratio doslovno, primenio bi tri
auth migracije i zaključio da je posao gotov, a `authoritative_sessions` bi
ostala neprimenjena — dok kod koji je očekuje ide u pogon.

`docs/PRISMA-BASELINE.md` je jedini bio tačan (ima tabelu sa svih osam redova i
statusom svake); ostala dokumenta su usklađena sa njim.

**Broj „tri“ u kontekstu audit skripti je namerno ostavljen.** Proverio sam
listu zabranjenih kolona u `scripts/auth-email-verification-audit-legacy.sql`:
pokriva tačno migracije 5–7 (`tokenHash`, verification throttle kolone,
`emailVerificationLoginGraceUntil`), a ne osmu. To je sada i zapisano u
PRISMA-BASELINE.md, da se ubuduće ne čita kao još jedan zaostali broj.

Nijedna tvrdnja o produkciji nije menjana — i dalje stoji da su primenjene samo
prve četiri migracije. Istorijski dnevnici (`docs/DETALJAN-*`) namerno **nisu**
dirani: oni beleže stanje u trenutku pisanja i menjanje bi falsifikovalo zapis.

---

### 3.6 `dodatak/e2e-admin-harnes` (faza 0) — provera admin ekrana

**Commit-i:** `751764d`, pa `3040182` (popravka posle prvog CI pada)

**Zašto postoji.** Sve kasnije faze menjaju admin panel, a zatečeni E2E paket je
pokrivao samo mobilni tok kupovine. Bez prijavljene sesije nijedan admin ekran
se nije mogao proveriti.

**Šta nosi.**

```
scripts/seed-e2e.ts            ADMIN nalog iza ISTOG guarda kao ostatak seed-a
e2e/fixtures/admin-stanje.ts   konstante (putanja stanja, prazno stanje, nalog)
e2e/fixtures/admin.ts          prijava kroz stvarni obrazac; čuva storageState
e2e/admin-smoke.spec.ts        4 provere harnesa, ne admin funkcionalnosti
playwright.config.ts           tri projekta: setup-admin, mobile, desktop
.gitignore                     /e2e/.auth/ — snimljena sesija je kredencijal
```

Nalog se pravi kroz `provisionPrivilegedAccount`, isti put kojim ide
`scripts/create-admin.ts` — ne ručnim `prisma.user.create` sa bcrypt hešom. Tako
dobija isto verified stanje i očišćene tokene, pa ga verified-login politika ne
obori.

**Zašto su konstante u zasebnom fajlu.** `playwright.config.ts` uvozi putanju
snimljenog stanja. Fajl koji zove `setup(...)` ne sme biti uvezen iz
konfiguracije — Playwright to odbija.

**Prvi CI pad i njegov uzrok.** Prvi run je pao ovako:

```
Expected pattern: /\/admin$/
Received string:  "http://127.0.0.1:3107/login?callbackUrl=%2Fadmin"
```

Izgledalo je kao pokvarena autorizacija. Nije bila. Obrazac za prijavu menja
natpis dugmeta dok zahtev traje:

```jsx
{isLoading ? (<span>… Prijava...</span>) : ("Prijavite se")}
```

Moje čekanje je bilo „dugme *Prijavite se* je nestalo“ — a to postane tačno već
u trenutku klika, pre nego što je NextAuth uopšte odgovorio. `page.goto("/admin")`
je kretao bez kolačića sesije, proxy ga je **ispravno** vraćao na `/login`, a
prekinuti zahtev je ostavljao `⨯ uncaughtException: Error: aborted (ECONNRESET)`
u dnevniku servera. Trka se gubi praktično uvek, jer prijava nosi bcrypt i upit
ka bazi — pao je i prvi pokušaj i ponovljeni.

**Popravka** (`3040182`): čeka se odgovor `/api/auth/callback/credentials`, uz
čekanje postavljeno **pre** klika da ne promakne, pa stvarni odlazak sa `/login`.
Ishod se čita kroz `expect.poll`, koji na odbijenu prijavu kaže „odbijeno“ umesto
anonimnog isteka vremena — jer odbijena prijava takođe vraća **200**, pa status
nije dokaz. Iz istog razloga `page.goto("/admin")` može vratiti `ok()` iako je
posetilac preusmeren: preusmerenje se završava statusom 200, pa se adresa mora
proveriti zasebno.

**Stanje:** i posle popravke CI i dalje pada na koraku `npm run test:e2e`. Ovog
puta je verovatan drugi uzrok — setup sada prolazi, pa se **prva četiri admin
testa uopšte prvi put izvršavaju** (ranije su bila „did not run“). Logovi
zahtevaju prijavu i nisu dostupni preko javnog API-ja, a lokalna reprodukcija
nije moguća: na razvojnoj mašini nema ni PostgreSQL-a ni Docker-a.

Tvrdnje ta četiri testa su ipak unapred proverene prema kodu: `Nazad na sajt`
postoji u `AdminShell.tsx:103`, `h1 Porudžbine` u `app/admin/orders/page.tsx:163`,
telo `{ error: "Prijava je obavezna." }` dolazi iz `proxy.ts`, a bočna traka se u
desktop projektu iscrtava jednom (mobilna kopija je iza `sidebarOpen`), pa nema
strict-mode sudara.

---

### 3.7 `dodatak/sekcije-registar` (faza 1) — početna postaje podatak

**Commit-i:** `4373893`, `e8663f9`

**Šta se promenilo.** `app/(shop)/page.tsx` je sveden na:

```tsx
export const dynamic = "force-dynamic";
export default function HomePage() {
  return (
    <>
      <RenderSekcije pageKey="home" />
      {storeCapabilities.newsletter && <NewsletterSection />}
    </>
  );
}
```

Sav tekst, redosled i izgled sekcija dolaze kroz registar tipova. Obrisano je
sedam komponenti početne (`HeroSection`, `MissionStatement`, `TrustBar`,
`FeaturesStrip`, `CategoryCards`, `StatsSection`, `nosnja.tsx`).

**Novi moduli.**

```
lib/sekcije/polja.ts        14 tipova polja, tokeni boja, obrasci putanja
lib/sekcije/okvir.ts        4 presečne grupe koje nosi SVAKA sekcija:
                            zaglavlje, pozadina, razdelnik, raspored
lib/sekcije/registar.ts     tipovi sekcija; jedini autoritet nad oblikom config-a
lib/sekcije/validacija.ts   validirajSekciju / normalizujSekciju / sanitizujSekciju
lib/sekcije/prikaz.ts       DRUGA granica sanitizacije, na renderu
components/sekcije/         okvir, zaglavlje, dugmad, šest tipova sekcija
hooks/useUOkviru.ts         ulazna animacija, tri stanja
```

**Odluke koje se ne smeju izgubiti.**

- **Razmaci su imenovani po ulozi**, ne po veličini: `bez`, `uzak`, `srednji`,
  `visok`, `uvodni`. Ime po ulozi preživljava promenu vrednosti.
- **Svaka asinhrona sekcija ide u sopstveni `Suspense`**, sa kosturom iz
  registra. Bez toga se sekcije serijalizuju i stranica prestaje da strimuje — a
  finalni snimak ekrana izgleda isto, pa se regresija ne primeti.
- **`try/catch` stoji unutar te granice**, u samoj komponenti. Jedna pokvarena
  sekcija renderuje ništa; stranica ostaje.
- **Nepoznat `kind` se preskače uz upozorenje.** To je normalno stanje posle
  vraćanja koda unazad, kad podaci znaju za tip koji kod još nema.
- **`podrazumevanaKonfiguracija()` vraća `structuredClone`**, nikad zajedničku
  referencu.

**Regresija uhvaćena poređenjem HTML-a.** Prva verzija je svaku sekciju umotavala
u `OkvirSekcije` na nivou renderera. Asinhrone sekcije koje vrate `null` tako su
i dalje emitovale prazan `<section>` sa razmakom — **vidljivi procepi tamo gde
danas nema ničega**. Popravljeno zasebnim commit-om `e8663f9`: okvir renderuje
sama komponenta sekcije.

Provera je rađena poređenjem normalizovanog `<main>` HTML-a pre i posle izmene.
Sekcije kategorija i proizvoda nisu mogle biti upoređene — za njih treba baza.

**Uz to,** `lib/security/navigation.ts` je proširen: izdvojen
`canonicalInternalPath`, dodati `safeInternalPath` (prima i `#sidro`),
`safeExternalUrl` i `safeLinkTarget`. Ponašanje `safeLoginCallbackPath` je
nepromenjeno.

**Privremeni dug, upisan kao takav.** `lib/sekcije/podrazumevani-raspored.ts`
drži današnju početnu u kodu, doslovno reprodukovanu kroz sedam sekcija. To je
jedina tačka u kojoj postoje dve istine o početnoj. Njeno gašenje je stavka faze
3 i uslovljeno je upitom nad produkcijom.

---

### 3.8 `dodatak/sekcije-model-i-admin` (faza 2) — baza, rute, admin ekran

**Commit-i:** `7f8bdfa` (model), `0cace37` (rute), `419865c` (ekran)

Jedina grana koja se naslanja na drugu (na fazu 1).

#### 3.8.1 Model i deveta migracija

Tri nova modela; **nijedna postojeća tabela nije dirana**.

- `PageSection` — `pageKey`, `kind`, `order`, `isActive`, `config`, tri
  nacrt-kolone, `schemaVersion`, `version`, `publishedAt`, `updatedById`.
- `MediaAsset` — putanja, folder, MIME, dimenzije, bajtovi, `alt`.
- `MediaAssetUsage` — veza sekcije i medija sa putanjom polja.

**Zašto nacrt ima tri kolone, a ne jednu.** Bez `draftOrder` i `draftIsActive`
preslagivanje i gašenje sekcija menjaju javni sajt **uživo**, dok pregled nacrta
tu promenu ne pokazuje — čime nacrt gubi smisao.

**Zašto `MediaAssetUsage`.** Putanja medija stoji na proizvoljnoj dubini
`config`-a i pod različitim ključevima po tipu (`stavke[2].ikona`,
`slike[3].slika`). Nijedan Prisma jsonb filter ne nalazi string na proizvoljnoj
dubini. Bez tabele upotrebe provera reference ili tiho promaši i dozvoli brisanje
slike sa žive početne, ili odbija brisanje svega.

**`updatedById` je bez strane veze ka `User`-u**, da brisanje admin naloga ne
obori sekciju.

**Migracija** `20260902120000_expand_page_sections` je ručno pisana, expand-only:
samo `CREATE TABLE`, `CREATE INDEX` i `ADD CONSTRAINT CHECK`. Nijedan `ALTER` nad
postojećom tabelom, nijedan DML, nijedan `DROP` — povratak koda na prethodnu
verziju ostaje bezbedan.

`search_path` je `pg_catalog, public`, **namerno obrnuto** od
`20260829020000_expand_v2_platform`, da korisnički objekat u `public` ne može da
zaseni sistemsku funkciju tokom migracije. Razlika je objašnjena u samoj
migraciji da ne izgleda kao previd.

**Devet CHECK ograničenja, ne osam.** Plan u tekstu kaže osam, ali njegova
sopstvena tabela nabraja devet; pošao sam za tabelom.

| Ograničenje | Uslov |
| --- | --- |
| `PageSection_order_nonnegative_check` | `"order" >= 0` |
| `PageSection_version_nonnegative_check` | `"version" >= 0` |
| `PageSection_draft_order_check` | `"draftOrder" IS NULL OR "draftOrder" >= 0` |
| `PageSection_pageKey_format_check` | `~ '^[a-z][a-z0-9_-]{0,63}$'` |
| `PageSection_kind_format_check` | `~ '^[a-z][a-zA-Z0-9]{0,39}$'` |
| `PageSection_config_object_check` | `jsonb_typeof("config") = 'object'` |
| `PageSection_draft_object_check` | `NULL OR jsonb_typeof(...) = 'object'` |
| `MediaAsset_path_format_check` | putanja mora početi alfanumerikom |
| `MediaAsset_dimensions_check` | `width > 0 AND height > 0 AND bytes > 0` |

`pageKey` je **regex, a ne zatvorena `IN` lista**: lista bi tražila novu
migraciju za svaku novu stranicu i time protivrečila razlogu zbog kog je
konfiguracija Json. **Dvotačka je zabranjena** dok odluka o dometu
(`stranica:<slug>`) ne bude doneta — jednom dozvoljena vrednost u bazi se teško
povlači nazad.

**Provera bez baze.** DDL je upoređen sa onim što Prisma sama generiše
(`migrate diff --from-empty --to-schema-datamodel`): imena indeksa, redosled
kolona, tipovi, podrazumevane vrednosti i imena stranih ključeva se poklapaju.
CHECK ograničenja Prisma ne vidi — isti obrazac koriste i `20260829020000` i
`20260830030000`.

**DB invarijante.** `scripts/db-invariant-smoke.sql` je dobio dvanaest blokova:
provera da tabele, kolone i dva indeksa postoje u dogovorenom obliku, **jedan
pozitivan fixture** (bez njega bi provera prolazila i da ograničenja odbijaju baš
sve) i devet negativnih scenarija, svaki u sopstvenoj subtransakciji.

**Redosled objave je odlučen i upisan** u `docs/V2-ROLL-OUT.md`: prvo sve četiri
auth migracije, pa tek onda sekcije. Nije tehnička zavisnost — tabele sekcija ne
dodiruju nijednu auth tabelu. Razlog je što auth migracije nose pravi rizik
(diraju `User` i `Session`, imaju audit skripte, lock plan i maintenance prozor),
a sekcije su samo tri nove tabele. Da sekcije idu prve, problem u auth prozoru
zatekao bi bazu u stanju drugačijem od onog nad kojim su auth migracije probane
na klonu, pa bi rollback morao da razmršava dva nepovezana posla odjednom.

**GRANT** je imenovan korak u istom dokumentu, ne u migraciji: nijedna postojeća
migracija nema GRANT, a aplikaciona rola je sada vlasnik baze pa bi bio no-op.
Postoji za slučaj da migraciju ikad primeni druga rola — superuser tokom
restore-a je realan scenario — jer bi tada `validate`, `diff` i `build` uredno
prolazili, a runtime padao na prvom upitu.

#### 3.8.2 Rute

**Rute su fabrike sa ubrizganim zavisnostima, ne obični handleri.** To nije stvar
ukusa: `lib/auth/server-session-callsite-inventory.test.ts` dozvoljava
`resolveServerSession` samo rutama koje su tako napisane i upisane u njegov
`SESSION_FACTORY_SPECS`, a sirovi `getServerSession(authOptions)` stoji na spisku
koji se namerno **smanjuje**. Prva verzija ovih ruta ga je koristila i test ju je
oborio — s pravom.

Oblik se isplatio odmah: logika se testira bez PostgreSQL-a i bez Next runtime-a.
Petnaest testova u `lib/sekcije/rute.test.ts`.

```
lib/sekcije/rute.ts          rukovaoci: GET, POST, PUT, DELETE, redosled, objavi
lib/sekcije/prisma-veze.ts   vezivanje tih fabrika za Prismu i next/cache
lib/db/sekcije.ts            keširano čitanje objavljenog + čitanje nacrta
lib/sekcije/invalidacija.ts  pravilo koje oznake keša padaju posle koje izmene
```

**Statusi koji nose značenje.**

- **428** kad `version` nedostaje — klijentu fali preduslov, nije poslao smeće;
  400 bi ga naveo da traži grešku u telu.
- **409** kad se `version` ne poklapa — uslovni `updateMany` vraća nulu, pa drugi
  tab dobija poruku umesto tihog „poslednji pobeđuje“.
- **503** kad je sesija `unavailable` — to nije isto što i „nije prijavljen“.
  401 bi posetioca poslao na prijavu koja bi pala isto.

**Preslagivanje prima parove `{ id, version }`, ne go niz `ids`.** Go niz bi
značio da se dva otvorena taba tiho pregaze, a rezultat bi bio redosled koji
nijedan od njih nije video. Sve ide u jednoj transakciji: delimično preslagan
spisak je gori od neizmenjenog, jer bi redni brojevi počeli da se ponavljaju.

**Objava ide po stranici, ne po sekciji.** Nacrt je slika celog rasporeda; da se
objavljuje sekcija po sekcija, posetilac bi između dva klika video novi naslov
iznad starog rasporeda. Plan nije naveo rutu za objavu — dodata je kao
`/api/admin/sekcije/objavi`.

**Čuvanje nacrta NIŠTA ne poništava u kešu.** To je cela poenta nacrta: javna
stranica bi se pregradila iz istih objavljenih podataka, pa bi svaki potez u
obrascu rušio keš početne za sve posetioce bez ikakve koristi.

**Javni čitač ne vidi nacrt.** `citajObjavljeneSekcije` u `select`-u namerno ne
navodi nijednu nacrt-kolonu. To je granica, ne optimizacija: da su tu, jedan
pogrešan `??` u komponenti objavio bi neobjavljen sadržaj, a greška bi se videla
tek na produkciji.

**Granica po tipu (`maxPoStrani`) se sprovodi u ruti**, ne samo u obrascu:
obrazac sakrije dugme, ali ruta prima i direktan zahtev. Broje se i neobjavljene
sekcije, inače bi se granica zaobišla tako što se naprave a ne objave.

Politika pristupa nije menjana — deny-by-default već pokriva nove putanje. Dodat
je test koji to dokazuje za svih šest, uključujući slučaj da neko kasnije doda
`/admin/sekcije` u OPERATOR spisak.

#### 3.8.3 Admin ekran

```
app/admin/sekcije/page.tsx                     spisak + obrazac
app/admin/sekcije/pregled/[pageKey]/page.tsx   pregled nacrta
components/admin/sekcije/EkranSekcija.tsx      dve kolone
components/admin/sekcije/PoljeObrasca.tsx      polje po tipu iz registra
components/admin/sekcije/ListaObrasca.tsx      liste stavki
components/admin/BogatiTekst.tsx               uređivač bogatog teksta
lib/auth/admin-stranica.ts                     ADMIN provera za stranice
```

**Obrazac se generiše iz registra.** `PoljeObrasca` pokriva svaki tip polja i ima
iscrpnu `never` proveru: nov tip u registru obara prevođenje umesto da tiho
nestane iz obrasca.

**Prevlačenja nema i ne obećava se.** Dugmad ▲▼ rade bez biblioteke, rade na
dodir i rade sa tastature.

**Pregled nacrta koristi pravi renderer**, sa `force-dynamic` i trakom „Pregled
nacrta — nije objavljeno“. Poseban „pregledni“ prikaz bi pokazivao nešto što
javni sajt nikad neće nacrtati, pa bi lagao baš kad je najpotrebniji.

Kad ekran dobije 409 ili 428, **sam ponovo učita spisak**. Bez toga bi svaki
sledeći potez pao isto, a administrator ne bi znao zašto.

**Dva mrtva mehanizma su ugašena.** `getCachedBanners` i `getCachedAllBanners`
nisu imali nijednog pozivaoca i nisu ni bili keširani — komentar je sam govorio
da su slike prevelike za `unstable_cache`. Uz njih su obrisana i tri
`revalidateTag("banners")` poziva: oznaku `banners` **nikad niko nije
registrovao**, pa su bili no-op koji izgleda kao invalidacija. Takav kod je gori
od nikakvog, jer sledeći čitalac veruje da keš postoji i da se čisti. Model i
admin ekran za banere ostaju; čitanje ide kroz `lib/banners/index.ts`.

**Usputna ispravka:** preslagivanje trakice išlo je kroz `Promise.all` sa
zasebnim upitima. Jedan neuspeh je ostavljao spisak delimično preslagan uz 500 u
odgovoru, pa bi administrator ponovio radnju nad stanjem koje više nije video.
Sada je `prisma.$transaction`.

**Seed za E2E** upisuje tačno ugrađeni raspored kao objavljene sekcije. Time E2E
ima šta da uređuje, a renderovana početna ostaje ista kao sa povratkom na
ugrađeni raspored, pa postojeći mobilni test kupovine ne vidi promenu.

---

### 3.9 `dodatak/medijateka-obrada` (deo faze 3)

**Commit:** `436695a`

Deo faze 3 koji **ne zavisi ni od faze 1 ni od faze 2**, pa je granan sa
kanonske grane i ne produbljuje niz.

**Granice po fascikli.** `lib/media/profili.ts` drži po jedan profil za svaku
fasciklu. Zatečene (`products`, `articles`, `categories`, `brands`) ostaju
netaknute na 1 MB i 800×800 — podizanje bi bez potrebe povećalo postojeće slike
i promenilo izgled stranica podešenih prema tim dimenzijama. Novi
`sekcije-hero` prima 4 MB i 2000×1200; `sekcije-kartica` 1 MB i 800×800;
`sekcije-ikona` 256 KB i 256×256.

**Zamka koja je zamalo napravljena.** Modul nema uvoza React-a, Prisme ni Next-a,
pa isto ograničenje čita i ruta i pregledač. To nije stil nego uslov:
`ImageUpload` je tvrdo kodirao 1 MB, tako da bi veća serverska granica bila
**nedostižna** — hero od 3 MB klijent bi odbio pre nego što zahtev uopšte krene.

Uz to, klijent je bacao poruku servera i prikazivao uopšteno „Greška pri uploadu
slike“. Nova poruka nosi razlog i granicu za tu fasciklu, pa je sada i prikazuje.

**Semafor nad `sharp`-om.** Svaka obrada drži dekodovani bitmap u memoriji;
2000×1200 u RGBA je oko 9,6 MB pre ijedne transformacije. Nekoliko istovremenih
otpremanja obori ceo Node proces, ne samo jedan zahtev. Najviše dve obrade
istovremeno, uz `finally` koji vraća mesto i kad posao pukne — bez toga bi
nekoliko grešaka trajno smanjilo broj mesta i otpremanje bi se zaglavilo zauvek.
Dodat je i `checkRateLimit` **po korisniku**, ne po IP-u, jer administratori rade
iza iste adrese.

> ⚠️ Ni jedno ni drugo **nije zaštita od namernog DoS-a** i tako je i zapisano:
> oba žive u memoriji jednog procesa, pa pod PM2 cluster režimom svaka instanca
> broji za sebe, a restart briše brojanje.

**Dimenzije u odgovoru.** `.toBuffer()` je postao
`.toBuffer({ resolveWithObject: true })`, pa odgovor nosi `width` i `height`.

**Pauza karusela — stvarni propust.** `RecentlyViewed` je montiran na stranici
proizvoda, ima autoplay na 5 s i **nijedno dugme za pauzu**. `stopOnInteraction`
to ne ispunjava: staje tek kad posetilac dodirne sam sadržaj, a WCAG 2.2.2 traži
mehanizam i pre toga. Pauza na hover ne prolazi ni na dodir ni sa tastature.
Isti sajt je taj problem već bio rešio u `components/layout/Ticker.tsx`.

Popravljeno kroz `hooks/usePauzaKarusela.ts` + `components/ui/DugmePauze.tsx`, u
sve tri komponente sa autoplayem. Uz `prefers-reduced-motion` karusel starta
pauziran.

**Dva čuvara umesto dve rečenice u dokumentaciji:**

- `lib/media/kvalitet-slika.test.ts` — nijedan `quality={n}` van `[70, 75]` i van
  `next.config.ts` liste. Next to već ograničava kroz `qualities`, ali **tiho**:
  vrednost van spiska ne obara izgradnju, slika se samo posluži drugačije nego
  što je autor mislio.
- `lib/media/autoplay-pauza.test.ts` — svaka komponenta sa autoplayem mora imati
  `aria-pressed` dugme ili `DugmePauze`.

---

## 4. Nalazi u zatečenom kodu

Sve nabrojano je nađeno usput, nije bilo predmet zahteva, i svako je provereno
pre nego što je opisano.

| # | Nalaz | Posledica | Stanje |
| --- | --- | --- | --- |
| 1 | `where.OR` se prepisuje u `fetchProducts` | pretraga u kategoriji vraća ceo katalog | popravljeno |
| 2 | `var(--color-*)` unutar `data:` URI SVG-a | traka u podnožju bez boje, tačkice crne | popravljeno |
| 3 | `zod` nije u `package.json`, stiže preko lint dodatka | izgradnja dve admin rute visi o tuđoj zavisnosti | popravljeno |
| 4 | Osam migracija, dokumentacija tvrdi sedam | primena na produkciju bi preskočila osmu | popravljeno |
| 5 | `getCachedBanners` / `getCachedAllBanners` bez pozivaoca | mrtav kod | obrisano |
| 6 | Tri `revalidateTag("banners")` bez registrovane oznake | no-op koji izgleda kao invalidacija | obrisano |
| 7 | Preslagivanje trakice bez transakcije | delimično preslagan spisak uz 500 | popravljeno |
| 8 | `RecentlyViewed` autoplay bez pauze | pad WCAG 2.2.2 na živoj stranici | popravljeno |
| 9 | `ImageUpload` tvrdo kodira 1 MB | veća serverska granica nedostižna | popravljeno |
| 10 | `ImageUpload` baca poruku servera | korisnik ne zna šta je pogrešio | popravljeno |
| 11 | 15 od 17 komponenti u `components/home/` nema nijednog pozivaoca | mrtav kod | zabeleženo; faza 1 briše 7 |
| 12 | `TextAlign` bi proizveo `style` koji beli spisak briše | poravnanje bi tiho nestajalo | izbegnuto |

---

## 5. Ispravke ranijih tvrdnji

Ovo su mesta gde sam nešto tvrdio, pa proverio i ispalo drugačije. Beleže se da
se pogrešna tvrdnja ne prenese dalje.

1. **„`fetchSimilarProducts` ima istu `where.OR` grešku.“** Nema. On namerno
   gradi jedan OR niz. Tvrdnja je bila u ranijoj belešci; ispravljena je u
   commit poruci ispravke.
2. **„Lanac ima četiri migracije.“** Ima osam; sekcije su deveta. Utvrđeno
   direktnim `git ls-tree`.
3. **„`lib/security/bounded-json.ts` ne postoji.“** Postoji na kanonskoj grani.
   Ranija provera je gledala zastareo lokalni ref, 33 commita iza `origin`.
4. **„Autoplay bez pauze je propust u `HeroCarousel`-u na živoj stranici.“** Ni
   `HeroCarousel` ni `FeaturedCarousel` nisu nigde montirani. Živi propust je
   bio u `RecentlyViewed`. Ostale su svejedno popravljene, da pravilo važi svuda.
5. **„Plan traži osam CHECK ograničenja.“** Tekst plana kaže osam, njegova
   tabela nabraja devet. Ugrađeno je devet, po tabeli.

---

## 6. Zamke zabeležene u CLAUDE.md

Sve su nađene tako što su prvo pojele vreme.

- **`export type { X }` iz fajla sa `"use server"`** Turbopack tumači kao Server
  Action i obara izgradnju na svakoj stranici koja taj modul dodiruje — a
  `npm run typecheck` to uredno propusti.
- **Rute koje čitaju sesiju moraju biti fabrike sa ubrizganim zavisnostima**, i
  zavisnosti se pišu izričito (`nadjiSekciju: nadjiSekciju`) — skraćeni zapis je
  drugi AST čvor i inventar ga odbija. Inventar drži i tvrde ukupne brojeve.
- **ADMIN provera na admin STRANICI ide kroz `zahtevajAdminaNaStranici`.**
  `app/admin/layout.tsx` propušta i OPERATOR-a, jer `isAdminRole` obuhvata obe
  uloge.
- **`Prisma.DbNull`, ne `null`**, kad se nullable Json kolona vraća na prazno.
  `null` upisuje JSON vrednost `null`, koju `draftConfig ?? config` čita kao
  postojeći nacrt.
- **Traka bogatog teksta sme da nudi samo ono što preživi
  `lib/security/html.ts`.**
- **Ikone admin navigacije moraju u `ADMIN_ICONS`;** `DynamicIcon` za nepoznato
  ime tiho vraća `null`.
- **Ne čekaj da dugme za slanje nestane kao znak da je radnja gotova** — obrazac
  mu menja natpis dok zahtev traje.
- **Odbijena prijava vraća 200**, greška je u telu; `ok()` nije dokaz uspeha.
- **Vrednosti sa `dataUri()` idu u jednostrukim navodnicima** (postojeće
  pravilo, potvrđeno nalazom o boji).

---

## 7. Šta je provereno, a šta nije

**Provereno lokalno, na svakoj grani:**

- `npm run lint -- --quiet`
- `npm run typecheck`
- `npm test` — 425 (kanonska) → 440 (medijateka) → 489 (faza 2)
- `npm run build` sa **tačnim** env blokom iz `.github/workflows/objavi.yml`
- faza 1 dodatno: poređenje normalizovanog `<main>` HTML-a pre i posle

**Provereno u CI-ju:** četiri grane su zelene (plan, tkana traka, where-or,
faza 1). Harnes je crven.

**NIJE provereno, i to je bitno znati:**

- **Nijedan upit nad pravom bazom.** Na razvojnoj mašini nema ni PostgreSQL-a,
  ni Docker-a, ni Homebrew-a, ni nix-a; port 5432 je prazan. Deveta migracija,
  `db-invariant-smoke.sql`, sve Prisma operacije i ceo E2E paket prvi put se
  izvršavaju u CI-ju.
- **Nijedan klik kroz pregledač.** Admin ekran, pregled nacrta i obrazac nisu
  viđeni kako se iscrtavaju.
- **Nijedno stvarno otpremanje slike.** Profili obrade i semafor su testirani
  kao čiste funkcije, ne kroz `sharp`.
- **Ništa na produkciji.** Nijedna migracija nije primenjena, nijedan upit
  izvršen, ništa objavljeno.

---

## 8. Šta iz plana nije urađeno i zašto

**Faza 2b:**

- Birači `refKategorija`/`refBrend` — ti tipovi polja **ne postoje** u registru
  faze 1. Nema ih čime napraviti; idu uz fazu koja ih uvodi.
- Tip `poziv` — nov tip sekcije, ne deo admin ekrana.
- `NewsletterEditor` nije preveden na `BogatiTekst`: treba mu ubacivanje slika i
  imperativni `ref`, pa bi prevođenje značilo rizik za newsletter bez ikakve
  koristi za sekcije.

**Faza 3:**

- `Karusel` omotač — namerno **nije** dodat. Pripada uz medijske sekcije koje ga
  koriste, a te zavise od faza 1 i 2. Komponenta bez ijednog pozivaoca je tačno
  bolest koju sam kritikovao u istraživanju (u `components/home/` ih na kanonskoj grani ima
  petnaest). Umesto nje je izdvojena kuka sa **tri stvarna pozivaoca**.
- Medijateka, deseta migracija, tip `medij`, brisanje ugrađenog rasporeda —
  zavise od faza 1 i 2 i od kapija koje ja ne mogu proći:
  - upit nad **produkcijom** mora vratiti broj veći od nule pre brisanja
    ugrađenog rasporeda, i rezultat se lepi u PR;
  - merenje LCP-a početne pre i posle prve fotografije;
  - provera na kloniranom VPS-u da slike prežive `deploy.sh`;
  - **provera pretpostavke o backup-u** pre nego što medijateka postane jedini
    nosilac fotografija.

---

## 9. Sledeći koraci

1. **Otvoriti PR-ove** za četiri grane koje ih nemaju (`zod`, `uputstva`,
   faza 2, medijateka). Bez PR-a CI ne postoji.
2. **Spojiti pet nezavisnih grana** koje su zelene ili trivijalne.
3. **Zatvoriti harnes.** Potreban je log koraka `npm run test:e2e` iz palog
   run-a; logovi zahtevaju prijavu i nisu dostupni preko javnog API-ja.
4. **Spojiti fazu 1, pa fazu 2.**
5. **Primeniti migracije na produkciju** po redosledu iz `docs/V2-ROLL-OUT.md`:
   prvo četiri auth, pa sekcije. Pre toga backup i pun prolaz na restore klonu,
   sa merenjem trajanja svake migracije zasebno.
6. **Tek onda ostatak faze 3.**

---

*Ovaj dokument opisuje stanje na dan 4. septembra 2026. i ne ažurira se sam.
Ako se nešto od navedenog promeni, promena se beleži u novom preseku, a ovaj
zapis ostaje kakav jeste — isto pravilo koje je primenjeno na
`docs/DETALJAN-*` dnevnike.*
