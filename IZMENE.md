# Izmene — dnevnik rada

Zapis svega što je urađeno na projektu narodne nošnje, sa razlozima i zamkama
na koje se naišlo. Namenjeno je i tebi i svakom ko posle preuzme rad.

Poslednja dopuna: 30. avgust 2026.

## Gde je koji dokument

Zapisa ima više i lako je otvoriti pogrešan. Poređano po dubini:

| Dokument | Obim | Šta pokriva |
| --- | --- | --- |
| **`docs/DETALJAN-IZVESTAJ-RADA-DO-2026-08-30.md`** | 34 glavna odeljka | **Konsolidovan presek svega urađenog.** Implementirano stanje, razlozi, Git/PR/CI dokazi, ključni fajlovi, P0/P1/P2 dug, preporučeni redosled i produkcioni checklist |
| **`docs/DETALJAN-DNEVNIK-IZMENA.md`** | 42 odeljka | **Najdetaljniji zapis.** Svaka V2 izmena, fajl po fajl: bezbednosne granice, checkout, admin politika, Prisma šema, CI/CD, poznati blokatori |
| Ovaj fajl (`IZMENE.md`) | sažeti dnevnik | Hronologija i odluke — zašto je nešto urađeno tako |
| `docs/ARCHITECTURE-V2.md` | 4 KB | Arhitektonske granice platforme |
| `docs/CATALOG-MIGRATION-PLAN.md` | 10 KB | Redosled prelaska na generički katalog |
| `docs/V2-ROLL-OUT.md` | 6 KB | Postupak puštanja V2 u produkciju |
| `docs/GITHUB-DEPLOY.md` | 5 KB | Podešavanje objavljivanja |
| `docs/PRISMA-BASELINE.md` | 3 KB | Baseline migracija |
| `PREGLED_PROJEKTA_2026-08-29.md` | 770 linija | U repou prezentacionog sajta — read-only pregled **oba** dela projekta |

Ako tražiš objedinjeno „šta je urađeno i šta je ostalo“ — otvori
`docs/DETALJAN-IZVESTAJ-RADA-DO-2026-08-30.md`. Ako tražiš hronološki zapis
svakog razvojnog preseka i pojedinačnih izmena — otvori
`docs/DETALJAN-DNEVNIK-IZMENA.md`. Ovaj fajl je ulazna tačka i objašnjava
razloge, ne pojedinačne izmene.

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

**Istorijska napomena:** prvobitno je objavu blokiralo to što zaseban repo nije
postojao. V2 je kasnije objavljen kao odvojena grana u zajedničkom repou. Novi
operativni model više ne pokušava deploy preko presentation `main` grane;
produkcijski posao je rezervisan za pregledani `prodavnica-v2-*` release tag.

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
- Korpa, checkout, nalozi kupaca, kuponi i pouzeće; kartični i reservation
  cleanup kod postoje u V2, ali je card capability i dalje isključen
- 13 pravnih stranica propisanih za prodaju na daljinu
- Zaseban ključ za objavljivanje, napravljen i proveren na serveru
- Prezentacioni sajt na GitHub Pages, sa objavljivanjem na push

**Ne radi / nedostaje:**

- Draft PR #1 ka `main` zatvoren je bez merge-a jer je bio pogrešan release
  put; tag-gated V2 release granica spojena je kroz PR #8, ali production
  Environment, release tag i live objava namerno ostaju za poslednju rollout
  fazu
- Fotografije proizvoda — sve prazne, stoje tkane šare
- Pravi domen i HTTPS (sada samo adresa servera i port)
- Filteri su nasleđeni iz prodavnice obuće („Vrsta obuće“, „Pol“, brendovi)
- Brzi pregled radi samo za ERP proizvode, ne za one iz CMS-a
- Isporuka: nema zona, težinskih pravila ni veze sa kurirskom službom
- Početna strana se ne slaže iz panela
- SEO: kategorije nemaju meta polja, preusmerenja ne postoje
- Engleski prevodi
- Reservation cleanup je uklopljen u V2, ali nije deployovan; VPS timer, prvi
  dry-run/apply smoke i operativni monitoring nisu instalirani
- REVIEW inbox, reconciliation, refund i bankarski staging tok još nisu gotovi

**Sledeći P1 korak:** zatvoriti preostale auth/session, newsletter subscribe,
email/dependency i COD abuse blokatore. Produkcijski cleanup dry-run/apply i
VPS timer ostaju zasebno odobren serverski postupak; kartice ostaju isključene.

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
- Jedan centralni dvočasovni rok sada dele checkout idempotency, pending-card
  recovery i netaknuta kartična rezervacija. Stari payment pokušaj koristi
  zaseban konzervativni REVIEW rok od 24 sata, ograničeno podesiv kroz
  `ORDER_PROCESSING_REVIEW_MINUTES`.
- Cleanup automatski oslobađa zalihu/kupon samo za stari `CARD` sa order
  `PENDING`, payment `PENDING`, aktivnom rezervacijom i bez
  `Transaction`/`PaymentEvent` traga. Payment aktivnost ili `PROCESSING` idu u
  `REVIEW` bez oslobađanja; `CASH` se nikad ne menja ovim tokom.
- Payment start odbija isteklu netaknutu rezervaciju, ne može ponovo pokrenuti
  order kome je zaliha već oslobođena i sumnjivo staro payment stanje
  atomarno prebacuje u `REVIEW`.
- Druga adresa sada ima sopstveni poštanski broj/državu, pa se billing ZIP ne
  upisuje kao shipping ZIP.
- Javne forme proveravaju reCAPTCHA token, honeypot, rate limit i veličinu
  sadržaja na serveru; SMTP TLS validacija je podrazumevano uključena.

---

## XII. P1 ispravka login povratne navigacije — 29. avgust 2026.

Bezbednosni pregled je našao da napadački kontrolisan `callbackUrl` sa login
stranice ide direktno u `router.push`. Next.js klijentska navigacija ne sme
dobiti neproveren URL jer URL šema poput `javascript:` može postati XSS sink.

Na zasebnoj grani `ispravka/v2-bezbedan-callback-url` dodat je centralni
`safeLoginCallbackPath` u `lib/security/navigation.ts`. Helper dozvoljava samo
root-relative, same-origin putanje. URL šeme, protocol-relative forme,
backslash, kontrolni bajtovi, kodirani separatori, dupli separatori i dot
segmenti padaju na fiksni `/` fallback. Query i fragment ostaju dozvoljeni jer
ne mogu promeniti origin; Unicode se kanonizuje kroz standardni `URL` parser.

Login sada validira vrednost pre jedinog `router.push` sinka. Regresioni testovi
pokrivaju legitimne interne putanje i napadačke `javascript:`, spoljne, `//`,
backslash, encoded-separator, control-byte i dot-segment varijante.

Lokalno je potvrđeno: 43/43 unit testa, TypeScript, lint bez grešaka i
produkcijski build sa bezbednim test HTTPS URL-om. Lokalni PostgreSQL nije
pokrenut; build je zato koristio postojeće safe-default grane za DB sadržaj.
Nisu menjani Prisma šema, podaci, server, tajne, payment tok ni deployment.

---

## XIII. Centralni SMTP TLS sloj — 30. avgust 2026.

Bezbednosni pregled je pokazao da su reset lozinke, verifikacija naloga,
porudžbine i wishlist poruke imali sopstvene transportere koji su prihvatali
nevažeće TLS sertifikate. Preostala dva transportera jesu proveravala
sertifikat, ali nisu zahtevala STARTTLS i nisu pravilno podržavala implicitni
TLS na portu 465.

Sada svih pet email tokova koristi `lib/email/smtp.ts` kao jedini izvor SMTP
politike. Port 465 uključuje implicitni TLS; 587, 2525 i drugi portovi zahtevaju
uspešan STARTTLS pre autentifikacije ili slanja sadržaja. Node-ova održavana
cipher lista zamenjuje ručno ograničenje koje je praktično isključivalo TLS
1.2 iako je bio deklarisan kao podržan minimum.

Konfiguracija radi fail-closed: port mora biti ceo broj 1–65535, host i oba
credential-a su obavezni, a nepoznata TLS boolean vrednost se odbija.
`SMTP_TLS_REJECT_UNAUTHORIZED=false` prihvata se samo u `development`/`test`
okruženju i samo za loopback SMTP, pa produkcija ne može slučajno da pošalje
reset token, podatke porudžbine ili prijavu za posao preko neproverenog ili
plaintext kanala. Novi testovi proveravaju obe TLS varijante, neispravnu
konfiguraciju, legacy alias-e i lokalni self-signed izuzetak bez mrežnog slanja.

---

## XIV. Istek napuštenih kartičnih rezervacija — 30. avgust 2026.

U V2 je preko grane `ispravka/v2-istek-rezervacija` dodat bezbedan cleanup
napuštenih kartičnih rezervacija bez nove Prisma migracije. Cilj je da netaknut
payment pokušaj ne drži zalihu i kupon zauvek, ali da sistem nikada automatski
ne oslobodi robu posle moguće komunikacije sa bankom.

### Politika isteka i REVIEW granica

- Netaknuta rezervacija može da istekne tek posle dva sata i samo ako je
  `CARD + Order.PENDING + PaymentStatus.PENDING + inventoryAllocated=true`, bez
  `Transaction` i bez `PaymentEvent` reda.
- Takav order se u istoj transakciji menja u `CANCELLED/FAILED`, a postojeći
  exactly-once helperi vraćaju tačan stock snapshot i rezervisani kupon.
- Svaka payment aktivnost, stari `PROCESSING`, `PROCESSING` bez transaction-a
  ili aktivan order sa terminalnom transaction projekcijom ide u `REVIEW`.
  Zaliha i kupon ostaju rezervisani za ručni reconciliation.
- `CASH`, zatvorene/terminalne porudžbine, neaktivna rezervacija i sveži
  pokušaji ostaju netaknuti.

Pending rok je centralizovan i isti je za idempotency replay, checkout
recovery i cleanup: dva sata. Processing/payment-activity REVIEW rok je
podrazumevano 1440 minuta, a `ORDER_PROCESSING_REVIEW_MINUTES` prihvata samo
ceo broj 120–10080; nevalidna eksplicitna vrednost radi fail-closed.

### Transakcije, concurrency i poison redovi

Batch upit samo pronalazi ograničenu listu kandidata. Svaki ID se zatim
ponovo učitava, procenjuje i menja u sopstvenoj Serializable transakciji, sa
ograničenim retry-em za PostgreSQL serialization/CAS konflikt. Tako cleanup,
payment start i callback ne mogu svi „pobediti“ nad istom zastarelom slikom.

Promena order stanja, vraćanje zalihe i vraćanje kupona čine jednu transakciju.
Ako inventory ili coupon snapshot nije bezbedno oslobodiv, ceo pokušaj se
rollback-uje, a zaseban svež CAS pokušava da stavi order u `REVIEW` bez
oslobađanja rezervacije. Ako ni fallback ne uspe, red se broji kao greška, ali
obrada sledećih kandidata se nastavlja. Rezultat iznosi samo agregate
`scanned/expired/reviewed/skipped/failed`, bez order ID-eva i ličnih podataka.
Ako ijedan kandidat ostane `failed`, endpoint vraća HTTP 500 i `success:false`
sa istim agregatima, pa systemd/curl nadzor ne može prijaviti lažan uspeh.

### Endpoint i payment-start zaštita

Novi maintenance endpoint je samo `POST /api/cron/order-reservations`. Zahteva
tačan Bearer secret `ORDER_RESERVATION_CLEANUP_SECRET` od najmanje 32 znaka,
nema admin-cookie fallback i ostaje iza same-origin zaštite, pa VPS poziv mora
poslati `Origin` jednak `NEXT_PUBLIC_SITE_URL`. Prazno telo ili izostavljen
`apply` su dry-run; eksplicitni JSON oblici su `{"apply":false}` i
`{"apply":true}`. Telo je malo i strogo validirano, a odgovor je `no-store`.

`beginCardPayment` koristi istu reservation politiku pre payment state
machine-a. Istekla netaknuta rezervacija vraća
`PAYMENT_RESERVATION_EXPIRED`, oslobođena zaliha
`PAYMENT_INVENTORY_NOT_RESERVED`, a sumnjivo star payment pokušaj atomarno
prelazi u `REVIEW` umesto da dobije nov ili replayovan bankarski payload.

### Provere i operativno stanje

Završna lokalna provera 30. avgusta na samostalnoj cleanup grani našla je 82
testa: 81 je prošao, a jedini PostgreSQL integration test bio je očekivano
preskočen bez bezbedne test baze. `lint --quiet`, TypeScript, produkcijski build
sa lažnim test podešavanjima i `git diff --check` takođe su prošli. Opt-in
PostgreSQL test sa `RUN_RESERVATION_CLEANUP_DB_TESTS=true` pokreće dva cleanup
radnika nad istim orderom i mora dokazati jedan `EXPIRED`, jedan `SKIPPED` i
tačno jedan povrat zalihe/kupona, uz realnu pozitivnu i negativnu proveru
kandidatskog prefiltera. CI ga obavezno uključuje nad izolovanim PostgreSQL
servisom.

Kôd je uklopljen u V2, ali nije deployovan. Produkcioni `.env` nije dobio
cleanup secret, VPS nije menjan i timer nije instaliran. Prvi secret-safe
dry-run, kontrolisani apply, praćenje agregata i systemd oneshot/timer ostaju
zasebno odobrena operativna radnja. Kartice ostaju isključene dok timer i smoke
nisu dokazani i dok REVIEW inbox, reconciliation, refund i bankarski staging
nisu završeni. Postojeći DB race test pokriva dva cleanup radnika; posebna
real-DB trka cleanup-a sa payment start/callback putem ostaje dodatni uslov pre
kartica.

---

## XV. Bezbedna newsletter odjava — 30. avgust 2026.

Newsletter unsubscribe tok više nema javni fallback ključ niti mutaciju preko
GET zahteva. Centralni `lib/newsletter/unsubscribe.ts` normalizuje adresu,
potpisuje je HMAC tokenom i verifikuje token timing-safe poređenjem pre bilo
kakvog pristupa bazi.

Produkcija dobija zaseban `NEWSLETTER_UNSUBSCRIBE_SECRET` od najmanje 32 bajta.
Podešen ali slab dedicated secret radi fail-closed i ne pada tiho na drugi
ključ. Ranije poslati linkovi mogu privremeno da se verifikuju jakim
`NEXTAUTH_SECRET` samo uz eksplicitni
`NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY=true`; novi linkovi se uvek
potpisuju dedicated ključem, a migracioni flag se zatim vraća na `false`.

GET link sada samo proverava potpis i vodi na `noindex`/`no-referrer` stranicu
za potvrdu. Pretplata se menja tek potpisanim POST zahtevom posle izričitog
klika korisnika. Jedna transakcija idempotentno deaktivira i korisničku i
gostujuću pretplatu, bez otkrivanja da li adresa postoji. Posle uspeha email i
Bearer token se uklanjaju iz browser URL-a i istorije.

Regresioni testovi pokrivaju jake/slabe/nedostajuće ključeve, legacy migraciju,
normalizaciju, pogrešne i rotirane tokene, URL izgradnju, zabranu mutacije bez
autorizacije i idempotentnu deaktivaciju. PR #4 i završni objedinjeni V2 CI su
zeleni. Promena nema Prisma migraciju, nije deployovana i nije menjala server,
produkcione tajne ili podatke.

---

## XVI. P0 razdvajanje V2 CI-ja i produkcijskog release-a — 30. avgust 2026.

V2 workflow više ne koristi presentation `main` kao CI/deploy cilj. Nova
matrica je:

- PR ka `verzija/v2.0-univerzalna-platforma` — kompletan CI, bez deploya;
- push na kanonsku V2 granu — kompletan CI, bez deploya;
- ručni `workflow_dispatch` — kompletan CI, bez deploya;
- push `prodavnica-v2-YYYYMMDD-N` taga — CI, pa produkcijski job tek posle
  svih repository i Environment zaštita;
- push na presentation `main` — ovaj V2 workflow se ne pokreće.

Pre instalacije zavisnosti workflow potvrđuje identitet V2 stabla. Posle CI-ja
poseban `Potvrdi V2 release` job proverava strogi oblik taga i da je označeni
commit već deo remote kanonske V2 grane, pre nego što se otvori production
Environment gate. Produkcijski job iste uslove ponavlja pre SSH-a.
Checkout/setup-node Actions su osvežene i pinovane na pregledane pune SHA
vrednosti. Tag deploy se ne prekida, dok zastarele CI provere mogu biti
otkazane.

Spoljni `production` Environment mora pred live fazu biti promenjen sa starog
`main` branch pravila na `prodavnica-v2-*` tag policy, required reviewera i
poželjno zaštićeni tag ruleset. Dok to nije urađeno, novi deploy ostaje dodatno
blokiran. Ovom izmenom nije napravljen ili pushovan release tag, nisu postavljene
tajne, server nije menjan i aplikacija nije puštena uživo.

Granica je spojena isključivo u kanonsku V2 granu kroz
[PR #8](https://github.com/biozencaj-stack/narodnanosnja/pull/8), merge
`6aa506924aa5b95d30e638adffa209c307aed6b0`. Exact-head PR run
[`33302673497`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33302673497)
i post-merge V2 push run
[`33302806208`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33302806208)
završeni su uspešno; u oba su release potvrda i produkcijski deploy preskočeni.
Stari Draft PR #1 zatvoren je bez merge-a. Read-only provera posle svega i
dalje nalazi 0 production deployment zapisa.

---

## XVII. P1 auth secret i atomska email verifikacija — 30. avgust 2026.

Prva P1 auth sekcija zatvara javni fallback ključ i nedeterministički
verification/session tok. Novi `lib/auth/config.ts` centralizuje auth secret,
rok sesije i izbor cookie-ja. Nedostajući, prazan, kraći od 32 UTF-8 bajta,
razmacima okružen ili poznati javni placeholder secret sada se odbija. U
produkciji je `NEXTAUTH_URL` obavezan i mora biti HTTPS; razvojni HTTP ostaje
dozvoljen. NextAuth, proxy i verification ruta koriste isti resolver, isto ime
cookie-ja i isti secure-cookie kriterijum.

Session, JWT i verification cookie sada dele jedan rok od 24 sata. Pre bilo
kakve verification mutacije ruta validira kanonski storefront URL, auth
konfiguraciju i sve redirect mete, zatim potpisuje JWT i potpuno priprema
uspešan odgovor sa HttpOnly/SameSite cookie-jem. Ako encode ili priprema
odgovora zakažu, korisnik i token ostaju netaknuti i zahtev može bezbedno da se
ponovi.

Tek posle uspešne pripreme odgovora `commitEmailVerification()` otvara jednu
Prisma transakciju. Conditional `deleteMany` claim prihvata tačno jedan isti,
još važeći token; zatim ista transakcija postavlja `emailVerified` i briše sve
ostale verification tokene korisnika. Paralelni replay zato može imati samo
jednog pobednika, dok drugi dobija kontrolisani konflikt bez parcijalnog
stanja.

Dodati su unit testovi za secret/URL/cookie matricu, jedinstveni 24-časovni rok
i redosled session encode → response priprema → DB commit, uključujući svaku
failure granicu. Opt-in PostgreSQL test koristi dve preklopljene interaktivne
transakcije, zahteva lokalnu bazu sa jasnim test nazivom i proverava jednog
uspešnog radnika, jednog konfliktnog, verifikovanog korisnika i nula sibling
tokena. GitHub CI sada taj test obavezno uključuje preko
`RUN_AUTH_VERIFICATION_DB_TESTS=true`.

Ova etapa nema Prisma migraciju i ne menja produkcione podatke, server, tajne,
GitHub Environment, release tag ili live sajt. Takođe još ne uključuje globalni
`emailVerified` login uslov, jer bi bez audita/backfill-a i resend toka mogao da
zaključa postojeće legitimne naloge. Reset privacy je zatvoren narednom etapom
iz odeljka XVIII, a prefetch-safe POST potvrda iz odeljka XIX integrisana je u
V2 kroz PR #14. Slede hashovani jednokratni tokeni, atomska registracija i resend,
kontrolisani verified-login rollout, session revocation/sveža role provera i
shared login limiter. Live puštanje ostaje poslednja faza.

Promena je potom spojena isključivo u kanonsku V2 granu kroz
[PR #10](https://github.com/biozencaj-stack/narodnanosnja/pull/10). Feature
commit je `db35f6efce16535e6f831fcf98549934c018d0cf`, a V2 merge
`d6d44c806447d5e7211c9312fcaa0d98ef8f2c1b`. Exact-head run
[`33305077539`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33305077539)
i post-merge run
[`33305210714`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33305210714)
završili su uspešno; u oba su release potvrda i produkcijski deploy preskočeni.
Read-only GitHub provera posle merge-a i dalje nalazi 0 production deployment
zapisa.

---

## XVIII. P1 privatnost zahteva za reset lozinke — 30. avgust 2026.

Druga P1 auth etapa zatvara account-enumeration signal u
`POST /api/auth/reset-password/request`. Ranija ruta je za nepostojeći nalog
brzo vraćala generički HTTP 200, dok je postojeći nalog čekao DB upise i SMTP.
Ako DB ili SMTP zakažu, samo postojeći nalog dobijao je HTTP 500 sa drugačijim
telom. Status, telo i naročito vreme odgovora zato su mogli da otkriju da li je
email registrovan.

Novi javni ugovor razdvaja HTTP odgovor od account-dependent rada. Svaki
sintaksno validan email, kada je zahtev uspešno zakazan, odmah dobija isti HTTP
202, istu buduće-formulisanu poruku i zaglavlja
`Cache-Control: no-store, max-age=0` i `Pragma: no-cache`. Lookup naloga,
jednočasovni token i SMTP pokreću se tek kroz Next.js `after()` callback, posle
zatvaranja odgovora. Nevalidan JSON/email i rate-limit 429 ostaju različiti jer
nastaju pre lookup-a i ne zavise od toga da li nalog postoji. Ako samo
zakazivanje `after()` callbacka sinhrono zakaže, ruta vraća generički HTTP 503
sa retry porukom; ni tada lookup nije pokrenut i nema account oracle-a.

Privatni pipeline prijavljuje samo fazu `LOOKUP`, `TOKEN_REPLACEMENT`,
`DELIVERY`, `SCHEDULING` ili `BACKGROUND`. Email, reset token i originalni DB/
SMTP tekst greške ne ulaze u ovaj log. Brisanje prethodnih tokena i kreiranje
novog rade u jednoj Prisma transakciji, pa jedan zahtev ne može da obriše staro
stanje bez uspešnog upisa novog tokena. Novi token se ne briše automatski kada
SMTP prijavi grešku: udaljeni server je možda već prihvatio poruku pre gubitka
odgovora, pa bi cleanup pretvorio eventualno isporučen link u nevažeći.

UI sada više ne tvrdi da je email već sigurno poslat. Prikazuje samo da će
uputstva biti poslata ako nalog postoji. Logika rute izdvojena je u testabilni
factory, pa testovi proveravaju sirovi HTTP status, tačno telo, content type,
cache zaglavlja, normalizovan email i činjenicu da se privatni posao ne pokreće
pre vraćanja odgovora. Ukupno je dodato 11 testova: četiri route-contract i
sedam service/scheduler testova. Završni lokalni paket ima 126 testova: 124
prolaze, a dva postojeća opt-in PostgreSQL testa očekivano su preskočena bez
bezbedne lokalne test baze. `lint --quiet`, TypeScript, `git diff --check`,
ciljani testovi i produkcijski build sa lažnim CI vrednostima takođe prolaze.

Granice ove etape ostaju namerno eksplicitne. `after()` nije durable queue:
pad/redeploy procesa posle 202 može izgubiti posao, pa su transactional outbox,
alert i runtime smoke obavezni pre produkcije. Transakcija je atomska po jednom
zahtevu, ali bez unique/CAS/Serializable zaštite dva paralelna zahteva još mogu
ostaviti dva važeća tokena. Tokeni su i dalje čitljivi u bazi, reset-confirm još
nema exactly-once claim, a procesni LRU i ceo `x-forwarded-for` nisu shared
limiter/trusted-proxy ugovor.

Promena je spojena isključivo u kanonsku V2 granu kroz
[PR #12](https://github.com/biozencaj-stack/narodnanosnja/pull/12). Feature
commit je `d7bf89494098c8d88d5f81ddd08af31e07e3b136`, a V2 merge
`9f998866b1be2dad576f5c626fee05c41a978572`. Exact-head run
[`33307015696`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33307015696)
i post-merge run
[`33307162583`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33307162583)
završili su uspešno; u oba su `Potvrdi V2 release` i
`Objavi na produkciju` preskočeni. Read-only provera posle merge-a nalazi 0
production deployment zapisa.

Nema Prisma migracije, produkcionih podataka, servera, tajni, GitHub
Environment promene, release taga ili live deploya. Sledeći auth koraci su
hashovani jednokratni tokeni, exactly-once reset confirm, atomska
registracija/resend, session revocation i shared limiter. Prefetch-safe POST
potvrda u međuvremenu je integrisana u kanonski V2 kroz PR #14 sa zelenim
exact-head i post-merge CI dokazom. Live puštanje ostaje poslednja, posebno
odobrena faza.

---

## XIX. P1 prefetch-safe potvrda emaila — 30. avgust 2026.

Treća P1 auth etapa urađena je na grani
`ispravka/v2-prefetch-safe-verifikacija`, izvedenoj iz tadašnjeg kanonskog V2
commita `8d22116543c3bf2f2e76080758d9814b0e61c2fe`. Feature commit
`6ffd173b3eda59815894ea43181543791dba58a0` potom je kroz
[PR #14](https://github.com/biozencaj-stack/narodnanosnja/pull/14) spojen
isključivo u `verzija/v2.0-univerzalna-platforma` kao merge
`c96473c22fb56f8b6c1b5b34570936d526577c10`. Prethodni atomski verification
servis iz etape XVII ostao je osnova, ali je uklonjena poslednja opasna browser
granica: samo otvaranje email linka više ne verifikuje nalog, ne troši token i
ne izdaje magic-login sesiju.

### XIX.1. GET je potvrda za čitanje, POST je jedina mutacija

Kanonski email link sada vodi na `/verify-email/[token]`, serversku stranicu za
potvrdu. Ona ne radi DB lookup, nema client-side mutaciju i ne zahteva
JavaScript da bi se završio tok. Prikazuje eksplicitno objašnjenje da samo
otvaranje nije promenilo nalog i običan HTML `<form method="post">`; tek klik
na „Potvrdi email i prijavi me“ šalje native same-origin POST ka
`/api/auth/verify-email/[token]`.

Postojeći direktni linkovi ka API ruti ostali su kompatibilni, ali su
bezopasni: legacy `GET` i `HEAD` vraćaju samo `303 See Other` ka confirmation
stranici. Nema response tela, session cookie-ja, DB lookup-a, čitanja postojeće
sesije, JWT encode-a ili token commita. Zato prefetch, antivirusni email skener,
link preview i crawler mogu najviše da otvore read-only stranicu. Ne mogu da
potroše jednokratni credential ili automatski prijave korisnika.

Stranica odbija pogrešan oblik tokena pre prikaza forme. Prihvaća se tačno 64
heksadecimalna znaka, odnosno postojeći 32-byte CSPRNG token u hex obliku.
Validan token se kanonizuje u lowercase pre DB lookup-a i conditional claim-a.
Ova format provera nije dokaz da token postoji i namerno ne radi DB lookup u
GET renderu.

### XIX.2. Lokalni Origin guard i bezbedne failure granice

Pošto je širi `/api/auth` namespace izuzet od globalne proxy origin provere
zbog legitimnih NextAuth callbackova, verification POST ima sopstveni
`isTrustedWriteRequest()` guard. Produkcijska ruta ga izvršava pre parsiranja
parametara, `getStorefrontUrl()`, auth-secret/cookie konfiguracije, session
čitanja i bilo kog DB poziva; testabilni factory istu proveru ponavlja kao
invarijantu. Zahtev mora imati `Origin` čiji host odgovara `Host` headeru ili,
kada Origin nije poslat, `Sec-Fetch-Site: same-origin`. Cross-origin i zahtev
bez oba pouzdana signala dobijaju 403 bez lookup-a i bez potrošnje tokena.

Same-origin nije dovoljan kada storefront može da se otvori i preko alias
hosta. Session cookie je host-only, pa bi POST na aliasu potrošio token, a
kanonski success redirect zatim izgubio upravo izdatu sesiju. Ruta zato posle
lokalnog Origin guard-a i razrešavanja `getStorefrontUrl()`, ali pre auth
secret/session/DB rada, proverava i kanonski origin. Trusted alias POST vraća
samo zaštićeni 303 ka kanonskoj confirmation stranici. Nema lookup-a, commita
ili cookie-ja; korisnik tek sa kanonskog hosta ponavlja eksplicitni klik.

Posle trusted-write i format provere redosled je:

1. pronaći verification zapis po kanonizovanom tokenu;
2. proveriti da `expires` strogo leži posle trenutka potvrde;
3. pročitati eventualnu aktivnu NextAuth sesiju;
4. izdati 24-časovni session JWT;
5. potpuno pripremiti `303` odgovor ka `/moj-nalog?verified=true` i
   centralno imenovan `HttpOnly`, `SameSite=Lax`, 24-časovni cookie;
6. tek tada atomskom transakcijom conditional `deleteMany` claim-ovati još
   važeći token, postaviti `User.emailVerified` i obrisati sve sibling tokene;
7. vratiti već pripremljen odgovor samo ako je commit uspeo.

Istekli token se prijavljuje read-only i ne briše se u request ruti; cleanup je
posao budućeg resend/maintenance toka. Ako je u istom pregledaču aktivna sesija
drugog korisnika, ruta vraća korisnika na confirmation ekran sa jasnim
uputstvom za odjavu ili privatni prozor. U tom ishodu nema session encode-a,
cookie-ja, commita niti potrošnje tokena. Odsutna sesija i sesija istog
korisnika mogu da nastave.

Ako dva POST-a pokušaju isti token, conditional claim daje samo jednog
pobednika. Gubitnik dobija invalid-token ishod bez cookie-ja. Isti fail-closed
ugovor važi za JWT encode, pripremu odgovora i DB greške: prepared success
cookie nikada se ne šalje ako atomski commit nije uspeo. Operativni kvar vraća
retry confirmation URL, dok log dobija samo fazu `PARAMS`, `LOOKUP`,
`EXPIRY_CHECK`, `CURRENT_SESSION`, `SESSION_ISSUE`, `RESPONSE_PREPARATION`,
`COMMIT` ili spoljašnju `CONFIGURATION`; token, URL, email i raw exception tekst
se ne loguju. Magic-login i njegov standardni 24-časovni rok zato nastaju tek
posle stvarnog klika i uspešnog exactly-once commita.

### XIX.3. Cache, referrer, crawler i analytics privatnost

Confirmation stranica i svi API odgovori/redirecti dobijaju:

- `Cache-Control: private, no-store, max-age=0`;
- `Pragma: no-cache`;
- `Referrer-Policy: no-referrer`;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

Stranica je dodatno `force-dynamic`, bez revalidacije, sa Next metadata
`noindex`, `nofollow`, `nocache` i `no-referrer`. Time token ne treba da uđe u
browser/shared cache, indeks ili outbound Referer. Zajednički
`lib/security/credential-path.ts` guard isključuje sve third-party skripte na
`/verify-email/*`, token putanji `/reset-password/*` i
`/newsletter/odjava`. Njega koriste i Google Analytics wrapper i globalni
reCAPTCHA provider, a nerešen pathname je private-by-default. Obična
`/reset-password` request forma i slično nazvane normalne storefront putanje
ostaju funkcionalne/merljive. GA `page_location` za dozvoljene stranice pravi
se samo od origin-a i pathname-a, bez query stringa ili hash-a.

Ista puna header politika preko `next.config.ts` sada pokriva verification page
i API, reset-token stranicu, newsletter odjava stranicu i njen API. Time se
ranija newsletter `no-referrer` zaštita proširuje i na no-store/noindex/
noarchive ugovor, a postojeći reset bearer URL dobija istu zaštitu.

Ove mere ne mogu da uklone sam prvi request URL iz browsera, CDN-a, reverse
proxy-ja ili web-server access loga. To je eksplicitni preostali residual:
verification token je još plaintext credential u URL-u i bazi, pa hashing i
log-redaction ostaju sledeći hardening korak.

### XIX.4. Email, registracija i završni korisnički tok

`sendVerificationEmail()` više ne sklapa URL iz generičkog `siteUrl` stringa.
Koristi `getStorefrontUrl()`, URL encoding i kanonski
`/verify-email/[token]` cilj. HTML i tekst emaila više ne obećavaju automatsku
potvrdu samim otvaranjem: objašnjavaju da link otvara sigurnu confirmation
stranicu i da korisnik tamo mora da klikne. Dugme je preimenovano iz
„Potvrdi email i prijavi se“ u „Otvori stranicu za potvrdu“ i nosi
`rel="noreferrer"`; na confirmation stranici završno dugme eksplicitno kaže
„Potvrdi email i prijavi me“, pa 24-časovna session posledica nije skrivena.

Posle uspešnog POST-a korisnik odlazi na `/moj-nalog?verified=true`, gde dobija
statusni banner da je email potvrđen i sesija aktivna. Mali client helper potom
uklanja samo `verified` query parametar preko `history.replaceState`, uz
očuvanje drugih query/hash delova, pa refresh i kopiranje nalog URL-a ne
ponavljaju banner. Verification token nikada ne prelazi na account URL.

Usput je ispravljena i registration delivery poruka: uspešan odgovor sada
kaže da je nalog napravljen i da je za aktivaciju potrebna email potvrda, ali ne
tvrdi da je SMTP sigurno isporučio poruku. Delivery `catch` više ne loguje raw
SMTP grešku ili primaoca, već samo kontrolisani `{ stage: "DELIVERY" }`. Login
banner koristi isti oprezni copy i upućuje na inbox/spam/podršku. Ovo je samo
tačniji failure ugovor; ne uvodi resend ili durable delivery.

### XIX.5. Testovi i lokalni dokaz

Novi `lib/auth/email-verification-route.test.ts` ima 13 route-contract testova:
prvobitnih 12 ugovora i naknadni canonical-origin test.
Oni pokrivaju kompletna privacy zaglavlja; strogo read-only GET/HEAD 303;
Origin guard pre params/lookup-a; canonical-origin/alias matricu; encode →
response → commit redosled; asinhronu pripremu odgovora; malformed i
nepostojeći token; boundary expiry bez commita; različitu i istu aktivnu
sesiju; sve stage-only failure tačke; conflict bez cookie-ja; i otpornost javnog
ishoda kada logger sam zakaže.

`lib/analytics/google-analytics.test.ts` dodaje tri wrapper testa, a
`lib/security/credential-path.test.ts` još tri testa centralne politike. Oni
dokazuju da verification/reset-token/newsletter credential putanje ne učitavaju
GA ili reCAPTCHA, da normalne i slično nazvane putanje ostaju uključene i da je
null/undefined/prazan pathname private-by-default. Opt-in real-PostgreSQL
verification test je proširen na celu route granicu: prefetch `GET` i `HEAD`
ostavljaju `emailVerified`, `updatedAt` i oba tokena netaknutim i imaju nula DB
lookup-a; zatim dva preklopljena POST radnika daju tačno jedan 303 sa cookie-jem
i jednog konfliktnog bez cookie-ja, verifikovanog korisnika i nula sibling
tokena.

Završna lokalna matrica funkcionalnog stabla:

| Provera | Rezultat |
| --- | --- |
| verification route-contract testovi | 13/13 prolazi |
| analytics testovi | 3/3 prolaze |
| sensitive-credential policy testovi | 3/3 prolaze |
| ciljani paket | 20 ukupno; 19 prolazi; 1 auth DB test očekivano preskočen |
| kompletan `npm test` | 145 ukupno; 143 prolaze; 2 opt-in DB testa očekivano preskočena bez bezbedne lokalne PostgreSQL baze |
| `npm run lint -- --quiet` | prolazi |
| `npm run typecheck` | prolazi |
| `git diff --check` | prolazi |
| produkcijski Next.js build sa lažnim CI vrednostima | prolazi; svih 91 ruta završeno |

Završni nezavisni read-only review potvrdio je da su ranija dva HIGH i
canonical-host MEDIUM nalaz zatvoreni i nije našao novi blocker/high. Canonical
helper je direktno unit-testiran; production route modul nema direktan import
test zbog server-only/Prisma kompozicije, pa je njegov guard → canonical
redirect → auth/DB redosled potvrđen pregledom koda. To ostaje test-depth
napomena, ne otvoren funkcionalni nalaz.

### XIX.6. Jasne granice i sledeći koraci

Ovaj presek ne dodaje Prisma migraciju i ne hash-uje postojeće verification ili
reset tokene. Nema pravog verification resend/cooldown toka, transactional
outbox-a, durable worker-a, verified-login enforcementa, audita/backfill-a
legacy naloga, session revocationa, sveže role provere ili shared auth limitera.
Zato registraciona SMTP greška još može ostaviti nalog bez samouslužnog resend
puta, postojeći neverifikovani nalozi nisu globalno blokirani, a procesni
abuse/credential zaštitni sloj nije dovršen.

Nisu menjani produkcioni podaci, server/VPS, `.env`, tajne, DNS/TLS/proxy, PM2,
GitHub `production` Environment, reviewer, secrets/variables ili release
workflow. Nije napravljen release tag i ništa nije pušteno live.

### XIX.7. PR #14, exact-head i post-merge CI dokaz

| Dokaz | Rezultat |
| --- | --- |
| Feature commit | `6ffd173b3eda59815894ea43181543791dba58a0` |
| PR | [#14](https://github.com/biozencaj-stack/narodnanosnja/pull/14), base isključivo `verzija/v2.0-univerzalna-platforma` |
| Exact-head run | [`33309850609`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33309850609), `pull_request`, SUCCESS za oko 2 min 39 s |
| Exact-head poslovi | `Provera verzije` SUCCESS; `Potvrdi V2 release` SKIPPED; `Objavi na produkciju` SKIPPED |
| V2 merge | `c96473c22fb56f8b6c1b5b34570936d526577c10` |
| Post-merge run | [`33309984025`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33309984025), `push`, SUCCESS za oko 2 min 50 s |
| Post-merge poslovi | `Provera verzije` SUCCESS; `Potvrdi V2 release` SKIPPED; `Objavi na produkciju` SKIPPED |
| Remote V2 head | `c96473c22fb56f8b6c1b5b34570936d526577c10` |
| Deployment/tag provera | 0 deployment zapisa za merge SHA; 0 tagova pokazuje na merge |

Oba `Provera verzije` posla prošla su PostgreSQL 16, migracije i DB provere,
kompletan test paket sa uključenim opt-in PostgreSQL scenarijima, Chromium
smoke, lint, TypeScript i produkcijski build. Read-only GitHub provera potvrdila
je tačan feature head, V2 base, merge SHA i remote V2 head. Presentation
`main`, live sajt i GitHub `production` Environment ostali su netaknuti; oba
release posla bila su preskočena i nijedan tag nije otvorio produkcijski put.

---

## XX. P1 auth credential storage i atomska reset potvrda — 30. avgust 2026.

Četvrta P1 auth etapa urađena je na grani
`ispravka/v2-hashovani-tokeni-reset-claim`, izvedenoj iz kanonskog V2 head-a
`4e53d138b6b2c3c0c206ab6a28d169fecbbe4ab`, i kroz PR #16 spojena isključivo u
V2 kao `8cf83e56be9cf0775db92ba9319eac5d993994e0`. Cilj je jedan strogi
credential format za verification/reset, indeksirani hash-first lookup i
exactly-once promena lozinke, uz kompatibilnost sa ranije izdatim linkovima.

Ovo je **expand/compat**, ne završni hash-only presek. Trenutni register i
reset-request upisi privremeno čuvaju i raw token i hash; plaintext kolone i
indeksi ostaju zbog rolling/rollback prozora. Zato ova etapa još ne štiti novi
credential od čitaoca baze. Ona postavlja format, konkurentnost i bezbedan
redosled za kasniji hash-only/grace/contract prelaz.

### XX.1. Centralni purpose-separated credential helper

Novi `lib/auth/credential-token.ts` je jedini generator/parser/storage helper:

- pravi 32 CSPRNG bajta kao tačno 64 lowercase hex znaka;
- parser prihvata samo 64 hex znaka, normalizuje case i ne radi `trim()`;
- storage ključ je lowercase `v1:<64-hex-sha256>`;
- namespace, verzija i purpose (`email-verification` ili `password-reset`) su
  odvojeni NUL bajtovima pre hashovanja, pa isti raw token u dva toka nema isti
  hash;
- lookup ključevi eksplicitno naređuju current hash pre legacy plaintexta;
- recognizer odbija raw, uppercase, malformed i drugu storage verziju.

Raw vrednost i dalje postoji samo zato što mora da stigne kroz email/browser
capability granicu; current DB lookup i conditional claim koriste hash. Šest
direktnih testova pokriva entropiju/format, strogi parser, poznate digest
vrednosti, purpose separation, verziju i fail-closed input bez credential echo-a.

### XX.2. Expand/compat šema i migracija bez automatskog čišćenja

`PasswordReset.token` i `EmailVerification.token` postaju nullable, a oba
modela dobijaju nullable unique `tokenHash`. `PasswordReset.userId` postaje
unique, pa korisnik može imati najviše jedan reset red. Stari ne-unique user
indeks se uklanja kao redundantan; svi plaintext token indeksi ostaju za compat.
`EmailVerification.userId` ostaje ne-unique da bi sibling tokovi bili dozvoljeni
do uspešnog atomic cleanup-a.

Migracija `20260830000000_expand_hashed_auth_tokens` radi u transakciji, sa
hardened `search_path = pg_catalog, public`, `lock_timeout='10s'` i
`statement_timeout='2min'`. Pre promene šeme uzima
`SHARE ROW EXCLUSIVE` lock nad `PasswordReset` i fail-closed traži duple
`userId` vrednosti. Ako postoje, cela migracija se prekida. U migraciji nema
`DELETE`, `UPDATE` ni `INSERT`: ne bira pobednički link i ne uništava podatke na
osnovu neproverene pretpostavke. Pre produkcione primene obavezni su read-only
audit, backup/restore dokaz, eksplicitno razrešenje svakog duplikata i plan za
lock vreme. `statement_timeout` važi po SQL naredbi, dok DDL lockovi ostaju do
`COMMIT`-a. Ako `prisma migrate deploy` zbog preflight-a ili timeout-a evidentira
ovu migraciju kao neuspelu, prvo se potvrđuju potpuni PostgreSQL rollback i
otklanjanje uzroka; tek zatim se kontrolisano radi
`prisma migrate resolve --rolled-back 20260830000000_expand_hashed_auth_tokens`
i ponavlja deploy. Resolve se ne koristi za prikrivanje delimičnog ili
neistraženog stanja.

`scripts/db-invariant-smoke.sql` unutar rollback transakcije proverava nullable
kolone, hash-only i legacy-only redove, reset-user/hash uniqueness i dozvoljene
verification sibling redove. Za svih sedam auth indeksa proverava da su
`indisvalid` i `indisready`, da pripadaju tačno očekivanoj tabeli i jednoj
očekivanoj koloni, kao i tačan unique/non-unique ugovor. Tako indeks istog
imena na pogrešnoj tabeli/koloni ili parcijalno/nevalidno stanje ne može da dâ
lažan PASS. PostgreSQL 16 `indnullsnotdistinct` takođe mora biti `false`, jer
nullable compat kolone zavise od standardnog `NULLS DISTINCT` ponašanja.

### XX.3. Jedan reset red i hash-first compat upis

Immediate-202 reset-request ugovor ostaje nepromenjen: lookup, upis i SMTP su u
`after()` callbacku. Privatni pipeline sada generiše raw token centralno,
izračunava password-reset hash i prekida pre persistence/emaila ako credential
nije validan. `PasswordReset.upsert({ where: { userId } })`, zajedno sa unique
user indeksom, čuva najviše jedan aktivni reset red. Compat zapis još dual-write
čuva raw token, current hash i expiry; samo raw token ide u email.

Ovo rešava sibling redove pod paralelnim requestima, ali ne pretvara `after()`
u durable queue. Process shutdown posle vraćenog 202 i dalje može izgubiti
background posao, pa transactional outbox, worker/retry i delivery monitoring
ostaju otvoreni.

### XX.4. Exactly-once reset confirm

Novi testabilni route/service tok sprovodi sledeći redosled:

1. trusted same-origin guard pre body/config/DB rada;
2. postojeći procesni rate limit;
3. strogi JSON, 64-hex token i password tip;
4. postojeća password politika plus najviše 72 UTF-8 bajta zbog bcrypt granice;
5. current hash lookup prvi;
6. legacy lookup tek posle hash promašaja i samo uz `tokenHash: null`;
7. record-to-claim provera ponovo zabranjuje plaintext downgrade reda sa hashom;
8. strogi prvi `expires > lookupAt` check;
9. bcrypt i kompletan private success response pre mutacije;
10. ponovno merenje vremena posle tih skupih koraka i strogi
    `expires > resetAt` check;
11. jedna transakcija conditional `deleteMany` claim-om vezuje `id`, `userId`,
    tačan stored hash ili legacy token sa `tokenHash: null`, i expiry;
12. samo `count === 1` menja `User.passwordHash` i briše sve reset siblinge;
13. claim, password update i cleanup zajedno commit-uju ili rollback-uju.

Concurrent gubitnik dobija isti generičan 400 kao nepostojeći/istekli link i ne
dobija pripremljeni success. Operativni kvar daje generičan 503. Svaki odgovor
ima private/no-store/no-referrer/noindex zaglavlja, a log sadrži samo kontrolisanu
fazu bez tokena, hasha, emaila, lozinke ili raw exceptiona.

Opt-in PostgreSQL test barijerom preklapa dva radnika sa dve različite nove
lozinke: tačno jedan pobeđuje i samo njegov bcrypt hash ostaje. Isti test
proverava hash-miss → čist legacy put i rollback/retry kada password update
namerno zakaže posle conditional delete-a.

### XX.5. Verification, registracija i email URL

Verification zadržava prefetch-safe POST i session/response-before-commit
invarijante. Produkcijski lookup traži hash prvi, a legacy red samo sa
`tokenHash: null`. Claim se gradi iz credentiala stvarno pročitanog iz storage-a;
red sa bilo kakvom current-column vrednošću ne može pasti na plaintext kopiju.
Legacy conditional delete dodatno zahteva `tokenHash: null`.

Po adversarial review-u verification sada ponovo meri vreme i posle session
encode/response pripreme, neposredno pre atomic claima. Token koji je bio važeći
pri lookup-u, ali istekne tokom tih koraka, dobija read-only late-expiry ishod:
nema claima, `emailVerified` upisa, sibling cleanup-a ni session cookie-ja.

Registracija koristi centralni generator i purpose-separated hash i u compat
fazi dual-write čuva oba oblika. Top-level failure log je stage-only
`{ stage: "REQUEST" }`. User i verification red ipak još nisu napravljeni u
jednoj transakciji; pravi resend/cooldown i outbox ostaju sledeća faza.

Novi `lib/email/auth-email-links.ts` pravi oba auth URL-a iz validiranog
kanonskog storefront `URL` objekta i strogo normalizovanog raw credentiala.
Malformed, razmacima okružen ili query-injected token fail-closed prekida slanje.

### XX.6. Provere i tačan status preseka

U trenutku ove dopune važi:

| Provera | Rezultat |
| --- | --- |
| kompletan `npm test` | 172 ukupno; 169 prolazi; 3 očekivana opt-in PostgreSQL skip-a; 0 failure-a |
| `npm run lint -- --quiet` | prolazi |
| `npm run typecheck` | prolazi |
| Prisma schema validate | prolazi sa lažnim loopback DB URL-om, bez DB konekcije |
| `git diff --check` | prolazi |
| probni produkcijski build | PASS; 91/91 stranica, lažne CI tajne/URL-ovi i namerno nedostupan `127.0.0.1:9` DB URL; očekivani DB safe-default logovi, bez produkcione konekcije |
| real-PostgreSQL migracija/smoke/test | lokalno nije pokrenuto; kompletno prošlo na izolovanom PostgreSQL 16 servisu u exact-head i post-merge CI-ju |
| PR/exact-head/post-merge CI | PR #16 spojen samo u V2; oba run-a SUCCESS, release/deploy poslovi SKIPPED |

Tri skip-a su real-DB reservation-cleanup, email-verification i novi
password-reset-confirm scenario. Workflow dobija
`RUN_PASSWORD_RESET_CONFIRM_DB_TESTS=true`; exact-head i post-merge CI su ga
izvršili nad izolovanim PostgreSQL servisom zajedno sa migracijom i ojačanim DB
smoke-om.

Produkcijska baza nije čitana ili kontaktirana, a nova migracija nije lokalno
primenjena. Sadržaj `.env` nije ručno otvaran niti ispisivan; build loader ga je
automatski učitao, ali su DB, auth, site URL i card-payment vrednosti eksplicitno
pregazile lažne CI vrednosti. Naknadni real-DB dokaz odnosi se isključivo na
praznu izolovanu GitHub Actions PostgreSQL 16 bazu, ne na produkciju.

### XX.7. Preostali bezbedni redosled

Posle završenog lokalnog builda, finalnog review-a i uspešnog V2-only PR/CI
dokaza, produkcioni DB rollout i dalje mora ići fazno:

1. audit duplikata, backup/restore i lock-time plan;
2. kontrolisana compat expand primena;
3. runtime dokaz hash-first/rollback ponašanja;
4. zaseban prelaz novih upisa sa dual-write na hash-only;
5. čekanje najdužeg auth-token TTL-a plus dogovoreni grace period uz nula
   legacy fallback čitanja;
6. tek onda contract migracija koja uklanja plaintext kolone/indekse;
7. atomska registracija, resend/cooldown/outbox, verified-login audit/backfill,
   session revocation i shared limiter/trusted-proxy ugovor.

Nisu menjani server, produkcioni podaci/tajne, DNS/TLS/proxy, PM2, GitHub
`production` Environment ili production secrets/variables. Nije napravljen
release tag i ništa nije pušteno live. Live ostaje poslednja posebno odobrena
faza.

### XX.8. PR #16, exact-head i post-merge CI dokaz

Auth-token/reset-claim kod je integrisan isključivo u kanonsku V2 granu:

| Dokaz | Rezultat |
| --- | --- |
| Feature commit | `b6c7aada0a692b826ff04443308f62584c96fe0a` |
| PR | [#16](https://github.com/biozencaj-stack/narodnanosnja/pull/16), base `verzija/v2.0-univerzalna-platforma` |
| Exact-head run | [`33313169708`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33313169708), attempt 1, SUCCESS na tačnom feature SHA-u |
| Exact-head poslovi | `Provera verzije` SUCCESS; `Potvrdi V2 release` SKIPPED; `Objavi na produkciju` SKIPPED |
| V2 merge | `8cf83e56be9cf0775db92ba9319eac5d993994e0` |
| Post-merge run | [`33313329660`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33313329660), attempt 1, SUCCESS |
| Post-merge poslovi | `Provera verzije` SUCCESS; `Potvrdi V2 release` SKIPPED; `Objavi na produkciju` SKIPPED |
| Remote V2 head | `8cf83e56be9cf0775db92ba9319eac5d993994e0` |
| Release tagovi | nema `prodavnica-v2-*` tagova |

Oba kompletna `Provera verzije` posla podigla su PostgreSQL 16, izvršila
`prisma migrate deploy`, drift proveru i ojačani DB invariant smoke, a zatim
sva tri opt-in DB integration testa koja su lokalno bila preskočena. Prošli su
i kompletan test paket, lint, TypeScript, Chromium COD E2E i produkcijski
build. Migracija je time dokazana na praznoj izolovanoj CI bazi, ali nije
primenjena na produkcionu bazu.

GitHub trenutno ima pet deployment zapisa, ali svih pet pripada istorijskom
presentation `main`/`github-pages` toku; najnoviji je iz
`2026-08-30T08:30:02Z`. Nijedan zapis ne koristi feature/merge V2 SHA ili V2
ref, niti environment `production`. Tačan zaključak za ovaj presek je zato
**0 V2/production deployment zapisa**, a ne globalno nula GitHub deploymenta.
Server, produkciona baza/migracija, tajne, release tag i live sajt ostali su
netaknuti.
