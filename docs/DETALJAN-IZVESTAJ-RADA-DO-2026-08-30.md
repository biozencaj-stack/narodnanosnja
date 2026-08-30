# Detaljan izveštaj dosadašnjeg rada

> Datum preseka: 30. avgust 2026.<br>
> Glavni projekat: `narodnanosnja-prodavnica`<br>
> V2 grana: `verzija/v2.0-univerzalna-platforma`<br>
> Poslednji V2 merge pre ovog izveštaja: `79216213a3ad45d8d3be372aeb5f62dd5371cbe7`<br>
> Testirano Git stablo: `762f004ce8774ef24f61b9231394b4afb8b84331`<br>
> Produkcijski status: V2 aplikacija nije deployovana; kartice su isključene; `main` nije menjan ovim V2 radom<br>
> Svrha: samostalan, konsolidovan i detaljan opis svega što je urađeno do ovog preseka

## Sadržaj

1. [Kako čitati ovaj izveštaj](#1-kako-čitati-ovaj-izveštaj)
2. [Konačan rezime](#2-konačan-rezime)
3. [Granice repozitorijuma i pravila bezbednog rada](#3-granice-repozitorijuma-i-pravila-bezbednog-rada)
4. [Hronologija razvoja](#4-hronologija-razvoja)
5. [Prezentacioni sajt](#5-prezentacioni-sajt)
6. [Prelazak na punu e-commerce platformu](#6-prelazak-na-punu-e-commerce-platformu)
7. [Početna prodavnica, podaci i redizajn](#7-početna-prodavnica-podaci-i-redizajn)
8. [V2 arhitektura i white-label konfiguracija](#8-v2-arhitektura-i-white-label-konfiguracija)
9. [Storefront, katalog i pristupačnost](#9-storefront-katalog-i-pristupačnost)
10. [Cena, korpa i checkout](#10-cena-korpa-i-checkout)
11. [Porudžbine, zaliha, kuponi i pristup](#11-porudžbine-zaliha-kuponi-i-pristup)
12. [Kartično plaćanje i NestPay](#12-kartično-plaćanje-i-nestpay)
13. [Generički katalog i admin](#13-generički-katalog-i-admin)
14. [Bezbednosni slojevi](#14-bezbednosni-slojevi)
15. [Baza, baseline i migracije](#15-baza-baseline-i-migracije)
16. [CI/CD i release deployment](#16-cicd-i-release-deployment)
17. [UX, admin i operativni sprint](#17-ux-admin-i-operativni-sprint)
18. [Četiri P1 hotfixa](#18-četiri-p1-hotfixa)
19. [Integracija grana, PR-ovi i dokumentacija](#19-integracija-grana-pr-ovi-i-dokumentacija)
20. [Testovi i dokazi](#20-testovi-i-dokazi)
21. [Inventar ključnih fajlova](#21-inventar-ključnih-fajlova)
22. [Važne odluke i razlozi](#22-važne-odluke-i-razlozi)
23. [Problemi i zamke otkrivene tokom rada](#23-problemi-i-zamke-otkrivene-tokom-rada)
24. [Šta namerno nije urađeno](#24-šta-namerno-nije-urađeno)
25. [Aktuelno stanje](#25-aktuelno-stanje)
26. [Preostali P0/P1/P2 posao](#26-preostali-p0p1p2-posao)
27. [Preporučeni redosled nastavka](#27-preporučeni-redosled-nastavka)
28. [Produkcioni kontrolni spisak](#28-produkcioni-kontrolni-spisak)
29. [Referentna dokumentacija](#29-referentna-dokumentacija)
30. [P0 release granica za V2](#30-p0-release-granica-za-v2)

---

## 1. Kako čitati ovaj izveštaj

Ovaj dokument spaja nekoliko vremenskih slojeva projekta: početni
prezentacioni sajt, prvu prodavnicu, V2 univerzalnu platformu, production-
readiness rad, bezbednosni sprint i naknadne P1 hotfixe. Zbog toga se statusi
uvek tumače ovako:

- **implementirano** — kod postoji u projektu;
- **lokalno provereno** — kod je prošao navedene testove, lint, typecheck ili
  build na radnoj stanici;
- **CI provereno** — isti Git commit ili identično Git stablo prošlo je GitHub
  Actions nad izolovanim PostgreSQL-om i Chromiumom;
- **primenjeno na produkcionu bazu** — izvršena je pregledana, backupovana i
  proverena DB migracija; to ne znači da je nova aplikacija deployovana;
- **uklopljeno u V2** — promena je na V2 grani, ali nije automatski na javnom
  sajtu;
- **nije deployovano** — produkcijski aplikacioni proces, domen, tajne i server
  nisu menjani tom izmenom;
- **blokator** — poznata stavka koja mora biti rešena pre produkcije ili pre
  uključivanja određene capability funkcije.

Istorijski brojevi testova, poput 33, 40, 43 ili 82, ostaju korisni kao dokaz
pojedinačnih preseka. Aktuelni objedinjeni lokalni presek je 103 testa: 102
prolaze, a jedan opt-in PostgreSQL test se lokalno namerno preskače. U CI-ju se
taj test obavezno uključuje.

Ovaj izveštaj opisuje stanje koda pre dodavanja samog izveštaja. Poslednji
remote V2 merge je `7921621`; njegov sadržaj je kriptografski isti kao CI-
testirani head `4816b93`.

Operativna dopuna u odeljku 30 opisuje naknadno implementiranu P0 release
granicu. Raniji commitovi, PR-ovi i CI runovi ostaju istorijski dokazi svog
vremenskog preseka; aktuelna pravila okidanja i deploya tumače se prema
odeljcima 16, 26, 28 i 30.

---

## 2. Konačan rezime

Projekat je prerastao iz statičke prezentacije o narodnoj nošnji u ozbiljnu
osnovu za single-store, white-label e-commerce platformu. Najvažniji rezultati
su:

| Oblast | Urađeno stanje |
| --- | --- |
| Prezentacioni sajt | Sopstveni Node.js statički generator, 8 regiona, pojmovnik, tehnike, muzeji, ćirilica/latinica, GitHub Pages i automatske provere |
| Prodavnica | Next.js 16, React 19, Prisma, PostgreSQL 16 i NextAuth osnova sa 18 proizvoda u 6 kategorija |
| Dizajn | Radionica identitet, PT Serif/PT Sans, tkani SVG ornamenti, etno paleta, responsivan storefront |
| V2 arhitektura | White-label single-store slojevi za config, katalog, quote, order, payment, admin i deployment |
| Checkout | Server-authoritative cene, promocije, dostava i minimum; idempotentno i transakciono kreiranje porudžbine |
| Zaliha | Stabilni `ProductSize` identiteti, soft-retire, CAS zaštita i exactly-once povrat zalihe/kupona |
| Payment | Ojačan NestPay start/callback, payment state machine, audit događaji, `PROCESSING` i `REVIEW` |
| Bezbednost | Deny-by-default admin, HTML sanitizacija, Origin zaštita, security headeri, reCAPTCHA, bezbedan login callback, centralni SMTP i potpisana newsletter odjava |
| Baza | Produkcioni baseline i tri expand koraka, 42 tabele, 4 završene migracije, 0 drift i očuvani poslovni redovi |
| CI | PostgreSQL 16, migracije, drift, DB invarijante, lint, TypeScript, 103 testa, Chromium COD E2E i build |
| Deployment | Izolovani release direktorijumi, health SHA provera, atomska aktivacija i rollback; produkcijski deploy još nije aktiviran |
| Dokumentacija | Arhitektura, katalog migracija, rollout, GitHub deploy, Prisma baseline i konsolidovani dnevnici |

Najvažnija trenutna granica: **V2 kod je razvijen i proveravan odvojeno, ali
nije deployovan.** Kartice ostaju isključene. `main` služi prezentacionom
GitHub Pages sajtu i V2 se trenutno ne sme spajati u njega.

---

## 3. Granice repozitorijuma i pravila bezbednog rada

### 3.1. Dva projekta u jednom repozitorijumu

Repo trenutno sadrži dve različite celine:

| Celina | Aktivna grana | Namena |
| --- | --- | --- |
| Prezentacioni sajt | `main` | GitHub Pages sadržaj o srpskoj narodnoj nošnji |
| Prodavnica/V2 | `verzija/v2.0-univerzalna-platforma` | Next.js/Prisma e-commerce aplikacija |

Aktuelno operativno pravilo je strogo: **ne spajati V2 u `main`**. Push na
`main` objavljuje prezentacioni sajt, dok V2 ima drugačiju aplikacionu strukturu
i produkcioni tok. Postojeći Draft PR #1 ka `main` je konfliktan i ne sme se
spajati u trenutnom obliku. Trajno najčistije rešenje je razdvajanje u dva
repozitorijuma ili eksplicitno odobrena migracija sa potpuno novim rollout
planom.

Stariji detaljni dnevnici pominju budući V2 merge u `main`. Ti pasusi su
istorijski i prevaziđeni novijim pravilom iz `IZMENE.md`; ne treba ih koristiti
kao operativno uputstvo.

### 3.2. Pravila rada koja su poštovana

- Nije rađeno direktno na `main`.
- Svaka bezbednosna izmena je imala zasebnu granu i PR ka V2.
- Testirani hotfix commitovi su čuvani merge commitovima, bez force push-a.
- `.env`, privatni ključevi, kredencijali, DB dumpovi i stvarne tajne nisu
  dodavani u Git.
- Produkciona baza nije korišćena kao zamena za lokalni ili CI test.
- Serverske, GitHub environment i produkcijske promene nisu pretpostavljane iz
  opšteg odobrenja za rad na kodu.
- Kartični capability nije uključen samo zato što payment kod postoji.
- Produkcijski deployment job je na svim V2/hotfix proverama ostao preskočen.

### 3.3. Sanitizovana Git istorija

Stara lokalna istorija prodavnice bila je nepovezana sa remote `main` istorijom
i sadržala je raniju hardkodovanu demo DB vrednost. Zbog toga nije pushovana
kao celina. Napravljen je sanitizovan V2 snapshot sa kontrolisanim roditeljem,
bez privatnih ključeva, `.env` fajlova, build artefakata, uploadova i dumpova.

Ojačani su `.gitignore` i `.gitattributes`, a legacy provisioning šabloni su
očišćeni od konkretnih DB/SSH vrednosti. Lokalna arhiva je sačuvana odvojeno,
ali nije postala predak javne V2 istorije.

---

## 4. Hronologija razvoja

### 4.1. Prezentacioni sajt i početna dokumentacija

| Commit/period | Promena |
| --- | --- |
| `a409c57` | Prva verzija sajta o srpskoj narodnoj nošnji |
| `855e20e` / `7c49236` | MIT licenca za kod i CC BY-SA 4.0 za sadržaj |
| `b6ba3a8` | Ponovno pokretanje Pages objave nakon ručnog uključivanja |
| `d67d2f9` / `0630c53` | Mrežna provera objavljenog sajta i merge u `main` |
| `3747793` / `31ebf14` | Prvi objedinjeni dnevnik izmena |
| `7aa68ba` / `200d804` | Pregled projekta i beleška da dva projekta dele repo |

### 4.2. Prodavnica i V2

| Commit/grana | Promena |
| --- | --- |
| `b350099` | Preuzeta i prilagođena e-commerce osnova, etno paleta, fontovi, `.gitignore`, `.env.example` |
| `d21e52a` | Idempotentni uvoz 6 kategorija i 18 proizvoda |
| `283af3f`, `73fe43f` | Redizajn „radionica”, PT tipografija, tkani ornamenti i nova početna |
| `c7893fc` | Spajanje ranog redizajna u tadašnji lokalni prodavnički `main` |
| `3dc757a` | Sanitizovan V2 snapshot univerzalne e-commerce platforme |
| `f38bb4e` | Dokumentovanje objave V2 grane na GitHub-u |
| `1076cae` | Bezbedan production rollout, baseline/migracije i CI/CD priprema |
| `c448334` | UX, bezbednosne i admin operativne popravke |
| `e61fcc2`, `438dc55` | Usklađivanje i preciziranje Chromium E2E checkout selektora |
| `5312ab2` | Objedinjavanje V2 dnevnika pre P1 hotfix faze |

### 4.3. P1 hotfix i završna dokumentaciona faza

| PR | Testirani head | V2 merge | Sadržaj |
| ---: | --- | --- | --- |
| #4 | `d0f2174` | `b60f798` | Potpisana newsletter odjava i GET→confirmation→POST tok |
| #5 | `652a863` | `9bea953` | Bezbedna validacija login `callbackUrl` vrednosti |
| #3 | `ac39288` | `b09a7ad` | Centralni fail-closed SMTP TLS sloj, usklađen sa newsletter/callback izmenama |
| #2 | `4a32b1c` | `6429de3` | Reservation cleanup, usklađen sa svim prethodnim hotfixima |
| #6 | `4816b93` | `7921621` | Ispravljena i kompletirana dokumentacija svih hotfixa |

Redosled spajanja bio je nameran: newsletter, callback, SMTP, reservation
cleanup, pa dokumentacija. Kada su se grane razišle, V2 baza je merge-ovana u
hotfix granu bez rebase/force-push-a; konflikti su ručno rešeni samo tamo gde
su zaista postojali.

---

## 5. Prezentacioni sajt

### 5.1. Statički generator bez zavisnosti

Napisan je sopstveni generator u čistom Node.js-u, bez `package.json`,
`node_modules` ili runtime biblioteka. Time je prezentacioni deo ostao mali,
predvidljiv i jednostavan za GitHub Pages.

Sadržaj uključuje:

- osam regionalnih tipova nošnje: Šumadija, Vojvodina, zapadna Srbija,
  istočna Srbija, južna Srbija, Kosovo i Metohija, Stari Vlah i Raška, Mačva i
  Podrinje;
- žensku i mušku nošnju, materijale, tehnike i zanimljivosti za svaki region;
- pojmovnik sa 26 pojmova i filtriranjem po osam grupa;
- stranice o tehnikama izrade, muzejima, etno-parkovima i manifestacijama;
- prebacivanje latinica ↔ ćirilica sa tačnom obradom `nj`, `lj`, `dž` i
  izuzecima gde digraf nije jedan glas;
- tamnu temu, mobilni prikaz i rad bez praćenja/kolačića;
- programski generisane SVG ornamente umesto tuđih fotografija.

### 5.2. Linkovi i objavljivanje

Sve interne veze su relativne kako bi build radio i u korenu i u podfascikli.
`404.html` je namerni izuzetak jer se može služiti sa proizvoljne dubine.

- `scripts/proveri-veze.mjs` proverava 363 interne veze;
- `scripts/proveri-uzivo.mjs` proverava HTTP statuse, naslove, resurse i pravi
  404 odgovor na javno objavljenom sajtu;
- `.github/workflows/objavi.yml` objavljuje na GitHub Pages sa `main`;
- `.github/workflows/provera.yml` proverava grane i PR-ove bez objavljivanja.

### 5.3. Licence i autorska prava

Kod prezentacionog sajta je pod MIT licencom, a sadržaj pod CC BY-SA 4.0.
Sadržaj proizvoda i opisi su sopstveni. Linkovi konkurencije korišćeni su samo
kao orijentir za tipove artikala, a nijedan njihov opis ili fotografija nije
kopiran.

---

## 6. Prelazak na punu e-commerce platformu

Prvobitno je započeta statička prodavnica sa katalogom, `localStorage` korpom,
6 kategorija i 18 proizvoda. Taj smer je napušten kada je pronađen potpuniji
`ecommerce-cms-template` sa Next.js 16, React 19, Prisma, PostgreSQL, NextAuth,
CMS-om, checkoutom, korisničkim nalozima, COD/card tokovima i pravnim
stranicama.

Odluka je bila da se ne piše ponovo ono što već postoji, već da se postojeća
platforma preuzme, očisti, testira i postepeno generalizuje.

Pregledan je i Planika CMS build sa NestPay integracijom, ali je odbačen jer je
na hostingu postojao samo `.next/standalone` izlaz bez izvornog koda. Iz njega
je bio koristan samo uvid u Prisma/NestPay model, ne i osnova za dalji razvoj.

DreamWeb hosting nije izabran za kritične POST tokove jer je Imunify360 Anti-
Bot presretao zahteve i vraćao interstitial umesto pouzdane poslovne akcije.

---

## 7. Početna prodavnica, podaci i redizajn

### 7.1. Preuzimanje i početna konfiguracija

Sa servera je preuzeto približno 2,8 MB izvornog koda, 519 fajlova, bez
`node_modules`, `.next` i pravog `.env` fajla. Dodati su bezbedan `.gitignore`
i `.env.example`, a stvarne tajne nisu kopirane u projekat.

Početna paleta je prebačena na etno boje:

- duboka crvena `#a4161a`;
- srma-zlatna `#b98f21`;
- lan `#faf6ed`;
- tamno drvo `#2c231b`.

Fontovi su prvo prebačeni na Playfair Display + Inter, uz obavezne
`latin-ext` i `cyrillic` podskupove, a kasnije na PT Serif + PT Sans.

### 7.2. Server i početna baza

Početna prodavnica je postavljena uz postojeće aplikacije, sa odvojenim PM2
procesom, portom 3007 i nginx ulazom na portu 8090. Početni `prisma db push`
napravio je 31 tabelu. Kasniji V2 migration lanac proširio je bazu na 42
tabele.

Prvi izbor porta je otkrio `EADDRINUSE`; od tada je pravilo da se pre svakog
novog procesa proveri `ss -ltn` i da se ne pretpostavlja da port nije zauzet.

### 7.3. Uvoz proizvoda

`scripts/uvoz-nosnja.ts` radi idempotentni upsert preko slug-a i ništa ne
briše. Uvezeno je 18 proizvoda u 6 kategorija:

- šalovi i ešarpe — 4;
- tkanice i pojasevi — 4;
- torbe i torbice — 3;
- ćilimi i prostirke — 2;
- nošnja i delovi — 3;
- suveniri i sitnice — 2.

Importer mapira:

- punu cenu u `price`, a sniženu u `salePrice` uz `onSale=true`;
- rasprodato stanje u univerzalnu opciju sa zalihom 0;
- „po porudžbini” u privremeni stock model sa zalihom 99;
- dimenzije iz opisa u strukturirana polja;
- srpski sadržaj u oba locale polja dok pravi engleski prevod ne postoji.

Važno pravilo: posle prvog uvoza proizvodi se uređuju kroz admin, jer ponovni
JSON import može pregaziti kasnije admin izmene.

### 7.4. Redizajn „radionica”

Vizuelni smer je promenjen iz generičke prodavnice u toplu zanatsku radionicu:

- PT Serif + PT Sans, sa punom srpskom latinicom i ćirilicom;
- lan/hartija podloge i drvo/crvena/zlatna akcentna paleta;
- `components/ukras/index.tsx` sa rombom, rozetom, cik-zagom, krstom,
  grančicom i kukom kao SVG motivima;
- komponentni logo „Народна ношња / ручно ткано”;
- stabilan ornamentni placeholder za artikle bez fotografije;
- hero „Svaki komad je jedinstven”;
- traka vrednosti, kategorije iz baze, proces izrade i priča o krajevima;
- uklanjanje countdown, Instagram, brend, statistika, testimonial i parallax
  sekcija koje nisu odgovarale stvarnom poslovnom sadržaju;
- hover zamena prve i druge fotografije na kartici;
- etno boje za oznake „Novo” i popust.

Otkriveno je da je aktivno zaglavlje `components/layout/NavBar.tsx`, dok je
`Header.tsx` legacy/mrtav kod. To je dokumentovano da se buduće izmene ne bi
radile u pogrešnoj komponenti.

---

## 8. V2 arhitektura i white-label konfiguracija

### 8.1. Arhitektonska granica

V2 je **white-label single-store platforma po instalaciji**, ne multi-tenant
SaaS. Jedan trgovac koristi jednu bazu i runtime. Nisu uvedeni tenant ID,
tenant izolacija, zajednički billing ili centralna pretplatnička administracija.

Odgovornosti su razdvojene na:

1. store identity/config;
2. generički katalog;
3. server-authoritative pricing/quote;
4. order i inventory;
5. payment;
6. storefront;
7. admin;
8. deployment i operativne provere.

### 8.2. Centralni settings sloj

Dodati su `store-settings-schema`, `store-settings`, `store-identity`,
`storefront-url`, `capabilities`, `StoreIdentityProvider` i admin settings
panel. Allow-list od 24 runtime vrednosti obuhvata identitet, kontakt,
društvene mreže, radno vreme, dostavu, minimum porudžbine, semantičke boje i
SEO.

Redosled izvora je:

1. bezbedne ugrađene vrednosti;
2. dozvoljeni environment fallback;
3. allow-listed `Setting` redovi iz baze.

Nepoznati ključevi se ignorišu, tajne se nikada ne izlažu klijentu, a DB kvar
vraća bezbedan fallback. SMTP, reCAPTCHA, NestPay, session, SSH i slične tajne
nisu deo admin-editable settings sistema.

### 8.3. Admin settings

`/admin/settings` ima tabove Opšte, Izgled, Prodaja i dostava i SEO. Uvedeni
su live preview, dirty-state, upozorenje pri napuštanju, reset, status čuvanja,
vezivanje greške za polje i fokus prve greške.

API je ADMIN-only, prima samo allow-listed ključeve, proverava email, HTTP(S)
URL, HEX boje, dužine i brojčane granice, zahteva kontrast najmanje 4.5:1,
upisuje u jednoj transakciji i invalidira cache nakon uspeha.

### 8.4. Capability flagovi

Centralni registry upravlja sledećim modulima:

- pouzeće;
- kartice;
- prodajna mesta;
- karijera;
- recenzije;
- wishlist;
- newsletter;
- chat;
- engleski jezik.

Kartice, lokacije, karijera i engleski su podrazumevano isključeni. Flagovi
utiču na navigaciju, footer, nalog, wishlist/reviews, newsletter/chat, checkout
metode, legal linkove i sitemap. Direktne rute za kartice, lokacije i favorite
vraćaju 404 kada modul nije uključen.

### 8.5. Identitet, tema i SEO

Root layout učitava locale, prevode i javna podešavanja, postavlja semantičke
CSS promenljive i `StoreIdentityProvider`. Metadata, OpenGraph, Twitter,
Organization/WebSite JSON-LD, robots, sitemap i OG generator koriste isti
kanonski storefront URL i identity izvor.

Kanonski URL mora biti apsolutan HTTP(S), a u produkciji obavezno HTTPS i ne
sme biti localhost. Auth layout je `noindex, nofollow`.

Admin tema je odvojena od storefront teme, pa loša javna paleta ne može učiniti
admin nečitljivim. Deo legacy `stone/gray` nijansi i hardkodovanih HEX vrednosti
još nije prebačen na semantičke tokene.

---

## 9. Storefront, katalog i pristupačnost

### 9.1. Zajednički layout i navigacija

Shop i legal stranice koriste isti navbar, footer, cart drawer i search modal.
`NavBarWrapper` izračunava tačan razmak ispod fiksnog zaglavlja: 6,5rem sa
tickerom i 4rem bez njega.

Mega-menu i mobilna navigacija dobijaju:

- stabilne ID veze između triggera i panela;
- `aria-expanded`, `aria-controls` i `role=region`;
- Escape zatvaranje sa vraćanjem fokusa;
- brend slug umesto vidljivog naziva u URL-u;
- uklanjanje capability-disabled funkcija iz navigacije.

Ticker screen readeru izlaže samo jednu skrivenu listu, dok su animirani
duplikati `aria-hidden`. Dodati su pause/resume, `aria-pressed`, hover pauza i
dostupno zatvaranje.

### 9.2. Globalna pristupačnost

Uvedeni su:

- „Preskoči na glavni sadržaj” link;
- stabilan `#glavni-sadrzaj` fokusni cilj;
- ujednačen `focus-visible`;
- reduced-motion režim;
- `aria-current` u admin navigaciji;
- dostupne mobile admin kontrole;
- jasni loading, status i alert regioni u pretrazi, korpi, kuponima i
  checkoutu;
- najmanje 44×44px touch mete za ključne kontrole.

### 9.3. Pretraga

Search modal je usklađen sa stvarnim lokalizovanim product ugovorom. Umesto
legacy `picture`, `price1` i ID URL-a koristi `image1`, `salePrice`, `price`,
lokalizovan naziv i kanonski slug.

Dodato je:

- prekidanje zastarelog zahteva kroz `AbortController`;
- tačno čitanje `total` i paginacije;
- računanje jednog jasnog procenta popusta;
- odvojena loading, error, empty i retry stanja;
- `aria-live` status;
- normalizacija nevalidnog `page` parametra;
- uklanjanje izmišljenih „popularnih termina” dok ne postoji data-driven
  izvor.

Brand i search paginacija čuvaju ispravnu rutu i query parametre. UI više ne
obećava „popularno” kada backend zapravo sortira po novini.

### 9.4. Katalog i mobilni filteri

Mobilni filter:

- ostaje na trenutnoj katalog/kategorija putanji;
- čuva search, sort i per-page parametre;
- menja samo filtere kojima upravlja;
- vraća `page` na 1 nakon izmene;
- broji brend, veličinu, boju, tip, cenu, pol, akciju i „novo”;
- prikazuje horizontalne filter chips;
- omogućava uklanjanje jednog ili svih filtera;
- razume oba postojeća `/api/brands` response oblika.

Na telefonu se prikazuju dve kartice u redu i jednostavnija filter/sort traka.
Prazan rezultat nudi direktan reset. Uklonjeni su fake fallback brendovi i
kategorije koji su mogli da sakriju DB/config grešku.

Filteri su i dalje legacy-orijentisani na veličinu, boju, tip i pol. Dinamički
filteri iz novog atributskog modela još nisu završeni.

### 9.5. Kartica i detalj proizvoda

`LocalProductCard` više nema interaktivno dugme unutar linka. Slika i naslov
su linkovi, wishlist je odvojena kontrola sa `aria-pressed`, a hover slika
koristi `image2`. Stock snapshot se prenosi u cart stavku.

Detalj proizvoda:

- automatski bira jedinu dostupnu opciju;
- blokira rasprodatu ili nepostojeću opciju;
- proverava količinu iste opcije već u korpi;
- ne dozvoljava dodavanje preko poznate zalihe;
- prikazuje CTA stanje umesto browser `alert()` dijaloga;
- ne pokreće review upit kada su recenzije isključene;
- koristi dinamičan seller identitet u metadata i JSON-LD.

---

## 10. Cena, korpa i checkout

### 10.1. Server je jedini autoritet za cenu

Browser više ne šalje cenu, popust, dostavu ili total kao pouzdane poslovne
vrednosti. Šalje samo:

- `productId`;
- izabranu opciju/legacy `size`;
- količinu;
- opciono kupon kod.

`lib/checkout/quote.ts` zatim:

1. normalizuje ulaz;
2. spaja duple stavke istog proizvoda i opcije;
3. ograničava korpu na 100 redova;
4. ograničava količinu po redu na 1–99;
5. učitava samo aktivne proizvode;
6. bira regularnu ili trenutno važeću sale cenu iz baze;
7. proverava aktivni `ProductSize` red i zalihu;
8. proverava kupon u konkretnom kontekstu;
9. obračunava automatske promocije;
10. učitava dostavu, free-shipping prag i minimum porudžbine iz settings-a;
11. vraća autoritativne line cene, međuzbir, popust, dostavu i total.

Eksplicitni error kodovi uključuju `EMPTY_CART`, `CART_TOO_LARGE`,
`INVALID_ITEM`, `INVALID_QUANTITY`, `PRODUCT_UNAVAILABLE`,
`OPTION_UNAVAILABLE`, `INVENTORY_NOT_CONFIGURED`, `INSUFFICIENT_STOCK`,
`MINIMUM_ORDER_NOT_MET`, `INVALID_COUPON` i `COUPON_CONDITIONS_NOT_MET`.

`POST /api/promotions` vraća kompletan quote, ima rate limit i `private,
no-store` odgovor.

### 10.2. Jedinstveni pricing context

`CheckoutPricingProvider` i `useCartWithPromotions` dele isto autoritativno
stanje između cart stranice, drawera, checkout forme, order summary-ja i kupon
komponente.

- quote poziv se debouncuje 300ms;
- stari zahtev se prekida;
- kupon greška se razlikuje od greške cele korpe;
- nevažeći kupon se uklanja;
- checkout je blokiran dok je quote nepoznat ili nevalidan;
- UI prikazuje „Provera cene…” umesto lokalne procene kao potvrđenu cenu.

### 10.3. Cart perzistencija i bezbedno čišćenje

Cart store sada čuva stock snapshot, kupon, hydration status i radi kroz
bezbedan `sessionStorage` wrapper sa memory fallbackom. Ne dozvoljava
`stock<=0`, ograničava količinu na poznatu zalihu i uklanja kupon kada je korpa
prazna.

Success stranica više ne može obrisati novu korpu samo zato što je korisnik
otvorio staru success adresu. Čuva se marker `orderId` + deterministički
fingerprint snapshot-a. Korpa se briše tek kada je store hidriran, marker
pripada toj porudžbini i trenutni fingerprint odgovara poručenim stavkama.

### 10.4. Checkout forma

Checkout podržava gosta i prijavljenog korisnika i capability-gate-uje payment
metode. Uvedeni su:

- zaseban poštanski broj i država za alternativnu adresu;
- klijentska i serverska validacija obe adrese;
- honeypot i reCAPTCHA;
- idempotency header;
- pending-card recovery;
- čekanje hydration-a pre odluke da je korpa prazna;
- responsivan order summary: sklopiv na telefonu, sticky na desktopu;
- skeleton sa `role=status`, `aria-live` i `aria-busy`;
- strukturisani error summary;
- fokus prve neispravne kontrole;
- `aria-invalid` i `aria-describedby` veze;
- sticky mobilni CTA sa autoritativnim totalom.

Obe istorijske create-order rute koriste isti handler:

- `POST /api/order`;
- `POST /api/orders`.

Aktivna logika je u `lib/checkout/order-handler.ts`. Handler proverava IP rate
limit, idempotency format, honeypot, dužine/formate, adrese, payment capability,
reCAPTCHA, server quote i vlasništvo pri replay-u.

### 10.5. Idempotentnost

Browser generiše kriptografski idempotency ključ. Baza ga čuva uz porudžbinu
i dozvoljava replay samo istom prijavljenom korisniku ili istom guest emailu,
unutar centralnog dvočasovnog prozora.

Concurrent unique race (`P2002`) se hvata i vraća već kreiranu porudžbinu,
bez ponovnog skidanja zalihe ili kupona. Istekli replay vraća
`IDEMPOTENCY_REPLAY_EXPIRED`.

---

## 11. Porudžbine, zaliha, kuponi i pristup

### 11.1. Atomsko kreiranje porudžbine

Order kreiranje radi u Serializable Prisma transakciji:

- ponovo proverava aktivnost i cenu;
- zaključava proizvode determinističkim redosledom;
- uslovno smanjuje tačan aktivni stock red;
- pravi Order/OrderItem snapshot;
- čuva `inventoryStockId` za kasniji tačan povrat;
- rezerviše kupon i beleži njegov usage marker;
- čisti relevantan wishlist marker;
- prekida celu transakciju ako bilo koja poslovna invarijanta padne.

Aktivan proizvod bez aktivnog stock reda radi fail-closed i ne ponaša se kao
proizvod sa beskonačnom zalihom.

### 11.2. Stabilni `ProductSize` identiteti

Admin delete/recreate tok je zamenjen reconciliation modelom:

- postojeći `ProductSize.id` ostaje stabilan;
- uklonjeni red dobija `active=false`;
- ponovno dodavanje reaktivira isti ID;
- parent Product se zaključava;
- `expectedStock` štiti od prepisivanja paralelne rezervacije ili povrata;
- stale admin stanje vraća `409 PRODUCT_SIZE_STALE_STOCK`;
- postojeći red bez očekivane verzije vraća
  `409 PRODUCT_SIZE_VERSION_REQUIRED`;
- case-insensitive duplikati, tuđi ID-evi, negativna zaliha i loš naziv se
  odbijaju;
- reaktivacija sabira novounetu količinu sa povratom nastalim dok je red bio
  povučen;
- DB garantuje unique `(productId,size)`, `stock>=0`, trimovan naziv i indeks
  `(productId,active)`.

### 11.3. Exactly-once oslobađanje

Otkazivanje i potvrđeni payment decline vraćaju zalihu i kupon tačno jednom.
`inventoryAllocated` compare-and-set sprečava dupli release. Povrat ide na
snapshot `inventoryStockId`, čak i kada je opcija kasnije povučena.

Promotion ID-evi se sortiraju pre uslovnog smanjenja `usedCount`, čime se
smanjuje deadlock rizik. Ako snapshot nije dosledan, transakcija pada umesto da
napravi delimičan povrat.

### 11.4. Guest order pristup

Broj ili ID porudžbine više ne glumi autorizaciju. Guest pristup koristi
order-scoped HMAC token sa 24h rokom, constant-time proverom i jakim
`ORDER_ACCESS_SECRET`-om. Token se čuva u per-order HttpOnly, SameSite cookie-
ju; u produkciji je i Secure.

Recovery prikaz je dodatno ograničen na odgovarajući CARD order,
`PENDING/PROCESSING` stanje i centralni dvočasovni prozor. Javni odgovor je
redigovan i ne izlaže provider payload ili nepotrebne lične podatke.

---

## 12. Kartično plaćanje i NestPay

### 12.1. Bezbedno podrazumevano stanje

Card capability je podrazumevano `false`. Prisustvo NestPay koda nije razlog
da se kartice uključe pre ugovora, sertifikacije, staging provere, operativnog
cleanup-a i završenih REVIEW/reconciliation/refund tokova.

### 12.2. Payment start

Payment start više ne veruje browser iznosu, valuti, order statusu ili emailu.
Sve učitava sa servera i baze. Aktivni pokušaj prelazi iz `PENDING` u
`PROCESSING`, a isti attempt može replayovati isti snapshotovani provider
payload bez pravljenja novog zaduženja.

Top-level HPP POST koristi kratkotrajni, dvominutni handoff token. Provider
forma se prikazuje kroz dokument sa nonce CSP, `no-store`, `no-referrer`,
`nosniff`, ograničenim `form-action`, `base-uri` i frame pravilima.

### 12.3. Fail-closed konfiguracija

NestPay konfiguracija zahteva:

- kanonski HTTPS storefront origin;
- callback putanje na istom poreklu;
- RSD valutu `941`;
- podržani Auth transaction tip;
- očekivani store/terminal/secret parametar;
- odsustvo credentiala u URL-u.

Pogrešna ili nepotpuna konfiguracija pada pre pravljenja HPP payload-a.

### 12.4. Callback i state machine

Callback:

- proverava hash constant-time;
- pokriva samo dogovorena potpisana provider polja;
- proverava amount, currency i transaction identitet;
- sanitizuje audit sadržaj;
- ne loguje hash, PAN, email ili proizvoljan provider payload;
- tehnički/nejasan rezultat šalje u `REVIEW`, ne u implicitni decline;
- isti terminalni callback je replay-safe;
- konfliktan kasni approval/decline ne oživljava otkazan order i ne vraća
  već oslobođenu zalihu.

`PaymentStatus` sada podržava `PENDING`, `PROCESSING`, `PAID`, `FAILED`,
`REVIEW` i `REFUNDED`. `PaymentEvent` čuva append-like audit događaje, a
state-machine pravila sprečavaju nedozvoljeno prepisivanje terminalnog stanja.

Success/failure stranice veruju bazi. Retry se nudi samo za stvarni `FAILED`;
`PENDING`, `PROCESSING` i `REVIEW` daju neutralnu poruku i čuvaju korpu.

---

## 13. Generički katalog i admin

### 13.1. Additive generički model

U Prisma šemu su dodati modeli za:

- `ProductType`;
- `AttributeDefinition`;
- vezu tipa proizvoda i atributa;
- deset tipova atributskih podataka;
- choices i tipizovane product vrednosti;
- product options i option values;
- veze varijante sa izabranim option values.

Kompozitni unique/FK odnosi, CHECK pravila i deferred cardinality triggeri
sprečavaju da se scalar atribut upiše u pogrešnu kolonu, da `SELECT` dobije
nula ili više izbora ili da `MULTI_SELECT` krši svoju granicu.

Model je namerno expand-only. Legacy `ProductSize` ostaje autoritativan dok se
ne završe seed, backfill, dual-read i contract faza.

### 13.2. Admin API za tipove i atribute

ADMIN-only rute podržavaju:

- stabilne kodove i lokalizovan input;
- optimistic `expectedUpdatedAt`;
- `428` kada precondition nedostaje;
- `409` pri konfliktu;
- arhiviranje umesto fizičkog brisanja;
- Serializable mutacije i precizne validation greške.

Potpun ProductType/Attribute/Variant admin UI i integracija u product editor
još nisu završeni.

### 13.3. Deny-by-default admin politika

Centralna politika proverava i putanju i HTTP metod:

- `ADMIN` ima pun admin pristup;
- `OPERATOR` ima samo eksplicitno dozvoljene porudžbine/status/chat akcije;
- anonimni i obični korisnik dobijaju različite 401/403 odgovore;
- prefix lookalike putanje se ne prihvataju;
- direktan URL ili API poziv ne može zaobići sakriven meni.

AdminShell je dobio responsivan meni, dostupne kontrole, `aria-current` i
vidljivu odjavu.

### 13.4. Porudžbine i dashboard

Admin order status API:

- blokira nedozvoljene payment/order tranzicije;
- zahteva tracking pre `SHIPPED`;
- koristi optimistic/CAS uslove;
- atomski oslobađa inventory/kupon pri cancel-u;
- šalje email tek nakon DB commita.

Lista porudžbina prikazuje i filtrira svih šest payment statusa. Dashboard i
statistika računaju „plaćeni prihod” samo iz `PAID`, neotkazanih porudžbina.
Uklonjen je mrtav user-detail link.

Low-stock pregled prikazuje broj aktivnih `ProductSize` redova sa najviše pet
komada, pet najkritičnijih stavki, posebno stanje nula i direktne edit linkove.

---

## 14. Bezbednosni slojevi

### 14.1. Stored-XSS i rich HTML

`lib/security/html.ts` koristi `sanitize-html` sa malom uredničkom allow-listom
za pasuse, naslove, liste, naglašavanje, linkove, kod i slike. Uklanjaju se
script, iframe, SVG, event handleri, stilovi, proizvoljni atributi,
`javascript:` i protocol-relative URL-ovi.

Zaštita radi na dve granice:

1. pri admin create/update upisu članka, FAQ-a i opisa proizvoda;
2. ponovo pri javnom čitanju/renderovanju postojećeg sadržaja.

Newsletter sadržaj se sanitizuje pre slanja i istorijskog upisa, subject se
escape-uje, a admin preview radi u sandbox iframe-u bez script dozvole.

`serializeJsonLd` escape-uje znakove koji mogu zatvoriti `<script>` kontekst i
koristi se za Organization, WebSite, breadcrumb i product JSON-LD.

### 14.2. Origin i browser headeri

Unsafe API write provera sada radi fail-closed. Zahteva podudaran `Origin` ili
browserov `Sec-Fetch-Site: same-origin`. NextAuth i potpisani NestPay callback
tokovi su eksplicitno izuzeti pre te provere.

Globalni headeri uključuju:

- CSP sa eksplicitnim potrebnim izvorima;
- `X-Content-Type-Options: nosniff`;
- `frame-ancestors` i `X-Frame-Options` zabranu frame-ovanja;
- strožu referrer politiku;
- Permissions Policy koja isključuje kameru, mikrofon, geolokaciju i Topics.

HSTS je iza `ENABLE_HSTS=true` i ne uključuje se pre dokazanog punog HTTPS-a za
domen i relevantne poddomene.

### 14.3. reCAPTCHA i javne forme

Centralni verifier proverava action, score, hostname, IP i timeout. Produkcija
bez secreta radi fail-closed. Checkout i prijava za posao ponavljaju proveru u
samoj poslovnoj akciji, a ne samo u pomoćnoj ruti.

Kontakt, reklamacija i prijava za posao imaju honeypot/token zaštitu. Job ruta
dodatno ograničava rate, body, broj fajlova, veličinu, ekstenziju i naziv.
MIME/magic-byte verifikacija priloga još nije završena.

### 14.4. Login povratna putanja

Nepoverljiv `callbackUrl` više ne ide direktno u `router.push`. Centralni
`safeLoginCallbackPath` dozvoljava samo kanonsku root-relative same-origin
putanju, bez scheme, apsolutnog origin-a, `//`, backslash-a, kontrolnih bajtova,
kodiranih separatora i dot segmenata. Query, fragment i Unicode ostaju
dozvoljeni kada ne mogu promeniti origin.

### 14.5. SMTP i newsletter

Svih pet email tokova koristi `lib/email/smtp.ts`: port 465 dobija implicitni
TLS, svi drugi portovi obavezni STARTTLS, minimum TLS 1.2, sertifikati se
proveravaju, a bypass postoji samo u development/test režimu za loopback.

Newsletter unsubscribe koristi HMAC token, dedicated secret, eksplicitni
legacy migration flag, GET confirmation i tek zatim idempotentni POST. Detalji
oba hotfixa nalaze se u odeljku 18.

### 14.6. Ostale granice

- order access, payment handoff, newsletter i cleanup imaju odvojene scope/
  secret granice;
- tokeni se porede timing-safe;
- payment audit ne čuva proizvoljan poverljiv payload;
- `.env`, ključevi i dumpovi su isključeni iz Git-a;
- rate limiter je još in-memory i trusted-proxy model nije završen;
- nema MFA, punog login lockout-a, centralnog error trackinga ni univerzalnog
  poslovnog audit loga.

---

## 15. Baza, baseline i migracije

### 15.1. Read-only audit i backup

Pre migracije je potvrđen PostgreSQL 16, legacy localized JSONB schema,
`User.preferredLocale`, odsustvo pouzdane `_prisma_migrations` istorije i
početni countovi `Product=18`, `ProductSize=18`, `Order=0`, `Transaction=0`.

Napravljena su dva produkciona backup preseka:

| Backup | SHA-256 |
| --- | --- |
| `prod-20260829-before-v2.dump` | `b2a75af62fb6df014588540bafa16cf726e3b88b8e3f25c8c5e6039930b7eed4` |
| njegova schema | `dabe254c3b2accaae4b0bf0d439d15065a7fff5a334682cbb8535aedb497b31d` |
| `prod-20260829-immediate-pre-v2.dump` | `7c5e4ac67119d7dd40b58d6756b945d573e9810e4a4b664013b02fff361d` |
| njegova schema | `07b604f29dd7a7ac5b139a75e03ed605e92ce008c8ed0420c310456f86caead8` |

Backup fajlovi nisu u Git-u ni u release paketu.

### 15.2. Četiri kanonske migracije

| Redosled | Migracija | SHA-256 |
| ---: | --- | --- |
| 1 | `20260829000000_baseline_production_before_v2` | `0aff56aa04c0bc388a5ca53f67c6a7ffc65c5d9ea2e41139789756186ef26942` |
| 2 | `20260829010000_add_payment_status_processing` | `b80018daa574c030f2a896d53aa23427627e5897f05348ecda5b3039d508c946` |
| 3 | `20260829010100_add_payment_status_review` | `831ecf4688ad95a700136fdaa04143dedb25da3994e52ea8b840f8d1d70cc48a` |
| 4 | `20260829020000_expand_v2_platform` | `d064d2b2af0275923546fcce5622e95cc83a2f0e940866ef14fc63d08b2d283a` |

Baseline je current-state schema-only snimak. Na postojećoj produkciji je
evidentiran kao primenjen, a nije ponovo kreirao postojeće objekte. Dve enum
vrednosti su razdvojene zbog PostgreSQL kompatibilnosti. Glavni expand je
transakcijski i additive.

Ova četiri fajla i checksumovi su kanonski i ne menjaju se retroaktivno.

### 15.3. P1014/search_path nalaz

Fresh-DB test je otkrio da je originalni `pg_dump` baseline postavljao prazan
`search_path`, pa Prisma posle baseline-a nije nalazila sopstvenu migration
tabelu i vraćala `P1014`. Baseline je normalizovan na:

```sql
SET search_path = public, pg_catalog;
```

Promena nije dirala poslovne tabele ili podatke; samo je očuvala `public` za
Prisma migration engine. Kompletan fresh-DB lanac je zatim ponovljen uspešno.

### 15.4. Restore, drift i invariant provere

Pre produkcione primene:

- backup je restore-ovan u izolovanu bazu;
- kompletna istorija je primenjena na praznu PostgreSQL 16 bazu;
- restore klon je prošao baseline/expand bez gubitka legacy redova;
- Prisma drift rezultat je bio 0;
- invalid constraints i indeksi su bili 0;
- negativne probe su dokazale odbijanje pogrešne scalar kolone, nedozvoljene
  choice cardinality, negativne cene/zalihe/iznose, prazne/netrimovane size
  vrednosti i duplikate;
- validni rollback-only fixture je prošao svih deset attribute tipova;
- deferred triggeri su provereni kroz `SET CONSTRAINTS ALL IMMEDIATE`;
- smoke transakcija je završena sa `ROLLBACK`.

`scripts/db-legacy-preflight.sql` je read-only/ROLLBACK preflight sa timeoutima.
`scripts/db-invariant-smoke.sql` je reusable rollback-only valid/negative
scenario koji CI pokreće sa `ON_ERROR_STOP=1`.

### 15.5. Produkcioni rezultat

Kontrolisana DB primena je završena uz sledeće stanje:

- 42 tabele;
- 4 završena migration reda;
- 0 drift;
- 0 invalid constraints;
- 0 invalid indeksa;
- `Product` 18 pre i posle;
- `ProductSize` 18 pre i posle;
- `Order` 0 pre i posle;
- `Transaction` 0 pre i posle.

Ovo je bila samo DB migracija. Nije menjala Git `main`, nije deployovala V2
aplikaciju i nije uključila kartice.

---

## 16. CI/CD i release deployment

### 16.1. Verify job

`.github/workflows/objavi.yml` koristi Node 22 i PostgreSQL 16. Verify job
izvršava:

1. zaključani `npm ci --legacy-peer-deps --no-audit --no-fund`;
2. `prisma validate`;
3. kompletan `prisma migrate deploy` na praznoj CI bazi;
4. schema drift proveru;
5. rollback-only DB invariant smoke kroz `psql`;
6. ESLint 9 sa `--quiet`;
7. TypeScript bez emitovanja;
8. automatski pronađene `lib/**/*.test.ts` testove;
9. opt-in reservation PostgreSQL race test;
10. instalaciju Chromiuma;
11. seed i mobilni COD Playwright E2E;
12. produkcijski Next build.

U aktuelnoj P0 radnoj grani verify job se automatski pokreće za PR ka
`verzija/v2.0-univerzalna-platforma`, push na tu kanonsku V2 granu i push taga
sa prefiksom `prodavnica-v2-`; `workflow_dispatch` ostaje ručna
verification-only provera. Push na prezentacioni `main` više nije V2 okidač.

Produkciona objava zavisi od uspešnog verify job-a i posebnog
`Potvrdi V2 release` posla, a oba release posla mogu da uđu u izvršavanje samo
za push namenskog V2 release taga. Ručni dispatch, PR i običan push kanonske V2
grane uvek proveravaju kod bez deploya. Sam prefiks taga nije dovoljan:
neprodukcijski release-gate posao zahteva tačan format
`prodavnica-v2-YYYYMMDD-N` i commit koji je predak kanonske V2 grane pre nego
što GitHub otvori `production` Environment. Deploy posao iste uslove ponavlja
pre SSH-a.

### 16.2. CI izolacija i concurrency

- minimalna dozvola je `contents: read`;
- svaki PR dobija svoju cancelable CI concurrency grupu;
- push V2 grane i ručni dispatch dobijaju zasebne cancelable CI grupe po ref-u;
- samo release-tag push ulazi u serijsku produkcionu grupu i taj run se ne
  prekida novijim runom;
- `actions/checkout` i `actions/setup-node` su pinovani na pune SHA vrednosti
  za v7 izdanja, a checkout ne čuva GitHub kredencijale;
- verify pre instalacije zavisnosti potvrđuje V2 identitet preko obaveznih
  Next/Prisma/deploy/health fajlova i odbija prezentacioni `scripts/build.mjs`;
- test tajne su eksplicitno neprodukcijske;
- E2E seed odbija bazu čiji naziv ne sadrži `e2e`, `test` ili `provera`.

### 16.3. Deployment validacije

Deploy zahteva validan HTTPS `PRODUCTION_URL`, portove 1–65535, različite app/
smoke portove, bezbedan PM2 naziv, bezbednu `/var/www` ili `/srv` putanju i
ispravan release ID. SSH koristi unapred verifikovan known-hosts sadržaj;
runtime `ssh-keyscan` i gašenje host provere nisu dozvoljeni.

Potrebni GitHub environment secrets su:

- `SSH_PRIVATE_KEY`;
- `SSH_KNOWN_HOSTS`;
- `SERVER_HOST`;
- `SERVER_USER`.

Obavezna variable je `PRODUCTION_URL`; opcione su `SERVER_PORT`, `DEPLOY_PATH`,
`APP_PORT`, `SMOKE_PORT` i `APP_NAME`.

### 16.4. Izolovani release i rollback

`scripts/deploy.sh`:

- pravi zaseban release direktorijum;
- povezuje shared `.env` i uploadove;
- instalira zavisnosti i generiše Prisma client;
- proverava schema drift;
- migracije primenjuje samo uz eksplicitan flag;
- gradi release izolovano;
- podiže ga na privremenom smoke portu;
- zahteva `/api/health` sa tačnim deployment SHA i zdravom bazom;
- tek tada atomarno menja `current` symlink i aktivira PM2;
- proverava lokalni i javni health;
- vraća prethodni release ako aktivacija padne;
- koristi isti `flock` za deploy i cleanup;
- zadržava ograničen broj ranijih release-ova.

Health endpoint vraća deployment SHA, DB stanje, `no-store` i HTTP 503 kada
baza nije dostupna.

### 16.5. Operativno stanje

U ovoj radnoj grani implementiran je repository-side, fail-closed release
gate: `main` nije V2 trigger, dispatch ne deployuje, a produkcijski job prihvata
samo namenski V2 tag, strogi naziv taga, V2 stablo i commit iz kanonske V2
istorije. To je stanje koda, a ne tvrdnja da je GitHub ili server već
konfigurisan.

Read-only audit od 30. avgusta 2026. potvrdio je da spoljašnji GitHub
`production` Environment i dalje dopušta samo staru `main` branch politiku,
nema required reviewer ni wait timer, ima 0 Environment secrets, 0 variables i
0 deployment zapisa. `main` nema branch protection niti repository ruleset.
Ništa od tog spoljašnjeg stanja nije menjano ovom etapom.

Allowed-tag policy/ruleset, obavezni reviewer, secrets i variables ostaju za
poslednju, posebno odobrenu live fazu. Deploy korisnik, prava, SSH ključ,
produkcijski `.env`, domen, DNS, TLS i reverse proxy nisu popunjeni kroz ovaj
rad. Nije napravljen release tag, nije kontaktiran server i V2 aplikacioni
deploy nije izvršen.

---

## 17. UX, admin i operativni sprint

Posle osnovne V2 production-readiness faze urađen je poseban sprint čiji cilj
nije bio dodavanje velikih novih funkcija, već zatvaranje konkretnih UX,
bezbednosnih i operativnih slabosti koje su pronađene pregledom koda i ručnim
prolaskom kroz aplikaciju.

### 17.1. Stored XSS i prikaz bogatog sadržaja

HTML koji dolazi iz editora ili baze više se ne tretira kao bezuslovno
bezbedan. Uvedena je centralna server-side sanitizacija sa dozvoljenom listom
tagova i atributa. Isti princip primenjen je na opise proizvoda, tekstualne
blokove i druge prikaze koji koriste HTML, tako da se uklanjaju skripte,
event-handler atributi, opasne URL šeme i nedozvoljeni elementi.

Posebno je obrađen JSON-LD: strukturirani podaci se serijalizuju tako da sadržaj
iz baze ne može da prekine `<script type="application/ld+json">` kontekst.
Time su odvojene dve različite odgovornosti:

- HTML za prikaz prolazi kroz sanitizer;
- JSON-LD prolazi kroz bezbedan serializer;
- React tekst koji ne mora biti HTML ostaje običan escaped tekst;
- admin unos se ne smatra pouzdanim samo zato što zahteva ADMIN ulogu.

### 17.2. Security headeri i zaštita mutirajućih ruta

Uvedeni su ili pooštreni headeri i politike za:

- sprečavanje MIME sniffinga;
- kontrolu referera;
- zabranu nepotrebnog framing-a;
- ograničavanje browser capability funkcija;
- `no-store` odgovore na osetljivim i tokenizovanim stranicama;
- strožu kontrolu izvora za API rute koje menjaju stanje.

Origin zaštita je centralizovana kako mutirajući zahtevi ne bi zavisili samo od
toga da li browser automatski šalje cookie. Osetljive javne forme dobijaju
reCAPTCHA proveru, dok serverske/admin/cron rute koriste odgovarajući auth ili
Bearer sloj. Ovi mehanizmi imaju različite pretnje i nisu tretirani kao zamena
jedan za drugi.

### 17.3. Mobilni katalog i filteri

Katalog je sređen za realne mobilne širine:

- filter panel na malom ekranu radi kao kontrolisan drawer;
- broj pronađenih rezultata i aktivni filteri ostaju vidljivi;
- pretraga, sortiranje i filteri imaju jasne labele;
- dugmad i kartice imaju dovoljno velike dodirne zone;
- modal brze pretrage i navigacija mogu se koristiti tastaturom;
- fokus se ne gubi pri otvaranju/zatvaranju interaktivnih slojeva;
- desktop i mobile varijanta ne vode dve nezavisne poslovne logike.

Ispravljeni su i problemi sa karticama proizvoda, slikama, cenom, stanjem
varijante i prelaskom na detalj proizvoda. Cilj je bio da katalog ostane
upotrebljiv i kada podaci nisu idealni, bez oslanjanja na hover.

### 17.4. Checkout pristupačnost i stabilnost

Checkout je dobio jasnije semantičke labele, grupisanje kontrola i poruke o
grešci. Kontrole načina plaćanja i dostave povezane su sa odgovarajućim
tekstom, a mobilni prikaz je proveren kroz Chromium E2E.

Prva dva CI pokušaja posle UX izmene otkrila su da su E2E selektori previše
vezani za naslov i prikaz teksta. To nije sakriveno isključivanjem testa:
selektori su najpre usklađeni u `e61fcc2`, zatim stabilizovani u `438dc55`,
nakon čega je kompletan pipeline prošao. Ovaj sled je važan jer pokazuje da je
test zaista detektovao regresiju/nesklad, a ne samo formalno postojao.

### 17.5. Admin operativa

Admin je proširen informacijama potrebnim za svakodnevni rad:

- pregled statusa porudžbine i plaćanja;
- filteri za payment stanja, uključujući `PROCESSING`, `REVIEW` i `REFUNDED`;
- KPI kartice i sažeci prodaje;
- upozorenja za nisku zalihu;
- osnovni prikaz kritičnih payment/inventory signala;
- pristup generičkim catalog API-jima samo za ADMIN;
- jasnije odvajanje konfiguracije prodavnice od hardkodovanog brenda.

Ovo nije kompletan ERP niti završena customer-support konzola. `REVIEW`
reconciliation, refund workflow, logistika, povrati, fakture i inventory ledger
ostaju zaseban posao.

### 17.6. Tooling i održavanje

Projekat je prebačen na ESLint 9 flat konfiguraciju. Test runner više ne zavisi
od ručno održavane liste svakog unit testa, već otkriva `lib/**/*.test.ts`.
Playwright Chromium je dodat kao obavezna provera najvažnijeg mobilnog COD
toka. Time su lint, typecheck, unit/integration provere, browser E2E i build
postali deo jednog ponovljivog pipeline-a.

---

## 18. Četiri P1 hotfixa

Završna faza razvoja izdvojila je četiri konkretna P1 nalaza u nezavisne grane
i PR-ove. Svaki hotfix je prvo testiran samostalno, zatim usklađen sa aktuelnim
V2 stanjem i tek onda spojen. Nijedan od ovih hotfixeva nije automatski
deployovan na produkciju.

### 18.1. Potpisana newsletter odjava

#### Problem pre izmene

Stari unsubscribe URL oslanjao se na javno poznat fallback i dozvoljavao je da
GET zahtev odmah promeni stanje pretplate. To je imalo dva problema:

1. token nije imao dovoljno pouzdanu produkcionu secret politiku;
2. email skener, prefetcher ili browser koji samo otvori link mogao je da
   deaktivira pretplatu bez jasne korisničke potvrde.

#### Nova token politika

`lib/newsletter/unsubscribe.ts` je postao jedini izvor pravljenja i provere
unsubscribe tokena i URL-ova. Implementirano je:

- normalizovanje email adrese pre potpisivanja;
- HMAC-SHA256 potpis skraćen na strogo validiran 32-hex token;
- constant-time poređenje preko `timingSafeEqual`;
- `NEWSLETTER_UNSUBSCRIBE_SECRET` kao namenski secret;
- najmanje 32 bajta za namenski ili kompatibilni `NEXTAUTH_SECRET`;
- fail-closed ponašanje kada secret nedostaje ili je preslab;
- zabrana tihog fallback-a ako je namenski secret postavljen, ali pogrešan;
- eksplicitni, privremeni legacy prozor samo kada je
  `NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY=true`;
- legacy secret se tada koristi samo za proveru ranijih linkova, dok se novi
  linkovi potpisuju namenskim secretom.

Ova migraciona zastavica je namerno opt-in. Kada isteknu stari poslati linkovi,
treba je vratiti na `false` i ostaviti samo namenski secret.

#### Bezbedan HTTP tok

GET više ne vrši mutaciju. Link otvara potvrdu na `/newsletter/odjava`, a tek
eksplicitni POST deaktivira pretplatu. Tok dodatno koristi:

- `noindex`/`nofollow` da tokenizovana stranica ne ulazi u pretraživače;
- strogu referrer politiku i `no-store`;
- idempotentnu deaktivaciju, pa ponovljen validan zahtev ne pravi grešku;
- jednu Prisma transakciju sa dva `updateMany` poziva koja deaktivira i
  `User.newsletterOptIn` i `NewsletterSubscriber.active` kada red postoji;
- generički korisnički rezultat bez curenja nepotrebnih podataka;
- uklanjanje tokena iz vidljivog URL-a preko `router.replace` tek posle
  uspešnog POST odgovora.

Mailer sada svaki odjavni link pravi kroz isti helper. Unit testovi helpera
pokrivaju secret matricu, slab/missing secret, legacy migraciju, normalizaciju
emaila, nevalidne tokene i autorizovani callback/retry ponašanje. Poseban route/
component integration test koji poziva stvarni GET/POST, mockuje Prisma
transakciju i dokazuje replay/zero-match odgovor još ne postoji i naveden je u
preostalim test-rupama.

#### Status

- izvorni/testirani head: `d0f21742`;
- PR: [#4](https://github.com/biozencaj-stack/narodnanosnja/pull/4);
- V2 merge: `b60f7982`;
- CI: uspešan;
- produkcija: nije deployovano i secret nije ovim radom postavljen.

### 18.2. Fail-closed login `callbackUrl`

#### Problem pre izmene

Login UI je uzimao `callbackUrl` iz query stringa i prosleđivao ga navigaciji.
Takav podatak je napadački kontrolisan. Provera samo početnog `/` nije dovoljna
jer postoje protocol-relative, encoded separator, backslash, kontrolni znakovi
i canonicalization trikovi.

#### Rešenje

`lib/security/navigation.ts` uvodi `safeLoginCallbackPath()`. Dozvoljena je samo
kanonska root-relative putanja istog storefronta. Sve sumnjivo se svodi na `/`.
Helper odbija:

- apsolutne URL šeme (`https:`, `javascript:` i druge);
- vrednosti bez vodeće kose crte;
- `//host` protocol-relative oblik;
- backslash i kontrolne znakove;
- encoded `/`, `\\` i kontrolne bajtove u path delu;
- duple separatore i `.`/`..` segmente;
- whitespace pre ili posle vrednosti;
- malformed percent encoding;
- vrednost čije parsirano poreklo nije interno.

Validni query i fragment se čuvaju kada pripadaju bezbednoj internoj putanji.
Unit testovi pokrivaju normalne lokalne rute i reprezentativne bypass pokušaje.

#### Status

- testirani head: `652a863c`;
- PR: [#5](https://github.com/biozencaj-stack/narodnanosnja/pull/5);
- V2 merge: `9bea9537`;
- CI: uspešan;
- produkcija: nije deployovano.

### 18.3. Centralni SMTP TLS sloj

#### Problem pre izmene

Email slanje je bilo raspoređeno na više mesta sa neujednačenim Nodemailer
opcijama. Deo tokova mogao je da se osloni na implicitne default vrednosti, a
postojala je opasnost da se privremeni TLS bypass proširi van lokalnog razvoja.

#### Rešenje

Svi relevantni email tokovi prebačeni su na `lib/email/smtp.ts` i jednu
fail-closed transport politiku. Obuhvaćeni su registracija/verifikacija,
resetovanje lozinke, porudžbina, newsletter i wishlist/obaveštenja.

Centralni resolver:

- prihvata dokumentovane legacy i nove nazive host/user/password promenljivih;
- koristi 587 samo kao podrazumevani port kada port nije zadat;
- odbija nebrojčan port i vrednosti izvan 1–65535;
- koristi implicitni TLS samo na portu 465;
- za svaki drugi port zahteva uspešan STARTTLS pre kredencijala/sadržaja;
- zahteva najmanje TLS 1.2;
- podrazumevano i u produkciji proverava sertifikat;
- zahteva host, korisničko ime i lozinku pre pravljenja transporta;
- ne loguje tajne.

`SMTP_TLS_REJECT_UNAUTHORIZED=false` dozvoljen je isključivo kada su istovremeno
ispunjena oba uslova: `NODE_ENV` je `development`/`test` i SMTP host je stvarni
loopback (`localhost`, `127.0.0.1`, `::1` ili ekvivalent). Nevažeća boolean
vrednost takođe prekida konfiguraciju umesto da je tiho prihvati.

Testovi pokrivaju port 465, STARTTLS portove, minimum TLS verzije, missing
credentials, neispravne portove, produkcijski bypass pokušaj, nelokalni host i
dozvoljen lokalni development/test slučaj.

#### Status

- izvorni head: `11a60e99`;
- usklađeni/testirani head: `ac39288a`;
- PR: [#3](https://github.com/biozencaj-stack/narodnanosnja/pull/3);
- V2 merge: `b09a7ad7`;
- CI: uspešan;
- produkcija: SMTP vrednosti nisu menjane i V2 mailer nije deployovan.

### 18.4. Cleanup isteklih kartičnih rezervacija

#### Problem pre izmene

Kartična porudžbina rezerviše zalihu pre odlaska na bankarsku stranicu. Ako
kupac nikada ne završi tok, netaknuta rezervacija može ostati zauzeta. Naivni
cron koji samo traži „stare PENDING” porudžbine bio bi opasan: mogao bi da
vrati zalihu dok callback ili početak plaćanja upravo radi, ili da oslobodi
kupon/zalihe iako banka ima dokaz aktivnosti.

#### Deterministička politika

`lib/orders/reservation-policy.ts` razdvaja ishode:

- `EXPIRE` — samo netaknuta `CARD/PENDING` porudžbina bez transakcije i bez
  payment događaja, starija od recovery roka;
- `REVIEW` — postoji processing/payment aktivnost, terminalna anomalija ili
  dovoljno star provider pokušaj koji zahteva ručnu proveru;
- `SKIP` — uslovi nisu bezbedni za automatsku izmenu.

Podrazumevani recovery prag za netaknutu rezervaciju je 120 minuta.
`PROCESSING`/payment-activity review prag je konzervativno 24 sata i može se
konfigurisati preko `ORDER_PROCESSING_REVIEW_MINUTES` samo u dozvoljenom
opsegu. `CASH` porudžbine ovaj cleanup nikada ne menja.

#### Transakciona i konkurentna zaštita

`lib/orders/reservation-cleanup.ts` radi u ograničenim batch-evima. Široki DB
prefilter služi samo za pronalaženje kandidata; odluka se ponovo računa iz
svežeg snapshot-a unutar zasebne `Serializable` transakcije za svaku
porudžbinu.

Implementirano je:

- najviše 200 redova po batch-u, podrazumevano 50;
- ponovni snapshot pre bilo kakvog write-a;
- compare-and-set zaštita očekivanog statusa/snapshot-a;
- retry do tri puta za serializable/CAS konflikt;
- exactly-once vraćanje zalihe preko postojećeg inventory helpera;
- exactly-once oslobađanje kupona preko postojećeg coupon helpera;
- `REVIEW` bez vraćanja zalihe ili kupona;
- pojedinačna izolacija greške tako jedan „poison” red ne zaustavi ostale;
- zbirni rezultat `scanned/expired/reviewed/skipped/failed`;
- HTTP 500 kada makar jedan kandidat nije bezbedno obrađen;
- bez email adresa, tokena i drugih osetljivih detalja u cron odgovoru.

`beginCardPayment()` je dodatno ograđen: plaćanje se ne može pokrenuti kada
porudžbina više nema rezervisanu zalihu, kada nije u očekivanom order/payment
stanju ili kada je cleanup već promenio snapshot. Time se konflikt zatvara sa
obe strane, a ne samo unutar cron-a.

#### Zaštićeni endpoint i operativni tok

`POST /api/cron/order-reservations` zahteva:

- zaseban `ORDER_RESERVATION_CLEANUP_SECRET` od najmanje 32 znaka;
- validan Bearer header sa constant-time proverom;
- važeći Origin kroz zajedničku zaštitu mutirajućih ruta;
- telo do 256 bajtova i isključivo opcioni boolean `apply`;
- eksplicitno `{"apply":true}` za mutaciju.

Prazno telo ili `apply:false` namerno znače dry-run. Pogrešna ili nedovoljno jaka
konfiguracija vraća fail-closed 503; pogrešna autentikacija 401; nevalidno telo
400/413.

Dokumentovani systemd oneshot/timer prvo zahteva ručni dry-run, pregled samo
agregatnih rezultata, eksplicitan apply i ponovni dry-run. Timer nije postavljen
u okviru ovog rada.

#### Testovi i status

Unit testovi pokrivaju policy i endpoint matricu. Opt-in PostgreSQL integration
test pokreće dva paralelna cleanup radnika nad istim order/stock/coupon fixture-
om i dokazuje da se resursi vraćaju tačno jednom. Taj test je lokalno preskočen
bez eksplicitnog env flag-a, a CI ga obavezno pokreće nad izolovanom bazom.

- izvorni head: `cc544e84`;
- usklađeni/testirani head: `4a32b1c0`;
- PR: [#2](https://github.com/biozencaj-stack/narodnanosnja/pull/2);
- V2 merge: `6429de34`;
- CI: uspešan;
- produkcija: endpoint, secret i timer nisu deployovani/uključeni.

### 18.5. Zašto su hotfixevi provereni i zajedno

Izolovan uspeh nije bio dovoljan zato što više hotfixeva dodiruje iste zone:

- newsletter odjava i SMTP menjaju mailer i email konfiguraciju;
- callback helper menja login UI koji već koristi zajedničke security politike;
- reservation cleanup deli order/inventory/coupon/payment invarijante sa
  checkout i NestPay tokom;
- dokumentaciona i `.env.example` dopuna moraju odgovarati konačnom, a ne
  izvornom head-u pojedinačne grane.

Zato su posle svakog merge-a ponavljani kompletni testovi, E2E i build na
objedinjenom V2 stanju.

---

## 19. Integracija grana, PR-ovi i dokumentacija

### 19.1. Redosled i način integracije

Primenjen je sledeći redosled:

1. newsletter PR #4;
2. callback PR #5;
3. SMTP PR #3;
4. reservation cleanup PR #2;
5. završna dokumentacija PR #6.

Grane koje su nastale ranije usklađene su merge-ovanjem novog V2 stanja u
njih. Nije korišćen rebase koji bi promenio već testirane SHA vrednosti, niti
force push koji bi otežao audit.

SMTP grana je morala da sačuva novu newsletter logiku dok centralizuje mailer,
`.env.example` i dokumentaciju. Reservation grana je zatim morala da preuzme
sva tri ranije spojena hotfixa. Konflikti nisu rešavani izborom cele jedne
strane; pregledana je semantika konačnog fajla.

### 19.2. PR i commit evidencija

| Vreme (UTC) | Događaj | SHA / PR |
| --- | --- | --- |
| 2026-08-29 16:11 | Početni V2 platform snapshot | `3dc757ac` |
| 16:14 | GitHub/V2 dokumentacija | `f38bb4e8` |
| 17:21 | Production-readiness priprema | `1076cae0` |
| 17:23 | Otvoren Draft V2 → `main` | [PR #1](https://github.com/biozencaj-stack/narodnanosnja/pull/1) |
| 18:05 | UX/security/admin hardening | `c4483345` |
| 18:10 | Prva E2E korekcija | `e61fcc2d` |
| 18:15 | Stabilizovani checkout E2E selektori | `438dc55b` |
| 20:08 | V2 dokumentaciona baza | `5312ab24` |
| 20:33 | Callback hotfix | `652a863c` |
| 22:10 | Izvorni reservation hotfix | `cc544e84` |
| 22:39 | Izvorni SMTP hotfix | `11a60e99` |
| 23:16 | Newsletter hotfix | `d0f21742` |
| 23:32 | Newsletter spojen u V2 | PR #4, merge `b60f7982` |
| 23:33 | Callback spojen u V2 | PR #5, merge `9bea9537` |
| 23:42 | SMTP usklađen sa prethodnim merge-ovima | `ac39288a` |
| 23:45 | SMTP spojen u V2 | PR #3, merge `b09a7ad7` |
| 23:56 | Reservation usklađen sa prethodnim merge-ovima | `4a32b1c0` |
| 2026-08-30 00:01 | Reservation spojen u V2 | PR #2, merge `6429de34` |
| 00:08 | Ispravljena SMTP dokumentaciona referenca | `d2a9252c` |
| 00:10 | Kompletirana newsletter evidencija | `4816b931` |
| 00:15 | Završna dokumentacija spojena u V2 | PR #6, merge `79216213` |

### 19.3. Završna dokumentaciona korekcija

PR #6 je ispravio zastarelu SMTP referencu i dopunio objedinjeni dnevnik tako
da newsletter, callback i reservation više nisu opisani kao odvojene ili
neintegrisane grane. Dokumentacija razlikuje:

- izvorni hotfix commit;
- usklađeni/testirani PR head;
- V2 merge commit;
- stanje aplikacionog deploya;
- stanje produkcione baze;
- preostale operativne obaveze.

### 19.4. Dokaz identičnog završnog stabla

Završni remote V2 merge `79216213` nema zaseban GitHub Actions run. To nije
prećutano: njegov tree je `762f004ce8774ef24f61b9231394b4afb8b84331`, isti
kao zeleni dokumentacioni head `4816b931`. Merge commit zato nije promenio
sadržaj koji je CI proverio.

Ipak, pre bilo kakvog budućeg produkcionog deploya treba pokrenuti obavezan CI
na tačnom release SHA-u. Tree ekvivalencija je dobar dokaz za ovaj izveštaj,
ali nije zamena za release proceduru.

Ovaj pasus ostaje istorijski dokaz završnog stabla pre P0 release izmene. Nova
P0 grana mora zasebno proći CI na svom tačnom head SHA-u, a posle integracije i
kanonska V2 grana mora dobiti zeleni push run. Tek commit koji je već deo te
grane može kasnije biti označen namenskim release tagom; takav tag u ovoj fazi
nije napravljen.

---

## 20. Testovi i dokazi

### 20.1. Aktuelni lokalni presek

Poslednji objedinjeni lokalni test pre ovog izveštaja daje:

- 103 ukupna testa;
- 102 prolaze;
- 0 pada;
- 1 je namerno preskočen;
- preskočeni test je opt-in PostgreSQL reservation-cleanup race scenario;
- CI ga uključuje sa `RUN_RESERVATION_CLEANUP_DB_TESTS=true`.

Pored unit/integration testova provereni su lint, TypeScript, Prisma validacija,
produkcijski build i mobilni COD browser scenario u odgovarajućim presecima.

### 20.2. Šta kompletan CI dokazuje

Zeleni `Provera verzije` pipeline dokazuje da iz čistog checkout-a i zaključanog
dependency stabla može da:

1. podigne prazan PostgreSQL 16;
2. primeni sve committed migracije;
3. potvrdi da Prisma schema i migration history ne driftuju;
4. izvrši pozitivne i negativne DB invarijante u rollback transakciji;
5. prođe ESLint 9 i TypeScript;
6. pronađe i izvrši sve unit testove;
7. izvrši pravi PostgreSQL cleanup concurrency test;
8. instalira Chromium;
9. seeduje izolovanu E2E bazu;
10. završi mobilni COD checkout;
11. napravi produkcijski Next build.

Ovaj pipeline ne dokazuje bankarski staging, SMTP dostavljivost, stvarni VPS,
DNS/TLS/reverse proxy niti produkcijske tajne. Te provere su namerno odvojene.

### 20.3. CI hronologija

| SHA | GitHub Actions run | Rezultat i značenje |
| --- | --- | --- |
| `1076cae0` | [33265509005](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33265509005) | SUCCESS; production-readiness baza, deploy skipped |
| `c4483345` | [33267356156](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33267356156) | FAILURE; mobilni checkout E2E našao nesklad |
| `e61fcc2d` | [33267566232](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33267566232) | FAILURE; isti E2E korak još nije stabilan |
| `438dc55b` | [33267767572](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33267767572) | SUCCESS; stabilizovana V2 baza |
| `cc544e84` | [33277948225](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33277948225) | SUCCESS; izvorni reservation hotfix |
| `11a60e99` | [33279309833](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33279309833) | SUCCESS; izvorni SMTP hotfix |
| `d0f21742` | [33280908896](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33280908896) | SUCCESS; newsletter hotfix |
| `652a863c` | [33281060934](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33281060934) | SUCCESS; callback hotfix |
| `9bea9537` | [33281263488](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33281263488) | SUCCESS; V2 posle newsletter/callback merge-a |
| `ac39288a` | [33281613427](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33281613427) | SUCCESS; konačni SMTP PR head |
| `4a32b1c0` | [33282177630](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33282177630) | SUCCESS; konačni reservation PR head |
| `6429de34` | [33282336793](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33282336793) | SUCCESS; završno objedinjeno V2 kodno stanje |
| `4816b931` | [33282725051](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33282725051) | SUCCESS; završni docs head, isti tree kao finalni merge |

Na svim uspešnim V2/hotfix run-ovima produkcioni deployment job je ostao
`skipped`.

### 20.4. Poznata CI napomena

Pinovane verzije `actions/checkout` i `actions/setup-node` trenutno izazivaju
GitHub napomenu da stara action implementacija cilja Node 20 i da je platforma
privremeno izvršava na Node 24. To nije oborilo pipeline, ali action SHA treba
osvežiti na pregledanu verziju koja nativno podržava aktuelni runtime.

### 20.5. Granice dokaza

Zeleni CI nije isto što i produkcijsko odobrenje. Još nisu dokazani:

- pravi bankarski HPP i ugovorna NestPay konfiguracija;
- bankarski callback kroz javni HTTPS i reverse proxy;
- email dostava kroz stvarni SMTP sa validnim certifikatom;
- VPS release, PM2 aktivacija i rollback u realnom okruženju;
- scheduler/timer za reservation cleanup;
- ručna obrada `REVIEW`, reconciliation i refund;
- oporavak iz najnovijeg produkcionog backupa na zasebnoj mašini;
- pun cross-browser i assistive-technology audit.

---

## 21. Inventar ključnih fajlova

Ovo nije spisak svakog promenjenog reda, već mapa fajlova koji nose glavne
ugovore sistema. Za tačan istorijski diff koriste se commitovi i PR-ovi iz
odeljka 19.

### 21.1. Konfiguracija i identitet prodavnice

| Fajl/oblast | Uloga |
| --- | --- |
| `lib/config/store-settings-schema.ts`, `store-settings.ts`, `store-identity.ts` i `storefront-url.ts` | Novi centralni settings, identitet i javni URL ugovor; `store.ts` ostaje deo legacy env sloja |
| `lib/config/capabilities.ts` | Fail-closed uključivanje/isključivanje payment i drugih capability funkcija |
| `lib/config/order-reservations.ts` | Validirani rokovi za pending recovery i processing review |
| `.env.example` | Javna, bezbedna matrica očekivanih promenljivih bez stvarnih tajni |
| `components/StoreIdentityProvider.tsx`, `app/layout.tsx` i `app/globals.css` | Runtime tema, CSS promenljive i zajednička prezentacija identiteta |

Brend nije potpuno sveden na jedan tekstualni config fajl: runtime vrednosti
prolaze i kroz server layout/CSS promenljive. Promena teme zato mora biti
proverena u oba sloja i na svetloj/tamnoj varijanti.

### 21.2. Katalog, proizvod i varijante

| Fajl/oblast | Uloga |
| --- | --- |
| `prisma/schema.prisma` | Legacy i generički modeli kataloga, zalihe, porudžbine i paymenta |
| `scripts/uvoz-nosnja.ts` i seed/import skripte | Idempotentni uvoz sopstvenih 6 kategorija i 18 proizvoda |
| `lib/catalog/*` | ProductType, atributi, izbori, opcije i varijantni ugovori |
| `lib/products.ts` | Storefront upiti, pretraga i filtriranje proizvoda |
| `components/filter/FilterSidebar.tsx` | Aktivni desktop/mobile filter ugovor |
| `components/filter/FiltersAside.tsx` | Dodatni legacy filter prikaz koji treba konsolidovati |
| `components/product/*` | Kartica, detalj, opcije, stanje i kupovna interakcija |
| `app/api/admin/product-types/*` i `app/api/admin/attributes/*` | ADMIN-only generički catalog API-ji |

Generički Prisma/API sloj postoji, ali storefront i admin nisu do kraja
prebačeni na stabilni `variantId`. Legacy `size` string i dalje je deo aktivnog
ugovora.

### 21.3. Korpa, quote i porudžbina

| Fajl/oblast | Uloga |
| --- | --- |
| `store/cart.ts` | Klijentska korpa, per-tab storage, hidracija i fingerprint |
| `types/cart.ts` | Aktivni legacy cart line ugovor |
| `lib/checkout/quote.ts` | Serverski autoritativan obračun proizvoda, promocija, dostave i minimuma |
| `lib/checkout/order-handler.ts` | Validacija, idempotency, quote i centralno kreiranje porudžbine |
| `lib/orders/index.ts` | Transakcioni order tok i order-item snapshot postojeće šeme |
| `lib/orders/inventory.ts` | Alokacija i exactly-once oslobađanje zalihe |
| `lib/orders/coupon.ts` | Rezervacija/upotreba i exactly-once oslobađanje kupona |
| `lib/orders/access.ts` | Vlasnik, admin ili potpisani guest pristup porudžbini |
| `lib/promotions.ts` | Automatske i kuponske promocije |

### 21.4. Plaćanje i rezervacije

| Fajl/oblast | Uloga |
| --- | --- |
| `lib/nestpay/index.ts` i payment helperi | Parametri, potpis i provider ugovor |
| `lib/orders/payment-policy.ts` i `lib/orders/payment.ts` | Dozvoljene payment state tranzicije i anomalije |
| `app/api/payments/nestpay/start/route.ts` i `callback/{success,fail}/route.ts` | Početak plaćanja i bankarski callback ulazi |
| `lib/orders/reservation-policy.ts` | Čista `EXPIRE`/`REVIEW`/`SKIP` odluka |
| `lib/orders/reservation-cleanup.ts` | Batch, Serializable/CAS i tačno-jednom cleanup |
| `app/api/cron/order-reservations/route.ts` | Bearer-protected, dry-run-default maintenance endpoint |
| `lib/orders/reservation-cleanup.integration.test.ts` | Opt-in real-PostgreSQL cleanup-vs-cleanup race dokaz |

### 21.5. Auth, bezbednost i javne forme

| Fajl/oblast | Uloga |
| --- | --- |
| `lib/auth/index.ts` | NextAuth credential tok, JWT i session mapiranje |
| `proxy.ts` | Centralna admin/API/request politika u Next 16 projektu |
| `lib/security/navigation.ts` | Bezbedna kanonizacija login callback putanje |
| `lib/security/origin.ts` | Origin pravila za mutirajuće zahteve |
| `lib/security/bearer.ts` | Constant-time Bearer provera |
| `lib/security/*html*` | HTML sanitizacija/serijalizacija sadržaja |
| `lib/rate-limit.ts` | Trenutni procesni LRU limiter; nije dovoljan za više instanci |
| `app/api/auth/*` | Registracija, verifikacija, login pomoćni tokovi i reset lozinke |
| `app/api/newsletter/*` | Subscribe i unsubscribe ugovori |
| `app/api/chat/messages/route.ts` | Chat ulaz i trenutni rate-limit identitet |
| `app/api/cron/wishlist-alerts/route.ts` | Legacy maintenance tok koji još zahteva hardening |

### 21.6. Email

| Fajl/oblast | Uloga |
| --- | --- |
| `lib/email/smtp.ts` | Jedina fail-closed SMTP TLS transport politika |
| `lib/email/mailer.ts` | Slanje poslovnih i javnih form emailova/priloga |
| `lib/email/auth-emails.ts` | Verifikacija/reset/auth šabloni |
| `lib/email/order-emails.ts` | Potvrde i statusne poruke porudžbine |
| `lib/email/wishlist-notifications.ts` | Wishlist obaveštenja |
| `lib/newsletter/unsubscribe.ts` | Token, secret matrica i URL za odjavu |

Transport sigurnost je centralizovana, ali HTML escaping svih template polja i
magic-byte politika priloga još nisu završeni.

### 21.7. Baza, migracije i backup

| Fajl/oblast | Uloga |
| --- | --- |
| `prisma/migrations/*` | Baseline i tri expand migraciona koraka |
| `.github/workflows/objavi.yml` i `scripts/deploy.sh` | Inline `prisma migrate diff` schema drift provera u CI/release toku |
| `scripts/db-legacy-preflight.sql` | Read-only inventar legacy produkcione šeme pre baseline/migracije |
| `scripts/db-invariant-smoke.sql` | Rollback-only DB pozitivni/negativni scenariji |
| `scripts/seed-e2e.ts` | Idempotentni i test-baza-zaštićeni E2E seed |
| `scripts/backup.sh`, `scripts/restore.sh` | Legacy operativa koja mora biti prepisana pre upotrebe |
| `docs/PRISMA-BASELINE.md` | Obrazloženje baseline-a, dokazi i procedura |

### 21.8. CI, release i dokumentacija

| Fajl/oblast | Uloga |
| --- | --- |
| `.github/workflows/objavi.yml` | Kompletan verify i strogo ograđen production deploy |
| `scripts/deploy.sh` | Izolovani release, health, aktivacija, rollback i retention |
| `app/api/health/route.ts` | Deployment SHA i DB health ugovor |
| `playwright.config.ts` | Mobilni Chromium E2E konfiguracija |
| `e2e/purchase-flow.spec.ts` | Guest COD happy-path browser scenario |
| `docs/ARCHITECTURE-V2.md` | V2 granice i slojevi |
| `docs/CATALOG-MIGRATION-PLAN.md` | Expand/backfill/dual-read/contract plan kataloga |
| `docs/V2-ROLL-OUT.md` | Operativni rollout i cleanup runbook |
| `docs/GITHUB-DEPLOY.md` | GitHub environment/secrets/deploy uputstvo |
| `docs/DETALJAN-DNEVNIK-IZMENA.md` | Hronološki dnevnik svih razvojnih preseka |
| ovaj dokument | Konsolidovan opis gotovog, nedovršenog i preporučenog nastavka |

---

## 22. Važne odluke i razlozi

### 22.1. Single-store white-label, ne multi-tenant

V2 je generalizovan tako da isti kod može da se konfiguriše za drugu
prodavnicu, ali jedna instanca i jedna baza predstavljaju jednu prodavnicu.
Nisu uvedeni `tenantId`, tenant-scoped unique indeksi, izolacija podataka niti
tenant routing. Naziv „univerzalna platforma” zato ne znači SaaS multi-
tenant sistem.

Razlog je smanjenje bezbednosnog i migracionog rizika. Multi-tenant izolacija
je zaseban arhitektonski projekat i ne treba je imitirati samo config poljem.

### 22.2. Server je autoritet za cenu

Browser može da prikaže okvirni zbir, ali ne može da odluči cenu, dostavu,
promociju, minimum ili dostupnu količinu. Server ponovo učitava proizvode i
varijante i vraća quote. Time izmena `sessionStorage`/request JSON-a ne menja
stvarni poslovni rezultat.

### 22.3. Stabilan inventory identitet i soft-retire

`ProductSize` redovi se ne brišu i ne prave ponovo pri svakom admin čuvanju.
Stabilni ID-evi su potrebni zbog postojećih korpi, rezervacija i istorije.
Uklonjena opcija se penzioniše kada je bezbedno, a istorijski order snapshot
ostaje čitljiv.

### 22.4. Exactly-once oslobađanje

Zaliha i kupon ne vraćaju se „jer endpoint misli da treba”, već samo ako
transakcioni marker potvrdi da resurs još nije oslobođen. To štiti od replay-a,
duplog callback-a, dva cleanup radnika i admin/cron preplitanja.

### 22.5. Payment anomalija ide u `REVIEW`

Kada provider rezultat nije kompletan, kada nedostaje transaction ID ili se
Order/Transaction projekcije ne slažu, sistem ne glumi `FAILED` niti oslobađa
rezervaciju. Zadržava resurse i šalje slučaj na ručnu proveru. To je skuplje
operativno, ali sprečava prodaju istog artikla dva puta.

### 22.6. GET ne menja stanje

Newsletter hotfix eksplicitno je razdvojio otvaranje linka od mutacije. Isti
princip treba primeniti na preostali wishlist cron: GET može da pročita status,
ali ne sme da šalje poruke ili menja bazu.

### 22.7. Fail-closed capability i konfiguracija

Kartice, SMTP, newsletter token i cleanup ne postaju aktivni samo zato što neka
promenljiva nedostaje ili izgleda približno validno. Pogrešna kritična
konfiguracija prekida tok sa jasnom serverskom greškom. Ovo sprečava tihi rad u
nesigurnom režimu.

### 22.8. Expand pre contract migracije

Generički katalog je uveden aditivno. Stari `size` tok ostaje dok se podaci ne
backfill-uju, uvede dual-read i svi potrošači ne pređu na `variantId`/snapshot.
Tek tada se planira contract uklanjanje legacy ugovora. Ovo omogućava rollback
i izbegava jednokratni „big bang”.

### 22.9. Build/test/deploy su različiti dokazi

Lokalni build ne dokazuje CI; CI ne dokazuje produkcionu konfiguraciju;
uspešna DB migracija ne dokazuje aplikacioni deploy; postojanje payment koda ne
znači da je kartično plaćanje odobreno. Dokumentacija namerno vodi ove statuse
odvojeno.

### 22.10. Ne spajati V2 u prezentacioni `main`

Najnovija odluka ima prednost nad starijim dnevnicima. `main` trenutno objavljuje
drugu aplikaciju preko GitHub Pages. Draft PR #1 je ostao istorijski trag, ali
nije bezbedan release mehanizam. Za aktuelnu implementaciju izabrana je
kanonska V2 grana kao CI/integracioni target, uz produkcijski deploy isključivo
preko namenskog, strogo proverenog V2 release taga. Time `main` ostaje izvan V2
workflow-a i nastavlja da služi prezentacionom sajtu.

---

## 23. Problemi i zamke otkrivene tokom rada

### 23.1. Instalacija i generisanje klijenta

- Dependency stablo trenutno zahteva `npm install`/`npm ci` sa
  `--legacy-peer-deps` dok se paketi ne usklade.
- Prisma generate sa npm 11 ima ponašanje koje treba proveriti u čistom
  okruženju; CI je referentni ponovljivi put.
- Ne koristiti lokalni `node_modules` ili `.next` kao dokaz čistog builda.

### 23.2. Fontovi i pisma

Prodavnica koristi tekst na latinici i ćirilici. Google/font konfiguracija mora
uključiti `latin-ext` i `cyrillic`; samo `latin` izgleda ispravno na delu
stranica, a ostavlja fallback i različite metrike na drugima.

### 23.3. Dva mesta runtime teme

Promena boje u samo jednom config objektu nije dovoljna. Server layout i
provider/CSS promenljive moraju ostati usklađeni, inače SSR i hidrirani prikaz
mogu dati različit vizuelni rezultat.

### 23.4. Aktivne i mrtve komponente

`NavBar.tsx` je aktivan put u trenutnoj aplikaciji, dok pojedine starije
komponente kao `Header.tsx` više nisu stvarni ulaz. Pregled ili popravka mrtvog
fajla može dati lažni osećaj da je UI promenjen. Pre izmene treba pratiti import
lanac od layout-a.

### 23.5. Next.js 16 i TypeScript očekivanja

Stariji `@ts-expect-error` komentari mogu postati greška kada se promeni Next/
React tip. Typecheck mora ostati zaseban CI korak; build sam nije pouzdan popis
svih očekivanih tip grešaka.

### 23.6. Data URI i navodnici

SVG/data URI vrednosti unutar CSS/JS konteksta zavise od nivoa escaping-a.
Dupli navodnici ili neenkodovani specijalni znakovi mogu napraviti build koji
prođe, ali ne prikazuje ornament. Vizuelna provera i browser test ostaju
potrebni.

### 23.7. Portovi i zaostali procesi

`EADDRINUSE` pri E2E/dev radu često znači da prethodni Next proces još sluša na
portu, a ne da je kod neispravan. Ciljni port treba proveriti sa `ss -ltn` (ili
platformskim ekvivalentom) i zaustaviti samo tačno identifikovan test proces.

### 23.8. Minimalna širina headless browsera

Chromium/headless okruženje može ograničiti veoma male viewport vrednosti;
praktični minimum od približno 500 px ne zamenjuje proveru stvarnog mobilnog
layouta. E2E zato koristi definisan uređaj/viewport, a CSS treba ručno proveriti
i ispod/iznad breakpointa.

### 23.9. GitHub Pages i privatni repo

Pages često prvo mora biti ručno omogućen, a dostupnost zavisi od plana i
vidljivosti repozitorijuma. Neuspešan prvi deploy nije nužno problem generatora
ili linkova.

### 23.10. GitHub API rate limit

Neautentifikovani read-only upiti brzo troše limit. Hronologija zato treba da se
čuva u projektu, a automatizacija da koristi najmanje potrebne API pozive i
odgovarajući token bez ispisivanja kredencijala.

### 23.11. DreamWeb Anti-Bot

Imunify360 interstitial može vratiti HTML 200 umesto poslovnog API odgovora.
Takav hosting nije pouzdan za automatizovan checkout/payment callback dok se
ne obezbedi izuzetak i proveri stvarni POST tok.

### 23.12. Zastarela dokumentacija može biti opasnija od nedostatka dokumenta

Stari `backup.sh`, `restore.sh`, `server-setup.sh`, `ecosystem.config.js` i
README nose Planika/shopdemo putanje ili raniji način rada. Posebno je opasan
restore koji sadrži `DROP DATABASE`. Nijednu od tih skripti ne treba pokrenuti
na produkciji dok se ne prepiše, pregleda tačan target i uradi probni restore u
izolovanom okruženju.

---

## 24. Šta namerno nije urađeno

Sledeće nije propust predstavljanja rezultata, već svesno zadržana granica
ovog rada:

- V2 nije spojen u prezentacioni `main`;
- Draft PR #1 nije nasilno razrešen ili merge-ovan;
- produkcijski V2 aplikacioni deploy nije pokrenut;
- server, PM2, nginx, DNS, TLS i firewall nisu menjani bez posebnog rollout
  odobrenja;
- GitHub `production` tajne i variables nisu izmišljene niti upisane;
- stvarne `.env` vrednosti i privatni ključevi nisu čitani ili dokumentovani;
- kartično plaćanje nije uključeno;
- bankarski staging/HPP i sertifikacija nisu simulirani kao završeni;
- cleanup secret, apply i systemd timer nisu postavljeni na VPS;
- produkcioni `REVIEW` slučajevi nisu automatski rešavani;
- nije uveden refund bez provider i računovodstvenog ugovora;
- `CASH` porudžbine nisu automatski istekle po CARD pravilu;
- generički katalog nije proglašen završenim dok cart/order koriste `size`;
- legacy kolone nisu obrisane pre backfill/dual-read dokaza;
- nisu kopirani konkurentski tekstovi ili fotografije;
- nisu obavljene pravne tvrdnje niti uneti izmišljeni PIB/telefon/PDV podaci;
- produkcijska baza nije korišćena za testove;
- stari destruktivni restore nije pokrenut;
- zavisnosti nisu automatski nadograđene bez regresionog pregleda;
- nije pretpostavljena multi-tenant izolacija;
- ovaj izveštaj ne tvrdi da zeleni CI zamenjuje produkcioni smoke.

---

## 25. Aktuelno stanje

### 25.1. Git i GitHub stanje na preseku

| Stavka | Stanje |
| --- | --- |
| Remote V2 grana | `origin/verzija/v2.0-univerzalna-platforma` |
| Završni V2 merge | `79216213a3ad45d8d3be372aeb5f62dd5371cbe7` |
| Završni V2 tree | `762f004ce8774ef24f61b9231394b4afb8b84331` |
| Lokalni docs head pre ovog izveštaja | `4816b9319b376e741577536edea62d886a68665c` |
| Lokalni docs tree | isti `762f004c...` |
| `origin/main` | `200d8042987d32179465be4919565efea2892fd6` |
| PR #2–#6 | MERGED u V2 |
| PR #1 | OPEN, DRAFT, `CONFLICTING/DIRTY`, bez attached checkova |
| Poslednji objedinjeni kodni CI | run `33282336793`, SUCCESS |
| Poslednji exact-tree docs CI | run `33282725051`, SUCCESS |
| Deployment job | preskočen |

Radni branch pre pravljenja ovog izveštaja bio je dokumentaciona grana sa istim
stablom kao završni V2 merge. Sam izveštaj i prateća dopuna indeksa u
`IZMENE.md` predstavljaju isključivo dokumentacionu izmenu: ne menjaju runtime,
bazu, capability funkcije niti deployment stanje. Za njihov kasniji Git/PR
status merodavni su aktuelni branch i GitHub evidencija, a ne ovaj vremenski
presek.

### 25.2. Funkcionalno stanje

- prezentacioni `main` i V2 ostaju odvojeni;
- V2 može da se lintuje, typecheckuje, testira i izgradi;
- guest COD happy path je browser-testiran;
- server-authoritative quote/order/inventory/coupon tok postoji;
- kartični kod i state machine postoje, ali capability je isključen;
- četiri P1 hotfixa su spojena u V2;
- reservation cleanup postoji u kodu, ali nije operativno zakazan;
- generički katalog postoji na schema/API nivou, ali nije end-to-end aktivan;
- admin ima važne operativne preglede, ali nema kompletan backoffice;
- production release skripta postoji, ali environment nije popunjen i deploy
  nije izvršen.

### 25.3. Baza naspram aplikacije

Raniji kontrolisani production DB rad je dokumentovan kao završen: 42 tabele,
4 migracije, 0 drift i očuvani poslovni brojevi. Taj rezultat ne znači da je
aktuelna V2 aplikacija na serveru. Pre sledeće DB/app promene stanje se mora
ponovo nezavisno očitati; istorijski zapis nije dozvola za novu mutaciju.

---

## 26. Preostali P0/P1/P2 posao

Prioriteti u ovom odeljku znače:

- **P0** — capability/release NO-GO; ne uključivati ili ne reklamirati dok nije
  zatvoreno;
- **P1** — rešiti pre javnog V2 deploya ili neposredno pre otvaranja pogođenog
  toka;
- **P2** — sledeći hardening i razvojni sprint; važno, ali ne blokira svaki
  ograničeni COD pilot.

### 26.1. P0 — release i capability blokatori

#### P0.1. Odvojiti V2 release od prezentacionog `main`

PR #1 je OPEN/DRAFT, konfliktan prema `main` i nema attached checks. Još važnije,
njegov cilj je sada arhitektonski pogrešan: `main` objavljuje prezentacioni
GitHub Pages sajt. Ne treba samo „rešiti konflikte” i merge-ovati.

Izabrano je drugo rešenje: kanonska V2 grana je trajni CI/integracioni target,
a namenski tag je jedini repository-side ulaz u produkcijski job. U aktuelnoj
radnoj grani implementirano je:

1. PR i push CI vezan za `verzija/v2.0-univerzalna-platforma`;
2. uklanjanje prezentacionog `main` iz V2 workflow okidača;
3. verification-only `workflow_dispatch`;
4. tag-only production job sa strogim nazivom i V2 ancestry proverom;
5. V2 tree guard i odvojene CI/production concurrency grupe.

Repository-side P0 granica je zato implementirana u kodu, ali njeno prihvatanje
još zahteva zeleni CI na tačnom head SHA-u i integraciju u kanonsku V2 granu.
Spoljašnji GitHub Environment allowed-tag policy/ruleset, obavezni reviewer,
secrets/variables, zatvaranje ili arhiviranje PR-a #1 i samo kreiranje release
taga ostaju odvojeni koraci. Release tag, environment izmena i live deploy
namerno se ne rade do poslednje, posebno odobrene faze.

#### P0.2. Kartice moraju ostati isključene

Pre `CARD` capability uključivanja obavezno nedostaju:

- pisana potvrda banke o callback poljima i tačnom signature coverage-u;
- stvarni staging HPP purchase/cancel/failure/callback tok;
- operativni admin `REVIEW` inbox;
- provider reconciliation i procedura za konfliktne rezultate;
- refund ugovor i implementacija;
- idempotentni outbox za email/poslovne side-effecte;
- multi-tab, refresh, 429/5xx, timeout, lost-response i network-loss matrica;
- deployovan cleanup sa jakim secretom;
- kontrolisani dry-run, apply smoke, ponovni dry-run, timer i monitoring;
- real-PostgreSQL cleanup-vs-payment-start i cleanup-vs-callback test;
- produkcijski domen/HTTPS/proxy callback dokaz.

Do tada `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED` i serverski capability moraju ostati
isključeni; UI skrivanje samo po sebi nije dovoljna zaštita.

#### P0.3. Ne reklamirati potpuno generičke varijante pre end-to-end ugovora

Prisma modeli atributa/opcija postoje, ali aktivni cart, quote i order i dalje
prenose legacy `size` string. `OrderItem` nema stabilan `variantId` ni snapshot
svih izabranih opcija. To ne blokira trenutni ograničeni size storefront, ali
blokira obećanje da platforma bez dodatnog rada podržava proizvoljne kombinacije
boja+veličina, pakovanja+ukusa i slično.

Potrebno je:

- dodati stabilni `variantId` kroz cart → quote → order;
- sačuvati immutable snapshot naziva/vrednosti izabranih opcija u `OrderItem`;
- backfill postojeće podatke;
- uvesti dual-read uz metriku/fallback;
- prebaciti inventory i prikaz porudžbine;
- tek posle dokaza ukloniti legacy `size` ugovor.

### 26.2. P1 — auth, recovery i sesije

Aktuelni kod još ima sledeće nalaze:

- verify-email ruta ima javni `fallback-secret`;
- ista ruta menja korisnika/briše token pre nego što JWT encode uspe;
- auth cookie traje 30 dana, dok osnovna auth sesija traje 24 sata;
- login nema poseban rate limit/lockout;
- login ne zahteva `emailVerified`;
- registracija guta SMTP kvar, a korisniku pominje resend koji nije
  implementiran;
- reset zahtev vraća 500 samo kada postojeći nalog pogodi SMTP kvar, što može
  omogućiti enumeraciju;
- verification/reset tokeni su čitljivi u bazi umesto hashovani;
- promena lozinke ne opoziva postojeće JWT sesije;
- promena role može ostati keširana u postojećem JWT-u.

Preporučeni redosled popravke je:

1. centralni fail-closed auth secret;
2. atomski verify tok i usklađeno trajanje session/cookie;
3. generički, ne-enumerabilan reset odgovor i isti SMTP failure oblik;
4. concurrency-safe resend sa jednim aktivnim tokenom;
5. produkcioni audit/backfill `emailVerified` stanja;
6. tek zatim verified-login enforcement;
7. hashovani jednokratni tokeni;
8. `sessionVersion`/revocation i sveža role provera za osetljive radnje;
9. shared login limiter, lockout politika i po mogućstvu MFA za admin.

### 26.3. P1 — production dependency ranjivosti

Read-only `npm audit --omit=dev` na dan ovog preseka nalazi **13 produkcionih
nalaza: 1 critical, 8 high, 3 moderate i 1 low**. Direktno pogođeni paketi u
aktuelnom lockfile-u uključuju:

| Paket | Aktuelna verzija | Najviši prijavljeni nivo |
| --- | ---: | --- |
| `next-auth` | `4.24.13` | critical |
| `next` | `16.1.6` | high |
| `nodemailer` | `6.10.1` | high |
| `postcss` | `8.5.6` | high |
| `sharp` | `0.33.5` | high |
| `xlsx` | `0.18.5` | high; bez automatskog npm fixa |
| `next-intl` | `4.8.3` | moderate |

Next advisory skup uključuje Proxy/Middleware bypass, što je posebno važno jer
`proxy.ts` sprovodi deo admin/API politike. Ovo zahteva prioritetnu trijažu,
kontrolisane nadogradnje i kompletan regresioni CI. Za `xlsx` treba izabrati
održavanu/zamenjivu biblioteku ili jasno ograničiti/izolovati funkciju, ne samo
prihvatiti nalaz.

CI trenutno instalira sa `--no-audit`. Potrebno je dodati kontrolisan security
gate, Dependabot/Renovate, dependency review, CodeQL i SBOM politiku. Audit
rezultat je vremenski promenljiv i mora se ponoviti neposredno pre release-a.

### 26.4. P1 — COD stock abuse i rate limiting

CARD cleanup namerno ne dira `CASH`, dok je COD podrazumevano uključen. Jedan
checkout zahtev trenutno može imati do 100 linija i do 99 komada po artiklu.
Napadač zato može praviti lažne COD porudžbine i držati veliku količinu zalihe.

Trenutni limiter je procesni LRU sa ograničenim brojem ključeva i kratkim
prozorom; ne deli stanje između instanci i veruje prvom `X-Forwarded-For` bez
dovoljno eksplicitnog trusted-proxy ugovora.

Potrebno je:

- shared Redis/DB limiter po IP-u, nalogu, emailu i poslovnoj akciji;
- tačna lista trusted proxy hopova i kanonski client IP;
- niži/poslovno opravdan line/quantity limit;
- COD potvrda (email/telefon ili operater, zavisno od politike);
- definisan COD pending/confirmed/cancelled lifecycle;
- bezbedno, exactly-once oslobađanje zalihe za odbijenu/nepotvrđenu COD
  porudžbinu;
- monitoring neuobičajenih naloga/adresa/IP obrazaca.

Ne treba naslepo primeniti dvostatni CARD TTL na legitimne COD porudžbine.

### 26.5. P1 — newsletter subscribe, chat i wishlist cron

Newsletter **odjava** je popravljena, ali **prijava** još:

- nema double opt-in;
- nema rate limit ili captcha;
- može uključiti/reaktivirati adresu koju je uneo neko drugi;
- odgovorom otkriva deo statusa pretplate.

Potrebni su generički javni odgovori, pending-verification model, jednokratni
potpisani link, throttling/resend pravila i audit saglasnosti.

Chat limiter koristi rotabilnu korisničku email vrednost i mora preći na shared,
višedimenzionalnu politiku. Wishlist cron još menja stanje preko GET-a, koristi
prost secret compare/admin-cookie fallback, a POST samo delegira GET-u. Mora se
zameniti POST-only maintenance ugovorom sa jakim namenskim Bearer secretom,
constant-time proverom, dry-run/apply semantikom i testovima.

### 26.6. P1 — email HTML injection i prilozi

Centralni SMTP transport rešava TLS politiku, ali ne rešava sadržaj šablona.
Korisnički podaci se na više mesta interpoliraju direktno u HTML auth/order/
wishlist/contact/reclamation/job poruka.

Potrebno je:

- jedan email template renderer koji escape-uje sva dinamička polja;
- usko definisani bezbedni rich-HTML izuzeci;
- plain-text alternativa za svaku transakcionu poruku;
- testovi za `<script>`, HTML attribute i URL injection slučajeve;
- server-side detekcija MIME tipa/magic bytes za priloge;
- allow-list stvarnog sadržaja, ekstenzije i maksimalne veličine;
- bezbedno generisano ime priloga i zabrana path/control znakova;
- po potrebi antivirus/karantin pre prosleđivanja emailom.

Trenutna provera imena, ekstenzije i veličine sama nije dokaz da je fajl zaista
PDF/slika/dokument očekivanog tipa.

### 26.7. P1 — pravni, privacy i poslovni podaci

Pravne stranice još sadrže placeholder-e ili hardkodovane pretpostavke za:

- PIB, matični broj i telefon;
- PDV status/tvrdnju;
- City Express i cenu dostave 350 RSD;
- zastarelu referencu na određeni član;
- reklamacioni PDF koji ne postoji;
- dokumente za odustanak bez stvarnih linkova.

Pre javnog sajta treba uneti stvarne podatke trgovca, povezati tekst sa
capability/config pravilima, dodati stvarne obrasce i obaviti stručni pravni i
privacy pregled. Kod ne može sam potvrditi zakonitost poslovnog teksta.

### 26.8. P1 — produkciona operativa, licenca i zastareli runbookovi

V2 tree trenutno nema `LICENSE`, iako prezentacioni projekat ima odvojenu
licencnu istoriju. README još sadrži Node 18+, `cd EcommerceTemplate`, običan
`npm install`, Docker korake bez potrebnih fajlova i nepostojeći Hetzner vodič.

Posebno pregledati/prepisati ili arhivirati:

- `ecosystem.config.js` sa `shopdemo` vrednostima;
- `scripts/backup.sh` sa Planika putanjama/bazom;
- `scripts/restore.sh` sa starim targetima i destruktivnim `DROP DATABASE`;
- `scripts/server-setup.sh` sa nepinnovanim `curl | bash` i starim putanjama.

Pre deploya nezavisno potvrditi:

- domen, DNS, HTTPS, HSTS trenutak i reverse proxy;
- trusted forwarding i stvarni client IP;
- runtime secrets/variables i rotaciju;
- najmanje privilegije deploy/DB korisnika;
- backup plus probni restore;
- tačan migration plan i rollback granice;
- monitoring, log retention, error tracking i alerting;
- SMTP reputaciju/dostavljivost;
- GitHub environment zaštitu i obavezne reviewere.

### 26.9. P1 — najvažnije test-rupe

Pre javnog release-a dodati testove za:

- fail-closed NextAuth secret i atomski verify;
- session/cookie trajanje i session revocation;
- login rate limit/lockout i `emailVerified` matricu;
- reset enumeration i SMTP failure uniformnost;
- resend concurrency i jedan aktivni token;
- newsletter subscribe/double opt-in;
- newsletter unsubscribe route/component GET/POST, Prisma transakciju,
  zero-match i replay odgovor;
- shared limiter/trusted proxy;
- COD abuse/lifecycle/expiry;
- wishlist cron HTTP/auth/dry-run ugovor;
- email escaping i plain-text šablone;
- MIME/magic-byte priloge;
- dependency/security gate;
- ključne legal/config feature zastavice.

Za kartice dodatno nedostaju provider contract test, HPP E2E, refund/
reconciliation test, real-DB cleanup-vs-payment trke i mrežna failure matrica.

### 26.10. P2 — bezbednost i platforma

- Stroži CSP bez `unsafe-inline`, nakon inventara stvarno potrebnih izvora.
- HSTS uključiti tek posle potvrđenog, trajnog HTTPS-a.
- MFA za administratore i bolja admin session revocation politika.
- Centralni audit log sa actorom, internom napomenom i immutable događajima.
- Error tracking i korelacioni ID kroz checkout/payment/email.
- Idempotentni outbox za email i druge side-effecte.
- Build-once/deploy-same-artifact umesto ponovnog instaliranja/builda na serveru.
- Zero/minimal-downtime aktivacija i realan rollback test.
- Preciznije pinovanje Node/PostgreSQL/Playwright/runner verzija.
- Dependency review, Renovate/Dependabot, CodeQL i SBOM.
- Formalni accessibility regression suite i cross-browser matrica.

### 26.11. P2 — katalog i commerce roadmap

- ProductType/attribute/variant admin editor; API postoji, UI ne.
- Stabilni `variantId` i option snapshot kroz ceo kupovni tok.
- Dinamički filteri iz `AttributeDefinition` umesto hardkodovanih size/gender/
  shoe kontrola.
- Backfill, dual-read metrika i contract migracija legacy size sloja.
- Search po brendu/kategoriji, sinonimi i typo tolerance.
- Dublja category hijerarhija, kategorijski SEO meta i redirect/404 centar.
- Inventory ledger i audit svake promene zalihe.
- Account-synced korpa; trenutna korpa je tab-local `sessionStorage`.
- Quantity selector sa jasnom dostupnom količinom i server validacijom.
- Shipping zone, težina, dimenzije i kurirska pravila umesto flat-rate modela.
- Deterministički promotion priority/stacking i `FREE_SHIPPING` pravilo.
- Rezervacija `maxUses` i za automatske promocije.
- Jedinstvena decimal/rounding politika.

### 26.12. P2 — admin i post-purchase

- Ispraviti brand-edit bug gde se lokalizovani objekat prosleđuje `slugify(name)`.
- Kompletan users admin i role/session upravljanje.
- Order timeline sa actorom, internim beleškama i audit događajima.
- Shipment provider, tracking i parcijalna isporuka.
- Return/RMA i partial/full refund.
- Invoice/fiskalni/računovodstveni ugovor.
- Operativni `REVIEW` i payment reconciliation ekran.
- Inventory ledger, ručne korekcije sa razlogom i low-stock workflow.

### 26.13. P2 — storefront, sadržaj i dizajn

- Page builder i branšno podesiva početna; sadašnja početna je folk-specific.
- Zajednička medijateka za logo, favicon, OG, hero i proizvodne fotografije.
- Stvarne optimizovane fotografije sa alt politikom i pravima korišćenja.
- Puna i18n migracija UI/auth/admin/legal teksta; DB lokalizacija sama nije
  dovoljna.
- Prenos relevantnog sadržaja prezentacionog sajta u Articles bez gubitka
  izvora/licence.
- Mobile focus dorade i formalni design tokeni.
- Automatizovani axe/a11y audit, desktop Chromium, Firefox i WebKit scenariji.

### 26.14. P2 — ograničenja aktuelnih testova

Aktuelni test runner otkriva samo `lib/**/*.test.ts`; testovi smešteni pod
`app/**` ne ulaze automatski osim ako je logika izvučena u `lib`. Browser
pokriće je jedan Pixel 7/mobile Chromium guest COD happy path i koristi
development server.

Potrebno je proširiti discovery ili zadržati pravilo da testabilna route logika
živi u `lib`, a zatim dodati:

- production build/start E2E;
- desktop i druge browser engine-e;
- auth/admin/card/a11y tokove;
- promotion, admin-brand i variant editor integracione testove;
- negativne upload/email/legal/config scenarije.

---

## 27. Preporučeni redosled nastavka

Redosled je namerno zasnovan na riziku i zavisnostima, a ne na vizuelnoj
privlačnosti funkcije.

### Faza 1 — zaključati release granicu

1. Potvrđeno u kodu i dokumentaciji: `main` ostaje prezentacioni sajt.
2. Izabrano i implementirano u radnoj grani: V2 CI target plus tag-only release
   workflow, bez deploya sa dispatch-a ili push-a grane.
3. Sledeće: otvoriti PR ka kanonskoj V2 grani i dobiti zeleni CI na tačnom
   head SHA-u, zatim potvrditi zeleni push run posle integracije.
4. Zatvoriti/arhivirati Draft PR #1 da ne postane slučajan merge put.
5. Vratiti licencu, dovršiti README usklađivanje i označiti legacy skripte kao
   neupotrebljive.
6. Podesiti required CI/dependency/security gate za pravi V2 target.
7. GitHub Environment tag policy, reviewer, secrets, release tag i live
   aktivaciju ostaviti za završnu, posebno odobrenu fazu.

### Faza 2 — zatvoriti neposredne security P1 nalaze

1. Nadograditi/trijažirati critical/high zavisnosti, posebno Next/NextAuth.
2. Popraviti auth secret, verify/reset/resend i session revocation.
3. Uvesti shared rate limiting i trusted-proxy ugovor.
4. Zatvoriti COD stock-abuse lifecycle.
5. Uvesti newsletter double opt-in i popraviti wishlist maintenance ugovor.
6. Centralizovati email escaping i ojačati priloge.

Posle svake logičke grupe: ciljani testovi, kompletnih 103+ testova, lint,
typecheck, Prisma provere, E2E i build.

### Faza 3 — pravni i produkcioni readiness

1. Uneti proverene podatke trgovca i stvarne obrasce.
2. Uraditi stručni legal/privacy pregled.
3. Prepisati backup/restore/server runbookove.
4. Pripremiti domen, DNS, HTTPS, proxy, secrets, najmanje privilegije i
   monitoring.
5. Napraviti svež backup i dokazati restore u izolovanom okruženju.
6. Pokrenuti kompletan CI na tačnom release SHA-u.

### Faza 4 — ograničeni COD-only staging/pilot

1. Deployovati V2 sa karticama eksplicitno isključenim.
2. Proveriti `/api/health` SHA i DB status.
3. Uraditi javni smoke za katalog, auth, COD, admin i email.
4. Posmatrati logove, rate limit, zalihu, porudžbine i rollback.
5. Tek posle stabilnog pilota odlučiti o širem javnom puštanju.

### Faza 5 — reservation cleanup operativa

Cleanup je vezan za CARD rezervacije i nije potreban kao izgovor za prerano
uključivanje kartica. Kada staging bude spreman:

1. postaviti zaseban jak secret;
2. deployovati endpoint bez timera;
3. ručno pokrenuti dry-run;
4. pregledati agregate i pojedinačno razrešiti svaki `REVIEW` kroz internu
   operativu;
5. eksplicitno pokrenuti apply u kontrolisanom prozoru;
6. ponoviti dry-run i proveriti invarijante;
7. tek tada uključiti oneshot/timer i alerting.

### Faza 6 — bankarska sertifikacija i kartice

1. Potvrditi ugovor/potpis sa bankom.
2. Napraviti staging HPP test matricu.
3. Završiti `REVIEW`, reconciliation, refund i outbox.
4. Dodati real-DB payment/cleanup race i mrežne failure testove.
5. Proći formalni security i operativni review.
6. Uključiti capability prvo u stagingu, zatim kontrolisano u produkciji.

### Faza 7 — generički katalog i P2 roadmap

1. Stabilni variant/order snapshot ugovor.
2. Backfill i dual-read.
3. Admin editor za tipove/atribute/varijante.
4. Dinamički storefront filteri.
5. Inventory ledger, promocije, logistika i post-purchase.
6. Page builder, medijateka, i18n i širi E2E/a11y.
7. Contract uklanjanje legacy size sloja tek na kraju.

---

## 28. Produkcioni kontrolni spisak

Ovaj spisak je operativni gate. Stavka se označava tek uz dokaz, ne na osnovu
pretpostavke ili postojanja koda.

### 28.1. Repo i release

- [x] U kodu je definisan V2 CI/release target koji ne prepisuje
  prezentacioni `main`.
- [x] `workflow_dispatch`, PR i običan push V2 grane ne mogu pokrenuti
  produkcijski job.
- [x] Produkcijski job zahteva namenski tag, strogi format, V2 identitet stabla
  i commit iz kanonske V2 istorije.
- [ ] P0 workflow izmena je integrisana u kanonsku V2 granu uz zeleni PR i
  post-merge push CI na tačnim SHA vrednostima.
- [ ] Draft PR #1 je zatvoren/arhiviran ili zamenjen validnim release PR-om.
- [ ] GitHub Environment/ruleset dozvoljava samo `prodavnica-v2-*` tagove i
  zahteva review pre produkcijskog job-a.
- [ ] Namenski release tag je napravljen tek u odobrenoj završnoj live fazi.
- [ ] Tačan release SHA je pregledan.
- [ ] Required CI je zelen na tom SHA-u.
- [ ] Nema nerešenih merge konflikata.
- [ ] `git diff --check`, lint, typecheck, test, E2E i build su zeleni.
- [ ] Licenca i README odgovaraju V2 projektu.
- [ ] Legacy/destruktivne skripte su uklonjene, arhivirane ili prepisane.

### 28.2. Zavisnosti i bezbednost

- [ ] Ponovljen je `npm audit --omit=dev` neposredno pre release-a.
- [ ] Critical/high nalazi su popravljeni ili formalno, vremenski ograničeno
  prihvaćeni uz mitigaciju.
- [ ] Next/NextAuth proxy/auth advisories su zatvoreni.
- [ ] Dependency review/CodeQL/SBOM politika je aktivna.
- [ ] Auth secret nema fallback.
- [ ] Verify/reset/resend su ne-enumerabilni, atomski i testirani.
- [ ] Session revocation i admin role promena imaju jasan ugovor.
- [ ] Shared limiter i trusted-proxy model su dokazani.
- [ ] Newsletter double opt-in je aktivan.
- [ ] Wishlist maintenance je POST-only sa jakim Bearer secretom.
- [ ] Email HTML escaping i MIME/magic-byte provera su testirani.

### 28.3. Pravni i poslovni podaci

- [ ] Uneti su stvarni naziv, adresa, PIB, matični broj, kontakt i telefon.
- [ ] PDV tvrdnje odgovaraju stvarnom statusu.
- [ ] Dostava, cena, kurir i rokovi dolaze iz odobrene konfiguracije.
- [ ] Uslovi korišćenja, privatnost, reklamacije i odustanak su stručno
  pregledani.
- [ ] Svi obrasci i PDF linkovi postoje i testirani su.
- [ ] Consent/cookie/analytics politika odgovara stvarno uključenim servisima.

### 28.4. Infrastruktura i tajne

- [ ] Domen i DNS su potvrđeni.
- [ ] HTTPS sertifikat i automatska obnova rade.
- [ ] HSTS je uključen tek posle potvrde trajnog HTTPS-a.
- [ ] Reverse proxy prosleđuje samo očekivane headere.
- [ ] Aplikacija veruje samo poznatim proxy hopovima.
- [ ] Deploy i DB korisnik imaju najmanje potrebne privilegije.
- [ ] GitHub production environment ima review zaštitu.
- [ ] GitHub production environment odbija grane i tagove van odobrenog
  `prodavnica-v2-*` obrasca.
- [ ] Secrets/variables su postavljeni, validirani i imaju plan rotacije.
- [ ] `.env` ima ograničena prava i nije u release/Git istoriji.
- [ ] Logovi ne sadrže lozinke, tokene, kartične ili nepotrebne lične podatke.

### 28.5. Baza, migracije i backup

- [ ] Svež pre-deploy backup je napravljen i checksum sačuvan.
- [ ] Restore je uspešno dokazan u izolovanom okruženju.
- [ ] Migration history i checksum odgovaraju Git-u.
- [ ] `prisma migrate status` je pregledan.
- [ ] Drift je nula.
- [ ] DB invarijante prolaze.
- [ ] Očekivani broj ključnih redova je zabeležen pre i posle.
- [ ] Rollback granica je jasna; nema obećanja automatskog rollbacka
  nekompatibilne DB contract migracije.

### 28.6. COD-only aplikacioni pilot

- [ ] `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED=false` i serverski CARD capability je
  isključen.
- [ ] COD lifecycle i stock-abuse zaštita su završeni.
- [ ] Javni health vraća tačan deployment SHA i zdravu bazu.
- [ ] Katalog, pretraga, detalj, korpa i quote su smoke-testirani.
- [ ] Guest i nalog COD checkout su provereni.
- [ ] Potvrda porudžbine i admin prikaz rade.
- [ ] Email je provereno isporučen bez TLS bypass-a.
- [ ] Low-stock, rate-limit i error alerti rade.
- [ ] PM2/reverse proxy aktivacija i rollback su probani.
- [ ] Posle deploya nisu uočene neočekivane promene prezentacionog sajta.

### 28.7. Dodatni CARD gate

- [ ] Banka je potvrdila parametre, potpis i callback ugovor.
- [ ] Staging HPP happy/failure/cancel/replay tokovi prolaze.
- [ ] Multi-tab, refresh, timeout, 429/5xx i network-loss scenariji prolaze.
- [ ] `REVIEW` inbox i on-call vlasnik postoje.
- [ ] Reconciliation procedura i provider izvor istine su definisani.
- [ ] Refund tok je implementiran, autorizovan i auditovan.
- [ ] Idempotentni outbox je uključen.
- [ ] Cleanup-vs-payment real-DB trke prolaze.
- [ ] Cleanup secret je jak i zaseban.
- [ ] Dry-run/apply/ponovni dry-run smoke je dokumentovan.
- [ ] Timer, monitoring i alert za partial failure rade.
- [ ] Kartice se uključuju prvo u stagingu, zatim kroz odobren produkcijski
  rollout.

### 28.8. Posle deploya

- [ ] Proveren je javni SHA health.
- [ ] Provereni su error rate, latencija, DB konekcije i resursi procesa.
- [ ] Proverene su stvarne porudžbine/zalihe/kuponi bez ručne DB izmene.
- [ ] SMTP bounce/delivery i queue/outbox nemaju neočekivan backlog.
- [ ] Backup posle migracije je napravljen prema politici.
- [ ] Rollback odluka ima imenovanog vlasnika i vremenski prag.
- [ ] Dokumentovani su tačan release SHA, vreme, migracije, rezultat i incidenti.

---

## 29. Referentna dokumentacija

Ovaj dokument je najlakši za čitanje kao pregled, a sledeći fajlovi nose
specijalizovane detalje:

- [`../IZMENE.md`](../IZMENE.md) — aktuelni kratki pregled, pravila grana i
  status glavnih celina;
- [`DETALJAN-DNEVNIK-IZMENA.md`](./DETALJAN-DNEVNIK-IZMENA.md) — hronološki
  dnevnik od prezentacionog sajta do svih V2 hotfixeva;
- [`ARCHITECTURE-V2.md`](./ARCHITECTURE-V2.md) — arhitektonske granice,
  white-label slojevi i odluke;
- [`CATALOG-MIGRATION-PLAN.md`](./CATALOG-MIGRATION-PLAN.md) — generički katalog,
  expand/backfill/dual-read/contract faze;
- [`PRISMA-BASELINE.md`](./PRISMA-BASELINE.md) — baseline, migracije, drift,
  checksum i DB dokaz;
- [`V2-ROLL-OUT.md`](./V2-ROLL-OUT.md) — release i reservation-cleanup runbook;
- [`GITHUB-DEPLOY.md`](./GITHUB-DEPLOY.md) — GitHub environment, secrets i
  deployment tok;
- [`../README.md`](../README.md) — opšti ulaz u projekat, uz napomenu da
  zastarele V2 setup delove treba uskladiti pre produkcione upotrebe;
- [GitHub Actions run `33282336793`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33282336793)
  — poslednji zeleni objedinjeni kodni presek;
- [GitHub Actions run `33282725051`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33282725051)
  — zeleni dokumentacioni head sa istim tree-em kao završni V2 merge;
- [PR #6](https://github.com/biozencaj-stack/narodnanosnja/pull/6) — završna
  integraciona dokumentacija;
- [PR #1](https://github.com/biozencaj-stack/narodnanosnja/pull/1) — istorijski
  Draft ka `main`, trenutno konfliktan i nije operativni release put.

---

## 30. P0 release granica za V2

Ovaj odeljak je operativna dopuna vremenskom preseku iz ostatka izveštaja. On
beleži repository-side P0 izmenu implementiranu u radnoj grani
`ispravka/v2-release-granica`. Ne menja istorijske tvrdnje o ranijim PR-ovima,
commitovima i CI runovima, već zamenjuje ranije operativno pravilo po kojem su
`main` ili ručni dispatch mogli da budu produkcijski deploy ulaz.

### 30.1. Problem koji je granica zatvorila

Isti GitHub repozitorijum sadrži dva različita projekta:

- prezentacioni sajt, čiji `main` ide na GitHub Pages;
- V2 Next.js/Prisma prodavnicu, čija je kanonska grana
  `verzija/v2.0-univerzalna-platforma`.

Staro V2 workflow pravilo je produkcijski job vezivalo za `main` i dozvoljavalo
`workflow_dispatch`. To je stvaralo dve klase rizika: V2 deploy put je zavisio
od grane drugog projekta, a ručno pokretanje je imalo šire ovlašćenje od obične
verifikacije. Novi model eksplicitno razdvaja tri stvari: integracioni CI,
odobreni release identitet i stvarnu live aktivaciju.

### 30.2. Nova matrica okidanja

| Događaj/ref | `Provera verzije` | `Potvrdi V2 release` | `Objavi na produkciju` |
| --- | --- | --- | --- |
| PR ka `verzija/v2.0-univerzalna-platforma` | pokreće se | preskočen | preskočen |
| Push na kanonsku V2 granu | pokreće se | preskočen | preskočen |
| V2 `workflow_dispatch` | ručna provera | preskočen | preskočen |
| Push taga `prodavnica-v2-*` | pokreće se | proverava identitet pre Environment-a | moguć tek posle oba uspešna posla |
| Push na prezentacioni `main` | nije V2 okidač | nije okidač | nije okidač |
| Drugi branch ili proizvoljan tag | nije okidač | nije okidač | nije okidač |

Glob `prodavnica-v2-*` služi samo da GitHub uopšte napravi release-tag run.
Unutar neprodukcijskog release-gate job-a važi stroži format:
`^prodavnica-v2-[0-9]{8}-[1-9][0-9]*$`, odnosno praktično
`prodavnica-v2-YYYYMMDD-N`. Zbog toga tag koji samo deli prefiks, ali nema
odobren oblik, ne može proći deploy guard.

### 30.3. Fail-closed identitet koda i release commit

Verify job pre instalacije zavisnosti proverava da checkout zaista liči na V2
prodavnicu. Zahteva `package.json`, zaključani npm manifest, Next konfiguraciju,
Prisma šemu, deploy skriptu i health rutu, a istovremeno odbija
`scripts/build.mjs`, koji pripada prezentacionom generatoru.

Poseban `Potvrdi V2 release` job posle CI-ja ponavlja ključne V2 identitetske
zahteve i dodatno traži:

1. da je GitHub ref zaista tag;
2. da naziv taga odgovara strogom release obrascu;
3. da je `GITHUB_SHA` predak
   `origin/verzija/v2.0-univerzalna-platforma`.

Release-gate i deploy checkout zato koriste kompletnu istoriju
(`fetch-depth: 0`), kako bi
ancestry provera bila zasnovana na Git istoriji, a ne na pretpostavci iz naziva
taga. I verify i deploy checkout imaju `persist-credentials: false`, pa GitHub
token ne ostaje upisan u checkout konfiguraciji.

Ovi uslovi znače da tag sa odgovarajućim nazivom, ali napravljen nad commitom
izvan kanonske V2 istorije, pada pre otvaranja `production` Environment-a.
Produkcijski job iste uslove ponavlja pre SSH pripreme. Isto važi za checkout
prezentacionog stabla. Repository workflow zato ne zavisi samo od ljudskog
sećanja da je izabran pravi commit.

### 30.4. Concurrency i supply-chain detalji

Concurrency je razdvojen prema posledici run-a:

- svaki PR ima svoju otkazivu CI grupu;
- branch push i ručni dispatch imaju otkazivu CI grupu po ref-u;
- samo release-tag push koristi jednu serijsku produkcionu grupu za repozitorijum;
- produkcijski tag run se ne prekida kada stigne noviji run.

Time ručna provera više ne zauzima niti imitira produkcijski deploy red, dok se
dva live pokušaja ne mogu izvršavati paralelno. `actions/checkout` i
`actions/setup-node` ažurirani su i pinovani na pune commit SHA vrednosti za
v7 izdanja, uz zadržanu minimalnu workflow dozvolu `contents: read`.

### 30.5. Šta je implementirano, a šta namerno nije aktivirano

| Sloj | Stanje u ovoj fazi |
| --- | --- |
| V2 workflow triggeri | implementirani u radnoj grani |
| Dispatch kao verification-only | implementirano u uslovu produkcijskog job-a |
| Tag format i V2 ancestry guard | implementirani u workflow kodu |
| Pre-Environment release-gate job | implementiran posle CI-ja, pre production Environment-a |
| V2 naspram presentation tree guard | implementiran pre verifikacije/deploya |
| CI naspram production concurrency | implementirano u workflow kodu |
| Zeleni exact-head PR CI | obavezan sledeći dokaz; nije pretpostavljen |
| Zeleni post-merge V2 push CI | obavezan posle integracije; nije pretpostavljen |
| GitHub Environment allowed-tag policy/ruleset | spoljašnja postavka, ostavljena za završnu fazu |
| Obavezni production reviewer | spoljašnja postavka, ostavljena za završnu fazu |
| Production secrets i variables | nisu popunjavani ovom izmenom |
| Namenski release tag | nije napravljen |
| SSH/server, DNS/TLS/proxy ili PM2 | nisu kontaktirani niti menjani |
| Live deploy i kartični capability | nisu aktivirani |

Ova razlika je namerna. Workflow kod sada postavlja neophodnu unutrašnju
granicu, ali nije dovoljan dokaz da je spoljna GitHub zaštita uključena ili da
je produkcija spremna. Environment allowed-tag pravilo, required reviewer i
odgovarajući ruleset treba da budu nezavisan drugi sloj. Njihovo podešavanje,
kao i unos tajni, ostaje neposredno pre odobrenog live release-a kako razvojni
push ili ručna provera ne bi imali produkcijske posledice.

### 30.6. Lokalni dokaz P0 radne grane

Pre PR-a su nad aktuelnim radnim stablom završene sledeće provere:

| Provera | Rezultat |
| --- | --- |
| `actionlint 1.7.12 .github/workflows/objavi.yml` | prolazi bez nalaza |
| lokalna release-gate simulacija | validan V2 tag/ancestor prolazi; pogrešan format taga pada |
| `git diff --check` | prolazi |
| relativne Markdown veze i interni anchor-i | svi postoje |
| `npm run lint -- --quiet` | prolazi |
| `npm run typecheck` | prolazi |
| `npm test` | 103 ukupno; 102 prolaze; 1 opt-in DB test očekivano preskočen lokalno |
| `npm run build` sa neprodukcijskim CI vrednostima | prolazi |

Build bez lokalnog PostgreSQL servisa emituje očekivane poruke da dinamički
podaci nisu dostupni i koristi bezbedne storefront podrazumevane vrednosti, ali
završava uspešno. To nije zamena za CI: PR provera mora podići PostgreSQL 16,
primeniti migracije, uključiti opt-in DB test i izvršiti Chromium E2E.

Zvanični GitHub tag ref-ovi su read-only proverom potvrđeni baš na pinovanim
SHA vrednostima: `actions/checkout@v7.0.1` na
`3d3c42e5aac5ba805825da76410c181273ba90b1` i
`actions/setup-node@v7.0.0` na
`820762786026740c76f36085b0efc47a31fe5020`.

### 30.7. Obavezan redosled pre prvog live V2 release-a

1. Lokalno validirati workflow sintaksu i kompletan V2 test paket.
2. Otvoriti PR isključivo ka kanonskoj V2 grani.
3. Potvrditi zeleni CI na tačnom PR head SHA-u i preskočen production job.
4. Integrisati promenu u V2, bez dodirivanja prezentacionog `main`.
5. Potvrditi zeleni push CI na tačnom kanonskom V2 SHA-u i ponovo preskočen
   production job.
6. Zatvoriti ili arhivirati stari Draft PR #1 ka `main`.
7. Završiti P1/security, pravne, serverske, backup/restore i operativne gate-ove.
8. Tek u poslednjoj odobrenoj fazi podesiti GitHub production Environment,
   ruleset, reviewer, secrets i variables.
9. Tek tada napraviti namenski release tag nad već proverenim kanonskim V2
   commitom i odobriti produkcijski job.
10. Posle objave proveriti javni health SHA, ključne smoke tokove, monitoring i
    rollback kriterijume.

Do koraka 9 nijedna aktivnost iz ove P0 sekcije ne pušta sajt live. To je
ključni operativni rezultat promene: svakodnevni V2 PR, branch push i ručna
provera ostaju bez produkcijske posledice, dok live zahteva poseban identitet,
posebnu spoljnu zaštitu i eksplicitno odobren poslednji korak.

---

## Završna napomena

Najveći deo tehničke osnove je urađen: postoji ozbiljan V2 commerce sloj,
kontrolisana DB evolucija, kompletan CI, bezbedniji payment/order model, četiri
naknadna P1 hotfixa i release mehanizam sa rollbackom. Repository-side V2
release granica je implementirana u radnoj grani, ali njeni exact-SHA CI dokazi
i spoljašnja GitHub/live zaštita još nisu završeni. Najveći preostali rizik nije
jedna izolovana funkcija, već poslednji kilometar: prihvatanje release granice,
critical/high dependency i auth hardening, abuse/consent/email zaštita, pravni
podaci i stvarna produkciona operativa.

Dok se ti gate-ovi ne zatvore, tačna tvrdnja je: **V2 je razvijen i proveravan
kao odvojena platforma, ali nije produkcijski pušten; kartice ostaju
isključene; prezentacioni `main` ostaje netaknut.**
