# CLAUDE.md

Uputstvo za Claude Code na ovom projektu. Pročitaj ga pre bilo kakve izmene.

## Šta je ovo

Statički sajt o srpskoj narodnoj nošnji. Generiše se sopstvenim skriptom u
čistom Node.js-u, **bez ijedne npm zavisnosti**. Objavljuje se na GitHub Pages.

---

## ⚠️ Pravilo broj jedan: svaka nova verzija ide na svoju granu

**Nikada ne radi direktno na `main`.** Svaki put kad kreneš u novu verziju,
novu funkcionalnost ili veću izmenu, prvo napravi granu:

```bash
git checkout main
git pull
git checkout -b verzija/v1.2-galerija
```

Imenovanje grana:

| Vrsta posla                 | Oblik imena                    | Primer                        |
| --------------------------- | ------------------------------ | ----------------------------- |
| Nova verzija sajta          | `verzija/vX.Y-kratak-opis`     | `verzija/v1.2-galerija`       |
| Nova funkcionalnost         | `dodatak/kratak-opis`          | `dodatak/pretraga-nosnji`     |
| Ispravka greške             | `ispravka/kratak-opis`         | `ispravka/veze-u-podnozju`    |
| Samo sadržaj (tekst/podaci) | `sadrzaj/kratak-opis`          | `sadrzaj/nosnja-pirota`       |

Kad je posao gotov: push grane, otvori pull request ka `main`, i tek posle
spajanja se objavljuje nova verzija sajta. **Push na `main` = objavljivanje.**

## ⚠️ Pravilo broj dva: održavaj ovaj fajl

Kad dodaš novu stranicu, novi izvor podataka, novi skript ili promeniš način
rada — **dopuni CLAUDE.md u istom commit-u**. Ovaj fajl je jedini opis kako
projekat radi; ako zastari, sledeći rad kreće od pogrešnih pretpostavki.

---

## Struktura

```
site/
  data/          izvor sadržaja — ovde se dodaje nova građa
    nosnje.js      regionalni tipovi nošnje (jedan unos = jedna stranica)
    pojmovnik.js   pojmovi i objašnjenja
  pages/         po jedan modul za svaku stranicu; izvoze naslov, opis,
                 aktivno, opciono sara(), i telo(ctx) -> HTML string
  assets/        site.css i site.js, kopiraju se u dist/ neizmenjeni
scripts/
  build.mjs      generator: čita data + pages, piše dist/
  proveri-veze.mjs  provera da nijedna interna veza nije polomljena
  proveri-uzivo.mjs provera objavljenog sajta preko mreže (ne koristi se u CI-ju)
.github/workflows/
  objavi.yml     push na main -> izgradnja -> GitHub Pages
  provera.yml    push na ostale grane i PR -> samo izgradnja i provera
dist/            rezultat izgradnje; nije u git-u, pravi ga CI
```

## Naredbe

```bash
node scripts/build.mjs        # izgradi sajt u dist/
node scripts/proveri-veze.mjs # proveri sve interne veze (mora proći)
python3 -m http.server 8000 --directory dist   # lokalni pregled

node scripts/proveri-uzivo.mjs   # proveri objavljeni sajt posle deploy-a
```

Pre svakog commit-a pokreni **obe** prve dve naredbe. Provera veza mora proći
bez ijedne greške — CI je ionako obara ako ne prođe.

---

## Pravila za kod

- **Bez npm zavisnosti.** Nema `package.json`, nema `node_modules`. Sve što
  treba piše se ručno. To je namerno: CI nema šta da instalira i ništa ne može
  da se pokvari samo od sebe.
- **Sve veze između stranica su relativne.** Svaka `telo(ctx)` funkcija dobija
  `ctx.p` — prefiks do korena sajta (`./`, `../`, `../../`). Uvek gradi veze kao
  `${p}nosnje/sumadija/`, nikad apsolutno sa `/`. Zahvaljujući tome sajt radi i
  na korenu domena i u pod-fascikli.
  - Jedini izuzetak je `404.html`, koja se servira sa proizvoljne dubine pa
    koristi apsolutne putanje kroz `BASE_PATH`.
- **Ekraniraj svaki tekst iz podataka** kroz `esc()` pre ubacivanja u HTML.
- **Vrednosti sa `dataUri()` idu u jednostrukim navodnicima.** Te vrednosti
  završavaju i u HTML `style` atributu, pa bi dvostruki navodnik prekinuo
  atribut i šara se ne bi videla. (Ovo je već jednom bilo pokvareno.)
- **Imena u kodu su na srpskom**, latinicom, bez dijakritika u imenima fajlova
  i promenljivih (`nosnje`, `saraZa`, `proveri-veze.mjs`).

## Pravila za sadržaj

- Tekst se piše **srpskom latinicom**; posetilac ga jednim klikom prebacuje u
  ćirilicu (`site/assets/site.js`). Ne piši sadržaj ćirilicom — transliteracija
  ide samo u jednom smeru.
- Ako dodaješ reč u kojoj `nj`, `lj` ili `dž` nisu jedan glas (npr. „injekcija“),
  dopuni mapu `IZUZECI` u `site/assets/site.js`.
- Nova nošnja se dodaje **isključivo** kao novi unos u `site/data/nosnje.js`.
  Stranica, kartica na početnoj, veza u podnožju i sitemap nastaju sami.
  Obavezna polja: `slug`, `naziv`, `tip`, `podrucje`, `boje` (tri hex boje),
  `uvod`, `opis` (niz pasusa), `zenska`, `muska` (nizovi parova `[ime, opis]`),
  `materijali`, `tehnike`, `zanimljivost`.
- Etnografija je puna lokalnih razlika i spornih podela. Piši uopšteno i tačno;
  ne izmišljaj datume, adrese, brojeve telefona ni imena ljudi. Ako nešto nije
  pouzdano poznato, izostavi ga.

## Objavljivanje

Push na `main` pokreće `objavi.yml`, koji gradi sajt i objavljuje ga na
GitHub Pages. Nema drugog načina objavljivanja i `dist/` se nikada ne commit-uje.

### ⚠️ U ovom repozitorijumu žive DVA projekta

Prodavnica (Next.js) je objavljena u isti repo, na grani
`verzija/v2.0-univerzalna-platforma`. Njena istorija je **nepovezana** sa
istorijom ovog sajta — nastala je kao zaseban `git init`.

**Nikada ne spajaj granu prodavnice u `main`.** `main` je prezentacioni sajt i
push na njega objavljuje na Pages; spajanje bi oborilo build ili objavilo
pogrešan sadržaj na javnu adresu. Ako radiš na prodavnici, radi u
`~/Desktop/narodnanosnja-prodavnica` i na njenim granama.

Posle objavljivanja proveri rezultat preko mreže:

```bash
node scripts/proveri-uzivo.mjs
```

Skripta obilazi sve stranice sa `sitemap.xml`, proverava statuse, naslove, sve
resurse i da 404 stranica zaista vraća 404.

### Preduslovi koji su već ispunjeni

Repozitorijum je javan i Pages je uključen sa izvorom **GitHub Actions**
(Settings → Pages). Ovo je jednokratno podešavanje koje je moralo ručno da se
uradi — token iz workflow-a ne može da uključi Pages prvi put, pa je korak
„Podesi Pages“ padao sve dok to nije podešeno. Ako se Pages ikad isključi,
greška će se vratiti na istom koraku.
