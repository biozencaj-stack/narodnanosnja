# Izmene — dnevnik rada

Zapis svega što je urađeno na projektu narodne nošnje, sa razlozima i zamkama
na koje se naišlo. Namenjeno je i tebi i svakom ko posle preuzme rad.

Poslednja dopuna: 29. avgust 2026.

## Gde je koji dokument

Zapisa ima više i lako je otvoriti pogrešan. Poređano po dubini:

| Dokument | Obim | Šta pokriva |
| --- | --- | --- |
| **`docs/DETALJAN-DNEVNIK-IZMENA.md`** | 2209 linija, 33 odeljka | **Najdetaljniji zapis.** Svaka V2 izmena, fajl po fajl: bezbednosne granice, checkout, admin politika, Prisma šema, CI/CD, poznati blokatori |
| Ovaj fajl (`IZMENE.md`) | ~500 linija | Hronologija i odluke — zašto je nešto urađeno tako |
| `docs/ARCHITECTURE-V2.md` | 4 KB | Arhitektonske granice platforme |
| `docs/CATALOG-MIGRATION-PLAN.md` | 10 KB | Redosled prelaska na generički katalog |
| `docs/V2-ROLL-OUT.md` | 6 KB | Postupak puštanja V2 u produkciju |
| `docs/GITHUB-DEPLOY.md` | 5 KB | Podešavanje objavljivanja |
| `docs/PRISMA-BASELINE.md` | 3 KB | Baseline migracija |
| `PREGLED_PROJEKTA_2026-08-29.md` | 770 linija | U repou prezentacionog sajta — read-only pregled **oba** dela projekta |

Ako tražiš „šta je tačno promenjeno u kodu“ — `docs/DETALJAN-DNEVNIK-IZMENA.md`.
Ovaj fajl je ulazna tačka i objašnjava razloge, ne pojedinačne izmene.

---

## Šta je projekat

Projekat ima **dva odvojena dela**, u dva radna direktorijuma ali — od 29.
avgusta — u **jednom zajedničkom GitHub repozitorijumu**:

| Deo | Radni direktorijum | Grana na GitHubu | Stanje |
| --- | --- | --- | --- |
| **Prezentacioni sajt** | `~/Desktop/narodnja nosnja` | `main` | Uživo na GitHub Pages |
| **Prodavnica** | `~/Desktop/narodnanosnja-prodavnica` | `verzija/v2.0-univerzalna-platforma` | Radi na serveru, nije puštena u produkciju |

Oba guraju u `biozencaj-stack/narodnanosnja`.

Zamišljeno je da se vremenom spoje kao sajt — građa o nošnjama da pređe u
Articles prodavnice, pa da postoji jedan sajt umesto dva. To je sadržajno
spajanje i **nema veze sa git spajanjem grana**, koje je zabranjeno (vidi
sledeći odeljak).

### ⚠️ Granu prodavnice nikada ne spajati u `main`

Dve istorije su nastale odvojeno — prodavnica je počela kao zaseban `git init` —
pa u repou postoje **dva nepovezana korena**. Push na `main` pokreće
objavljivanje prezentacionog sajta na GitHub Pages; spajanje grane prodavnice
tamo bi oborilo build ili objavilo pogrešan sadržaj na javnu adresu.

Git ionako odbija takvo spajanje bez `--allow-unrelated-histories`, ali to je
**slučajna zaštita, ne namerna** — ne oslanjati se na nju.

Ostale grane na remote-u: `verzija/v2.0-prodavnica` (napuštena statička
prodavnica) i `arhiva/v2-pre-github-2026-08-29` (arhiva stanja pre objave).

Trajno rešenje je razdvajanje u dva repozitorijuma.

---

## I. Prezentacioni sajt

### Zašto tako

Traženo je da sajt bude jednostavan za održavanje i da se objavljuje sam. Zato
je napisan **sopstveni generator statičkog sajta u čistom Node.js-u, bez ijedne
npm zavisnosti**. Nema `package.json`, nema `node_modules` — CI nema šta da
instalira i ništa ne može da se pokvari samo od sebe.

### Šta je napravljeno

- **8 regionalnih tipova nošnje**, svaki sa zasebnom stranicom: Šumadija,
  Vojvodina, zapadna Srbija, istočna Srbija, južna Srbija, Kosovo i Metohija,
  Stari Vlah i Raška, Mačva i Podrinje. Svaka nosi žensku i mušku nošnju,
  materijale, tehnike i zanimljivost.
- **Pojmovnik** sa 26 pojmova, pretragom i filtriranjem po 8 grupa.
- **Tehnike izrade** — od lana i konoplje do zlatoveza i šlingeraja.
- **Gde videti** — muzeji, etno-parkovi i manifestacije.
- **Prebacivanje latinica ⇄ ćirilica** jednim klikom, sa tačnom obradom
  digrafa (nj → њ, lj → љ, dž → џ) i izuzecima za reči gde to nisu jedan glas.
- Tamna tema, prilagođen prikaz na mobilnom, bez praćenja i kolačića.
- **Ornamenti kao generisane SVG šare** — po jedna za svaki kraj, bez ijedne
  slike.

### Ključne odluke

- **Sve veze između stranica su relativne.** Svaka stranica dobija prefiks do
  korena (`./`, `../`, `../../`), pa sajt radi i na korenu domena i u
  pod-fascikli. Jedini izuzetak je `404.html`, koja se servira sa proizvoljne
  dubine pa koristi apsolutne putanje.
- **`scripts/proveri-veze.mjs`** proverava da nijedna od 363 interne veze nije
  polomljena. Deo je CI-ja i obara objavljivanje ako ne prođe.
- **`scripts/proveri-uzivo.mjs`** obilazi objavljeni sajt preko mreže i
  proverava statuse, naslove, resurse i da 404 zaista vraća 404.

### Objavljivanje

- `.github/workflows/objavi.yml` — push na `main` gradi i objavljuje na GitHub Pages.
- `.github/workflows/provera.yml` — grane i pull request-i se samo grade i
  proveravaju, bez objavljivanja.

Uživo: <https://biozencaj-stack.github.io/narodnanosnja/>

### Zamke koje su pojele vreme

1. **Dvostruki navodnici u `style` atributu.** Funkcija `dataUri()` je vraćala
   `url("data:…")`, a ta vrednost završava u HTML `style` atributu — dvostruki
   navodnik je prekidao atribut i **nijedna šara se nije videla**. Popravljeno
   prelaskom na jednostruke navodnike. Zapisano u `CLAUDE.md` da se ne ponovi.
2. **Pages se ne uključuje sam.** Korak „Podesi Pages“ je padao dva puta.
   Token iz workflow-a ne može da uključi GitHub Pages **prvi put** — to mora
   ručno, kroz Settings → Pages → Source: GitHub Actions.
3. **Privatan repo + besplatan plan = nema Pages.** Repo je prebačen u javni.
4. **Headless Chrome ima najmanju širinu 500px.** Snimak na 414px je izgledao
   kao da sadržaj prelazi ekran — bio je samo skaliran. Provera preko
   `scrollWidth` je pokazala da preliva nema.

---

## II. Zašto se prešlo na gotovu platformu

Prvo je početa **statička prodavnica** — katalog i korpa u istom generatoru.
Napravljeni su podaci (6 kategorija, 18 proizvoda), logika korpe u
`localStorage`-u i stranice prodavnice.

Onda se ispostavilo da na sopstvenom serveru već stoji
**`ecommerce-cms-template`** — Next.js 16 + Prisma + PostgreSQL + NextAuth, sa
punim CMS-om, korpom, checkout-om, nalozima kupaca, plaćanjem pouzećem i
karticom, i pravnim stranicama propisanim za webshop u Srbiji.

Odluka: **ne pisati ponovo ono što već radi.** Statička prodavnica je
napuštena; njeni podaci o proizvodima su prebačeni u novu platformu.

### Šta je još pregledano i odbačeno

- **Planika CMS** na DreamWeb hostingu (`demoplanika.designjust4you.com`) —
  takođe Next.js + Prisma, sa NestPay integracijom. **Odbačeno:** na serveru
  postoji samo `.next/standalone` build, izvornog koda nema. Iz minifikovanog
  bundle-a se ne može razvijati. Upotrebljiva je samo njegova
  `prisma/schema.prisma` sa modelom za NestPay transakcije.
- **DreamWeb hosting za prijem porudžbina** — **odbačeno.** Imunify360
  Anti-Bot tamo presreće POST zahteve ka PHP krajnjim tačkama i vraća
  interstitial stranu; zbog toga kontakt forma na `izradawebsajta.co` nije
  radila. Izgubljena porudžbina je skuplja od izgubljene poruke.

---

## III. Postavljanje prodavnice

### Osnova

`ecommerce-cms-template` je preuzet sa servera (2.8 MB izvora, 519 fajlova,
bez `node_modules`, `.next` i `.env`) i stavljen u git kao nov projekat.

### Izmene u odnosu na template — commit `b350099`

- **Paleta** prebačena na etno boje: duboka crvena `#a4161a`, srma-zlatna
  `#b98f21`, lan `#faf6ed`, tamno drvo `#2c231b`. Iste boje nosi i
  prezentacioni sajt, da oba dela izgledaju kao jedna celina.
- **Fontovi** promenjeni iz Libre Baskerville + Roboto u Playfair Display +
  Inter (kasnije opet promenjeni, vidi V).
- **Fontovima dodati podskupovi `latin-ext` i `cyrillic`.** Zatečeni
  `Libre_Baskerville` je imao samo `latin` — srpske dijakritike (č, ć, š, ž, đ)
  bi tiho pale na rezervni font. Tiha greška koju je lako prevideti.
- Dodati `.gitignore` i `.env.example`. Pravi `.env` **nije preuzet** — u njemu
  su tajne.

### Server

Sve radi na Hetzner VPS-u `SERVER_HOST` (`ssh` alias `kockica`), pored
postojećih aplikacija koje **nisu dirane** (`shopdemo`, `kore`, `kockica`).

| Stavka | Vrednost |
| --- | --- |
| Kod | `/var/www/narodnanosnja` |
| PM2 proces | `narodnanosnja`, port **3007** |
| nginx | `/etc/nginx/sites-available/narodnanosnja`, port **8090** |
| Baza | PostgreSQL 16, `narodnanosnja_db`, korisnik `nosnja` |
| Adresa | <http://SERVER_HOST:8090/> |
| Admin | `/admin` |

**Zauzeti portovi na tom serveru: 3000, 3001, 3002, 8000, 8080.** Prvi pokušaj
je pao na `EADDRINUSE` jer je 3001 delovao slobodno a nije bio — proveriti
`ss -ltn` pre svakog novog procesa.

### Baza

`npx prisma db push` je napravio **31 tabelu**. Modeli koje platforma nosi:
User, Session, PasswordReset, EmailVerification, Wishlist, Address, Order,
OrderItem, Transaction, Banner, Setting, SizeTable, TickerMessage,
NewsletterSubscriber, Newsletter, NewsletterImage, ProductReview, Product,
ProductVariant, Color, Category, ProductCategory, Brand, ProductSize, Article,
Promotion, PromotionProduct, CouponUsage, ChatFAQ, ChatMessage, StoreLocation.

---

## IV. Uvoz proizvoda — commit `d21e52a`

### Podaci

`podaci/` nosi **6 kategorija** i **18 proizvoda**, isti JSON koji je koristio i
statički sajt:

- Šalovi i ešarpe (4), Tkanice i pojasevi (4), Torbe i torbice (3),
  Ćilimi i prostirke (2), Nošnja i delovi (3), Suveniri i sitnice (2).

**Sadržaj je sopstveni.** Sa poslatih linkova konkurencije
(malasrpskaprodavnica, looms.rs, kalem-tkano, serbianshop, olx) **nije preuzet
nijedan tekst ni slika** — korišćeni su samo kao orijentir za tipove proizvoda,
atribute i raspon cena. Preuzimanje njihovih opisa i fotografija bilo bi
kršenje autorskog prava.

### Skript za uvoz

`scripts/uvoz-nosnja.ts` upisuje podatke **preko `slug`-a**, pa se može
pokretati više puta bez dupliranja i **ništa ne briše**.

Mapiranja koja nisu očigledna:

- **Sniženje:** puna cena ide u `price`, snižena u `salePrice`, `onSale = true`.
  Tako sajt sam precrtava staru cenu i računa procenat.
- **`stanje: rasprodato`** → veličina „Univerzalna“ sa zalihom 0.
- **`stanje: po-porudzbini`** → zaliha 99 (može se naručiti, samo se duže čeka).
- **Dimenzije** se parsiraju iz teksta („180 × 45 cm“) u polja `length` i
  `width`; ceo tekst ostaje i u opisu, jer ga kupac tamo traži.
- **Engleski prevodi ne postoje** — u svim `{ sr, en }` poljima stoji srpski.

> Posle prvog uvoza proizvode uređuj kroz admin panel, **ne** kroz JSON —
> ponovni uvoz bi pregazio izmene urađene u panelu.

---

## V. Redizajn — commit-i `283af3f` i `73fe43f`

Grana `verzija/v1.1-redizajn-radionica`. Traženo je da se dizajn i font promene
iz temelja i prilagode potrebama. Izabran pravac: **radionica** — toplo i
rukotvorno.

### Tipografija

**PT Serif + PT Sans** umesto Playfair Display + Inter. PT porodica je crtana
za ćirilicu, pa srpska slova nisu naknadno dodata nego deo osnovnog pisma.
Oba fonta učitana sa `latin`, `latin-ext` i `cyrillic` podskupovima.

### Identitet

- **Podloga prebačena na boju lana i hartije** (`#faf6ed`, sekcije `#f2ead9`,
  kartice `#fffdf6`). Čisto belo je ubijalo utisak rukotvorine.
- **`components/ukras/index.tsx`** — novo. Tkane šare kao SVG, bez ijedne
  slike: romb sa krstom, osmokraka rozeta, cik-cak, stepenasti krst, grančica i
  kuka. Uz njih ornamentna traka i znak radionice.
- **Logo** — `components/layout/Logo.tsx`, znak sa rozetom i ispisano ime
  „Народна ношња / ручно ткано“. **Namerno je komponenta a ne slika:** SVG
  učitan kroz `<img>` ne može da povuče PT Serif, pa bi ime bilo ispisano
  sistemskim serifom i odudaralo od ostatka sajta.
- Zamenjen i `public/logo.svg` (za admin panel i stranice prijave, gde se logo
  i dalje učitava kao slika).
- **Proizvod bez fotografije** više ne prikazuje praznu sivu kutiju nego tkanu
  šaru, stabilno vezanu za identifikator proizvoda da se motiv ne menja pri
  svakom prikazu.

### Početna strana

Izbačeno kao besmisleno za ručni rad: odbrojavanje rasprodaje, Instagram,
brendovi, statistika, iskustva kupaca, parallax baner.

Dodato u `components/home/nosnja.tsx`:

- **Hero radionice** — „Svaki komad je jedinstven“, sa tkanim uzorcima.
- **Traka vrednosti** — rađeno rukom, nema dva ista, pouzeće, isporuka.
- **Kategorije** — povlače se iz baze, svaka sa svojom šarom.
- **Kako nastaje jedan komad** — četiri koraka: vuna i lan, bojenje, razboj,
  rese i dorada. Ovo je duša radioničkog pravca.
- **Priča o krajevima** — veza ka građi o nošnjama.

### Kartica proizvoda

- **Zamena fotografije pri prelasku mišem.** `fetchProducts` je `image2` već
  vraćao, kartica ga prosto nije koristila.
- Oznake „Novo“ i sniženje prebačene sa podrazumevane plave i crvene na zlatnu
  i crvenu iz palete.

### Otkriće pri radu

**Zaglavlje ide kroz `components/layout/NavBar.tsx`, a ne kroz `Header.tsx`.**
`Header.tsx` je mrtav kod iz template-a — prve izmene loga su otišle u njega i
nisu se videle na sajtu.

---

## VI. Objavljivanje

### Prezentacioni sajt

Radi. Push na `main` gradi i objavljuje na GitHub Pages.

### Prodavnica

`.github/workflows/objavi.yml` je napisan i spreman:

1. Na runner-u radi zaključani install, Prisma/TypeScript provere, sigurnosne
   testove i produkcijski build.
2. Preko verifikovanog SSH host ključa šalje kod u zaseban release direktorijum;
   `.env` i `public/uploads` ostaju shared i ne mogu biti obrisani rsync-om.
3. Server proverava usklađenost baze, gradi i smoke-testira release pre nego što
   atomski promeni `current` link i podigne novu PM2 verziju.
4. Lokalni i javni health endpoint moraju potvrditi SHA novog commita. Greška
   ili prekid tokom aktivacije vraćaju prethodni zdravi release.

Detaljna podešavanja secrets/variables su u `docs/GITHUB-DEPLOY.md`.

**Blokira ga to što repozitorijum `narodnanosnja-prodavnica` na GitHubu još ne
postoji.** SSH ključ daje pravo da se gura, ali ne i da se repo napravi.

### Ključ za objavljivanje

Napravljen je **zaseban ključ** `~/.ssh/narodnanosnja_deploy`, ovlašćen
isključivo na ovom serveru. Namerno **nije** lični ključ naloga: ako GitHub
tajna ikada procuri, povlači se samo taj ključ, a pristup GitHub nalogu i
ostalim serverima ostaje netaknut.

Povlačenje, ako zatreba:

```bash
ssh SERVER_USER@SERVER_HOST "sed -i '/narodnanosnja-deploy/d' ~/.ssh/authorized_keys"
```

### Spajanje redizajna u main — commit `c7893fc`

Grana `verzija/v1.1-redizajn-radionica` je spojena u `main` 27. avgusta.
`main` sada nosi kompletan redizajn (radionica, PT tipografija, tkani
ornamenti, nova početna, kartica proizvoda) i spreman je za prvi push čim
repo na GitHubu bude postojao.

---

## VII. Planovi i merila

Pored koda, napravljena su dva dokumenta koja vode dalji rad. Objavljeni su
kao artefakti (privatne stranice na claude.ai), pa ovde stoje veze i sažetak.

### Plan izgradnje — osam faza

<https://claude.ai/code/artifact/8e0c8d30-f869-409a-a8ff-41135abc5d77>

Popis zatečenog stanja (šta postoji, šta delom, šta nedostaje) i redosled
rada. **Faze idu po zavisnosti, ne po vidljivosti** — filteri ne mogu biti
dobri dok proizvod nema polja po kojima se filtrira.

1. **Temelj: šta je uopšte proizvod** — atributi tkanja (tehnika, kraj
   porekla, sastav, dimenzije), varijante, stanja zalihe.
2. **Katalog, filtriranje i pretraga** — pravi filteri umesto nasleđenih iz
   prodavnice obuće; pretraga sa predlozima otporna na kvačice.
3. **Stranica proizvoda** — uveličavanje, lepljiva traka za kupovinu, rok
   isporuke, brzi pregled (postojeći radi samo za ERP proizvode — rupa).
4. **Isporuka i kurirska služba** — najozbiljniji deo koji potpuno
   nedostaje: zone, težinska pravila, otpremnica, nalepnica, obračun
   otkupnine, veza sa kurirom.
5. **Admin: proizvodi, zalihe, porudžbine** — masovni unos, medijateka,
   upozorenje na nisku zalihu, štampa dokumenata.
6. **Admin: sadržaj, izgled i podešavanja** — slaganje početne iz panela,
   prevodi, pravne stranice.
7. **SEO iz panela** — dodato naknadno na zahtev. Zatečeno: mapa sajta,
   robots i strukturirani podaci rade; proizvod i članak imaju meta polja.
   Nedostaje: meta polja za kategorije (ni u bazi ih nema), preusmerenja,
   praćenje 404, slika za deljenje, zajednička podešavanja, provera
   zdravlja. **Upozorenje iz plana:** preusmerenja su jedina stavka koju je
   skuplje dodati kasnije nego sada — kad Google zapamti adrese, svaka
   promena bez preusmerenja gubi zarađenu poziciju.
8. **Puštanje u rad** — domen i HTTPS, fotografije, podaci o prodavcu,
   pristanak na kolačiće, rezervne kopije, brzina.

Plan beleži i **četiri odluke koje čekaju vlasnika**: koja kurirska služba,
fotografije proizvoda, domen, i da li ide engleski. Plus napomena da
fiskalizacija kod prodaje na daljinu zavisi od oblika poslovanja — pitanje
za knjigovođu, ne za programera.

### Merilo — šta čini vrhunsku prodavnicu

<https://claude.ai/code/artifact/78e7711f-50fe-4c3d-87f2-02a9e54c202e>

Popis svega što najbolji webshop sadrži, nezavisno od našeg plana: 7 oblasti
na strani kupca (pronalaženje, katalog, stranica proizvoda, korpa i naplata,
nalog, poverenje, ono što se oseti a ne vidi) i 11 na strani vlasnika
(katalog, zalihe, porudžbine, isporuka, kupci, marketing, sadržaj, SEO,
izveštaji, podešavanja, kvalitet samog panela). Stavke koje naša prodavnica
već ima označene su sa „imamo“.

Ključni zaključak merila: prodaju stvarno obaraju **loše fotografije,
nejasna cena dostave, naplata u previše koraka i spor sajt na telefonu** —
sve ostalo je nadgradnja. Zato fotografije i pravila isporuke idu pre
poređenja proizvoda i programa vernosti.

---

## VIII. Zamke — sažeto

Sve što je jednom pojelo vreme, na jednom mestu:

| Zamka | Posledica | Rešenje |
| --- | --- | --- |
| `npm install` bez `--legacy-peer-deps` | Instalacija puca | `next-auth@4` ne prihvata React 19 kao peer; obavezna zastavica |
| npm 11 blokira install skripte paketa | Prisma klijent ne postoji | Ručno `npx prisma generate` posle instalacije |
| Font bez `latin-ext` | Kvačice tiho padnu na rezervni font | Uvek navesti `latin-ext`, a za ćirilicu i `cyrillic` |
| Paleta stoji na dva mesta | Deo klasa dobije jednu boju, deo drugu | Menjati i `app/globals.css` (`@theme`) i `tailwind.config.ts` |
| Zauzeti portovi na serveru | `EADDRINUSE`, PM2 u petlji | `ss -ltn` pre pokretanja; ova aplikacija je na 3007 |
| `Header.tsx` je mrtav kod | Izmene se ne vide | Zaglavlje je `NavBar.tsx` |
| `@ts-expect-error` uz async server komponente | Build pada | Next 16 ih više ne traži — ukloniti |
| Dvostruki navodnici u `dataUri()` | Šare se ne vide | Jednostruki navodnici |
| GitHub API bez prijave | 60 zahteva na sat, pa 403 | Za proveru postojanja repoa koristiti `git ls-remote` preko SSH-a |

---

## IX. Trenutno stanje

**Radi:**

- Prodavnica na <http://SERVER_HOST:8090/>, 18 proizvoda u 6 kategorija
- Admin panel na `/admin` sa 14 strana
- Redizajn u duhu radionice, PT tipografija, tkani ornamenti — **spojeno u
  `main`**
- Korpa, checkout, nalozi kupaca, kuponi i pouzeće; kartični kod postoji, ali
  je capability isključen do bankarske sertifikacije i operativnog cleanup-a
- 13 pravnih stranica propisanih za prodaju na daljinu
- Zaseban ključ za objavljivanje, napravljen i proveren na serveru
- Prezentacioni sajt na GitHub Pages, sa objavljivanjem na push

**Ne radi / nedostaje:**

- Repo prodavnice na GitHubu → objavljivanje na push čeka samo na to
- Fotografije proizvoda — sve prazne, stoje tkane šare
- Pravi domen i HTTPS (sada samo adresa servera i port)
- Filteri su nasleđeni iz prodavnice obuće („Vrsta obuće“, „Pol“, brendovi)
- Brzi pregled radi samo za ERP proizvode, ne za one iz CMS-a
- Isporuka: nema zona, težinskih pravila ni veze sa kurirskom službom
- Početna strana se ne slaže iz panela
- SEO: kategorije nemaju meta polja, preusmerenja ne postoje
- Engleski prevodi

**Sledeći korak po planu:** faza 1 — atributi tkanja u bazi. Čeka se
potvrda vlasnika (ili drugačiji redosled).

---

## X. Pravila rada

Zapisana su u `CLAUDE.md`, ali ponavljaju se ovde jer su važna:

1. **Nikada rad direktno na `main`.** Svaka nova verzija ide na svoju granu
   (`verzija/`, `dodatak/`, `ispravka/`, `sadrzaj/`), pa pull request, pa
   spajanje. Push na `main` znači objavljivanje.
2. **`CLAUDE.md` se dopunjuje u istom commit-u** kad se menja struktura ili
   način rada.
3. `.env` nikada ne ide u git. Šablon je `.env.example`.

---

## XI. Univerzalna commerce osnova v2 — 29. avgust 2026.

Rad se odvija na grani `verzija/v2.0-univerzalna-platforma`. Cilj ove faze je
white-label prodavnica po instalaciji: isti stabilan commerce core, a branša,
atributi, identitet, boje i uključeni moduli menjaju se konfiguracijom.
Multi-tenant SaaS nije uveden; to bi zahtevalo tenant scope na svakoj tabeli i
svakom upitu.

### Bezbedan kupovni tok

- Cena, popust, dostava i total više se ne prihvataju iz browsera. Jedan
  serverski quote je izvor i za prikaz i za upis porudžbine.
- Porudžbina ponovo proverava aktivnost/cenu i atomarno skida zalihu u
  Serializable transakciji; otkazivanje je idempotentno vraća.
- Duple order rute dele isti bezbedni handler. Pristup gosta koristi potpisani
  kratkotrajni token, pa broj/ID porudžbine nije tajna koja glumi autorizaciju.
- Payment start učitava iznos iz baze, callback proverava hash, iznos i valutu,
  a transakcija se upisuje idempotentno. Kartice su isključene dok ugovor i
  sertifikacija nisu stvarno završeni.

### Univerzalna konfiguracija i UI

- `/admin/settings` je novi konfiguracioni centar: brend, kontakt, društvene
  mreže, SEO, paleta sa live preview-em, radno vreme, dostava i minimalna
  porudžbina. Promene se invalidiraju i odmah koriste u root metapodacima,
  JSON-LD-u, logu, navigaciji i footeru.
- Semantičke CSS promenljive omogućavaju promenu teme bez izmene koda.
- Capability flagovi skrivaju nespremne kartice, jezike, lokacije, karijere,
  dokumente i chat umesto lažnih obećanja korisniku.
- Dodat je skip link, reduced-motion režim i tačan spacer zaglavlja sa/bez
  ticker trake.

### Storefront stabilizacija

- Pretraga koristi stvarni lokalizovani product ugovor, canonical slug,
  sale cenu, slike, total i paginaciju; zastareli zahtevi se prekidaju.
- Brand linkovi koriste slug, mobilni filter čuva kategoriju i ostale query
  parametre, a paginacija više ne vodi na pogrešnu rutu.
- Kartica nema dugme unutar linka. Varijanta je pristupačan izbor, jedina
  dostupna se bira automatski, a korpa ne može preko raspoložive zalihe.

### Admin i generički katalog

- Centralna deny-by-default politika: ADMIN ima sve; OPERATOR samo porudžbine,
  promenu statusa i poruke. Direktan URL/API pokušaj više ne zaobilazi meni.
- Dodati su `ProductType`, tipizovane definicije/vrednosti atributa i generičke
  options/value veze ka `ProductVariant`. Odeća, obuća, hrana ili druga branša
  više ne moraju dugoročno da dele hardkodovana polja.
- Model je expand-only: legacy `ProductSize` ostaje aktivan dok se ne urade
  baseline, seed, backfill i dual-read provera. Redosled je u
  `docs/CATALOG-MIGRATION-PLAN.md` i `docs/V2-ROLL-OUT.md`.

### Važna rollout odluka

Produkcijska baza nema potpun Prisma baseline. Zbog toga nije pravljen niti
primenjen SQL migration i server nije diran. Uklonjen je opasan deploy fallback
na `prisma db push`; migracije se uključuju samo eksplicitno posle backupa i
probe na klonu baze.

### Checkout/payment hardening u istoj v2 fazi

- Quote API sada vraća i autoritativne stavke; korpa, drawer i checkout ne
  kombinuju stare lokalne line cene sa novim serverskim totalom.
- Create-order koristi DB-unique idempotency ključ. Network retry vraća istu
  porudžbinu umesto da drugi put skine zalihu i potroši kupon.
- Kartični retry ima read-only recovery prikaz originalnog order snapshot-a.
  Kratkotrajni handoff zamenjuje dupli nezaštićeni start POST, a access token
  ostaje u per-order HttpOnly cookie-ju umesto URL-a ili sessionStorage-a.
- Payment status stranice veruju stanju iz baze: samo potvrđeni `FAILED` nudi
  retry; `PENDING`/`PROCESSING`/`REVIEW` su neutralni i ne tvrde da kartica nije
  zadužena.
- Decline i admin cancel exactly-once vraćaju rezervisanu zalihu i kupon.
- Druga adresa sada ima sopstveni poštanski broj/državu, pa se billing ZIP ne
  upisuje kao shipping ZIP.
- Javne forme proveravaju reCAPTCHA token, honeypot, rate limit i veličinu
  sadržaja na serveru; SMTP TLS validacija je podrazumevano uključena.
