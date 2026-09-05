# Detaljan izveštaj rada — od spajanja grana do spremnog V2 taga

**Presek: 5. septembar 2026.**
**Osnova:** `2efbb76d4adcfa8d1e5fe335cb59f411d0c65cbe` (kod koji je u ovom
trenutku još uvek na produkciji)
**Glava grane `verzija/v2.0-univerzalna-platforma`:** `104e1afac6c4c1a4b639c22843536b8c2e67d155`

---

## Kako čitati ovaj dokument

Zapisa na projektu ima više i lako je otvoriti pogrešan. Poređano po tome
**šta pokrivaju**:

| Dokument | Pokriva |
| --- | --- |
| `docs/PLAN-SEKCIJE.md` | istraživanje WoodMart tema i plan faza 0–7; **šta je trebalo uraditi** |
| `docs/DETALJAN-IZVESTAJ-RADA-DO-2026-09-04.md` | faze 0–3 dok **nijedna grana još nije bila spojena** |
| **ovaj dokument** | sve od tog preseka: spajanje 17 PR-ova, faze 4–7, migracija produkcione baze, priprema taga |
| `docs/V2-ROLL-OUT.md` | operativni runbook za produkciju; ažuriran u PR #39 |
| `IZMENE.md` | istorijski dnevnik celog projekta, poslednja dopuna 31. avgust |

Ovaj dokument je pisan tako da se može čitati sam. Tamo gde ponavlja nešto iz
izveštaja od 4. 9., radi to u jednoj rečenici i upućuje dalje.

---

## 0. Rezime u deset redova

Na dan preseka od 4. septembra **nijedna** grana nije bila spojena — devet
grana je stajalo otvoreno nad `2efbb76`. Od tada je:

1. spojeno **17 pull request-ova** (#23–#39) u `verzija/v2.0-univerzalna-platforma`;
2. dovršena **faza 4** (blok proizvoda), **faza 5** (jeftini tipovi sekcija),
   **faza 7** (zone na ostalim stranicama) i **faza 6** (mediji i rizični tipovi);
3. početna strana svedena na podatak — `app/(shop)/page.tsx` je danas samo
   `<RenderSekcije pageKey="home" />`;
4. registar narastao na **17 tipova sekcija** raspoređenih po **8 zona** na pet
   različitih stranica;
5. nađeno i popravljeno **šest grešaka u zatečenom kodu** koje niko nije tražio;
6. **produkciona baza migrirana** sa osam na svih devet migracija, uz vežbu nad
   vernim klonom pre nego što je produkcija dodirnuta;
7. runbook ispravljen tamo gde je bio netačan (PR #39);
8. napravljen i proveren tag `prodavnica-v2-20260905-1`, koji **još nije gurnut**.

Produkcija u trenutku pisanja i dalje servira `2efbb76`. Objava čeka tvoj push.

---

## 1. Brojevi

Razlika između koda koji je na produkciji i glave V2 grane:

```
git diff --shortstat 2efbb76 104e1af
→ 181 files changed, 19231 insertions(+), 2627 deletions(-)
```

| Mera | Pre (`2efbb76`) | Sada (`104e1af`) |
| --- | ---: | ---: |
| Test fajlova pod `lib/` | 85 | **109** |
| Playwright spec fajlova | 1 | **5** |
| Tipova sekcija u registru | 0 | **17** |
| Zona stranica | 0 | **8** |
| Prisma migracija u repou | 9 | 9 (nepromenjeno) |

Nova četiri E2E speca: `admin-smoke`, `blok-proizvoda`, `pokretna-traka`,
`zone-stranica`.

**Nijedan nov paket nije instaliran.** To je bilo eksplicitno ograničenje kroz
sve četiri faze i nijednom nije prekršeno — `tailwindcss-animate` je razmatran
pa odbijen (vidi §6.1), `embla-carousel` nije uveden (karusel je pisan ručno),
Instagram Graph API klijent nije uveden.

Jedna izmena u `package.json` ipak postoji, i nije nova zavisnost:
`ispravka/zod-zavisnost` (PR #29) je **premestio `zod` iz `devDependencies` u
`dependencies`**. Paket je već bio instaliran u istoj verziji (`^4.3.6`) — u
`package-lock.json` je uklonjen samo `"dev": true`. Ispravka je bila neophodna
jer `zod` uvozi runtime kod; kao dev zavisnost bi nedostajao u produkcionoj
instalaciji.

---

## 2. Kampanja spajanja — 17 pull request-ova

### 2.1 Redosled i zašto baš takav

Osam od devet grana sa preseka bilo je granato sa kanonske grane i međusobno
nezavisno; jedina koja se naslanjala bila je faza 2 na fazu 1. Redosled je
biran tako da se **sitno i zeleno spaja prvo**, pa krupno, pa dokumentacija.

Spojeno redom (prvi roditelj grane, odozdo naviše):

| Merge | PR | Grana | Izmena |
| --- | --- | --- | --- |
| `e356db5` | #28 | `ispravka/admin-nalog-vreme-verifikacije` | 3 fajla, +90 |
| `00ea314` | #23 | `ispravka/tkana-traka-u-podnozju` | 5 fajlova, +106 −5 |
| `00302e9` | #25 | `dodatak/e2e-admin-harnes` (faza 0) | 8 fajlova, +411 −1 |
| `e026c8e` | #27 | `dokumentacija/plan-sekcije` | 2 fajla, +1417 |
| `42bd180` | #24 | `ispravka/where-or-u-fetch-products` | 4 fajla, +300 −134 |
| `831224e` | #26 | `dodatak/sekcije-registar` (faza 1) | 38 fajlova, +3597 −1037 |
| `fdb5d9f` | #29 | `ispravka/zod-zavisnost` | 2 fajla, +2 −1 |
| `08fbfcf` | #30 | `ispravka/zastarela-uputstva` | 4 fajla, +31 −19 |
| `93d5dd2` | #31 | `dodatak/medijateka-obrada` | 18 fajlova, +847 −64 |
| `6ea7ad5` | #37 | `dokumentacija/dnevnik-sekcije` | 2 fajla, +766 |
| `3bc1180` | #32 | `dodatak/sekcije-model-i-admin` (faza 2) | 34 fajla, +3699 −59 |
| `fd2dc63` | #33 | `dodatak/sekcije-medijateka` (faza 3) | 18 fajlova, +1314 −12 |
| `ce0812c` | #34 | `dodatak/sekcije-blok-proizvoda` (faza 4) | 26 fajlova, +2159 −663 |
| `67cede8` | #35 | `dodatak/sekcije-jeftini-tipovi` (faza 5) | 39 fajlova, +2392 −375 |
| `bc949ea` | #36 | `dodatak/sekcije-druge-stranice` (faza 7) | 21 fajl, +801 −191 |
| `b18c3d4` | #38 | `dodatak/sekcije-mediji-rizicni` (faza 6) | 32 fajla, +1575 −392 |
| `104e1af` | #39 | `dokumentacija/rollout-posle-sekcija` | 1 fajl, +58 −8 |

Fazа 7 je namerno spojena **pre** faze 6. Faza 6 je bila jedina sa realnim
rizikom (spoljni mediji, CSP), pa je puštena poslednja od kodnih, da se u
slučaju problema izoluje bez povlačenja ostalog.

### 2.2 Konflikti i kako je svaki rešen

Konflikti su bili **isključivo u dokumentaciji**, nijedan u kodu. To nije
slučajnost — svaka grana je pisala u svoj deo `lib/sekcije/`, a svaka je
dopunjavala isti `CLAUDE.md`.

**`CLAUDE.md` — jedanaest grana, isti fajl.** Rešavano od slučaja do slučaja,
po pravilu:

- gde su obe strane dodavale **nove nabrojane stavke** (nov tip sekcije, nova
  zamka) — zadrži obe, poređaj logično;
- gde je `HEAD` već **nadjačao** stariji tekst (npr. opis registra koji je grana
  pisala pre nego što je registar narastao) — zadrži `HEAD`, odbaci granu;
- nikad „uzmi jednu stranu na slepo“, jer bi tako nestao opis tipa koji u kodu
  postoji.

**`docs/V2-ROLL-OUT.md` — „osam“ protiv „devet“ migracija.** Grana
`ispravka/zastarela-uputstva` je govorila o osam migracija, faza 2 o devet.
Zadržana je verzija iz faze 2: ona je nadskup, i tačna.

### 2.3 Jedini pravi pad CI-ja: PR #36

E2E spec `zone-stranica.spec.ts` je padao na Playwright *strict mode violation*.
Uzrok nije bio u kodu sajta nego u seleкtoru:

```ts
// palo: „404" se poklapa sa DVA naslova na 404 strani
await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
```

`getByRole(role, { name })` u Playwright-u poredi ime **kao podniz**, osim ako
se ne kaže drugačije. To nije nagađanje — provereno je u izvoru
`playwright-core`, u `getByRoleSelector`, gde se ime prosleđuje kroz
`escapeForAttributeSelector(name, !!options.exact)`. Bez `exact: true` drugi
argument je `false` i selektor postaje „sadrži“.

Popravka je bila da se traži tačno ono što se misli:

```ts
await expect(
  page.getByRole("heading", { level: 1, name: "404", exact: true }),
).toBeVisible();
await expect(
  page.getByRole("heading", { name: "E2E zona 404", exact: true }),
).toBeVisible();
```

Napomena o postupku: CI logove nisam mogao da pročitam (anonimni pristup vraća
`403`), pa je uzrok utvrđen čitanjem izvora biblioteke, a ne pogađanjem.

Posle toga je „Provera verzije“ na glavi grane **zelena**; deploy job-ovi
(`Objavi na produkciju`, `Potvrdi V2 release`) stoje `skipped`, jer se pale tek
na tag.

---

## 3. Faza 4 — blok proizvoda (PR #34)

Cilj: jedan tip sekcije koji zamenjuje tri ručno pisane komponente početne
strane i pri tom ume više od njih.

### 3.1 Čisti sloj upita — `lib/sekcije/upit-proizvoda.ts`

Ovaj fajl nema nijedan uvoz iz Prisma-e i zato je testabilan pod
`node --test`. On opisuje **šta** se traži, ne kako se dohvata.

Devet izvora:

```
izdvojeno · snizeno · izdvojenoISnizeno · novo · najnovije
kategorija · brend · najboljeOcenjeni · izabrani
```

Tri odluke iz ovog fajla vredi zapamtiti:

**`normalizujUpit` briše polja koja izabrani izvor ne koristi.** Ako
administrator izabere „iz kategorije“, upiše kategoriju, pa se predomisli i
pređe na „na sniženju“, polje kategorije se **prazni** pri čitanju. Bez toga bi
dva bloka koja rade isto imala različit ključ keša i uzalud dva puta gađala bazu.

**Ključ keša je string, ne objekat.**

```ts
export function kljucUpita(upit: VrednostUpitaProizvoda): string {
  return JSON.stringify([upit.izvor, upit.broj, upit.sort, upit.kategorija, upit.brend, upit.izabrani]);
}
```

Razlog je konkretan: React `cache()` memoizuje po **identitetu argumenta**. Dva
strukturno identična objekta su dva različita identiteta i keš ne bi radio
nikad. Zato keširane funkcije primaju stabilan string, a `kljucUpita`/
`razlozKljuc` su par koji ga pravi i razlaže.

**`izdvojenoISnizeno` vraća DVA koraka, ne jedan.** Zatečena
`FeaturedCarousel` komponenta je prikazivala prvo izdvojene pa sniženo, tim
redom. Da se taj redosled ne izgubi, plan upita za taj izvor ima dva koraka
koja se spajaju uz uklanjanje duplikata.

**Sortiranja po nazivu namerno nema.** `Product.name` je `Json` kolona
(višejezični naziv); `ORDER BY` nad njom ne daje ono što bi korisnik očekivao.
Bolje da opcija ne postoji nego da postoji i laže.

### 3.2 Sloj baze — `lib/db/blok-proizvoda.ts`

```ts
const ucitajPoKljucu = cache(async (kljuc: string) => { … });
```

Fajl živi pod `lib/db/`, ne u nekom `"use server"` modulu. Razlog je
bezbednosni: u fajlu sa `"use server"` **svaki izvoz postaje javno dostupna
Server Action**. Upitne funkcije tamo nemaju šta da traže.

Izvor `najboljeOcenjeni` ne može da se izrazi kao `orderBy` nad `Product` —
ocena živi u `ProductReview`. Rešeno grupisanjem:

```ts
prisma.productReview.groupBy({
  by: ["productId"],
  where: { productId: { not: null }, product: { active: true } },
  …
})
```

Uslov `productId: { not: null }` nije kozmetika: bez njega se u rezultatu
pojavljuje grupa sa `null` ključem i ruši mapiranje na proizvode.

### 3.3 Prikaz

- `components/sekcije/SekcijaProizvodi.tsx` — prepisana; bira mrežu, karusel ili
  tabove.
- `components/sekcije/KaruselProizvoda.tsx` — nov, ručno pisan klizač.
- `components/sekcije/TaboviProizvoda.tsx` — nov.
- `components/sekcije/stilovi.ts` — `MREZA_PROIZVODA` i `KLIZAC_PROIZVODA` kao
  **doslovne mape klasa**, plus `klaseMrezeProizvoda` / `klaseKlizacaProizvoda`.

Mape su doslovne zato što Tailwind skenira izvorni tekst; klasa sastavljena kroz
`` `grid-cols-${n}` `` ne bi bila generisana i mreža bi se raspala tek u
produkcionom buildu.

`LocalProductCard` je dobila `prikaziOznake` i `prikaziZelje` (obe `true`
podrazumevano), da bi ista kartica mogla da se koristi i u gušćim rasporedima.

### 3.4 Obrisano

`components/home/FeaturedCarousel.tsx`, `NewArrivals.tsx`, `BrandSlider.tsx` —
494 linije koda koje je zamenio jedan konfigurabilan tip sekcije.

---

## 4. Faza 5 — jeftini tipovi sekcija (PR #35)

„Jeftini“ znači: tipovi koje admin može da doda bez ijedne nove tabele i bez
spoljne integracije. Najveći skok u broju tipova od svih faza.

### 4.1 Novi tipovi

`tabela` · `cenovnik` · `clanci` · `odbrojavanje` · `traka` · `utisci` ·
`newsletter`, plus proširenje postojećeg `stavke` sa tri prikaza:
`harmonika | linija | brojaci`.

### 4.2 Prekidači mogućnosti — tip koji zna da nije dostupan

```ts
capability?: "newsletter" | "reviews" | "chat";
```

Tip `utisci` traži `reviews`, tip `newsletter` traži `newsletter`. Funkcija
`tipJeDostupan(kind, prekidaci)` odlučuje da li se tip uopšte nudi. Time se
sprečava da administrator doda sekciju koja u datoj konfiguraciji prodavnice
ne može ništa da prikaže.

### 4.3 Zamka sa datumima koja bi prošla neopaženo

Odbrojavanje prima datum. Prva verzija validacije je verovala `Date`-u:

```js
new Date("2026-02-31T10:00")   // NIJE Invalid Date — vraća 3. mart!
```

JavaScript ćutke prevrće nepostojeći datum. Administrator bi upisao 31. februar,
dobio zeleno, i video odbrojavanje do pogrešnog dana. Zato `datumPostoji`
rastavlja tekst pa poredi svaki deo sa onim što je `Date` zaista napravio:

```ts
function datumPostoji(vrednost: string): boolean {
  const delovi = vrednost.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!delovi) return false;
  const [, g, m, d, sat, minut] = delovi;
  const trenutak = new Date(vrednost);
  if (Number.isNaN(trenutak.getTime())) return false;
  return (
    trenutak.getFullYear() === Number(g) &&
    trenutak.getMonth() + 1 === Number(m) &&
    trenutak.getDate() === Number(d) &&
    trenutak.getHours() === Number(sat) &&
    trenutak.getMinutes() === Number(minut)
  );
}
```

Uz to je uvedeno `proveriUnakrsnaPravila` — provere koje ne mogu da se izraze
nad jednim poljem (npr. „kraj mora biti posle početka“).

### 4.4 Pokretna traka i WCAG

`TrakaKlizi.tsx` je animacija duža od pet sekundi, što po **WCAG 2.2.2** traži
mogućnost pauze. Važno: `stopOnInteraction` i pauza na hover **ne** zadovoljavaju
taj kriterijum — traži se stvarna kontrola. Zato traka ima dugme za pauzu i
poštuje `prefers-reduced-motion`.

Pri pisanju te komponente eslint pravilo `react-hooks/set-state-in-effect` je
oborilo prvu verziju. Rešeno kroz `useSyncExternalStore` sa serverskim snimkom
`false` — nema `setState` u efektu, nema neslaganja servera i klijenta.

### 4.5 Test koji čuva od izmišljanja

`lib/sekcije/izmisljen-sadrzaj.test.ts` je nastao zato što su obrisane
komponente (`Testimonials.tsx`, `CountdownSale.tsx`) sadržale **izmišljene
utiske kupaca sa imenima i gradovima**. Test pada ako se takav sadržaj vrati u
podrazumevani raspored ili u seed. Ovo je direktna primena pravila iz
`CLAUDE.md`: ne izmišljaj imena ljudi, datume ni brojeve.

### 4.6 Početna postaje podatak

```tsx
// app/(shop)/page.tsx — cela datoteka, praktično
export default function Page() {
  return <RenderSekcije pageKey="home" />;
}
```

Sav tekst, redosled i izgled dolaze iz registra i baze.

---

## 5. Faza 7 — zone na ostalim stranicama (PR #36)

Do ove faze sekcije su postojale samo na početnoj. Sada postoji **osam zona**:

```
home              cela početna
catalog-iznad     između navigacije i naslova kataloga
catalog-ispod     ispod liste proizvoda
category-iznad    vrh stranice kategorije
category-ispod    dno stranice kategorije
product-ispod     ispod detalja proizvoda
not-found         404 stranica
prefooter         iznad podnožja, na svim stranicama
```

### 5.1 Nije svaki tip dozvoljen svuda

`tipDozvoljenNaStranici(kind, pageKey)` sprečava besmislice — npr. blok
proizvoda u `prefooter` zoni koja se prikazuje na svakoj strani.
`STRANICE_BEZ_PREFOOTERA` isključuje dvostruko renderovanje.

Zaštita nije samo u admin obrascu. `lib/sekcije/rute.ts` na `POST` vraća `400`
i za nepoznatu zonu i za tip koji u toj zoni nije dozvoljen. **Sakriveno dugme
nije autorizacija** — provera mora da postoji na serveru.

### 5.2 `OkvirProdavnice` — jedan okvir umesto dva

`app/(shop)/layout.tsx` i `app/(legal)/layout.tsx` su imali skoro identičan
sadržaj koji se vremenom razišao. Sada oba koriste
`components/layout/OkvirProdavnice.tsx` sa `varijanta: "prodavnica" | "pravno"`,
i on je jedino mesto koje renderuje `<RenderSekcije pageKey="prefooter" />`.

### 5.3 `RenderSekcije` više ne obara stranicu

```tsx
try   { sekcije = await ucitajSekcije(pageKey); }
catch { sekcije = podrazumevanRaspored(pageKey); }
```

Ako baza padne, katalog i stranica proizvoda i dalje rade sa podrazumevanim
rasporedom. Pre ove izmene bi greška u učitavanju sekcija oborila celu stranicu.

---

## 6. Faza 6 — mediji i rizični tipovi (PR #38)

Poslednja i jedina faza sa spoljnim sadržajem. Četiri nova tipa: `medij`,
`video`, `hotspot`, `instagram`.

### 6.1 Animacije koje nisu postojale

Pri radu na dijalozima ispostavilo se da `Dialog.tsx`, `Drawer.tsx`,
`Accordion.tsx` i `FiltersAside.tsx` koriste klase iz `tailwindcss-animate`
**koji nikada nije bio instaliran**. Klase su bile mrtav tekst; animacija nije
bilo.

Uz to: `tailwind.config.ts` je stajao u korenu i **nije se učitavao uopšte**.
Projekat koristi Tailwind v4, gde konfiguracija ide kroz `@import 'tailwindcss'`
i `@theme` u CSS-u; stari `tailwind.config.ts` bi morao da se uveze
eksplicitnim `@config`, čega nije bilo. Fajl je obrisan (97 linija).

Umesto zavisnosti, u `app/globals.css` su napisani pravi `@keyframes` i pravila
vezana za `[data-state]`:

```
.animacija-preklopa      .animacija-dijaloga
.animacija-fioke-desno   .animacija-fioke-levo
.animacija-harmonike     (koristi var(--radix-accordion-content-height))
.sekcija-ulaz-sleva      .sekcija-ulaz-uvecanje
```

`lib/ui/animacije.test.ts` pada ako se bilo koja `tailwindcss-animate` klasa
vrati u kod, ako se paket doda u zavisnosti, ili ako se u komponenti upotrebi
klasa koje nema u `globals.css`.

### 6.2 Video bez menjanja CSP-a

Zatečeni CSP već dozvoljava `frame-src https://www.youtube.com`. Vimeo i
`youtube-nocookie.com` **ne** — za njih bi trebalo menjati politiku, što je
odluka vlasnika, ne usputna izmena. Zato `SekcijaVideo` podržava samo YouTube.

`VideoOkidac.tsx` je „klikni pa pusti“: dok se ne klikne, prikazuje se slika
(`https://i.ytimg.com/vi/...`, dodata u `next.config.ts` u dozvoljene domene),
a `<iframe src="https://www.youtube.com/embed/${youtubeId}">` nastaje tek posle
klika. Time nema učitavanja YouTube skripti na svakoj poseti.

ID videa se validira strogo:

```ts
export const OBRAZAC_YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
```

`lib/security/csp.test.ts` tvrdi da je `frame-src` tačno
`'self' https://recaptcha.google.com https://www.google.com https://www.youtube.com`,
da se vimeo i nocookie **ne** pojavljuju, i da je domen iz `VideoOkidac`-a
zaista u `frame-src`. Ako neko sutra doda plejer sa drugog domena, test će pasti
pre nego što CSP tiho blokira prikaz u produkciji.

### 6.3 Tačke na fotografiji (hotspot)

Novi tip polja `tackeNaSlici` sa `maxStavki` i `kljucSlike`. Admin komponenta
`PoljeTackeNaSlici.tsx` postavlja tačku klikom na sliku — koordinate su u
procentima, pa rade na svakoj širini.

Da bi ovo polje uopšte moglo da radi, `PoljeObrasca` je dobio
`susedneVrednosti?: Record<string, Vrednost>`, a `EkranSekcija` mu prosleđuje
`susedneVrednosti={vrednosti}`. Bez toga polje sa tačkama ne bi znalo koja je
slika izabrana u susednom polju.

### 6.4 Parallax koji ume da ne radi

`Parallax.tsx` pomera `transform` kroz `requestAnimationFrame`, uz pasivni
slušalac skrola, i **isključuje se ispod 1024px** i pod
`prefers-reduced-motion`. Na telefonu parallax je trošak bez koristi.

### 6.5 Obrisano

`components/home/InstagramFeed.tsx` (215 linija) i `ParallaxBanner.tsx` (55) —
obe su prikazivale izmišljen ili zakucan sadržaj.

**Instagram sekcija danas ne zove Instagram.** Prikazuje slike koje admin
otpremi u medijateku. Prava Graph API integracija je odluka vlasnika i traži
keširanje pre nego što se uključi — inače svaki poseti sajtu ide poziv ka
Meta-i, sa tokenom koji ističe.

---

## 7. Ispravke u zatečenom kodu — greške koje niko nije tražio

Ovo su problemi nađeni usput, dok se radilo na sekcijama. Svaki je popravljen
u fazi u kojoj je otkriven.

### 7.1 `sitemap.xml` je slao Google na adrese koje ne postoje

Zatečeni sitemap je za svaku kategoriju emitovao:

```
/catalog?category=<slug>
```

Katalog **nikada nije čitao parametar `category`**. Posledica je dvostruka:
svaka takva adresa je Google-u izgledala kao ista stranica sa drugim
parametrom (duplirani sadržaj), a **prave adrese kategorija** (`/category/...`)
u sitemap-u uopšte nisu bile. Prepisano u `app/sitemap.ts`.

Uz to je nastao `lib/seo/staticke-stranice.ts` sa testom koji poredi spisak
sa stvarnim rutama pod `app/`. Sitemap koji nabraja stranicu koje nema, ili
propušta stranicu koja postoji, sada obara test.

### 7.2 `/karijera` je radila i kad su karijere isključene

Stranica je bila dostupna iako je `storeCapabilities.careers` bio `false` —
link je bio sakriven, ali adresa je radila. Dodato:

```tsx
if (!storeCapabilities.careers) notFound();
```

Isti obrazac kao u §5.1: sakriven link nije zaštita.

### 7.3 Javni API proizvoda bez gornje granice

`app/api/products/route.ts` je primao `limit` bez ograničenja i `page` koji je
mogao da bude `NaN`. Dodata funkcija `ceoBroj()` koja seče oba u razuman opseg.
Isti PR je dodao propuštanje `novo`, `colors`, `types` i `brandIds` parametara,
koji su bili potrebni bloku proizvoda.

### 7.4 Promocije bez datuma isteka

`getProductPromotions` nije vraćao `endDate`, pa odbrojavanje do kraja akcije
nije imalo do čega da odbrojava. Nastao je `lib/promotions-prikaz.ts` sa
`uPromocijuZaPrikaz`, koji dodaje `endDate: red.endDate.toISOString()`.

### 7.5 Kostur koji ništa ne prikazuje

`Kostur` varijanta `mrezaKartica` u `RenderSekcije.tsx` je vraćala `null`.
Dok se asinhrona sekcija učitava, korisnik nije video ništa — stranica bi
poskočila kad podaci stignu. Napisan je pravi kostur, i dodat `tekstualni`.

### 7.6 Mrtve animacione klase i neučitani Tailwind config

Opisano u §6.1. Četiri komponente su koristile klase kojih nema.

---

## 8. Migracija produkcione baze — ceo tok

Ovo je jedini deo posla koji je dodirnuo produkciju.

**Polazno stanje:** runbook je tvrdio da je na produkciji četiri migracije.
Stvarno stanje je bilo **osam**. Runbook je bio pet dana zastareo.
Cilj: primeniti devetu, `20260902120000_expand_page_sections`, koja je uslov da
sekcije uopšte rade.

### 8.1 Redosled koraka

1. **Izviđanje samo za čitanje** — nijedan upis; utvrđeno tačno stanje
   `_prisma_migrations`, vlasništva i grantova.
2. **Provera postojećeg bekapa** — snimak i njegov `.sha256`.
3. **Veran klon** produkcione baze na istoj mašini.
4. **Proba migracije nad klonom**, ne nad produkcijom.
5. **Smoke nad invarijantama** — `scripts/db-invariant-smoke.sql` (skripta je
   postojala od ranije, iz commit-a `1076cae`; ovde je prvi put pokrenuta nad
   klonom posle nove migracije). Izlaz `0`.
6. **Drugi bekap**, neposredno pre dodirivanja produkcije.
7. **Primena migracije** na produkciju.
8. **`GRANT` + `ALTER TABLE ... OWNER TO nosnja`** nad novim tabelama.
9. **Provera** — brojanje primenjenih migracija i probni upit kao aplikaciona rola.
10. **Čišćenje** privremenih kopija.

### 8.2 Pet stvarnih prepreka i kako je svaka rešena

**`psql: invalid URI query parameter: "schema"`**
Prisma `DATABASE_URL` nosi `?schema=public`, koji `psql` ne razume. Rešeno
odsecanjem upitnog dela: `${DATABASE_URL%%\?*}`.

**`permission denied for table _prisma_migrations` kao rola `nosnja`**
Nad tom tabelom su privilegije oduzete **i vlasniku** — `relacl` je prazan niz,
a ne `NULL`. To je stanje koje se ne popravlja samo od sebe. Migracije se zato
pokreću kao `postgres` preko unix soketa:

```
postgresql://postgres@localhost/narodnanosnja_db?host=/var/run/postgresql
```

**`pg_dump: could not open output file … Permission denied`**
Direktorijum `/var/backups/narodnanosnja` nije pripadao korisniku `postgres`.
Rešeno `chown postgres:postgres`.

**Klon nije verno preslikavao vlasništvo (dva pokušaja)**
`pg_restore --no-owner` čini da objekti pripadnu roli koja vraća snimak — klon
tada ne liči na produkciju baš u onome što se testira. Tek treći pokušaj,
vraćanje **kao `nosnja`** kroz njen sopstveni URL, dao je veran klon.

**`EACCES … /root/nn-migracija/prisma.config`**
Prisma pokrenuta kao `postgres` ne može da čita iz `/root`. Radni direktorijum
prebačen u `/var/tmp/nn-migracija`, u vlasništvu `postgres`.

### 8.3 Zamka koju bi build i `prisma validate` propustili

Pošto se migracija pokreće kao `postgres`, **nove tabele nastaju u vlasništvu
`postgres`**, a aplikaciona rola nad njima nema ni `SELECT`. Ono što ovo čini
opasnim: `next build` prolazi, `prisma validate` prolazi, deploy prolazi —
a padne **prvi runtime upit**, pred korisnikom.

Zato posle svake migracije obavezno idu i `GRANT` i `ALTER TABLE ... OWNER TO
nosnja`, pa provera kao aplikaciona rola.

### 8.4 Ishod

Produkciona baza na dan 5. 9. 2026. ima **svih devet migracija**. Aplikaciona
rola ima pristup novim tabelama. Baza je mala — oko 10 MB, dva korisnika,
osamnaest proizvoda, **nula porudžbina** — pa je rizik ovog zahvata bio bitno
manji nego što runbook sugeriše.

**Bekap nije automatizovan.** Nema ni cron ni systemd timer; svi snimci u
`/var/backups/narodnanosnja/` su ručni. „Svež bekap“ znači da ga je neko upravo
napravio. To je otvoren operativni dug, ne nešto što je ovde rešeno.

---

## 9. Runbook — šta je bilo netačno (PR #39)

`docs/V2-ROLL-OUT.md` je ispravljen na tri mesta:

1. **Uvodni blok** sada kaže da je svih devet migracija primenjeno 5. 9. 2026,
   sa upitom kojim se to proverava.
2. **Korak 8 nije no-op.** Runbook je tvrdio da je taj korak prazan; nije —
   traži `ALTER TABLE ... OWNER TO nosnja`. Tekst je prepravljen izričito
   („Ovaj korak NIJE no-op…“).
3. **Dva nova odeljka:** „Migracije se pokreću kao `postgres`, ne kao
   aplikaciona rola“ i „Bekap nije automatizovan“.

Iste dve zamke su zapisane i u trajnu memoriju, da se ne izgube sa ovim poslom.

---

## 10. Tag i objava — gde je posao stao

### 10.1 Šta je spremno

Napravljen je anotirani tag:

```
prodavnica-v2-20260905-1  →  104e1afac6c4c1a4b639c22843536b8c2e67d155
```

Provereno pre nego što je predat:

| Provera | Nalaz |
| --- | --- |
| Ime odgovara CI obrascu `^prodavnica-v2-[0-9]{8}-[1-9][0-9]*$` | ✅ |
| Commit je tačno glava `verzija/v2.0-univerzalna-platforma` | ✅ `104e1af` |
| „Provera verzije“ na toj glavi | ✅ `success` |
| Sajt uživo | ✅ `https://narodnanosnja.rs`, HTTP 200, Let's Encrypt |
| `/api/health` | ✅ `"database":"connected"`, `deployment: 2efbb76…` |

Poslednji red znači da produkcija i dalje servira **stari** release — što je
tačno stanje pre objave.

### 10.2 Šta nije urađeno i zašto

**Tag nije gurnut.** `git ls-remote --tags origin` ne vraća nijedan tag. Push
ovog taga pokreće objavu na produkciju, a to je odluka vlasnika, ne usputni
korak. Komanda je:

```bash
cd ~/Desktop/narodnanosnja-prodavnica
git push origin prodavnica-v2-20260905-1
```

### 10.3 Šta se dešava posle push-a

Workflow ima tri sekcije: provera i izgradnja, objava, potvrda. Deploy job
zahteva `vars.PRODUCTION_URL` (treba da bude `https://narodnanosnja.rs`) i
tajne `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `SERVER_HOST`, `SERVER_USER`.
Njih **ne mogu da pročitam** — ako neka fali, deploy staje sa jasnom porukom
**pre nego što dodirne server**.

Deploy ide sa `APPLY_DATABASE_MIGRATIONS=false` — baza je već migrirana ručno
(§8), i to je namerno tako.

`scripts/deploy.sh` je blue/green: nov release ide u
`releases/<sha>-<attempt>`, proverava se na smoke portu `39007`, i tek onda se
prebacuje `current` simlink. **Nema prekida rada** — ranije sam ti rekao da će
biti kratkog prekida, i to je bilo netačno.

Pošto nijedan `prodavnica-v2-*` tag nikada nije gurnut, **ovaj deploy put nikad
nije prošao od kraja do kraja**. Prvi put je uvek prvi put.

---

## 11. Zamke koje vredi zapamtiti

Skupljeno na jedno mesto, jer će se svaka od njih ponovo pojaviti.

### Alati i okruženje

- **Tailwind je v4.** Konfiguracija je `@import 'tailwindcss'` + `@theme` u
  CSS-u. `tailwind.config.ts` se **ne učitava** bez izričitog `@config`.
- **Turbopack ne podnosi simlinkovan `node_modules`** — javlja
  `Symlink node_modules is invalid, it points out of the filesystem root`.
  Za jeftinu kopiju radnog stabla na APFS-u koristi `cp -Rc`.
- **`node --test` hvata samo `lib/**/*.test.ts`.** Čista logika koja treba da
  bude testirana mora da živi pod `lib/`.
- **Playwright `getByRole(role, { name })` poredi kao podniz** osim uz
  `exact: true`.

### Next.js i React

- **`cache()` memoizuje po identitetu argumenta.** Keširane funkcije primaju
  stabilan **string** ključ, ne objekat.
- **U fajlu sa `"use server"` svaki izvoz je javna Server Action.** Upitni
  moduli idu u `lib/db/`.
- **Rute koje čitaju sesiju su fabrike sa ubrizganim zavisnostima** — to čuva
  `lib/auth/server-session-callsite-inventory.test.ts`.

### Podaci

- **`new Date("2026-02-31T10:00")` nije Invalid Date** — prevrne se u 3. mart.
- **`Product.name` je `Json`** — sortiranje po nazivu kroz `ORDER BY` ne radi
  ono što izgleda da radi.
- **Relacija sa strane proizvoda je `categories`, ne `productCategories`.**
- **`Prisma.DbNull` nije `null`.**

### PostgreSQL

- **Prazan (ne-`NULL`) `relacl` znači da su privilegije oduzete i vlasniku.**
- **`pg_restore --no-owner` menja vlasništvo** — klon tada ne liči na original
  baš u onom što se testira.
- **Posle migracije kao `postgres` proveri vlasništvo novih tabela.** Build i
  `prisma validate` prolaze; padne prvi runtime upit.

### Bezbednost i pristupačnost

- **Sakriven link nije autorizacija.** Svaka admin ruta ima svoju serversku
  proveru.
- **Bogat HTML prolazi kroz `lib/security/html.ts` dvaput** — pri upisu u
  administraciji i ponovo pri javnom prikazu.
- **Animacija duža od 5 s traži pauzu (WCAG 2.2.2).** `stopOnInteraction` i
  hover to **ne** zadovoljavaju.
- **E2E seed odbija bazu čije ime ne sadrži `e2e`, `test` ili `provera`.** Ta
  zaštita se nikad ne zaobilazi.

---

## 12. Šta je provereno, a šta nije

### Provereno

- `node --test` nad `lib/**` prolazi na svakoj grani pre PR-a.
- `next build`, `tsc --noEmit` i eslint prolaze; CI na glavi grane je zelen.
- Playwright specovi za blok proizvoda, pokretnu traku, zone stranica i admin
  smoke prolaze u CI-ju.
- Migracija je **stvarno izvedena** nad vernim klonom pre produkcije, i
  invarijantni smoke je vratio `0`.
- Produkcioni `/api/health` je proveren preko mreže i vraća `connected`.

### Nije provereno

- **Deploy put kroz tag nikad nije izvršen.** Ne postoji dokaz da radi od kraja
  do kraja; postoji samo dokaz da su njegovi preduslovi na mestu.
- **Nijedna nova sekcija nije viđena na produkciji**, jer produkcija još servira
  stari kod. Sve što je viđeno, viđeno je lokalno i u CI-ju.
- **Ponašanje sekcija pod stvarnim saobraćajem** — keširanje, `revalidateTag`,
  broj upita po stranici — mereno je samo lokalno, sa osamnaest proizvoda.
- **Instagram tip nikad nije video Instagram API.** Prikazuje otpremljene slike.
- **Vraćanje bekapa u produkciju nije uvežbano** — vraćanje je vežbano samo u
  klon, što nije isto.

---

## 13. Šta nije urađeno i zašto

Sve stavke ispod su svesno ostavljene. Nijedna nije zaboravljena.

| Stavka | Zašto nije urađena |
| --- | --- |
| **Automatski bekap baze** | nema ni cron ni timer; traži odluku o rasporedu, retenciji i mestu čuvanja |
| **MP4 otpremanje za video** | traži odluku o ograničenju veličine i o tome gde se fajlovi čuvaju |
| **Vimeo / `youtube-nocookie.com`** | traži izmenu CSP `frame-src`, što je bezbednosna odluka vlasnika |
| **Pravi Instagram Graph API** | traži keširanje i token koji ističe; bez keša svaka poseta gađa Meta-u |
| **Proizvoljne stranice `stranica:<slug>`** | veći zahvat u rutiranju; nije bio deo plana |
| **Podešavanja po stranici** | tražilo bi **desetu** migraciju baze |
| **Blok filtera kao tip sekcije** | zavisi od dinamičkih filtera iz `AttributeDefinition`, koji još ne postoje |
| **Brisanje fajla pri brisanju medija** | u planu je označeno kao odluka vlasnika; do odluke se bira manja šteta — zaostao fajl umesto nepovratno obrisanog |

---

## 14. Ispravke mojih ranijih tvrdnji

Zapisano ovde da ne ostane samo u razgovoru:

1. **„Runbook opisuje stanje produkcije“** — nije. Bio je pet dana zastareo i
   govorio o četiri migracije umesto osam.
2. **„Korak 8 runbook-a je no-op“** — nije. Traži `ALTER TABLE ... OWNER TO`.
3. **„Deploy koda traži kratak prekid rada“** — ne traži. `scripts/deploy.sh`
   je blue/green sa proverom na smoke portu; `current` simlink se prebacuje tek
   kad nov release odgovori.
4. **„Prodavnica je dostupna samo preko IP-a i porta“** — nije. Radi na
   `https://narodnanosnja.rs` sa Let's Encrypt sertifikatom.

---

## 15. Otvoreno, van ovog posla

Jedna stvar nađena usput koju nisam dirao, jer nije moja: u radnom stablu
`~/Desktop/narodnanosnja-prodavnica` stoji **nekomitovana izmena `IZMENE.md`**
od 1329 linija (odeljci XXIII–XXVII, presek 31. avgust). Taj sadržaj ne postoji
ni na jednoj grani. Radno stablo je pri tom na staroj grani
`ispravka/v2-db-authoritative-sessions` na `2efbb76`.

Ako je taj tekst potreban, treba ga commit-ovati na svoju granu pre nego što se
to stablo prebaci na drugu granu. Ako nije, treba ga svesno odbaciti. Ostavljen
je netaknut.

---

*Dokument opisuje stanje na dan 5. septembra 2026. Sledeći korak je push taga
`prodavnica-v2-20260905-1`.*
