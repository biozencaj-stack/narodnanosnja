# Izmene — dnevnik rada

Zapis svega što je urađeno na projektu narodne nošnje, sa razlozima i zamkama
na koje se naišlo. Namenjeno je i tebi i svakom ko posle preuzme rad.

Poslednja dopuna: 31. avgust 2026.

> **Operativni presek na dan 31. avgusta 2026.** Prodavnica je tada puštena
> uživo na <https://narodnanosnja.rs>, sa HTTPS-om i namerno isključenim
> indeksiranjem. Aktivni produkcijski kod je bio
> `2efbb76d4adcfa8d1e5fe335cb59f411d0c65cbe`. PostgreSQL je imao osam migracija
> iz tadašnjeg lanca, runtime nalog ograničene CRUD grantove nad 42 eksplicitne
> aplikacione tabele, a novi administratorski nalog je napravljen i proverena je
> stvarna prijava. Odeljci XXIII–XXVII na kraju ovog fajla zamenjuju starije
> istorijske tvrdnje da V2 još nije javno objavljen.
>
> **Ovo više nije trenutno stanje.** Od 5. septembra 2026. baza ima svih
> **devet** migracija, a grana `verzija/v2.0-univerzalna-platforma` je odmakla
> na `104e1af` sa sekcijama stranica. Za stanje posle ovog datuma čitaj
> `docs/DETALJAN-IZVESTAJ-RADA-DO-2026-09-05.md` i `docs/V2-ROLL-OUT.md`;
> ovaj odeljak zadrži kao datirani zapis, ne kao opis produkcije.

## Gde je koji dokument

Zapisa ima više i lako je otvoriti pogrešan. Poređano po dubini:

| Dokument | Obim | Šta pokriva |
| --- | --- | --- |
| **`docs/DETALJAN-IZVESTAJ-RADA-DO-2026-08-30.md`** | 36 glavnih odeljaka | **Konsolidovan presek rada do verified-login etape.** Implementirano stanje, razlozi, Git/PR/CI dokazi, ključni fajlovi, P0/P1/P2 dug, preporučeni redosled i tadašnji produkcioni checklist |
| **`docs/DETALJAN-DNEVNIK-IZMENA.md`** | 44 odeljka | **Najdetaljniji presek razvoja do verified-login etape.** Svaka V2 izmena, fajl po fajl: bezbednosne granice, checkout, admin politika, Prisma šema, CI/CD i tada poznati blokatori |
| **Ovaj fajl (`IZMENE.md`)** | hronološki master dnevnik | Celokupna istorija, odluke i najnoviji operativni presek, uključujući DB-authoritative session rad i produkciju od 31. avgusta |
| `docs/ARCHITECTURE-V2.md` | 4 KB | Arhitektonske granice platforme |
| `docs/CATALOG-MIGRATION-PLAN.md` | 10 KB | Redosled prelaska na generički katalog |
| `docs/V2-ROLL-OUT.md` | 6 KB | Postupak puštanja V2 u produkciju |
| `docs/GITHUB-DEPLOY.md` | 5 KB | Podešavanje objavljivanja |
| `docs/PRISMA-BASELINE.md` | 3 KB | Baseline migracija |
| `PREGLED_PROJEKTA_2026-08-29.md` | 770 linija | U repou prezentacionog sajta — read-only pregled **oba** dela projekta |

Ako tražiš aktuelno „šta je urađeno i šta je ostalo“, ovaj fajl je sada
merodavna ulazna tačka. Za veoma dubok pregled ranijih V2 izmena otvori
`docs/DETALJAN-IZVESTAJ-RADA-DO-2026-08-30.md` i
`docs/DETALJAN-DNEVNIK-IZMENA.md`; za session arhitekturu i migraciju
pojedinačnih potrošača otvori
`docs/DB-AUTORITATIVNE-SESIJE-PLAN-I-DNEVNIK.md`.

---

## Šta je projekat

Projekat ima **dva odvojena dela**, u dva radna direktorijuma ali — od 29.
avgusta — u **jednom zajedničkom GitHub repozitorijumu**:

| Deo | Radni direktorijum | Grana na GitHubu | Stanje |
| --- | --- | --- | --- |
| **Prezentacioni sajt** | `~/Desktop/narodnja nosnja` | `main` | Uživo na GitHub Pages |
| **Prodavnica** | `~/Desktop/narodnanosnja-prodavnica` | `verzija/v2.0-univerzalna-platforma` | **Produkcija je uživo** na `https://narodnanosnja.rs`; aktivni SHA `2efbb76` |

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

To je istorijski status etape XIX. Atomska registracija i stvarni resend/
cooldown kasnije su implementirani u odeljku XXI; outbox, verified-login
audit/backfill i shared limiter i dalje nisu završeni.

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

Ovo je istorijska granica etape XX. User+credential transakcija i resend su
zatvoreni u kodu kroz XXI, dok durable outbox ostaje pre-live blokator.

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
| Remote V2 head pri PR #16 post-merge proveri | `8cf83e56be9cf0775db92ba9319eac5d993994e0` |
| Release tagovi | nema `prodavnica-v2-*` tagova |

Oba kompletna `Provera verzije` posla podigla su PostgreSQL 16, izvršila
`prisma migrate deploy`, drift proveru i ojačani DB invariant smoke, a zatim
sva tri opt-in DB integration testa koja su lokalno bila preskočena. Prošli su
i kompletan test paket, lint, TypeScript, Chromium COD E2E i produkcijski
build. Migracija je time dokazana na praznoj izolovanoj CI bazi, ali nije
primenjena na produkcionu bazu.

Read-only GitHub provera 30. avgusta 2026. našla je pet deployment zapisa, ali
svih pet pripada istorijskom presentation `main`/`github-pages` toku; najnoviji
je iz
`2026-08-30T08:30:02Z`. Nijedan zapis ne koristi feature/merge V2 SHA ili V2
ref, niti environment `production`. Tačan zaključak za ovaj presek je zato
**0 V2/production deployment zapisa**, a ne globalno nula GitHub deploymenta.
Server, produkciona baza/migracija, tajne, release tag i live sajt ostali su
netaknuti.

---

## XXI. P1 atomska registracija i verification resend — 30. avgust 2026.

Peta P1 auth etapa zatvara dve recovery granice koje su u prethodnim odeljcima
namerno ostale otvorene: parcijalno kreiranje naloga bez verification
credentiala i odsustvo samouslužnog, enumeration-safe resend toka. Kod je
implementiran na grani `ispravka/v2-atomska-registracija-resend` kao feature
`964831f490b54a3f5b11ec0cecce8b562551d4d8`. Kroz
[PR #18](https://github.com/biozencaj-stack/narodnanosnja/pull/18), sa base
granom isključivo `verzija/v2.0-univerzalna-platforma`, spojen je 30. avgusta
2026. u 14:46:32 UTC kao merge
`15c18cf1de19ceee4de4a06eff28bf7114d3fc19`.

Ova etapa je razvojni/CI presek. Produkciona baza nije čitana ili menjana,
migracija nije primenjena na server, `.env` i produkcione tajne nisu čitane,
GitHub `production` Environment nije menjan, release tag nije napravljen i
ništa nije pušteno live. Presentation `main` ostaje odvojen; workflow koji će
na svaki push te grane objaviti novu verziju prezentacionog sajta ostaje
namerno poslednja, posebno odobrena sekcija rada.

### XXI.1. Atomska registracija bez orphan naloga

Registraciona route logika izdvojena je iz produkcijske kompozicije u
testabilni factory i servis. `/api/auth` je globalno izuzet za legitimne
NextAuth callbackove, pa registration POST sada sopstveni trusted same-origin
guard izvršava pre limitera, JSON parsiranja, tokena, SMTP konfiguracije,
bcrypt-a ili baze. Prihvata se samo očekivani request shape; nepoznata polja,
ne-string vrednosti, control znakovi i prekoračenja granica za ime, prezime,
email i telefon padaju pre skupog ili account-dependent rada.

Application body guard pre JSON parse-a zahteva JSON `Content-Type`, odbija
svaki `Content-Encoding`, fail-closed proverava deklarisani `Content-Length` i
čita najviše 4096 stvarnih streaming bajtova. Chunked ili missing-length zahtev
zato ne može zaobići registration limit.

Lozinka koristi centralnu bcrypt zaštitu od najviše 72 UTF-8 bajta. Granica se
proverava u ruti, u `hashPassword()` kao defense-in-depth i pri verify-u, tako
da dve lozinke koje se razlikuju tek posle bcrypt truncation granice ne mogu
biti tretirane kao ista vrednost. Email prolazi kroz jedan centralni
normalizer: maksimalno 254 znaka, trim/lowercase kanonizacija i konzervativni
single-mailbox format. Display name, komentar, grupa, lista primalaca, navodnici
i ostali Nodemailer address-expression metaznaci nisu dozvoljeni.

Pre persistence-a nastaju raw verification token i purpose-separated hash,
validira se kanonski storefront URL, pravi SMTP transport i renderuje kompletna
verification poruka. Vraćeni delivery callback je jedina funkcija koja kasnije
poziva `sendMail()`. Bcrypt se završava van transakcije, a tek neposredno pre
DB granice meri se `issuedAt`, da sporo hashovanje ne skrati token TTL ili
cooldown. Production kompozicija taj instant dobija iz validiranog PostgreSQL
`clock_timestamp()`, ne iz sata Node procesa, pa početni TTL/cooldown/prozor i
kasniji resend koriste isti autoritativni clock domen.

`registerAccount()` u jednoj transakciji pravi:

- `User` sa normalizovanim emailom, bcrypt hashom, imenima i opcionim telefonom;
- početno verification throttle stanje;
- `EmailVerification` sa jednočasovnim raw+hash compat credentialom.

Ako verification insert zakaže, User insert se rollback-uje. Novi nalog dobija
`verificationEmailNextAllowedAt = issuedAt + 60s`, početak fiksnog 24-časovnog
prozora u `issuedAt` i brojač `1`, jer se initial verification email računa u
maksimum od pet poruka tokom tog prozora.

Concurrent unique-email P2002 nije automatski „existing”. Tek posle rollback-a
radi se kanonski email lookup. Pronađeni nalog daje privatni existing ishod;
unique token/hash kolizija bez tog naloga ostaje operativna greška. Tako
ekstremno malo verovatna credential kolizija ne može biti pogrešno proglašena
za duplikat korisnika.

### XXI.2. Enumeration-safe registracioni odgovor i recovery

Novo kreiran i postojeći email dobijaju byte-identical private HTTP 202, sa
istim JSON telom i no-store/no-referrer/noindex zaglavljima. Poruka govori samo
da će uputstvo biti poslato ako je registracija moguća; ne potvrđuje postojanje
naloga, uspešan insert ili SMTP isporuku.

Account-dependent persistence put dobija zajednički response floor od 900 ms i
kriptografski slučajan jitter od 0 do 200 ms. Padding sužava praktičnu timing
razliku između uspešnog INSERT-a i unique-conflict lookup-a, ali se dokumentuje
isključivo kao defense-in-depth. Nije formalna constant-time garancija, shared
abuse zaštita ili zamena za durable background red.

Posle commita Next.js `after()` dobija callback. Za nov nalog callback predaje
već pripremljenu poruku SMTP-u. Za existing ishod recovery prolazi kroz isti
resend servis i njegova verified/cooldown/24h-quota pravila, umesto da
registraciona ruta dobije drugi account-dependent odgovor. Sinhroni scheduler
kvar posle uspešnog persistence-a i SMTP delivery greška ne menjaju već
prihvaćeni 202; stage-only log ne sadrži email, ime, token ili raw exception.
Eksplicitna resend stranica ostaje korisnički recovery put.

### XXI.3. Stvarni verification resend sa DB throttle-om

Dodata je korisnička `/verify-email/resend` stranica i
`POST /api/auth/verify-email/resend`. Login, uspešna registraciona poruka i
nevažeća/istekla confirmation stranica vode ka tom toku. UI jasno kaže da se
između zahteva čeka najmanje jedan minut i da ranije primljen, još neistekao
link ostaje važeći.

Resend POST prvo proverava trusted same-origin, zatim account-independent IP
limiter i tačan plain JSON objekat sa jednim `email` poljem. JSON media type je
obavezan, encoded body se odbija, a deklarisani i stvarni streaming body imaju
limit 1024 bajta. Za svaki validan
email čiji je `after()` callback uspešno registrovan odmah vraća isti private
202. Lookup naloga, verified stanje, cooldown, kvota, token i SMTP ne učestvuju
u response putu. Nepostojeći, već verifikovan, cooling-down i quota-exhausted
nalog privatno završavaju bez slanja. Malformed input, limiter i sinhroni
scheduler kvar mogu vratiti 400/429/503 jer nastaju pre account lookup-a.

Privatni pipeline radi sledeće:

1. lookup normalizovanog emaila;
2. no-op za odsutan ili već verifikovan nalog;
3. centralno generisanje raw tokena i tačnog email-verification hash-a;
4. priprema kanonskog URL-a, SMTP transporta i poruke pre DB mutacije;
5. User-first transakcioni throttle/credential commit;
6. SMTP poziv tek posle uspešnog commita.

SMTP greška posle commita ostavlja novi token, cooldown i allowance broj.
Udaljeni SMTP server je možda prihvatio poruku pre gubitka odgovora, pa bi
automatsko brisanje eventualno isporučen link učinilo nevažećim. Log nosi samo
kontrolisanu fazu.

### XXI.4. User-first konkurentnost, fixed window i retained links

Resend transakcija uzima `FOR UPDATE` lock nad tačnim `User` redom pre čitanja
DB sata. Tek nakon dobijenog lock-a čita `clock_timestamp()`, pa lock-wait vreme
ne može skratiti 60-sekundni cooldown ili jednočasovni token TTL. Zaključani red
ponovo proverava očekivani email, `emailVerified`, cooldown i fixed-window
stanje.

Allowance je fiksni, ne sliding prozor:

- novi nalog počinje sa brojačem `1`, jer initial poruka ulazi u kvotu;
- u jednom 24-časovnom prozoru dozvoljeno je najviše pet ukupnih verification
  poruka;
- legacy red sa sva tri throttle polja `NULL` prvim resend-om otvara nov prozor
  i dobija broj `1`;
- istekli prozor se atomarno resetuje na novi početak i broj `1`;
- aktivan cooldown ili broj `5` završavaju bez token mutacije ili SMTP-a.

Uspešan resend briše samo tokene čiji je `expires <= issuedAt` i zatim dodaje
novi jednočasovni compat raw+hash token. Svaki ranije poslat neistekli link
namerno ostaje važeći, da nov zahtev ne poništi poruku koju korisnik upravo
otvara. Uspešna verifikacija je cleanup granica koja briše sve sibling tokene.

Verify commit je zato preuređen na isti `User → EmailVerification` lock
redosled. Conditional User update claim-uje samo još neverifikovan nalog,
postavlja `emailVerified` i čisti sva tri throttle polja. Tek zatim conditional
token claim troši tačan, još važeći stored credential. Token conflict baca
grešku unutar iste transakcije i rollback-uje User promenu. Verify-vs-resend
trka tako može završiti ili potpunom verifikacijom bez tokena ili uspešnim
resendom nad neverifikovanim nalogom, nikada parcijalnom kombinacijom.

### XXI.5. Šema, migracija i DB smoke

`User` dobija tri nullable/no-default kolone:

- `verificationEmailNextAllowedAt DateTime?`;
- `verificationEmailResendWindowStartedAt DateTime?`;
- `verificationEmailResendCount Int?`.

Migracija `20260830010000_expand_email_verification_cooldown` je kompatibilni
expand bez `INSERT`, `UPDATE`, `DELETE`, defaulta, backfill-a ili dedicated
indeksa. Equality pristup koristi već postojeći User ID. PostgreSQL nullable
column add bez defaulta je metadata-only, ali `ALTER TABLE` ipak zahteva kratak
`ACCESS EXCLUSIVE` lock, pa SQL koristi `search_path = pg_catalog, public`,
`lock_timeout='10s'` i `statement_timeout='2min'`.

DB invariant smoke proverava postojanje, nullability, tačne PostgreSQL tipove,
milisekundnu preciznost timestamp polja, odsustvo defaulta i odsustvo
jednokolonskih throttle indeksa. Migracija još nije primenjena na produkciju.
Pre toga ostaju obavezni read-only audit, proverljiv backup/restore, staging
proba, lock plan i pregled `prisma migrate status`/drift rezultata.

### XXI.6. Auth email sadržaj i tačno jedan primalac

Centralni auth template sloj sada escape-uje dinamičke HTML vrednosti: ime,
naziv prodavnice, kontakt, logo/home URL i verification/reset URL. URL helperi
i dalje strogo proveravaju kanonski storefront i raw credential. Auth primalac
se Nodemailer-u prosleđuje kao tačno jedan `{ name: "", address }` objekat
posle centralne normalizacije, pa caller input ne može postati display name,
grupa ili comma-separated lista.

Ovaj presek zatvara auth-email HTML/single-recipient nalaz. Ne tvrdi da su svi
order, wishlist, contact, reklamacioni ili job template-i prošli isti audit,
niti rešava MIME/magic-byte validaciju priloga.

### XXI.7. Testovi, CI i granica dokaza

Dodate su unit, route-contract i opt-in PostgreSQL provere za:

- strogu email normalizaciju i Nodemailer expression odbijanja;
- 72-byte UTF-8 bcrypt granicu;
- escaping i odloženi single-recipient verification email;
- atomic User+verification registration, unique-email race, rollback i
  token/hash koliziju;
- trusted-origin/body/password/response/scheduler registracioni ugovor;
- application-level Content-Type/Encoding/Length i 4096/1024 B streaming body
  limite za registration/resend;
- 900+0–200 ms response padding;
- resend immediate-202 i stage-only failure matricu;
- cooldown, fixed-window kvotu, legacy null state i retained unexpired links;
- dva resend radnika, DB-clock-after-lock, verify-vs-resend i rollback trke.

Workflow uključuje `RUN_REGISTRATION_DB_TESTS=true` i
`RUN_EMAIL_VERIFICATION_RESEND_DB_TESTS=true` uz izolovani PostgreSQL 16 servis.
Lokalno je kompletan paket imao 237 testova: 229 prolazi, 8 real-PostgreSQL
scenarija je očekivano preskočeno bez bezbedne lokalne baze i nema failure-a.
ESLint quiet, typecheck, Prisma validate, diff-check i probni build 93/93 su
prošli. Exact-head pull-request run
[`33317607438`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33317607438),
attempt 1, završio je SUCCESS na tačnom feature SHA-u; post-merge V2 push run
[`33317787952`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33317787952),
attempt 1, završio je SUCCESS na tačnom merge SHA-u. Oba kompletna CI-ja
izvršila su migration deploy, drift, DB smoke, lint, typecheck, svih 237 testova
sa svih 8 PostgreSQL scenarija, mobile Chromium E2E i build. U post-merge run-u
`Potvrdi V2 release` i `Objavi na produkciju` bili su SKIPPED. Remote V2 head je
tačno merge SHA, nema `prodavnica-v2-*` tagova, nema deployment zapisa za merge
SHA niti V2/production deploymenta; pet istorijskih deployment zapisa je
nevezano.

### XXI.8. Šta ostaje pre live-a

Atomska registracija i resend u kodu ne znače da je auth ili produkcija
završena. Pre live-a ostaju najmanje:

1. read-only audit postojećeg produkcionog `emailVerified` stanja;
2. kontrolisani backfill i recovery smoke, pa tek onda verified-login
   enforcement;
3. shared Redis/DB limiter i eksplicitan trusted-proxy/client-IP ugovor umesto
   procesnog LRU-a i sirovog `x-forwarded-for` identiteta;
4. reverse-proxy body/rate/timeout granice; završeni application streaming
   limiti ne sprečavaju upstream bandwidth/connection iscrpljivanje;
5. transactional auth-email outbox, durable worker, retry/deduplikacija,
   monitoring i shutdown/redeploy dokaz, jer Next.js `after()` nije durable;
6. audit/backup/restore i kontrolisana primena auth-token i cooldown expand
   migracija;
7. hash-only write, najduži TTL + grace, dokaz nula legacy fallbacka i contract
   uklanjanje plaintext tokena/indeksa;
8. session revocation posle promene lozinke i sveža role provera;
9. staging/runtime SMTP delivery, bounce i recovery smoke;
10. preostali non-auth email template i MIME/magic-byte hardening;
11. dependencies, legalni podaci, domen/HTTPS/proxy, operativni monitoring i
    ostali rollout gate-ovi.

GitHub `production` Environment, required reviewer, secrets/variables, release
tag, produkcijska baza/server i live aktivacija ostaju netaknuti. Poseban
main-push workflow koji objavljuje novu javnu verziju sajta ostaje poslednji
korak, u skladu sa eksplicitnim korisničkim redosledom.

---

## XXII. P1 verified-login audit/grace i auth security boundary — 30. avgust 2026.

Šesta P1 auth etapa priprema bezbedan prelaz sa istorijskog ponašanja, u kome je
ispravna lozinka bila dovoljna za login, na politiku koja zahteva potvrđen
email. Etapa nije pokušala da iz aktivnosti naloga izmisli dokaz vlasništva nad
mailbox-om. Umesto toga uvedeni su agregatni read-only auditi, kompatibilna
nullable grace kolona, eksplicitne `audit`/`staged`/`strict` politike i dodatno
ojačane sve auth write granice koje mogu promeniti lozinku, verifikaciju, ulogu
ili sesiju.

Kod je razvijan na grani
`ispravka/v2-verified-login-audit-grace`. Završni feature SHA, V2-only PR,
exact-head run, merge SHA i post-merge run sada su potvrđeni GitHub dokazima i
upisani u §XXII.12. Lokalni rezultat i GitHub PostgreSQL rezultat ostaju
odvojeno označeni, tako da nijedan očekivani lokalni DB skip nije predstavljen
kao CI prolaz.

Ova etapa je trenutno **audit-only**. Runtime sadrži staged i strict odluke, ali
staged preflight namerno ostaje blokiran dok se ne uvede DB revalidacija ili
opoziv rolling JWT sesija. Produkcijska baza nije otvarana ni auditirana,
migracija i backfill nisu izvršeni, produkcioni policy nije promenjen i ništa
nije pušteno live.

### XXII.1. Dva agregatna SQL audita bez PII izlaza

Dodata su dva odvojena skripta zato što jedan SQL ne sme da pretpostavi kolone
koje možda još ne postoje:

- `scripts/auth-email-verification-audit-legacy.sql` radi isključivo nad
  produkcionim baseline ugovorom pre auth expand migracija;
- `scripts/auth-email-verification-audit-current.sql` radi nad potpuno
  proširenom auth šemom sa `tokenHash`, resend throttle i login-grace kolonama.

Oba skripta počinju `REPEATABLE READ READ ONLY` transakciju, postavljaju
hardened `search_path`, UTC, lock/statement/idle timeout i uzimaju samo
`ACCESS SHARE` lockove nad tabelama potrebnim za konzistentan presek. PostgreSQL
sat se uzorkuje jednom, tek posle lockova i schema provere. Na kraju se uvek
radi `ROLLBACK`.

Izlaz je strogo `category|count`. Ne ispisuje se nijedan email, User ID,
credential, hash, token, pojedinačan timestamp, ime, adresa ili porudžbina.
Schema contract se fail-closed proverava po tabeli, koloni, PostgreSQL tipu,
nullability-ju i timestamp preciznosti, uz obavezan UTF-8 server encoding.
Legacy audit dodatno odbija expanded šemu, a current audit odbija baseline koji
nema sve očekivane kolone. Time pogrešan skript ne može proizvesti nepotpun
izveštaj koji izgleda validno.

Agregati obuhvataju:

- ukupan broj naloga i verified/unverified raspodelu po `CUSTOMER`, `OPERATOR`
  i `ADMIN` ulozi;
- kanonske emailove, vrednosti popravljive trim/lower operacijom, nepopravljive
  formate i grupe/redove koji bi se sudarili posle normalizacije;
- neočekivane role, non-finite/future `createdAt`, verification pre kreiranja i
  verification u budućnosti;
- neverifikovane naloge bez tokena, sa aktivnim tokenom ili samo isteklim
  tokenima;
- legacy plaintext/current hash/malformed verification credentiale, non-finite
  i future token vreme, kao i nevalidan token lifetime;
- verifikovane naloge sa zaostalim verification tokenima;
- aktivnost neverifikovanih naloga kroz porudžbine, adrese, wishlist, review,
  coupon usage i aktivan password-reset credential;
- `Session` redove isključivo kao telemetriju, nikada kao dokaz da je aktivni
  NextAuth JWT pročitan ili revalidiran iz baze;
- podržan bcrypt format i zaseban nalaz za validan format koji nije cost 12;
- u current auditu i celovitost resend throttle trojke, future/clock-skew
  stanje i login-grace: null, aktivan, istekao, non-finite, previše udaljen,
  pre `createdAt` ili pogrešno prisutan na već verifikovanom nalogu.

Aktivnost naloga je signal za recovery/grace odluku, ne dokaz da je korisnik
ikada kontrolisao mailbox. Zato audit nema `UPDATE`, `INSERT`, `DELETE`, DDL ili
automatsko postavljanje `emailVerified`.

### XXII.2. Staged enforcement preflight koji fail-closed ostaje blokiran

`scripts/auth-email-verification-enforcement-preflight.sql` je zaseban,
agregatni i read-only gate samo za staged rollout. Zahteva tri eksplicitne
`psql` promenljive:

```text
target_policy=staged
legacy_cutoff=YYYY-MM-DDTHH:MM:SS.mmmZ
grace_deadline=YYYY-MM-DDTHH:MM:SS.mmmZ
```

Nedostajuća promenljiva prekida psql script-error statusom `3`, preko
sanitizovanog SQL `RAISE EXCEPTION` pod `ON_ERROR_STOP` i pre transakcije.
PostgreSQL 16 CI je dokazao da `\quit 2`/`\quit 3` ne postavljaju proizvoljan
procesni kod, već završavaju statusom `0`; zato je taj fail-open oblik uklonjen
i iz preflight-a i iz oba current fixture-a. Vrednosti vremena prolaze tačan
ASCII UTC-millisecond format i round-trip proveru, umesto tolerantnog parsera.
`legacy_cutoff` ne sme biti u budućnosti. `grace_deadline` mora biti
najmanje sedam, a najviše trideset dana posle DB vremena preflight-a. Granica
je tačna: `createdAt < legacy_cutoff` označava legacy nalog, dok je nalog sa
`createdAt >= legacy_cutoff` post-cutoff i ne sme dobiti grace.

Za staged readiness preflight između ostalog blokira:

- email normalizaciju/duplikate i neočekivane role;
- neverifikovan `ADMIN` ili `OPERATOR` nalog;
- nevalidne/future/non-finite account i token timestampove;
- malformed verification credential ili zaostali token verifikovanog naloga;
- delimičan/nevalidan throttle i throttle na verifikovanom nalogu;
- bilo koji finite non-null grace koji nije tačno jednak jednom odobrenom
  `grace_deadline` timestampu;
- grace na verified ili post-cutoff nalogu, grace pre `createdAt`, legacy
  unverified nalog bez aktivnog grace-a i aktivan unverified nalog bez grace-a;
- nepodržan bcrypt ili podržan format sa cost vrednošću različitom od 12.

`target_policy=strict` se namerno odbija. Strict zahteva poseban kasniji gate,
posle grace perioda i zasebne odluke. Još važnije, kategorija
`preflight.jwt_session_revalidation.unavailable` je trenutno namerno `1` i
blocking čak i na inače čistom fixture-u. Zbog toga ovaj presek ne može dati
`preflight.ready=1`; psql završava statusom 3. Gate će smeti da se promeni tek
kada rolling JWT sesije zaista dobiju DB-authoritative policy/version
revalidaciju i kada za to postoji zaseban testiran presek.

### XXII.3. Kompatibilna grace migracija bez backfill-a

Prisma `User` model dobija:

```text
emailVerificationLoginGraceUntil DateTime?
```

Migracija `20260830020000_expand_verified_login_grace` dodaje jednu
`TIMESTAMP(3)` kolonu koja je nullable, nema default i nema dedicated indeks.
Nema DML-a, automatskog backfill-a ili promene postojećeg
`emailVerified` stanja. SQL koristi transakciju, `pg_catalog, public`
`search_path`, `lock_timeout='10s'` i `statement_timeout='2min'`.

Nullable column bez defaulta je metadata-only na podržanom PostgreSQL-u, ali
`ALTER TABLE` i dalje traži kratak `ACCESS EXCLUSIVE` lock. Zato produkcijska
primena i dalje zahteva read-only audit, svež backup i probni restore,
restore-clone/staging probu, pregled migration status/drift-a, odobren maintenance
prozor i nadgledanje locka. DB invariant smoke proverava tip,
`TIMESTAMP(3)` preciznost, nullability, odsustvo defaulta i odsustvo
jednokolonskog indeksa.

Novi registration nalog uvek dobija `emailVerificationLoginGraceUntil = NULL`.
Grace je rezervisan samo za eksplicitno pregledan legacy `CUSTOMER` backfill;
registracija ga ne može sama dodeliti. Uspešna verifikacija, privilegovano
provisioning ažuriranje i demo seed takođe čiste grace.

### XXII.4. Eksplicitna audit/staged/strict login politika

Dodate su dve runtime promenljive:

```text
AUTH_VERIFIED_LOGIN_POLICY=audit|staged|strict
AUTH_VERIFIED_LOGIN_GRACE_DEADLINE=YYYY-MM-DDTHH:MM:SS.mmmZ
```

Produkcija mora eksplicitno podesiti policy; nedostajuća vrednost ruši auth
konfiguraciju umesto da neprimetno isključi enforcement. Development/test bez
vrednosti zadržava compatibility-safe `audit`. Deadline je obavezan samo za
`staged`, mora biti kanonski UTC sa milisekundama, a aplikacija ga proverava
prema svežem DB vremenu. Staged odbija grace duži od 30 dana i svaki account
grace koji nije byte-for-time isti odobreni deadline.

Policy matrica je:

| Politika/stanje | Login odluka | Session/UI marker |
| --- | --- | --- |
| verified nalog, bilo koja politika | dozvoljen | `requiresEmailVerification=false` |
| unverified, `audit` | privremeno dozvoljen | `true`; coarse would-deny audit event |
| unverified `CUSTOMER`, `staged`, tačan aktivan grace | privremeno dozvoljen | `true` |
| unverified bez aktivnog/odobrenog grace-a u `staged` | generički odbijen | nema sesije |
| unverified `ADMIN`/`OPERATOR` u `staged` | generički odbijen | nema sesije |
| bilo koji unverified nalog u `strict` | generički odbijen | nema sesije |

Policy state fail-closed odbija nepoznatu ulogu, nevalidan datum, `createdAt`
u budućnosti, verification pre `createdAt` ili posle DB vremena i nekonzistentan
grace. Javni login ne objašnjava da li je problem email, lozinka, verifikacija,
policy ili nalog; očekivana odbijanja ostaju isti NextAuth
`CredentialsSignin`/`null` put.

Audit/grace korisnik dobija `requiresEmailVerification` u JWT/session claim-u i
trajan notice u korisničkom layout-u sa linkom ka enumeration-safe resend toku.
Notice ne potvrđuje postojanje bilo kog drugog emaila.

### XXII.5. Constant-work credentials login i svež DB snapshot

Credentials login više ne radi direktan `findUnique` sa svim profilskim
poljima pa zatim običan bcrypt. Nova granica je:

1. striktno kanonizovati sintaksno validan email;
2. pročitati samo `id` i `passwordHash`;
3. za svaki takav pokušaj izvršiti tačno jedan bcrypt compare;
4. tek posle uspešnog compare-a otvoriti svež DB snapshot;
5. zaključati User `FOR SHARE`;
6. ponovo pročitati email, exact password hash, role, ime, `createdAt`,
   `emailVerified` i grace;
7. tek posle lock wait-a uzorkovati
   `clock_timestamp()::timestamptz(3)`;
8. fail-closed potvrditi da email/hash/id nisu promenjeni i primeniti policy.

Fiksni javni dummy je cost-12 bcrypt i ne generiše se po zahtevu. Nepostojeći
nalog, malformed/unsupported stored hash, prazna/preduga lozinka i lookup
failure i dalje prolaze kroz jednu cost-12 proveru za svaki sintaksno validan
email pokušaj. Login prihvata samo `$2a$`/`$2b$` cost-12 hash, isti format koji
pravi aplikacija i koji proverava DB audit. Time se smanjuje account-existence
timing signal i sprečava da korumpirani proizvoljno skupi hash postane CPU
amplifikator.

Ako se između prvog čitanja i svežeg snapshot-a promene lozinka ili email,
nalog nestane ili policy stanje postane nevalidno, login se odbija bez sesije.
Observability nosi samo fazu i `INTERNAL_FAILURE` ili `AUDIT_WOULD_DENY`; tip
događaja uopšte ne može nositi email, user ID, password/hash ili raw exception.

Ovo je timing defense-in-depth, ne kompletna abuse zaštita. Validan-format email
i dalje može izazvati skupu cost-12 operaciju, pa credentials callback mora ući
u shared limiter/trusted-proxy paket pre live-a.

### XXII.6. DB-authoritative email verification bez stale JWT profila

Verification claim sada vezuje tačno ono što je pročitano pre pripreme sesije:
email, password hash, role, ime i prezime, uz exact token ID/User ID i stvarno
pročitani current-hash ili legacy credential. Current hash i dalje ima prioritet;
red sa bilo kakvim non-null current poljem ne može pasti na plaintext fallback.

Commit redosled je globalno usklađen:

1. pripremiti session token i kompletan success response/cookie bez DB mutacije;
2. `User FOR UPDATE` i poređenje svih očekivanih JWT/profile polja;
3. exact `EmailVerification FOR UPDATE`;
4. DB sat tek posle oba lock wait-a;
5. proveriti finite expiry i strogo `expires > verifiedAt`;
6. exact credential claim;
7. postaviti `emailVerified` na DB vreme i očistiti login grace/resend throttle;
8. obrisati sve sibling verification linkove u istoj transakciji.

Token koji istekne dok radnik čeka lock ne može proći na starom Node timestampu.
Role/password/email/name promena posle pripreme cookie-ja pravi conflict; cookie
se odbacuje, token ostaje retryable i nema parcijalnog User update-a. Token-row
zamena ili expiry takođe ne šalju pripremljenu sesiju. Route više ne koristi
Node wall clock kao autoritet za expiry.

### XXII.7. Password reset request, confirm i authenticated change

Javni reset-request ugovor ostaje enumeration-safe immediate 202, ali private
pipeline više ne može stale pre-promotion lookup-om vratiti reset credential na
upravo privilegovan nalog. Početni raw lookup čita minimalan `id`, email, role i
PostgreSQL `xmin` revision. Write transakcija zatim uzima User `FOR UPDATE`,
ponavlja email/role/xmin, čita DB vreme posle lock-a i tek onda zamenjuje reset
credential. Za slanje se koristi svež email/ime sa zaključanog reda. Promena
emaila, uloge, lozinke ili privilegovanog provisioning-a menja tuple revision i
privatno prekida stale zahtev.

Oba javna reset POST endpointa lokalno proveravaju trusted same-origin pre
limitera, body-ja i DB rada zato što je `/api/auth` globalno izuzet zbog
NextAuth callbackova. Request prihvata samo exact `{ email }`, a confirm samo
exact `{ token, password }` plain JSON objekat. Oba zahtevaju UTF-8 JSON bez
content encodinga i imaju deklarisani i stvarni streaming limit 1024 bajta;
oversize stream se otkazuje čim pređe granicu, dok tačno 1024 bajta prolazi.
Request limiter exception je stage-only generički private 503 i ne čita body,
čak ni kada reporter zakaže.

Reset-confirm sada radi `User FOR UPDATE → exact PasswordReset FOR UPDATE →
DB clock`. Expiry je autoritativno DB vreme posle oba čekanja. Exact stored
hash/legacy claim, password update, exact token consume, reset sibling cleanup
i brisanje svih `EmailVerification` linkova dele jednu transakciju. Poslednje je
važno jer je verification link passwordless session credential: posle uspešnog
reseta stari link ne sme ponovo izdati sesiju. Kvar bilo kog cleanup-a rollback-
uje i novi password hash i token claim.

Authenticated password change je izdvojen u testabilni servis. Radi minimalan
`id/passwordHash` pre-read, constant-work proveru postojeće lozinke i novo
hashovanje izvan transakcije. Zatim uzima User lock, radi exact old-hash CAS i
u istoj transakciji briše sve password-reset i email-verification credentiale.
Nalog obrisan ili promenjen posle bcrypt-a javno izgleda isto kao pogrešna
trenutna lozinka. Greške nose samo coarse fazu.

Ova tri toka još ne opozivaju već izdati rolling JWT. To ostaje eksplicitan
blokator, ne prećutna osobina.

### XXII.8. Privilegovani nalog i demo seed kao kontrolisane granice

`scripts/create-admin.ts` više nikada ne prihvata `--password`; secret ne sme
ostati u shell history/process listi. Lozinka stiže kroz ograničeni
`--password-stdin` ili maskirani TTY prompt. Postojeći nalog je no-op bez tačno
navedenog `--update-existing`, a role je isključivo `ADMIN` ili `OPERATOR`.

Privileged servis kanonizuje email, prihvata samo cost-12 hash i koristi jednu
transakciju. Postojeći User se zaključava prvi. Pošto `FOR UPDATE` ne može
zaključati nepostojeći red, create put uzima transaction-level advisory lock
izveden iz kanonskog emaila, ponavlja lookup i tek onda kreira. DB vreme se čita
posle svih row/advisory čekanja. Create ili eksplicitni update postavljaju
`emailVerified` na DB vreme, brišu grace i throttle i uklanjaju sve verification
i reset credentiale. Rezultat je samo `created`, `updated` ili `exists`; raw DB
greške i PII se ne ispisuju. CLI izričito upozorava da stari JWT-ovi nisu
opozvani.

Demo seed koristi jedan centralni cost-12 hash, upisuje demo naloge kao
verifikovane sa `grace=NULL` i transakciono čisti njihove verification/reset
tokene. Pre prvog DML-a zahteva tačno `DEMO_DATABASE_SEED=true`, PostgreSQL URL
sa odvojenim `demo|e2e|test|provera` markerom, odbija svaki `prod`,
`production` ili `live` substring i potvrđuje da `current_database()` odgovara
URL cilju. To nije backfill ili alat za produkciju.

Time su jedine namerne „verified without mailbox click” granice eksplicitni
privileged provisioning i bezbedno ograničen demo seed. Obična registracija
uvek ostaje neverifikovana i bez grace-a.

### XXII.9. Jedinstveni auth DB clock i lock redosled

Svi auth tokovi dotaknuti ovom etapom koriste
`clock_timestamp()::timestamptz(3)`, usklađeno sa `TIMESTAMP(3)` kolonama:

- credentials policy snapshot;
- registracija i resend;
- email verification;
- password-reset request i confirm;
- privileged provisioning.

Vreme se meri posle relevantnog lock wait-a, ne pre njega. User je zajednički
prvi serialization red za verify, resend, reset, password change i privileged
mutacije; credential red se zaključava posle User-a. Time se smanjuju deadlock
kombinacije i zatvaraju expiry/policy odluke zasnovane na zastarelom
application clock-u.

### XXII.10. Test i CI matrica

Dodate ili proširene provere pokrivaju:

- exact legacy/current aggregate izveštaje na izolovanim fixture bazama;
- legacy-skript-na-current i current-skript-na-legacy fail-closed ponašanje;
- missing/invalid/canonical cutoff i deadline, 7–30 dana granicu, strict
  odbijanje i namerni JWT blocker;
- policy config, finite timestamp invarijante i audit/staged/strict matricu;
- tačno jedan bcrypt compare, fixed dummy, unknown/malformed/cost mismatch,
  stale email/password/deletion i coarse report;
- fresh snapshot pod User `FOR SHARE` lockom i DB sat posle lock wait-a;
- token-row expiry tokom čekanja i role/password/profile konflikt posle
  pripremljenog verification cookie-ja;
- reset-request `xmin` stale race, reset-confirm expiry/claim/rollback i
  opoziv verification linkova;
- authenticated password-change CAS, stale/deleted user i atomski rollback
  token cleanup-a;
- concurrent privileged create, advisory serialization, DB-clock-after-lock i
  rollback/retry posle stvarnog cleanup kvara;
- verified/no-grace registration, seed i provisioning invarijante.

Fixture runner je CI-only, zahteva loopback PostgreSQL i tačno odobrenu test
bazu. Kreira tri namenski imenovane izolovane baze: legacy, expanded-blocked i
expanded-clean; na kraju ih uklanja. Parser prihvata isključivo jedinstvene
`category|count` redove. Workflow na praznom PostgreSQL 16 servisu pokreće
migration deploy, drift, DB invariant smoke, izolovane audit fixture-e i
opt-in real-DB auth testove preko `RUN_VERIFIED_LOGIN_DB_TESTS=true`, pored
ranijih reset/verification/registration testova.

PostgreSQL 16 exact-head izvršaj zatvorio je i četiri klase grešaka u samim
real-DB dokazima: predugačke test email local-part vrednosti sada prolaze isti
runtime normalizer; resend/verify timestamp se proverava između DB-clock
granica umesto lažne exact jednakosti; bound backend PID se kastuje iz Prisma
`bigint` u `integer` za `pg_blocking_pids`; privileged advisory lock zadržava
blocking transaction-level semantiku, ali svoj PostgreSQL `void` rezultat
zatvara u `MATERIALIZED` CTE i Prismi izlaže samo fail-closed boolean potvrdu.
Produkcijski validator i verification DB-clock pravilo nisu oslabljeni da bi
testovi prošli.

Konačan zbir testova i finalni lint/typecheck/Prisma/build rezultat namerno se
ne upisuju dok stablo ne bude stabilno i exact-head CI ne završi. Merodavna je
samo tabela §XXII.12.

### XXII.11. Audit-only status i preostali blokatori

Najvažniji otvoreni nalaz je NextAuth v4 rolling JWT model. JWT callback
trenutno kopira role i `requiresEmailVerification` pri izdavanju/loginu, ali
aktivan token se ne vraća u bazu na svako korišćenje. Posledice su:

- prelazak `audit → staged/strict` ne izbacuje već aktivnu unverified sesiju;
- istek grace-a ne opoziva JWT koji se i dalje obnavlja;
- password change/reset ili privileged role promena ne opozivaju druge uređaje;
- role i verification marker mogu ostati zastareli;
- cross-device verifikacija ne mora odmah ukloniti notice u staroj sesiji.

Zato staged preflight ostaje namerno crven. Sledeća security sekcija mora
uvesti DB-authoritative session/policy version, opoziv pri password/role/
verification mutaciji, revalidaciju na zaštićenim granicama i real-DB race
testove. Tek posle toga može se pregledano ukloniti hardcoded JWT blocker.

Drugi obavezni blokatori su:

1. shared Redis/DB limiter za credentials i ostale auth/business tokove;
2. tačan trusted-proxy hop i kanonski client-IP ugovor; sirovi prvi
   `X-Forwarded-For` i per-process LRU nisu dovoljni;
3. reverse-proxy rate/body/timeout/connection zaštita, posebno zbog cost-12 CPU
   rada za validan-format email;
4. transactional auth-email outbox, durable worker, retry/dedupe, monitoring i
   shutdown/redeploy dokaz; Next.js `after()` nije durable;
5. kontrolisan produkcioni aggregate audit, backup/restore, staging/clone
   migracija i ručno pregledana klasifikacija legacy naloga;
6. odobren backfill samo grace kolone za opravdane legacy `CUSTOMER` naloge;
   nikada automatski `emailVerified` na osnovu aktivnosti;
7. poseban hash-only write presek, najduži token TTL + grace, dokaz nula legacy
   fallbacka i tek zatim contract uklanjanje plaintext kolona/indeksa;
8. SMTP runtime/bounce/recovery, preostali non-auth template/MIME hardening,
   dependency, legalni, proxy, backup i monitoring gate-ovi;
9. zaseban strict preflight posle isteka grace perioda i recovery dokaza.

### XXII.12. Šta nije rađeno i završni Git/CI dokaz

U ovoj etapi nije čitana produkcijska baza niti stvarni `.env`, nisu dobijeni
realni audit counts, nije izvršena migracija, backfill ili izmena
`emailVerified`, nije poslat produkcijski email i nije promenjen server, DNS,
TLS, PM2/nginx, GitHub `production` Environment, secret, variable ili reviewer.
Nisu aktivirani staged/strict, release tag ili deploy. V2 nije spojen u
presentation `main`.

| Stavka | Dokaz/status |
| --- | --- |
| Feature grana | `ispravka/v2-verified-login-audit-grace` |
| Završni feature commit | `aa1afdb3de3cc8b9df15fa3576242f5445adbca0` |
| V2-only PR | [PR #20](https://github.com/biozencaj-stack/narodnanosnja/pull/20), base `verzija/v2.0-univerzalna-platforma`, merged |
| Exact-head CI run/attempt/SHA | [run `33324304744`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33324304744), attempt `1`, `aa1afdb3de3cc8b9df15fa3576242f5445adbca0`, `SUCCESS`, 17:06:17Z–17:09:25Z |
| V2 merge SHA i vreme | `3ceb1f3915ad63d45a30758254966d3904d1a86f`, `2026-08-30T17:11:08Z` |
| Post-merge V2 run/attempt/SHA | [run `33324541873`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33324541873), attempt `1`, merge SHA `3ceb1f3915ad63d45a30758254966d3904d1a86f`, `SUCCESS`, 17:11:15Z–17:14:03Z |
| Konačan lokalni `npm test` zbir | `316` ukupno / `299` pass / `17` očekivanih real-PG skip / `0` fail |
| Final lint/typecheck/Prisma/diff/build | Lokalni lint, typecheck i diff-check `PASS`; exact-head CI Prisma validate, migration deploy, drift i production build `PASS` |
| Audit fixture-i i real-PostgreSQL auth scenariji u CI-ju | `PASS: isolated aggregate auth audit fixtures`; PostgreSQL 16 test zbir `316/316 PASS`, `0` skip, `0` fail |
| Release/deploy poslovi u oba run-a | `Potvrdi V2 release = SKIPPED`; `Objavi na produkciju = SKIPPED` u exact-head i post-merge run-u |
| `prodavnica-v2-*` tagovi i V2/production deployment zapisi | `0` tagova; `0` deploymenta za merge SHA; `0` za V2 ref; `0` za `production` Environment |
| Produkcioni audit/migracija/backfill | **NIJE RAĐENO** |
| Produkcijski policy/live aktivacija | **NIJE RAĐENO**; audit-only razvojni presek |

Main-push workflow koji na svaku promenu `main` grane diže novu javnu verziju
sajta ostaje **isključivo poslednja sekcija ukupnog plana**, posle session
revalidacije/opoziva, shared limitera/trusted proxy-ja, outbox/hash-only rada i
svih ostalih produkcionih gate-ova.

---

## XXIII. DB-autoritativne sesije i migracija session potrošača — 30–31. avgust 2026.

Ova etapa je nastala zato što potpisani NextAuth JWT sam po sebi nije dovoljan
dokaz da je sesija i dalje dozvoljena. Pre ove izmene, token je mogao da nosi
staru ulogu, stari verification status ili dozvolu koja je u bazi već opozvana.
Promena lozinke, reset lozinke, promena privilegije ili promena centralne auth
politike zato nisu pouzdano prekidali već izdate rolling JWT sesije na drugim
uređajima.

Kompletan arhitektonski dnevnik ove etape nalazi se u
`docs/DB-AUTORITATIVNE-SESIJE-PLAN-I-DNEVNIK.md`. Ovaj odeljak daje
objedinjen pregled šta je stvarno dodato, šta je povezano u aktivni kod, šta je
pušteno na server i šta je i dalje namerno dormantno.

### XXIII.1. Izabrani model: JWT kao nosilac, PostgreSQL kao autoritet

Novi V2 model zadržava potpisani JWT, ali ga svodi na nosioca ograničenog skupa
claim-ova. Konačna serverska odluka treba da potvrdi u PostgreSQL-u da:

- konkretan Session red još postoji;
- Session pripada tačnom User redu;
- apsolutni rok nije istekao po PostgreSQL satu;
- `User.authSessionRevision` se poklapa sa revision vrednošću u sesiji;
- `AuthPolicyState.revision` se poklapa sa policy revision vrednošću u sesiji;
- trenutna uloga, profil i email-verification stanje iz baze dozvoljavaju
  zahtev.

Interna validacija razlikuje tri ishoda:

| Ishod | Značenje | Dozvoljeno ponašanje |
| --- | --- | --- |
| `valid` | Token, Session, User, revizije, politika i rok su potvrđeni | vratiti svež minimalni principal |
| `invalid` | Red nedostaje, opozvan je, istekao je ili se ugovor ne poklapa | tretirati kao nevažeću sesiju |
| `unavailable` | Baza ili autoritativna provera nisu dostupni | fail-closed `503`; nikada guest fallback za zaštićeni tok |

Pozitivan cross-request cache nije uveden. To je namerno: password/role/policy
revokacija ne sme imati skriveni cache TTL u kome stara dozvola još važi.

### XXIII.2. Session identitet, HMAC i apsolutni rok

Novi session identitet ima nasumičan 256-bitni `sid`:

- raw `sid` ostaje samo u potpisanom JWT-u;
- baza u `Session.sessionToken` čuva samo purpose-separated HMAC-SHA256 digest;
- canonical storage oblik je `v1:` plus 64 mala heksadecimalna znaka;
- read-only krađa baze zato ne daje direktan browser bearer credential;
- isti digest se koristi za insert, exact lookup i exact revoke.

Claim ugovor je sveden na `sv/sub/sid/ur/pr/sat/sae`:

- `sv` — verzija session ugovora;
- `sub` — User ID;
- `sid` — canonical raw session ID unutar potpisanog tokena;
- `ur` — User auth session revision;
- `pr` — centralna auth-policy revision;
- `sat` — apsolutno vreme izdavanja;
- `sae` — apsolutno vreme isteka.

`sae - sat` ne sme preći 24 sata. Refresh ne dobija novi 24-časovni prozor:
custom codec ograničava novi kriptografski `exp` na ostatak originalnog `sae`.
Time rolling NextAuth ponašanje ne može produžavati jednu sesiju beskonačno.

Edge-safe parser i Node-only kriptografija su razdvojeni:

- `lib/auth/session-claims-edge.ts` nema `node:*` ili `Buffer` dependency i
  može bezbedno u Edge/Proxy bundle;
- `lib/auth/session-claims.ts` sadrži Node `randomBytes` i HMAC deo;
- `lib/auth/session-jwt.ts` implementira strict, nerolling NextAuth
  encode/decode sloj;
- statički test ruši build ako Edge import lanac ponovo povuče Node API.

### XXIII.3. Prisma expand migracija

Dodate su kompatibilne, expand-only promene:

- `User.authSessionRevision Int @default(0)`;
- `Session.authSessionRevision Int?`;
- `Session.authPolicyRevision Int?`;
- `Session.issuedAt DateTime?`;
- indeks nad `Session.expires`;
- singleton `AuthPolicyState` sa revizijom, `audit|staged|strict` politikom,
  opcionim staged deadline-om i timestampovima.

Migracija je
`prisma/migrations/20260830030000_expand_authoritative_sessions/migration.sql`.
Session metadata je namerno nullable i bez defaulta, tako da stari i novi
procesi ne prave lažno kompletne redove. DB constrainti razlikuju:

- legacy Session: sva tri nova metadata polja su `NULL`;
- V2 Session: sva tri polja postoje, revizije su u dozvoljenom opsegu,
  `expires > issuedAt`, rok je najviše 24 sata i token je canonical HMAC
  digest.

`AuthPolicyState` može imati samo `id=1`. Početni red je
`revision=1, policy='audit'`, bez staged deadline-a. Migracija koristi
kontrolisane timeout-e i UTC u migracionoj transakciji. Dodatni preflight
`scripts/auth-session-expand-preflight.sql` read-only proverava da nijedan
postojeći legacy token već ne zauzima rezervisani `v1:<64 hex>` namespace.

`scripts/db-invariant-smoke.sql` je proširen pozitivnim i negativnim fixture
slučajevima za User revision, legacy/partial/V2 Session oblike, rok, HMAC
format i singleton policy ugovor. Fixture radi u transakciji koja se na kraju
rollback-uje.

### XXIII.4. Dormantni autoritativni core

Dodati su moduli koji formiraju buduću V2 granicu:

- `lib/auth/auth-policy-state.ts` — strict parser centralnog singletona;
- `lib/auth/authoritative-session-database.ts` — jedan PostgreSQL snapshot za
  Session, User, policy i DB sat;
- `lib/auth/authoritative-session-guard.ts` — strogo cookie decode → HMAC → DB
  validacija ponašanje;
- `lib/auth/authoritative-session-access.ts` — centralna customer/admin
  tri-state access semantika;
- `lib/auth/authoritative-session-server.ts` — Node server adapter;
- `lib/auth/session-jwt.ts` — versioned, nerolling token codec;
- prateći unit, source-safety i opt-in real-PostgreSQL testovi.

Jedan DB snapshot exact poredi JWT, Session, User i policy revision, User ID,
issued-at i absolute expiry. Vraća samo svež principal; raw SID, JWT i HMAC
digest se ne vraćaju višim poslovnim slojevima.

DB outage se ne prevodi u anonimnog korisnika. Za zahtev koji već nosi session
credential to bi bio authorization fail-open, pa se vraća retryable coarse
greška.

### XXIII.5. Atomska revokacija pri security write operacijama

Security write tokovi su prošireni tako da promena poverljivog stanja u istoj
transakciji:

1. zaključava User po unapred definisanom redosledu;
2. radi exact credential/state proveru;
3. menja lozinku, ulogu ili privileged stanje;
4. povećava `authSessionRevision` za jedan;
5. briše sve Session redove tog korisnika;
6. čisti pripadajuće verification/reset credentiale;
7. tek tada commit-uje.

Obuhvaćeni tokovi su:

- password-reset confirm;
- autentifikovana promena lozinke;
- privileged ADMIN/OPERATOR provisioning;
- demo-user seed u strogo ograničenoj test/demo bazi.

Ako revision bump, Session delete ili kasniji cleanup zakaže, cela mutacija se
rollback-uje. Nema stanja u kome je password promenjen, ali su stare sesije
slučajno ostale važeće zbog parcijalnog commita.

### XXIII.6. Dormantno izdavanje i rotacija V2 sesije

Dodate su testabilne orkestracije za buduću aktivaciju:

- credentials login može u jednoj transakciji zaključati User i policy,
  ponovo proveriti password/profile snapshot, pročitati DB sat, primeniti
  policy i insertovati HMAC-only Session red;
- email verification može opozvati stare sesije i izdati tačno jednu novu V2
  sesiju u istom commit-u u kome claim-uje verification credential;
- timestamp vrednosti su usklađene sa PostgreSQL `TIMESTAMP(3)` ugovorom;
- stale bcrypt/profile/policy snapshot, expiry tokom lock wait-a ili cookie
  priprema koja više ne odgovara User redu završavaju fail-closed.

Ove orkestracije su namerno ostale dormantne: nisu parcijalno povezane na
`authOptions`, jer bi istovremeno aktivan legacy i V2 issuer napravili dve
neusklađene klase credentiala.

### XXIII.7. Pouzdan current-session logout core

Built-in browser signout briše cookie, ali ne dokazuje da je DB Session red
opozvan. Zato je dodat dormantni logout redosled:

1. trusted same-origin POST;
2. strict V2 JWT decode;
3. HMAC iz `sid` claim-a;
4. exact delete samo tekućeg Session reda;
5. commit;
6. tek zatim bounded čišćenje versioned, legacy i chunked cookie imena.

Ako DB revoke ne uspe, rezultat je coarse `503`; sistem ne tvrdi da je logout
završen samo zato što je browser cookie lokalno uklonjen. Testovi proveravaju
exact revoke, replay i očuvanje sibling sesije na drugom uređaju.

### XXIII.8. Neutralni server-session facade

Uveden je zajednički ugovor u `lib/auth/server-session-contract.ts` i neutralni
facade u `lib/auth/server-session.ts`. Poslovna ruta više ne treba da zna da li
ispod nje radi legacy NextAuth ili budući DB-authoritative validator.

Važna trenutna činjenica: produkcijski facade je u ovom preseku i dalje
**legacy-only**. To omogućava kontrolisanu migraciju call-site-ova bez
parcijalnog cookie cutovera. Sam deploy V2 fajlova zato nije automatski
aktivirao dormantni session codec, V2 cookie, proxy cutover ili autoritativni
logout endpoint.

`lib/auth/server-session-callsite-inventory.test.ts` je AST/source kapija koja:

- broji sve raw `getServerSession`, `getToken` i neutralne session potrošače;
- održava exact allowlistu još nemigriranih call-site-ova;
- zahteva kanonski import i request-lazy resolver oblik;
- odbija module-scope session promise ili keš;
- odbija spread/computed/duplicate dependency override;
- odbija alternativni CommonJS, dynamic import, re-export ili namespace put;
- sprečava da brisanje autentifikacije izgleda kao uspešna migracija.

Posle wishlist batch-a frontier je:

- raw legacy potrošači: `93` poziva u `52` fajla;
- raw zajedno sa jednim centralnim facade čitanjem: `94/53`;
- neutralni resolver pozivi: `4` u `2` route fajla;
- neutralni resolver importi: `2/2`;
- `getToken`: nepromenjeno `2/2`.

### XXIII.9. Migriran consumer: checkout-data GET

`GET /api/user/checkout-data` je prvi realni consumer prebačen na neutralni
facade. Ruta je podeljena na:

- `lib/checkout/checkout-data-route.ts` — dependency-injected HTTP factory;
- `lib/checkout/checkout-data-route.test.ts` — izolovana session/HTTP matrica;
- `app/api/user/checkout-data/route.ts` — tanak production wiring.

Ugovor je:

- anonymous → postojeći `401`, bez DB poziva;
- unavailable, resolver throw ili malformed session → generički `503`;
- authenticated + missing User → postojeći `404`;
- DB lookup failure → coarse `500`;
- uspeh → samo eksplicitni profil i prva default adresa.

Svi odgovori nose `private, no-store`, `Pragma: no-cache`, `no-referrer` i
`noindex/noarchive` headere. Javna projekcija se konstruiše od tačno
dozvoljenih polja, tako da skrivena adapter polja ili sopstveni `toJSON` ne mogu
proširiti PII payload.

### XXIII.10. Migriran consumer: wishlist GET/POST/DELETE

Commit `ee2ac5f7e951f38572be51fddced2f5d1d94f539` prebacio je sva tri
`/api/wishlist` metoda sa direktnog `getServerSession(authOptions)` poziva na
request-lazy `resolveServerSession()` composition.

Promena je raspoređena na:

- `app/api/wishlist/route.ts` — tanak Prisma/facade composition root;
- `lib/wishlist/wishlist-route.ts` — stateless GET/POST/DELETE fabrike;
- `lib/wishlist/wishlist-route.test.ts` — 578 linija izolovanih testova;
- prošireni AST inventory gate;
- dopunjeni session dnevnik.

Bezbednosni i poslovni ugovor:

- vlasnik uvek dolazi iz `authenticated.principal.id`;
- eventualni `userId` iz request body-ja se ignoriše;
- auth se završava pre čitanja POST/DELETE body-ja;
- anonymous ostaje `401`, a session unavailable/throw/malformed je `503`;
- GET čita samo User-ove redove, sortira po `createdAt desc` i vraća samo
  `productId`;
- POST zadržava atomski compound-key `upsert`;
- DELETE koristi owner-scoped `deleteMany` i ostaje idempotentan za `count=0`;
- adapter rezultat se ručno projektuje da skrivena polja ili `toJSON` ne
  prošire odgovor;
- reporter dobija samo frozen `{ method, stage }`, bez exceptiona, User ID-a,
  product ID-a ili Prisma reda;
- svi odgovori imaju private/no-store/no-referrer/noindex headere.

Commit menja pet fajlova, sa 1.885 dodatih i 200 uklonjenih linija. Ne menja
Prisma šemu, migracije ni produkcione podatke.

### XXIII.11. Commit i CI trag ove etape

| Commit | Svrha |
| --- | --- |
| `9316e0e` | authoritative-session expand šema, migracija i DB invarijante |
| `baa39bd` | dormantni SID/HMAC/policy/JWT/DB validator core |
| `0790ccd` | atomska session revokacija u security write tokovima |
| `098cfcf` | dormantni credentials i verification V2 session issuer |
| `027b806` | transaction-local UTC korekcija |
| `e773a91` | apsolutni timestamp i coarse-stage dijagnostika |
| `6a42e49` | kanonski real-PG credentials fixture-i |
| `6af8114` | dormantni current-session logout core |
| `c9f7849` | dormantni autoritativni request guard |
| `d08fa32` | neutralni tranzicioni server-session facade |
| `23501d5` | mrtvi route cleanup i exact session call-site inventory |
| `7b81da6` | checkout-data customer consumer migracija |
| `ee2ac5f` | wishlist GET/POST/DELETE consumer migracija |

Dokumentovani exact-head GitHub run-ovi za pojedinačne faze su:

- `33326003849` — prvi expand;
- `33327741687` — dormantni core;
- `33328617960` — security revocation;
- `33330847915` — završni zeleni issuance/rotation presek;
- `33331632579` — logout core;
- `33333262290` — dormantni guard;
- `33334129994` — tranzicioni facade;
- `33336276720` — source inventory;
- `33342696902` — checkout-data consumer.

Wishlist presek je lokalno prošao:

- `12/12` factory HTTP/session/ownership testova;
- `3/3` AST inventory testova;
- kompletan suite `450` ukupno, `424` pass, `26` očekivanih opt-in
  real-PostgreSQL skipova i `0` fail;
- TypeScript, ciljane lint provere i `git diff --check`;
- production build i `93/93` statičke stranice.

### XXIII.12. Šta je deployovano, a šta nije aktivirano

Kod i expand šema iz ove etape postoje na produkcionom serveru, a migracija je
primenjena. Međutim, to ne znači da je kompletan DB-authoritative session
cutover završen.

Deployovano je:

- Prisma expand šema i `AuthPolicyState` audit singleton;
- dormantni V2 claim/HMAC/validator/issuer/logout moduli;
- security-write revision/revocation ponašanje;
- neutralni facade;
- checkout-data i wishlist call-site migracije;
- svi prateći testovi i source inventory gate.

Namerno nije aktivirano:

- V2 versioned cookie kao jedini browser credential;
- custom V2 encode/decode u aktivnom `authOptions` lancu;
- atomski V2 Session insert pri svakoj produkcionoj prijavi;
- proxy cutover sa JWT role snapshot-a na Node DB guard;
- autoritativni current-session logout HTTP endpoint;
- contract migracija koja bi legacy Session metadata učinila obaveznim;
- kompletna migracija preostalih raw session potrošača;
- uklanjanje svih legacy/session preflight blokera.

Zato se trenutno stanje opisuje kao: **schema/core deployed, active auth
cutover nije završen**. Ovo je važna granica za svaku buduću izmenu login,
logout, role ili proxy logike.

---

## XXIV. Fail-closed zabrana indeksiranja — 31. avgust 2026.

Pre puštanja na glavni domen traženo je da prodavnica bude javno dostupna za
pregled i dalji rad, ali da je Google i drugi pretraživači još ne indeksiraju.
To nije rešeno samo jednim `robots.txt` pravilom, već slojevitom aplikacionom i
HTTP zaštitom u commitu
`2efbb76d4adcfa8d1e5fe335cb59f411d0c65cbe` (`feat(seo): keep storefront out
of search by default`).

Commit menja šest fajlova, dodaje 79 i uklanja 12 linija. Ne menja Prisma šemu,
migracije, bazu ili podatke.

### XXIV.1. Jedan centralni environment prekidač

U `.env.example` i `lib/config/search-indexing.ts` uvedeno je:

```env
SEARCH_INDEXING_ENABLED="false"
```

Jedina vrednost koja omogućava indeksiranje je tačan string `"true"`:

```ts
environment.SEARCH_INDEXING_ENABLED === "true"
```

Nema trimovanja, case-insensitive parsera ili tolerantnog fallbacka. Sledeće
vrednosti sve ostavljaju indeksiranje isključeno:

- promenljiva nije postavljena;
- `false`;
- `TRUE`;
- ` true`;
- prazan string;
- bilo koja nepoznata vrednost.

Razlog je fail-closed konfiguracija: typo ili zaboravljena promenljiva ne smeju
slučajno otvoriti nezavršen sajt za indeksiranje.

`lib/config/search-indexing.test.ts` zaključava ovu matricu. Testira prazno
okruženje, `false`, pogrešan case, okolni razmak i jedinu dozvoljenu vrednost
`true`.

### XXIV.2. HTML metadata sloj

`app/layout.tsx` u `generateMetadata()` čita centralni prekidač.

Kada je indeksiranje isključeno, Next metadata generiše:

- `robots.index = false`;
- `robots.follow = false`;
- `googleBot.index = false`;
- `googleBot.follow = false`.

Kada se u budućnosti eksplicitno uključi:

- `index` i `follow` postaju `true`;
- GoogleBot dobija normalno indeksiranje i praćenje;
- dozvoljeni su veliki image preview, neograničen snippet i video preview.

Time HTML stranica sama nosi noindex signal, nezavisno od reverse proxy-ja.

### XXIV.3. HTTP `X-Robots-Tag` sloj

`next.config.ts` dodaje:

```text
X-Robots-Tag: noindex, nofollow, noarchive
```

Kada je indexing isključen, header je deo globalnih `securityHeaders` i
primenjuje se na `/:path*`. To pokriva HTML, API i druge odgovore koje crawler
može otkriti.

Kada se indexing uključi, globalni header se uklanja, ali osetljive credential
rute ostaju trajno noindex:

- `/newsletter/odjava`;
- `/api/newsletter/unsubscribe`;
- `/verify-email/:path*`;
- `/api/auth/verify-email/:path*`;
- `/reset-password/:token`.

Kompozicija je urađena tako da u trenutnom disabled režimu isti header ne bude
dodat dvaput kroz globalni i sensitive-route skup.

Na Nginx ivici je u produkciji dodat isti noindex signal kao dodatna odbrana.
Javna provera je potvrdila da finalni odgovor nosi header samo jednom, bez
duplikata koji bi otežali operativno tumačenje.

### XXIV.4. `robots.txt` ponašanje

`app/robots.ts` u disabled režimu namerno vraća:

```text
User-agent: *
Allow: /
```

Ovo na prvi pogled može delovati obrnuto, ali je namerno: crawler mora moći da
učita javnu stranicu i pročita njen `noindex` metadata/header. Potpuni
`Disallow: /` može sprečiti Google da vidi noindex i ostaviti već otkriven URL
u rezultatima bez sadržaja.

Dok je indexing isključen:

- crawler može da pročita noindex signal;
- sitemap se ne oglašava u `robots.txt`;
- stranica ostaje dostupna direktnim URL-om;
- noindex nije i ne predstavlja autentifikaciju.

Kada se indexing jednom eksplicitno uključi, vraća se normalan ugovor:

- `/` je dozvoljen;
- `/api/`, `/cart`, `/checkout`, `/payment/` i `/_next/` su zabranjeni;
- oglašava se `${baseUrl}/sitemap.xml`.

### XXIV.5. Produkciona konfiguracija i provera

U produkcionom `.env` je eksplicitno ostavljeno:

```env
SEARCH_INDEXING_ENABLED=false
```

Javni smoke je proverio:

- noindex robots metadata u HTML-u;
- `X-Robots-Tag: noindex, nofollow, noarchive` na odgovoru;
- `robots.txt` dozvoljava čitanje `/`;
- disabled `robots.txt` ne oglašava sitemap;
- Nginx i aplikacija ne proizvode duplirani robots header.

Indeksiranje se u budućnosti ne uključuje samo promenom Nginx-a ili samo
uklanjanjem meta taga. Potreban je pregledan config/deploy presek u kome se
`SEARCH_INDEXING_ENABLED` promeni na tačno `true`, aplikacija ponovo izgradi i
javno proveri HTML, header, robots i sitemap ponašanje.

### XXIV.6. Šta noindex ne rešava

Noindex nije access-control mehanizam. U trenutnom režimu:

- javne stranice su i dalje javno dostupne svakome ko zna URL;
- privatni/admin/API tokovi i dalje moraju imati sopstvenu autorizaciju;
- URL može biti podeljen ručno;
- pretraživaču je data direktiva, ne kriptografska zabrana;
- uklanjanje već indeksiranog URL-a može zavisiti od sledećeg crawler obilaska.

Zato se ova promena opisuje kao kontrola vidljivosti u pretraživačima, ne kao
zamena za login, proxy, route guard ili privatne response headere.

---

## XXV. Produkcijsko puštanje na `narodnanosnja.rs` — 31. avgust 2026.

Po eksplicitnom odobrenju, commitovi `ee2ac5f` i `2efbb76` su poslati u
`biozencaj-stack/narodnanosnja`, a VPS `159.69.157.123` je korišćen za
produkciju glavnog domena. Remote feature grana i kanonska
`verzija/v2.0-univerzalna-platforma` sada pokazuju na `2efbb76`.

Ovo je bio posebno odobren ručni produkcijski rollout. Nije pravljen
`prodavnica-v2-*` release tag i nije se tvrdilo da je tag-gated GitHub workflow
izvršio ovu objavu. Aplikacija je ipak postavljena u istu release/current
strukturu i proverena istim SHA-aware health principom.

### XXV.1. Aktivni release i proces

Aktivni release je:

```text
/var/www/narodnanosnja/releases/2efbb76d4adcfa8d1e5fe335cb59f411d0c65cbe-9000
```

Simbolički link:

```text
/var/www/narodnanosnja/current
```

pokazuje tačno na taj direktorijum. Time je aktivna verzija eksplicitno vezana
za Git SHA, umesto za neodređeni sadržaj jednog promenljivog direktorijuma.

PM2 stanje:

- proces: `narodnanosnja`;
- režim: `fork`;
- stanje: `online`;
- interni port: `3007`;
- cwd: aktivni release direktorijum;
- Next.js: `16.1.6` u izgrađenom release-u;
- u potvrđenom preseku: `0` restarta.

Release i PM2 trenutno rade kao `root`. To funkcioniše, ali nije konačan
least-privilege operativni model; budući hardening treba da uvede ograničenog
deploy/runtime korisnika sa tačno potrebnim pristupom direktorijumima i PM2
procesu.

### XXV.2. Produkcijski `.env` bez izlaganja tajni

Shared produkcijski environment ostaje van Git repozitorijuma:

```text
/var/www/narodnanosnja/.env
```

Potvrđeno je:

- vlasnik `root:root`;
- mode `600`;
- release koristi shared link, a ne kopiju tajni u source paketu;
- tajne nisu ispisivane u dokument, Git diff ili javni health odgovor.

Pre promene je napravljen mode-600 backup:

```text
/var/backups/narodnanosnja/env-20260831T114114Z-pre-release-2efbb76
```

Produkcione vrednosti su usklađene ovako:

- `NEXTAUTH_URL` i javni storefront URL koriste konačni HTTPS apex domen;
- `AUTH_VERIFIED_LOGIN_POLICY=audit`;
- `SEARCH_INDEXING_ENABLED=false`;
- kartično plaćanje ostaje isključeno;
- HSTS ostaje isključen u ovoj prvoj TLS etapi;
- `ORDER_ACCESS_SECRET` je odvojen, snažan 64-byte secret, različit od auth
  secret-a;
- stvarne DB, auth, order i SMTP tajne nisu upisane u ovaj dnevnik.

`audit` za verified login znači da neverifikovani kompatibilni CUSTOMER tok
još nije globalno prebačen na staged/strict enforcement. To ne znači da
nevalidna timestamp ili policy invarijanta sme proći: korumpirano auth stanje i
dalje fail-closed završava internim/generičkim login neuspehom.

### XXV.3. DNS

DNS je podešen tako da:

- apex `narodnanosnja.rs` ima A zapis ka `159.69.157.123`;
- `www.narodnanosnja.rs` je CNAME ka apex domenu i završava na istoj IPv4
  adresi;
- apex nema AAAA zapis, pa nema paralelnog IPv6 puta ka drugom serveru;
- autoritativni nameserveri su `dns1.dwhost.net`, `dns2.dwhost.net` i
  `dns3.dwhost.net`.

Ovo je omogućilo izdavanje jednog sertifikata za apex i `www` i kanonsko
preusmeravanje celog saobraćaja na jednu adresu.

### XXV.4. Nginx domen konfiguracija

Aktivni domen vhost je:

```text
/etc/nginx/sites-available/narodnanosnja-domain
```

Finalni tok:

| Ulaz | Rezultat |
| --- | --- |
| `http://narodnanosnja.rs/...` | `301` na `https://narodnanosnja.rs/...` |
| `http://www.narodnanosnja.rs/...` | `301` na apex HTTPS sa istom putanjom |
| `https://www.narodnanosnja.rs/...` | `301` na apex HTTPS |
| `https://narodnanosnja.rs/...` | reverse proxy na `127.0.0.1:3007` |

Proxy prosleđuje standardne Host/forwarded podatke i koristi:

- `client_max_body_size 15M`;
- proxy buffer `16k`;
- osam proxy buffera od `16k`;
- busy buffer `32k`;
- connect timeout `5s`;
- send/read timeout `60s`.

Na edge-u se dodaje:

```text
X-Robots-Tag: noindex, nofollow, noarchive
```

Upstream kopija istog headera je skrivena u Nginx kompoziciji, pa klijent
dobija tačno jedan finalni header. `nginx -t` je prošao pre reload-a.

Stari port-8090 vhost je ostao aktivan radi istorijske kompatibilnosti. To je
dodatna javna površina koju kasnije treba eksplicitno zatvoriti ili svesti na
redirect kada se potvrdi da je više ništa ne koristi.

Sačuvane su Nginx rezervne kopije iz više tačaka: pre domena, pre proxy-buffer
izmene, pre HTTPS-a i pre normalizacije HTTP/2 direktiva. One omogućavaju
ručno poređenje ili povratak konfiguracije bez oslanjanja na pamćenje.

### XXV.5. TLS i automatska obnova

Let's Encrypt sertifikat ima:

- CN: `narodnanosnja.rs`;
- SAN: `narodnanosnja.rs` i `www.narodnanosnja.rs`;
- issuer: `YE1`;
- važenje: 31. avgust 2026. — 29. novembar 2026.

`certbot.timer` je enabled i active i proverava obnovu dva puta dnevno.
Kontrolisani renewal dry-run je prošao. Time nije provereno samo postojanje
sertifikata, već i aktuelna automatizovana putanja njegove obnove.

HSTS je namerno odsutan u prvom javnom preseku. Razlog je operativna
reverzibilnost dok se ne potvrde stabilnost sertifikata, obnova, `www` redirect
i svi subdomeni. Kada se HSTS kasnije uključi, treba ga uraditi kao zaseban
pregledan korak, a ne usputnu promenu.

### XXV.6. PostgreSQL backup i restore dokazi

Pre migracije je napravljen custom-format backup:

```text
prod-20260831T112804Z-pre-migration-2efbb76.dump
```

Potvrđeno je:

- veličina `119.698` bajtova;
- vlasništvo root i mode `600`;
- prateći `.sha256` checksum;
- dodatni pre-release dump iste veličine;
- schema-only SQL presek veličine `68.040` bajtova;
- stariji backup setovi od 29. avgusta nisu obrisani.

Backup nije tretiran kao dovoljan samo zato što fajl postoji. Napravljene su
izolovane restore baze:

- `narodnanosnja_restorecheck_2efbb76` — vraćen aktuelni presek, sa osam
  migracija i 43 public tabele;
- immediate pre-migration clone — istorijski presek sa četiri migracije i 42
  public tabele.

Drugi clone dokumentuje tačan prelaz sa starog produkcionog stanja, dok prvi
potvrđuje da finalni backup zaista može da se pročita i obnovi.

### XXV.7. Primena svih osam migracija

Produkcija sada ima `8/8` migracija, bez pending ili rolled-back redova:

1. `20260829000000_baseline_production_before_v2`;
2. `20260829010000_add_payment_status_processing`;
3. `20260829010100_add_payment_status_review`;
4. `20260829020000_expand_v2_platform`;
5. `20260830000000_expand_hashed_auth_tokens`;
6. `20260830010000_expand_email_verification_cooldown`;
7. `20260830020000_expand_verified_login_grace`;
8. `20260830030000_expand_authoritative_sessions`.

To znači da su uz ranije commerce/platform promene primenjeni i:

- compat hash-first auth token storage;
- verification email cooldown/fixed-window kolone;
- nullable verified-login grace;
- `authSessionRevision`, V2 Session metadata i `AuthPolicyState` singleton.

Posle primene su provereni migration status i usklađenost sa aktuelnom Prisma
šemom; nije ostao prijavljen schema drift. Produkciona baza sada ima 43 public
tabele: 42 Prisma runtime tabele i `_prisma_migrations`.

Stariji runbookovi koji kažu da produkcija ima samo četiri migracije ili da
aktuelni lanac ima sedam predstavljaju istorijski presek i ne smeju se koristiti
kao trenutna činjenica.

### XXV.8. Least-privilege runtime grantovi

Po eksplicitnom odobrenju, login rola `nosnja` dobila je samo:

- `SELECT`;
- `INSERT`;
- `UPDATE`;
- `DELETE`;

nad sledeće 42 eksplicitne Prisma runtime tabele:

1. `User`;
2. `Session`;
3. `AuthPolicyState`;
4. `PasswordReset`;
5. `EmailVerification`;
6. `Wishlist`;
7. `Address`;
8. `Order`;
9. `OrderItem`;
10. `Transaction`;
11. `PaymentEvent`;
12. `Banner`;
13. `Setting`;
14. `SizeTable`;
15. `TickerMessage`;
16. `NewsletterSubscriber`;
17. `Newsletter`;
18. `NewsletterImage`;
19. `ProductReview`;
20. `Product`;
21. `ProductVariant`;
22. `ProductType`;
23. `AttributeDefinition`;
24. `ProductTypeAttribute`;
25. `AttributeChoice`;
26. `ProductAttributeValue`;
27. `ProductAttributeSelectedChoice`;
28. `ProductOption`;
29. `ProductOptionValue`;
30. `ProductVariantOptionValue`;
31. `Color`;
32. `Category`;
33. `ProductCategory`;
34. `Brand`;
35. `ProductSize`;
36. `Article`;
37. `Promotion`;
38. `PromotionProduct`;
39. `CouponUsage`;
40. `ChatFAQ`;
41. `ChatMessage`;
42. `StoreLocation`.

Finalni grant audit je potvrdio:

- `42 × 4 = 168` runtime table privilege-a;
- nula runtime grantova nad `_prisma_migrations`;
- nula default ACL/future table grantova;
- višak `TRUNCATE`, `REFERENCES` i `TRIGGER` prava je opozvan;
- eventualna ranija prava nad migration tabelom su opozvana;
- `nosnja` jeste LOGIN rola, ali nije superuser, `CREATEDB`, `CREATEROLE`,
  replication ili `BYPASSRLS` rola.

`_prisma_migrations` zato ostaje vlasništvo/odgovornost migracionog operatora,
a aplikacioni proces ne može da menja istoriju migracija.

Važna posledica: postojeći `scripts/db-setup.sql`, koji aplikacionom korisniku
daje široko vlasništvo i `GRANT ALL ON SCHEMA public`, više nije merodavan za
ovu produkciju. Ne koristiti ga bez prerade na odvojenu migration-owner i
runtime ulogu.

### XXV.9. Javni i lokalni smoke testovi

Posle aktivacije provereno je:

| Provera | Rezultat |
| --- | --- |
| `GET /api/health` | `healthy`, DB connected, deployment exact `2efbb76...` |
| `GET /` | `200`, bez Next error boundary-ja |
| `GET /catalog` | `200`, katalog se renderuje |
| `GET /login` | `200` |
| `GET /admin` bez sesije | `307` na `/login?callbackUrl=%2Fadmin` |
| products counts API | uspeh, vidi svih `18` proizvoda |
| HTTP apex | `301` na apex HTTPS |
| HTTPS `www` | `301` na apex HTTPS |
| `robots.txt` | `User-agent: *`, `Allow: /`, bez sitemap-a |
| robots header | tačno jedan `X-Robots-Tag` |
| HSTS | namerno odsutan |

Health endpoint je `no-store` i vraća deployment SHA. Zato uspešan `200` nije
bio dovoljan: potvrđeno je da javni Nginx stvarno servira baš novi commit, a ne
prethodni zdravi release.

### XXV.10. Trenutne produkcione adrese

- Storefront: <https://narodnanosnja.rs>
- Katalog: <https://narodnanosnja.rs/catalog>
- Prijava: <https://narodnanosnja.rs/login>
- Admin: <https://narodnanosnja.rs/admin>
- Health: <https://narodnanosnja.rs/api/health>

Direktna IP/port adresa više nije kanonska korisnička adresa. Svi javni linkovi
i auth callbackovi treba da koriste HTTPS apex domen.

---

## XXVI. Produkcioni administratorski nalog i login incident — 31. avgust 2026.

Na zahtev je napravljen novi produkcioni administratorski nalog:

```text
info@designjust4you.com
```

Uloga je `ADMIN`. Jedan raniji administratorski nalog je ostao netaknut; novi
nalog nije prepisao, obrisao ili degradirao postojeći admin red.

### XXVI.1. Bezbedan način kreiranja

Pre kreiranja je provereno da ciljni email ne postoji. Privremena lozinka je:

- kriptografski generisana na samom VPS-u;
- prosleđena `scripts/create-admin.ts` preko `--password-stdin`;
- nije prosleđena kao `--password` argument;
- nije upisana u shell command line, process list, Git ili ovaj dokument;
- privremeno je čuvana samo u root-only mode-600 fajlu dok se ne potvrdi
  stvarna prijava.

CLI prihvata samo `ADMIN` ili `OPERATOR`, normalizuje email i za postojeći
nalog zahteva eksplicitni `--update-existing`. Aplikacija čuva cost-12 bcrypt
hash, ne čitljivu lozinku.

### XXVI.2. Prva prijava i generički `401`

Prvo kreiranje je vratilo uspeh, ali realan NextAuth login preko javnog HTTPS
domena je vratio generički `401` / „Neispravan email ili lozinka“.

Proverama je utvrđeno da nisu problem:

- canonical email;
- `ADMIN` uloga;
- bcrypt cost ili format;
- poređenje unete lozinke sa hashom;
- verified vrednost kao takva;
- PostgreSQL timezone, koji je `Etc/UTC`.

Coarse server log je precizno ograničio kvar na:

```text
stage: POLICY_DECISION
reason: INTERNAL_FAILURE
```

Bez emaila, User ID-a, hasha, lozinke ili raw exceptiona u logu.

### XXVI.3. Tačan uzrok: timestamp invarijanta

`provisionPrivilegedAccount()` je uradio sledeće:

1. pročitao PostgreSQL `clock_timestamp()` kao `emailVerified`;
2. tek zatim pozvao Prisma `user.create()`;
3. prepustio `createdAt` bazi preko `@default(now())`.

U konkretnom create-u `createdAt` je nastao oko dve milisekunde posle ranije
pročitanog `emailVerified`. Red je zato privremeno imao:

```text
emailVerified < createdAt
```

`lib/auth/verified-login-policy.ts` namerno smatra to nemogućim/korumpiranim
stanjem. Čak i `audit` režim može kompatibilno dozvoliti uredan neverifikovan
nalog, ali ne sme da dozvoli vremenski nekonzistentan verified nalog. Zato je
policy ispravno fail-closed odbio login.

Ovo nije timezone kvar. PostgreSQL je bio UTC, a razlika nije bila dva sata,
već samo nekoliko milisekundi između dva odvojena timestamp izvora.

### XXVI.4. Sanacija konkretnog naloga

Nije rađen ručni SQL `UPDATE`, jer bi on zaobišao session i credential cleanup.
Ponovo je pokrenut zvanični CLI sa:

```text
--update-existing
```

i sa istom privremenom lozinkom preko stdin-a. Taj atomski put je:

- ponovo upisao validan `emailVerified` posle postojećeg `createdAt`;
- zadržao `ADMIN` ulogu;
- povećao `authSessionRevision` na `1`;
- opozvao DB Session redove naloga;
- obrisao verification credentiale;
- obrisao password-reset credentiale;
- očistio verification grace/throttle polja.

Posle sanacije je potvrđeno da je `emailVerified` `293 338` milisekundi
(približno 4 minuta i 53,338 sekundi) posle `createdAt`, odnosno da hronološka
invarijanta više nije prekršena.

### XXVI.5. Stvarni end-to-end login dokaz

Provera nije stala na bcrypt poređenju ili direktnom DB čitanju. Izvršen je
stvarni javni NextAuth tok preko HTTPS domena:

1. CSRF endpoint je vratio `200`;
2. credentials callback je vratio `200`;
3. izdat je session cookie;
4. session endpoint je vratio User sa ulogom `ADMIN`;
5. autentifikovani `GET /admin` je vratio `200`.

Time je potvrđeno da zajedno rade domen, TLS, NextAuth callback URL, cookie,
bcrypt, verified-login policy, DB nalog, role claim i admin layout.

### XXVI.6. Jednokratna predaja i brisanje privremene kopije

Privremena lozinka nije automatski izvučena sa servera. Zbog prenosa tajne u
ovu sesiju traženo je posebno eksplicitno odobrenje. Tek posle odobrenja je:

1. provereno da root-only fajl postoji;
2. provereno da ima mode `600`;
3. vrednost pročitana jednom;
4. serverski fajl obrisan pre prikaza korisniku;
5. potvrđeno da fajl više ne postoji.

Ovaj dokument namerno ne sadrži lozinku. Na serveru je ostao samo bcrypt hash,
iz kog se originalna lozinka ne može pročitati kroz aplikaciju. Lozinku treba
promeniti posle prve korisničke prijave.

### XXVI.7. Otvoren trajni kodni problem

Konkretan produkcioni nalog je popravljen, ali create put u izvoru još može da
ponovi isti milisekundski race za budući ADMIN/OPERATOR nalog.

Problem je u `lib/auth/privileged-account.ts`:

- `PrivilegedAccountCreateWrite` nema eksplicitni `createdAt`/`updatedAt`;
- `verifiedAt` se čita pre `createUser()`;
- Prisma/baza zatim nezavisno određuju create timestamp.

Minimalna trajna popravka treba da:

1. doda `createdAt: Date` i `updatedAt: Date` u create write ugovor;
2. pri novom privileged create-u postavi `createdAt`, `updatedAt` i
   `emailVerified` na isti već validirani DB `verifiedAt`;
3. ne menja update granu niti `readDatabaseTime()` cast;
4. proširi unit očekivanje exact create payloadom;
5. proširi real-PG concurrent-create test proverom da je
   `createdAt.getTime() === emailVerified.getTime()`;
6. opciono odmah provuče novi red kroz verified policy evaluator i očekuje
   `VERIFIED`.

Ova popravka nije uključena u `2efbb76` i nije tiho predstavljena kao završena.
Do njenog commita i deploya, svaki budući privileged create mora imati stvarni
login smoke ili kontrolisani `--update-existing` recovery ako se invariant
ponovi.

### XXVI.8. Još jedna CLI dokumentaciona nedoslednost

Aktuelna završna poruka u `scripts/create-admin.ts` upozorava da sesije nisu
opozvane. To je samo delimično tačno:

- DB-authoritative Session redovi se pri update-u brišu i revision se povećava;
- aktivni legacy stateless JWT još ne proverava tu DB revision vrednost i može
  ostati važeći do svog roka.

Poruku treba precizirati tako da razlikuje DB session revokaciju od još
nezavršenog legacy JWT cutovera.

---

## XXVII. Aktuelno stanje, dokaz provera i preostali posao — 31. avgust 2026.

Ovaj odeljak je završni operativni presek posle code push-a, DB migracija,
DNS/TLS podešavanja, produkcijskog deploya i admin provere.

### XXVII.1. Git i obim poslednjeg paketa

Pre dopune ovog dnevnika stanje je bilo:

- repo: `~/Desktop/narodnanosnja-prodavnica`;
- aktivna grana: `ispravka/v2-db-authoritative-sessions`;
- HEAD: `2efbb76d4adcfa8d1e5fe335cb59f411d0c65cbe`;
- feature remote usklađen sa HEAD-om;
- remote kanonska V2 grana takođe na `2efbb76`;
- bez `prodavnica-v2-*` taga;
- radno stablo čisto pre ove dokumentacione izmene.

Recentni auth/session/SEO paket od `d926e15` do `2efbb76` obuhvata:

- `79` promenjenih fajlova;
- približno `15.435` dodatih linija;
- približno `681` uklonjenu liniju;
- 14 logičkih commit koraka od session expand-a do fail-closed noindex-a.

Ovaj `IZMENE.md` je sada namerna lokalna dokumentaciona izmena preko aktivnog
HEAD-a. Ne sadrži produkcione tajne niti privremenu admin lozinku.

### XXVII.2. Lokalni test dokaz na aktuelnom kodu

Tokom završnog read-only pregleda aktuelnog `2efbb76` koda stvarno je
pokrenuto:

| Provera | Rezultat |
| --- | --- |
| `npm test` | `451` ukupno / `425` pass / `26` skip / `0` fail |
| `npm run typecheck` | PASS |
| `npm run lint` | exit `0`; `0` grešaka / `67` upozorenja |
| `git diff --check` pre dopune dokumenta | PASS |
| production build deployovanog SHA | PASS; javni release je zdrav |

Lokalnih 26 skipova nisu prećutani failure-i, već opt-in real-PostgreSQL
testovi. Oni obuhvataju:

- authoritative session DB adapter, guard i logout;
- session expand preflight;
- credentials snapshot i V2 issuance;
- verification/resend konkurentne tokove i rollback;
- password-reset request/confirm i password change;
- privileged concurrent create/update/rollback;
- atomsku registraciju;
- demo user sinhronizaciju;
- reservation cleanup concurrency.

CI workflow za njih postavlja odgovarajuće `RUN_*_DB_TESTS=true` vrednosti i
koristi PostgreSQL 16 servis. Pored testova, workflow proverava svih osam
migracija na praznoj bazi, drift, DB invarijante, auth audit fixture-e,
TypeScript, lint quiet, mobilni Playwright purchase tok i production build.

Postojećih 67 lint upozorenja nisu build greške, ali predstavljaju tehnički
dug. Najčešće klase su:

- neiskorišćeni importi ili promenljive;
- obični `<img>` umesto optimizovanog image sloja;
- `setState` direktno u efektu;
- JSX kreiran unutar `try/catch` bloka;
- jedan missing hook dependency;
- jedan admin banner bez `alt` vrednosti.

### XXVII.3. Funkcionalno stanje prodavnice

Trenutno radi:

- javna početna stranica na glavnom HTTPS domenu;
- dinamički katalog sa 18 uvezenih proizvoda;
- kategorije, filteri, proizvodi, korpa i guest checkout osnova;
- korisnička registracija, prijava, verification/resend i password reset kod;
- korisnički nalog, adrese, porudžbine i wishlist;
- admin panel za proizvode, kategorije, brendove, boje, promocije, porudžbine,
  korisnike, članke, banere, ticker, prodajna mesta, newsletter, chat i
  podešavanja;
- centralna `ADMIN`/`OPERATOR` politika;
- javni health endpoint sa DB i deployment SHA proverom;
- fail-closed noindex dok se sadržaj i poslovna podešavanja ne završe;
- HTTPS apex i kanonski `www` redirect;
- backup/restore, 8/8 migracija i least-privilege runtime DB grantovi;
- validan novi ADMIN nalog sa stvarno proverenom HTTPS prijavom.

### XXVII.4. Precizno auth stanje

Auth sloj nije ni „stari, bez zaštita“ ni „potpuno završen V2 cutover“.
Tačan opis je:

- credentials, verification, reset, password change i privileged write tokovi
  imaju mnogo novih atomskih i DB-clock zaštita;
- `AUTH_VERIFIED_LOGIN_POLICY=audit` je aktivan;
- authoritative session šema i dormantni core su deployovani;
- security write tokovi povećavaju revision i brišu DB Session redove;
- checkout-data i wishlist koriste neutralni facade;
- aktivni browser credential i većina zaštićenih potrošača i dalje koriste
  legacy NextAuth JWT snapshot;
- `proxy.ts`, `app/admin/layout.tsx` i većina ruta još nisu prebačeni na V2 DB
  guard;
- postoji `93` raw legacy `getServerSession` consumer poziva u `52` fajla i dva
  raw `getToken` potrošača.

Posledica: promena role/passworda opoziva DB sesije, ali već izdat legacy
stateless JWT ne proverava odmah novu revision vrednost i može trajati do
svog maksimalnog roka. Zato se staged/strict verified-login i potpuni admin
authorization hardening ne smatraju završenim.

### XXVII.5. Admin autorizacija — otvorena nedoslednost

`lib/auth/admin-policy.ts` propisuje:

- `ADMIN` — pun admin pristup;
- `OPERATOR` — deny-by-default;
- dozvoljene operator stranice — porudžbine i chat poruke;
- dozvoljeni operator API tokovi — promena statusa porudžbine i GET/PUT chat
  poruke.

Otkrivena je route-local nedoslednost:

- `GET /api/admin/products` i `GET /api/admin/products/:id` lokalno prihvataju
  `OPERATOR`;
- centralni proxy policy operatoru ne dozvoljava product API.

Proxy trenutno zaustavlja pristup, ali route-local provera nije puna
defense-in-depth granica. Treba uskladiti rute sa centralnom politikom i dodati
direktnu role matricu za svaku admin API rutu, uključujući poziv bez oslanjanja
na proxy.

### XXVII.6. Katalog i proizvodni model

Aktivni katalog:

- čita samo aktivne proizvode;
- podržava pol, brend, kategoriju/tip, boju, veličinu, cenu, akciju i novitete;
- aktivne veličine ulaze u rezultat;
- filter dostupne veličine zahteva zalihu veću od nule;
- koristi server-side Prisma upite;
- ima javne list/count/detail/similar endpointove.

Admin proizvod podržava:

- lokalizovane nazive, opise i SEO polja;
- do tri slike;
- SKU i barkod;
- redovnu i akcijsku cenu;
- brend i kategorije;
- boju, materijal, dimenzije, poreklo, održavanje i tagove;
- soft archive preko `active=false`;
- stabilan `ProductSize` ID;
- deaktivaciju uklonjene veličine umesto fizičkog brisanja;
- ponovno aktiviranje istog stock reda;
- `expectedStock` zaštitu od prepisivanja paralelne rezervacije/povrata;
- odbijanje negativne ili decimalne zalihe;
- pravilo da aktivan proizvod mora imati aktivan stock red.

Generičke V2 tabele `ProductType`, attribute, option i variant postoje, ali
prelaz nije završen:

- admin API za tipove i atribute postoji;
- kompletan admin UI nije povezan;
- nema završenog produkcionog backfill-a legacy proizvoda;
- nema dual-write/dual-read poređenja;
- `ProductSize` ostaje glavni izvor zalihe;
- contract uklanjanje legacy polja je buduća posebna migracija.

### XXVII.7. Nedostajući testovi i input granice proizvoda

Iako niži `product-size-sync` sloj ima jake testove, nedostaju direktne HTTP
matrice za:

- javni `/api/products`;
- `/api/products/counts`;
- product detail rutu;
- admin product list/create/update/archive tok;
- puni body/auth/role ugovor tih ruta.

Poznate input rupe:

- javni `page` i `limit` nemaju dovoljno stroge granice;
- counts API tolerantno propušta proizvoljne `Number(...)` rezultate;
- admin product liste nemaju čvrst maksimalni pagination cap;
- product POST/PUT nema centralni exact-body schema parser;
- product write rute nemaju svoj jasno dokumentovan body cap;
- nevalidan ili veoma veliki input često završi generičkim `500` umesto
  preciznim `400/413` ugovorom.

Ovo nije uzrok sadašnjeg javnog kataloga — produkcioni katalog i counts smoke
rade — ali je sledeći važan robustness i abuse-hardening paket.

### XXVII.8. Preostali auth i abuse-control blokatori

Pre prelaska sa `audit` na `staged` ili `strict` ostaje:

1. trajna popravka privileged create timestamp invarijante;
2. migracija preostalih legacy session potrošača;
3. jedan atomski V2 cookie/codec/issuer/guard/proxy/logout cutover bez legacy
   credential fallbacka;
4. real-PG i HTTP race matrica za login-vs-reset/change/role/policy;
5. shared Redis/DB limiter za credentials i ostale skupe auth tokove;
6. eksplicitan trusted-proxy hop i canonical client-IP ugovor;
7. Nginx rate, connection, header i request-read zaštite usklađene sa route
   body capovima;
8. transactional auth-email outbox, durable worker, retry/dedupe, bounce i
   delivery monitoring;
9. hash-only auth-token write faza, maksimalni TTL+grace period i contract
   uklanjanje legacy plaintext credential kolona;
10. poseban strict preflight tek posle završenog recovery/grace perioda.

Next.js `after()` nije durable queue: HTTP 202 može biti vraćen, a proces može
pasti pre slanja emaila. Zato trenutni asinhroni email kod nije isto što i
garantovana dostava.

### XXVII.9. Produkcioni operativni dug

Preostalo je i:

- prebaciti release i PM2 sa root-a na ograničenog deploy/runtime korisnika;
- ugasiti ili preusmeriti istorijski port-8090 vhost;
- dodati standardni monitoring za PM2, Nginx, certbot, PostgreSQL, disk i
  health/SHA mismatch;
- automatizovati proveru backup checksum-a i periodični restore test;
- definisati incident/rollback runbook koji odgovara stvarnom
  `/var/www/narodnanosnja/releases` modelu;
- uključiti HSTS tek posle posebne odluke i provere svih subdomena;
- završiti SMTP delivery/bounce test;
- završiti realne pravne/poslovne podatke i sadržaj prodavnice;
- ostaviti kartično plaćanje isključeno do bankarske sertifikacije i kompletnog
  payment/reconciliation testa;
- pregledati reservation cleanup scheduler pre uključivanja periodičnog
  apply-a.

### XXVII.10. Zastareli dokumenti i skripte

Ovaj dnevnik sada ispravlja aktuelno stanje, ali sledeći istorijski dokumenti
još sadrže tvrdnje iz vremena pre live rollout-a:

- `docs/GITHUB-DEPLOY.md` kaže da ništa nije live;
- `docs/PRISMA-BASELINE.md` navodi samo četiri produkcione migracije;
- `docs/V2-ROLL-OUT.md` na mestima govori o sedam migracija, a aktuelni lanac
  ima osam;
- `docs/DETALJAN-IZVESTAJ-RADA-DO-2026-08-30.md` i
  `docs/DETALJAN-DNEVNIK-IZMENA.md` ispravno opisuju tadašnji istorijski
  presek, ne finalno stanje od 31. avgusta.

README takođe ima zastarele delove:

- navodi Node 18, dok CI/server koriste Node 22;
- daje Docker komande iako `Dockerfile` ne postoji;
- upućuje na `docs/HETZNER-DEPLOY-GUIDE.md`, koji ne postoji.

Posebno opasne legacy operativne datoteke:

- `scripts/backup.sh` koristi Planika putanje/bazu;
- `scripts/restore.sh` koristi Planika bazu i sadrži destruktivan drop tok;
- `scripts/server-setup.sh` pravi Planika direktorijume;
- `ecosystem.config.js` koristi `shopdemo`, `/var/www/shopdemo` i port `3000`;
- `scripts/db-setup.sql` daje mnogo šira prava od sadašnjeg least-privilege
  produkcionog modela.

Ne koristiti te fajlove nad `narodnanosnja.rs` produkcijom. Treba ih jasno
arhivirati ili zameniti novim, testiranim narodnanosnja backup/restore/server/
PM2/DB-role runbookovima.

### XXVII.11. Uključivanje indeksiranja — budući kontrolisani korak

Kada sadržaj, pravni podaci i poslovna podešavanja budu spremni, indeksiranje
se uključuje koordinisano:

1. pregledati javni sadržaj, canonical URL-ove, metadata i sitemap;
2. promeniti `SEARCH_INDEXING_ENABLED` na tačno `true`;
3. ponovo izgraditi i deployovati aplikaciju;
4. ukloniti Nginx edge noindex header;
5. zadržati noindex na verification/reset/unsubscribe credential rutama;
6. proveriti finalni HTML robots metadata;
7. proveriti `robots.txt` disallow listu i sitemap;
8. proveriti da `X-Robots-Tag` više nije globalan niti dupliran;
9. tek zatim prijaviti sitemap u Google Search Console.

Sama env promena nije dovoljna dok Nginx i dalje dodaje edge noindex header.
Samo uklanjanje Nginx headera takođe nije dovoljno dok aplikacioni metadata
ostaje fail-closed. Oba sloja moraju se promeniti u istom pregledanom release-u.

### XXVII.12. Prioriteti preporučenog nastavka

Preporučeni redosled je:

1. popraviti privileged create timestamp i dodati unit + real-PG regresiju;
2. uskladiti admin product route role sa centralnom admin politikom;
3. dodati products/counts/admin-product HTTP testove i input limite;
4. nastaviti session consumer migraciju i pripremiti atomski V2 cutover;
5. uvesti shared limiter/trusted proxy i durable auth-email outbox;
6. zameniti legacy DB/backup/restore/PM2 skripte stvarnim production
   runbookovima;
7. zatvoriti port 8090 i prebaciti runtime sa root-a;
8. završiti generički katalog backfill/dual-read/UI;
9. završiti monitoring, payment, sadržaj i pravne produkcione uslove;
10. tek zatim koordinisano uključiti indeksiranje i eventualno HSTS.

### XXVII.13. Kratka konačna klasifikacija

| Oblast | Stanje 31. avgusta 2026. |
| --- | --- |
| Storefront na glavnom domenu | **uživo** |
| HTTPS apex + `www` | **završeno** |
| Google indeksiranje | **namerno isključeno** |
| Aktivni release | **`2efbb76...-9000`** |
| PostgreSQL migracije | **8/8** |
| Runtime DB grantovi | **168 CRUD grantova nad 42 tabele; bez migration/default grantova** |
| Backup i restore proba | **završeno** |
| Katalog podaci | **18 proizvoda dostupno** |
| Admin nalog `info@designjust4you.com` | **napravljen; stvarni login i `/admin` provereni** |
| Privremena admin lozinka na VPS-u | **kopija obrisana; lozinka nije u Git-u/dokumentu** |
| Verified-login politika | **`audit`** |
| DB-authoritative session šema/core | **deployovano** |
| Potpuni V2 session runtime cutover | **nije završen** |
| Kartično plaćanje | **isključeno** |
| HSTS | **namerno još isključen** |
| Produkcijski monitoring/hardening | **delimično; ostaje gore navedeni dug** |

Najvažnije: javni sajt više nije samo lokalni prototip — radi na glavnom
domenu, koristi stvarnu produkcionu bazu, HTTPS i kontrolisan noindex. Istovremeno,
aktivno se čuvaju granice između onoga što je live i onoga što je samo
implementirano/dormantno, kako sledeći korak ne bi slučajno pretpostavio
bezbednosnu osobinu koja još nije aktivirana.
