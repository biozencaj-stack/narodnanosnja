# Izmene — dnevnik rada

Zapis rada na prezentacionom sajtu o srpskoj narodnoj nošnji, sa razlozima i
zamkama na koje se naišlo.

Poslednja dopuna: 30. avgust 2026.

> Prodavnica je zaseban projekat u `~/Desktop/narodnanosnja-prodavnica`, sa
> sopstvenim `IZMENE.md`. Ovaj fajl pokriva samo prezentacioni sajt.

## Gde je koji dokument

Projekat ima više zapisa i lako je otvoriti pogrešan. Redosled po dubini:

| Dokument | Gde | Šta pokriva |
| --- | --- | --- |
| Ovaj fajl | `IZMENE.md` | Prezentacioni sajt — istorija i zamke |
| `PREGLED_PROJEKTA_2026-08-29.md` | ovde, koren | Potpun read-only pregled celog repozitorijuma na dan 29. 8. — 770 linija, obe grane, bezbednosni i pravni blokatori |
| `IZMENE.md` prodavnice | `narodnanosnja-prodavnica/` | Prodavnica — hronologija i odluke |
| `docs/DETALJAN-DNEVNIK-IZMENA.md` | `narodnanosnja-prodavnica/docs/` | **Najdetaljniji zapis**, 2532 linije u 37 odeljaka — svaka V2 izmena, fajl po fajl |

Ako tražiš „šta je tačno urađeno u kodu prodavnice“ — idi na
`docs/DETALJAN-DNEVNIK-IZMENA.md`. Ostalo su pregledi i ulazne tačke.

---

## Šta je ovo

Statički sajt o srpskoj narodnoj nošnji. Objavljuje se na GitHub Pages:
<https://biozencaj-stack.github.io/narodnanosnja/>

Napisan je **sopstveni generator u čistom Node.js-u, bez ijedne npm
zavisnosti**. Nema `package.json`, nema `node_modules` — CI nema šta da
instalira i ništa ne može da se pokvari samo od sebe.

---

## Sadržaj

- **8 regionalnih tipova nošnje**, svaki sa zasebnom stranicom: Šumadija,
  Vojvodina, zapadna Srbija, istočna Srbija, južna Srbija, Kosovo i Metohija,
  Stari Vlah i Raška, Mačva i Podrinje. Svaka nosi uvod, osobenosti, žensku i
  mušku nošnju, materijale, tehnike i zanimljivost.
- **Pojmovnik** — 26 pojmova, pretraga i filtriranje po 8 grupa.
- **Tehnike izrade** — obrada lana i konoplje, tkanje na razboju, valjanje
  sukna, zlatovez, šlingeraj, pletenje čarapa.
- **Gde videti** — muzeji, etno-parkovi i manifestacije.
- **O projektu** — šta sajt jeste, šta nije, i pod kojom je licencom.

Tekstovi su pisani uopšteno i namerno bez izmišljenih datuma, adresa i imena.
Etnografija je puna lokalnih razlika i spornih podela — bolje tačno nego
detaljno.

---

## Kako je napravljeno

```
site/
  data/          izvor sadržaja
    nosnje.js      8 regionalnih tipova
    pojmovnik.js   26 pojmova
  pages/         po jedan modul za svaku stranicu
  assets/        site.css i site.js
  sadrzaj/       podaci o proizvodima (ostatak napuštene statičke prodavnice)
scripts/
  build.mjs           generator
  proveri-veze.mjs    provera internih veza
  proveri-uzivo.mjs   provera objavljenog sajta preko mreže
```

### Odluke koje nisu očigledne

- **Sve veze između stranica su relativne.** Svaka stranica dobija prefiks do
  korena (`./`, `../`, `../../`), pa sajt radi i na korenu domena i u
  pod-fascikli. Jedini izuzetak je `404.html`, koja se servira sa proizvoljne
  dubine pa koristi apsolutne putanje kroz `BASE_PATH`.
- **Ornamenti su generisane SVG šare**, ne slike — romb, rozeta, cik-cak,
  krst, grančica i kuka, po jedna za svaki kraj. Rade u svakoj veličini i ne
  troše propusni opseg.
- **Prebacivanje latinica ⇄ ćirilica** radi na strani klijenta, sa tačnom
  obradom digrafa (nj → њ, lj → љ, dž → џ) i mapom izuzetaka za reči gde to
  nisu jedan glas („injekcija“, „nadživeti“).
- **Provera veza je deo izgradnje.** `proveri-veze.mjs` prolazi svih 363
  interne veze; ako ijedna pukne, objavljivanje pada.

---

## Objavljivanje

| Workflow | Kada se pokreće | Šta radi |
| --- | --- | --- |
| `.github/workflows/objavi.yml` | push na `main` | Proverava, gradi, objavljuje isti artefakt i potvrđuje javni SHA/live stanje |
| `.github/workflows/provera.yml` | ostale grane i pull request-i | Proverava identitet projekta i JS sintaksu, gradi i proverava veze — ne objavljuje |

### Ojačan automatski deployment — 30. avgust 2026.

Postojeći Pages workflow je podeljen u tri jasna produkcijska joba:

1. **Izgradnja i provera** — potvrđuje da je checkout prezentacioni, a ne V2
   projekat, proverava browser JavaScript, gradi sa tačnim Pages base path-om,
   proverava veze i pravi `verzija.json` sa SHA/run identitetom;
2. **GitHub Pages objava** — dobija Pages/OIDC write dozvole tek posle uspešne
   provere i objavljuje upravo provereni `dist` artefakt;
3. **Potvrda objavljene verzije** — čeka da CDN vrati očekivani SHA, run ID i
   run attempt, zatim pokreće punu mrežnu proveru sitemap stranica, resursa i
   404 odgovora.

Dodatno je urađeno:

- Node 20 koji je izašao iz podrške zamenjen je Node.js 24 runtime-om;
- zvanične GitHub Actions verzije pinovane su na pune commit SHA vrednosti;
- deploy ima sopstveni `refs/heads/main` guard;
- build job više nema Pages/OIDC write privilegije;
- Pages artefakt eksplicitno čuva generisani skriveni `.nojekyll` fajl;
- workflow-i imaju timeout i concurrency pravila;
- aktivan main deploy se ne prekida ako brzo stigne sledeći push;
- verification run za istu feature granu otkazuje zastareli aktivni run;
- uklonjen je netačan pokušaj da običan `GITHUB_TOKEN` prvi put uključi Pages;
- `dist/verzija.json` nastaje samo u CI-ju i ne ulazi u Git istoriju.

### Preduslovi koji su već ispunjeni

- Repozitorijum je **javan**. Na besplatnom planu GitHub Pages ne radi za
  privatne repoe.
- Pages je uključen sa izvorom **GitHub Actions** (Settings → Pages).

### ⚠️ Oba projekta dele jedan repozitorijum

Prodavnica je na kraju objavljena u **isti** repo `biozencaj-stack/narodnanosnja`,
kao zasebna grana, a ne u sopstveni repo. Na remote-u sada žive dve istorije:

| Grana | Šta je | Ko je objavljuje |
| --- | --- | --- |
| `main` | prezentacioni sajt | `objavi.yml` → GitHub Pages |
| `verzija/v2.0-univerzalna-platforma` | prodavnica (Next.js) | sopstveni `objavi.yml` u toj grani |
| `verzija/v2.0-prodavnica` | napuštena statička prodavnica | ništa |
| `arhiva/v2-pre-github-…` | arhiva stanja pre objave | ništa |

**Granu prodavnice nikada ne spajati u `main`.** Push na `main` pokreće
objavljivanje prezentacionog sajta na Pages; spajanje bi u najboljem slučaju
oborilo build, u gorem objavilo pogrešan sadržaj na javnu adresu.

Dve istorije su nastale odvojeno (prodavnica je počela kao zaseban `git init`),
pa git ionako odbija spajanje bez `--allow-unrelated-histories`. To je slučajna
zaštita, ne namerna — ne oslanjati se na nju.

Trajno rešenje je razdvajanje u dva repozitorijuma. Do tada ovo pravilo stoji
i u `CLAUDE.md` oba projekta.

---

## Zamke koje su pojele vreme

1. **Dvostruki navodnici u `style` atributu.** `dataUri()` je vraćao
   `url("data:…")`, a ta vrednost završava u HTML `style` atributu — dvostruki
   navodnik je prekidao atribut i **nijedna šara se nije videla**. Rešeno
   prelaskom na jednostruke navodnike.
2. **GitHub Pages se ne uključuje sam.** Korak „Podesi Pages“ je pao dva puta.
   Token iz workflow-a ne može da uključi Pages **prvi put** — to mora ručno
   kroz Settings → Pages → Source: GitHub Actions. Posle toga radi.
3. **Privatan repo na besplatnom planu nema Pages.** Repo je prebačen u javni.
4. **Headless Chrome ima najmanju širinu 500px.** Snimak na 414px je izgledao
   kao da sadržaj prelazi ekran — bio je samo skaliran. Provera preko
   `document.documentElement.scrollWidth` je pokazala da preliva nema.
5. **Ćirilična slova umešana u latinični tekst.** Pri pisanju podataka se
   potkralo nekoliko ćiriličnih slova unutar latiničnih reči („Prslук“,
   „suknени“). Nađeno pretragom `grep -n '[а-яА-Я]'` i ispravljeno.

---

## Napuštena statička prodavnica

U `site/sadrzaj/` stoje podaci o **6 kategorija i 18 proizvoda**, i u
`site/pages/` delovi statičke prodavnice (katalog, korpa, uslovi).

**Nije dovršeno namerno.** Ispostavilo se da na sopstvenom serveru već postoji
gotova e-commerce platforma sa CMS-om, korpom, porudžbinama i pravnim
stranicama — pisati to ponovo nije imalo smisla. Podaci o proizvodima su
prebačeni u novu prodavnicu i tamo se dalje održavaju.

Grana `verzija/v2.0-prodavnica` nosi taj nedovršen rad i **nije spojena u
`main`**. Ako se ikad ukine prodavnica, odatle se može nastaviti.

---

## Pravila rada

Detaljno u `CLAUDE.md`, ukratko:

1. **Nikada rad direktno na `main`.** Svaka nova verzija ide na svoju granu
   (`verzija/`, `dodatak/`, `ispravka/`, `sadrzaj/`), pa pull request, pa
   spajanje. Push na `main` znači objavljivanje.
2. **`CLAUDE.md` se dopunjuje u istom commit-u** kad se menja struktura.
3. Pre svakog commit-a: `node scripts/build.mjs` i `node scripts/proveri-veze.mjs`.
