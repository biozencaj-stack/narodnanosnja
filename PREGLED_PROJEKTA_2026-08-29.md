# Potpuni pregled projekta — 29. avgust 2026.

Ovaj dokument je trajni zapis read-only tehničkog, sadržajnog, UX, SEO, CI/CD,
bezbednosnog i operativnog pregleda repozitorijuma
`biozencaj-stack/narodnanosnja`. Napravljen je da bi rad mogao da se nastavi i
posle gašenja računara bez ponavljanja celog izviđanja.

> Stanje je snimak na dan 29. avgusta 2026. Svaka promena SHA commita, PR-a,
> zavisnosti ili produkcionog okruženja zahteva ponovnu proveru odgovarajućeg
> dela. Privremeni klonovi pod `/tmp` nisu trajni i nestaće posle restarta.

## 1. Referentno stanje

- Repozitorijum: <https://github.com/biozencaj-stack/narodnanosnja>
- Lokalna grana: `main`
- Lokalni i tada poznati `origin/main`:
  `31ebf14fe531c971d944fe4e8822830f644f66af`
- Radno stablo u trenutku audita: čisto (`main...origin/main`)
- Javni statički sajt:
  <https://biozencaj-stack.github.io/narodnanosnja/>
- Aktivna univerzalna V2 grana na remote-u:
  `verzija/v2.0-univerzalna-platforma`
- Auditovani V2 commit:
  `438dc55b8b50291f7b955c0187c78a9db3f38aeb`
- Draft PR: <https://github.com/biozencaj-stack/narodnanosnja/pull/1>
- Uspešan V2 Actions run:
  <https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33267767572>

Lokalni remote refs bili su zastareli i nisu sadržali aktivnu univerzalnu V2
granu. Ona je pregledana iz izolovanog privremenog klona. Posle restarta prvo
ponovo proveriti remote stanje; ne pretpostavljati da je `438dc55` i dalje vrh.

## 2. Izvršni zaključak

Repozitorijum praktično sadrži tri različite razvojne linije:

| Linija | Commit | Stanje i odluka |
|---|---:|---|
| `main` | `31ebf14` | Stabilan i objavljen statički edukativni sajt. Tehnički radi, ali sadržaj, pristupačnost i održavanje traže korekcije. |
| `verzija/v2.0-prodavnica` | `117d58a` | Napuštena statička prodavnica. Build je prekinut zbog nedostajućih stranica i admin fajlova. Ne koristiti kao osnovu. |
| `verzija/v2.0-univerzalna-platforma` | `438dc55` | Velika Next.js e-commerce aplikacija u Draft PR-u #1. Arhitektura ima dobre osnove i CI je zelen, ali postoje produkcioni bezbednosni, dependency, pravni, licencni i operativni blokatori. Ne mergeovati i ne deployovati u sadašnjem stanju. |

Najrazumniji smer je da se aktivna univerzalna V2 stabilizuje u odvojenim,
pregledljivim promenama. Ispravke objavljenog statičkog sajta mogu se voditi kao
zaseban, mali tok rada.

## 3. Istorija i grane

Stanje grana tokom pregleda:

| Grana | SHA | Napomena |
|---|---:|---|
| `main` | `31ebf14` | Aktivna GitHub Pages produkcija |
| `dodatak/provera-uzivo` | `d67d2f9` | Istorijska, spojena u `main` |
| `sadrzaj/dnevnik-izmena` | `3747793` | Istorijska, spojena u `main` |
| `sadrzaj/licence` | `855e20e` | Istorijska, spojena u `main` |
| `verzija/v2.0-prodavnica` | `117d58a` | Nije spojena; napuštena i neizgradiva |
| `verzija/v2.0-univerzalna-platforma` | `438dc55` | Aktivna remote grana; Draft PR #1 |

Nema tagova ni formalnih izdanja. Pregledani commitovi nisu potpisani.

Univerzalna V2 je šest commitova ispred `main`:

1. `3dc757a` — veliki sanitizovani V2 snapshot;
2. `f38bb4e` — dokumentovanje GitHub objave;
3. `1076cae` — production rollout infrastruktura;
4. `c448334` — UX, bezbednost i admin operacije;
5. `e61fcc2` — E2E usklađivanje;
6. `438dc55` — precizniji checkout selektori.

Prvi commit praktično zamenjuje statički sajt aplikacijom od približno 73.000
linija u više od 400 fajlova. To otežava code review i zahteva da se poreklo i
licenca uvezenog snapshot-a eksplicitno dokumentuju.

## 4. Trenutni `main`: arhitektura

`main` je dependency-free Node SSG bez `package.json` zavisnosti:

- `scripts/build.mjs` sastavlja HTML, sitemap, robots i assete;
- `site/data/nosnje.js` sadrži osam regionalnih zapisa;
- `site/data/pojmovnik.js` sadrži 26 pojmova;
- `site/pages/` sadrži page module i veliki deo proze;
- `site/assets/site.css` i `site/assets/site.js` sadrže ceo UI runtime;
- `dist/` je ignorisan generisani izlaz;
- GitHub Actions gradi i objavljuje sajt na GitHub Pages.

Build daje 14 indeksnih sadržajnih stranica i prilagođenu `404.html`, ukupno 15
HTML dokumenata i 21 fajl u `dist`.

## 5. Šta je provereno na `main`

### 5.1. Build i veze

- Dve uzastopne izgradnje u odvojenim temp direktorijumima dale su identičan
  izlaz.
- Build radi i sa root i sa project-subpath bazom.
- Provera internih veza: `363/363` prolazi.
- Svi URL-ovi iz sitemap-a vraćali su HTTP 200 na javnom sajtu.
- Svi testirani resursi bili su dostupni.
- Nepostojeća ruta vraćala je pravi HTTP 404 sa prilagođenom stranicom.
- Generisani `dist` imao je oko 201 KB sirovog sadržaja.
- Tipični gzip izlazi: glavni HTML oko 5,1 KB, CSS oko 4,1 KB, JS oko 2,36 KB.

### 5.2. Browser i responsive provera

Provereni su Chrome prikazi na 1280, 900, 760, 414, 360 i 320 px, svetla i
tamna tema, JS uključen/isključen, tastatura, meni, transliteracija, localStorage
i pretraga pojmovnika. Nije bilo browser console ili network exception-a.

### 5.3. HTML, SEO i struktura

- Svaka indeksna stranica ima jedinstven naslov, meta opis, canonical, jedan
  `h1`, jedan `main`, header i footer.
- Svi očekivani URL-ovi su tačno jednom u sitemap-u.
- Nema pronađenih duplih ID-eva, praznih linkova ili nedostajućih osnovnih meta
  elemenata.
- W3C Nu je prijavio hijerarhiju naslova: footer `h4` posle `h2` na pojedinim
  stranicama i `h1 → h3` na pojmovniku. `404.html` je prošao.

## 6. `main`: prioritetni sadržajni nalazi

### 6.1. Netačna UNESCO tvrdnja — najhitnije

`site/pages/tehnike.js:123` kaže da neke od šest opisanih tehnika štiti UNESCO
lista. Zvanična UNESCO stranica za Srbiju ne sadrži te tehnike. Pirotsko
ćilimarstvo je u ciklusu 2026. bilo nominacija u obradi, a više zanata jeste na
nacionalnom, ne UNESCO registru.

Izvori:

- <https://ich.unesco.org/en/state/serbia-RS>
- <https://ich.unesco.org/en/files-2026-under-process-01395>
- <https://nkns.rs/cyr/znanja-i-veshtine-u-vezi-sa-tradicionalnim-zanatima>

Tekst mora jasno razlikovati UNESCO upis, nominaciju i nacionalni registar.

### 6.2. Tvrdnje koje traže izvor ili ublažavanje

Posebno rizične su tvrdnje u `site/data/nosnje.js:217,225,247` da
kosovsko-metohijska nošnja neposredno potiče iz srednjovekovnog odevanja, gotovo
doslovno ponavlja motive sa fresaka i predstavlja neprekinut vizuelni jezik.
Zvanični Etnografski muzej opisuje zbirku pretežno iz XIX i XX veka, ali ne
potvrđuje takav kontinuitet:

<https://etnografskimuzej.rs/en/zbirka/national-costumes-of-serbia-kosovo-and-metohija/>

Izvor ili preciznije regionalno/vremensko ograničenje traže i sledeće tvrdnje:

- Vranje i Prizren kao „dva najveća” centra;
- skupljanje tkanine tačno za trećinu;
- zlatovez isključivo kao muški terzijski rad;
- sve vunene čarape rađene sa pet igala i od prstiju;
- nekada isključivo biljne boje;
- konoplja obavezno močena dve do tri nedelje;
- razboj u svakoj kući i tkanje bez crteža/šablona;
- više od dvadeset kompleta nošnji u vojvođanskom mirazu;
- vranjska nošnja kao vrhunac srpskog zlatoveza;
- cena nošnje jednaka dobrom grlu stoke;
- homoljska nošnja kao „lična karta” sela;
- kukasti krst kao specifičan zaštitni motiv u datom kontekstu;
- starovlaško domaćinstvo kao „najstarija seoska fabrika”;
- izrada svakog kompleta do godinu dana;
- univerzalno kodiranje sela, statusa i uzrasta kroz odeću.

Generički pasus o izvorima u `site/pages/o-projektu.js:45` nije dovoljan. Za
važne tvrdnje treba čuvati izvor, period na koji se odnose, datum provere i,
poželjno, stručnog recenzenta.

### 6.3. Muzeji i manifestacije

Stranica „Gde videti” meša činjenicu da muzej poseduje zbirku sa tvrdnjom da je
ona stalno izložena:

- za Zaječar je stalna etnološka postavka opisana kao planirana:
  <https://muzejzajecar.org/etnologija/>;
- „Narodni muzej u Kragujevcu” je zastareo naziv; od 2022. koristi se
  „Narodni muzej Šumadije”: <https://muzej.org.rs/o-muzeju/>;
- „sve varijante” u Muzeju Vojvodine je preširoka formulacija;
- Sirogojno ima zakazane programe, što ne znači stalnu demonstraciju.

Svaka stavka treba da bude označena kao „u zbirci”, „stalna postavka” ili
„povremeni/zakazani program”, uz zvanični link i datum provere.

### 6.4. Potvrđene činjenice koje se mogu zadržati uz izvor

- Kolo je upisano na UNESCO reprezentativnu listu 2017:
  <https://ich.unesco.org/en/Decisions/12.COM/11.b.28>.
- Vukov sabor postoji od 1933:
  <https://nkns.rs/cyr/popis-nkns/vukov-sabor>.
- Etnografski muzej je osnovan 1901, a zbirka nošnji centralne Srbije navodi
  6.540 predmeta:
  <https://etnografskimuzej.rs/zbirka/narodne-nosnje-centralne-srbije/>.
- Guča se tradicionalno održava u avgustu:
  <https://www.serbia.travel/sr-lat/events/dragacevski-sabor-trubaca/>.

## 7. `main`: podaci i informaciona arhitektura

Programska provera trenutnih podataka je prošla:

- 8 jedinstvenih nošnji i slugova;
- 26 jedinstvenih pojmova;
- sva trenutno očekivana polja postoje;
- nema praznih očekivanih nizova/pasusa;
- sve boje su šestocifreni hex zapisi;
- stringovi su trimovani i NFC normalizovani;
- nema kontrolnih znakova ili neočekivanog mešanja pisama.

To je samo stanje sadašnjih ručnih podataka. Ne postoji izvršna schema ili build
validacija koja ga garantuje.

Semantičke nedoslednosti:

- početna strana govori o četiri velika tipa, a podaci imaju sedam `tip`
  vrednosti; nedostaje hijerarhija nadtip/podtip;
- `filigran` je u jednom zapisu i materijal i tehnika;
- `zlatnici` su klasifikovani kao materijal umesto predmet/ukras;
- `Đemadan / mintan` i `Džamadan` nisu povezani kao alias-i;
- samo 12 od 47 jedinstvenih naziva delova odeće tačno odgovara pojmovniku;
- podaci imaju 25 različitih oznaka tehnika, a stranica objašnjava šest tema;
- detalj obećava „Kako se radi svaka od ovih tehnika”, što nije tačno;
- komponente, materijali i tehnike nemaju stabilne ID-eve, alias-e ni veze ka
  pojmovniku;
- pojmovi nemaju sidra za duboke linkove.

Hardkodovane vrednosti koje lako zastarevaju:

- „osam” nošnji na početnoj;
- „šest” zanata/tehnika;
- footer prikazuje samo `nosnje.slice(0, 5)`;
- istaknuti pojmovi su ručni niz;
- šest ornamenata deli se modulo operatorom između osam krajeva.

Potrebno je uvesti centralnu schemu sa obaveznim poljima, jedinstvenim i bezbednim
slugom, URL/hex validacijom, dozvoljenim kategorijama i proverom da izlazne
putanje ostaju unutar `dist`.

## 8. `main`: UI, pristupačnost i ćirilica

### 8.1. Responsive problemi

- Na širini 320 px 13 od 14 stranica horizontalno preliva. Unutrašnja širina
  `.omot` je oko 276 px, dok gridovi zahtevaju najmanje 285, 300 ili 320 px u
  `site/assets/site.css`.
- `.hero-sadrzaj` poništava padding `.omot`, pa tekst na početnoj dodiruje ivice
  malog ekrana.
- Na 360 i 414 px nije pronađen globalni overflow.

### 8.2. Mobilni meni

- Ispod 900 px desktop navigacija se potpuno krije i ostaje samo hamburger.
- Bez JavaScripta mobilna navigacija je nedostupna.
- Nema zatvaranja na Escape ili klik van menija.
- `aria-label` dugmeta se ne menja prema stanju.
- Nema upravljanja fokusom.
- Na niskom landscape ekranu otvoreni meni nema odgovarajući `max-height` i
  skrolovanje.

### 8.3. Ćirilica i pretraga

- Vidljivi tekst se transliteriše, ali `data-trazi` ostaje latiničan, pa upit
  poput `зубун` ne pronalazi `zubun`.
- Placeholder, `title`, `aria-label`, `lang` i drugi atributi ostaju na latinici,
  pa interfejs postaje mešovit.
- Transliteracija običnih text node-ova kvari identifikatore i strane termine,
  npr. `XIX`, `CC BY-SA`, „slovo V” i `GitHub Pages`.
- Lista izuzetaka ne radi pouzdano uz interpunkciju i različit case.

### 8.4. Kontrast i semantika

- Zlatna `#b98f21` na svetlim površinama daje približno 2,68–2,95:1.
- Tamnocrvena `#c0392b` u tamnoj temi daje približno 3,15–3,38:1.
- Beli tekst na tamnoj CTA crvenoj `#d9503f` daje približno 4,06:1.
- Breadcrumbs su obični `div/span`, bez `nav`, liste i `aria-current`.
- Callout pasusi koriste `blockquote` iako nisu citati.
- Rezultati pretrage nemaju rezultat-count ili `aria-live` status.
- Pojmovnik prelazi sa `h1` direktno na `h3`; footer koristi usamljene `h4`.

## 9. `main`: SEO, privatnost, build i CI

### 9.1. SEO i privatnost

- Osnovni SEO je dobar: jedinstveni title/meta/canonical, sitemap i osnovni Open
  Graph postoje.
- Nema `og:image`, structured data, datuma sadržaja, bibliografije ni izvora uz
  tvrdnje.
- `robots.txt` je na `/narodnanosnja/robots.txt`, ali crawler robots fajl traži
  na korenu hosta `/robots.txt`. Na GitHub project page-u taj fajl neće upravljati
  celim hostom. Potrebni su Search Console prijava sitemap-a ili domen čiji se
  koren kontroliše:
  <https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec>.
- Algoritam meta opisa uvek uklanja poslednju reč i dodaje trotačku, čak i kada
  tekst nije predugačak.
- Direktni `/404.html` nema `noindex`.
- README tvrdi „bez praćenja”, ali svaka strana kontaktira Google Fonts. Precizna
  tvrdnja bi bila „bez analitike i kolačića”, ili fontove treba hostovati lokalno.

### 9.2. Build i link checker

- `slug` ide direktno u putanju i URL bez schema/containment provere.
- Boje iz podataka idu direktno u inline CSS.
- `BAZA` ide u 404 URL bez URL/attribute validacije.
- `SITE_URL` ide u XML bez eksplicitnog escaping-a i kontrole novih redova.
- Link checker regexom vidi samo dvostruko citirane `href`/`src`.
- Ne proverava fragmente, CSS URL-ove, `srcset`, forme, jednostruke navodnike ili
  izlazak iz `dist`.
- `site.js` se samo kopira; nema syntax ili runtime testa u buildu.
- Live checker izračunava prisustvo šare, ali taj rezultat ne uključuje u
  konačno `dobro`.

### 9.3. GitHub Actions na `main`

Pozitivno:

- PR provera ima samo `contents: read`;
- koristi `pull_request`, ne `pull_request_target`;
- build i link check se izvršavaju bez tajni.

Slabosti:

- `workflow_dispatch` nema eksplicitan job-level guard da je ref baš `main`;
- Pages write/OIDC dozvole su workflow-wide;
- akcije koriste promenljive major tagove, ne pune commit SHA vrednosti;
- `ubuntu-latest` i Node 20 su plutajuće mete;
- nema post-deploy live smoke koraka;
- nema JS unit testova, HTML validacije, a11y testova, lint-a ili formatter-a.

## 10. Licenca i dokumentacija na `main`

Postojeća licenca kombinuje MIT za kod i CC BY-SA za podatke/tekst, ali opseg je
nejasan:

- `site/pages/` sadrži i kod i značajnu količinu proze, pa se opsezi preklapaju;
- root dokumentacija i konfiguracija nisu jasno razvrstane;
- CC link vodi na deed, ne direktno na legalcode.

Dokumentacija odstupa od stvarnosti:

- README kaže da `site/data/` sadrži sav sadržaj, ali veliki deo proze, tehnike i
  muzeji su u `site/pages/`;
- `IZMENE.md` pominje `site/sadrzaj/`, koji ne postoji na `main`;
- tvrdnja „bez praćenja” zanemaruje Google Fonts;
- dokumentacija o footer linkovima ne odgovara `slice(0, 5)` implementaciji;
- dokumentacija govori o po jednoj šari za svaki kraj, a postoji šest šara za
  osam zapisa.

## 11. Napuštena `verzija/v2.0-prodavnica`

Grana `117d58a` sadrži šest kategorija, 18 proizvoda, korpa assete i placeholder
podešavanja, ali nije kompletna. Build pada sa:

```text
ERR_MODULE_NOT_FOUND: site/pages/korpa.js
```

Generator očekuje i druge nepostojeće fajlove:

- `site/pages/isporuka-i-placanje.js`;
- `site/pages/uslovi.js`;
- `site/pages/kategorija-detalj.js`;
- `site/pages/proizvod-detalj.js`;
- `site/admin/index.html`;
- `site/admin/config.yml`.

Postavke sadrže lažne kontakt podatke i placeholder `/api/porudzbina`. Granu
treba označiti kao arhivsku ili sačuvati samo korisne podatke; ne treba je
tretirati kao nastavak produkcije.

## 12. Univerzalna V2: arhitektura i obim

Auditovana remote grana `438dc55` koristi:

- Next.js 16.1.6 i React 19.2.4;
- TypeScript, Tailwind 4 i Zustand;
- Prisma 6.19.2 sa PostgreSQL bazom;
- NextAuth 4.24.13;
- `next-intl`, Nodemailer, Sharp, XLSX, reCAPTCHA i NestPay integraciju;
- približno 62 `page.tsx` stranice, 70 API ruta, 41 Prisma model, 8 enum-a i 4
  migracije.

Funkcionalni obim obuhvata katalog, pretragu/filtere, varijante, korpu, quote,
checkout, idempotentne porudžbine, stanje zaliha, kupone, pouzeće/kartice,
naloge/adrese/istoriju, wishlist, recenzije, blog, banere, ticker, newsletter,
chat, karijere, kontakt/reklamacije i širok admin/CMS.

To je white-label single-store osnova, ne puna multi-tenant platforma.

## 13. Univerzalna V2: pozitivne kontrole

- Browser nije autoritet za cenu; server računa quote.
- Kreiranje porudžbine i promena zaliha koriste transakcije i Serializable nivo
  gde je potrebno.
- Postoji DB unique idempotency zaštita.
- Gostujući pristup porudžbini koristi potpisan token.
- Payment callbackovi su potpisani i idempotentni.
- Konfliktna plaćanja prelaze u REVIEW stanje.
- Admin pristup je deny-by-default.
- Rich HTML/JSON-LD prolazi sanitizaciju.
- Uploadovane slike se dekodiraju i ponovo kodiraju kroz Sharp.
- Feature/capability zastavice mogu isključiti kartice i druge funkcije.
- Nije pronađen očigledan bypass server-side obračuna cene, stanja ili potpisanog
  card callback-a.
- `.gitignore` razumno štiti `.env`, ključeve, credentials, uploadove, logove i
  backup fajlove.
- Nisu pronađene potvrđene produkcione tajne u repozitorijumu.

Nije potvrđen direktan admin-auth bypass, nepotpisano odobravanje kartičnog
plaćanja ili hardkodovan produkcioni credential. To ne znači da je aplikacija
bezbedna za produkciju; P1 nalazi u nastavku i dalje daju jasan `NO-GO` verdict.

Ovo su dobre osnove, ali ne poništavaju blokatore ispod.

## 14. Univerzalna V2: produkcioni bezbednosni blokatori

Sledeći nalazi se odnose na auditovani commit `438dc55`.

### 14.1. HIGH — login `callbackUrl` XSS/open-navigation sink

`app/(auth)/login/page.tsx:14` čita napadački kontrolisan `callbackUrl`, a posle
uspešne prijave ga na liniji 60 direktno šalje u `router.push(callbackUrl)` bez
validacije. Next.js upozorava da nepouzdani `javascript:` URL u router funkciji
može da se izvrši u kontekstu stranice:

<https://nextjs.org/docs/app/api-reference/functions/use-router>

To je naročito opasno kada se ciljaju prijavljeni korisnici ili administratori.
Dozvoliti samo proverene lokalne relativne putanje; odbiti scheme, `//`,
backslash i nekanonske varijante.

### 14.2. HIGH — rezervacije zaliha nikad ne ističu

`lib/orders/index.ts:208-248` umanjuje stanje i postavlja
`inventoryAllocated=true` za CASH i CARD porudžbine. Oslobađanje postoji pri
decline/cancel u `lib/orders/payment.ts`, ali nema cleanup posla za napuštene
porudžbine. `docs/V2-ROLL-OUT.md:94-105` i sam navodi nedostajući cleanup.

Jedna napuštena COD porudžbina može rezervisati do 99 komada po liniji i do 100
linija; u kombinaciji sa slabim rate limitom to omogućava praktičan stock-DoS.
Potrebni su TTL, statusni workflow i idempotentan cleanup job sa testovima.

### 14.3. HIGH — SMTP sertifikati se ne proveravaju

Sledeći transporteri hardkodovano koriste `rejectUnauthorized: false`:

- `lib/email/auth-emails.ts:12-26`;
- `lib/email/order-emails.ts:8-23`;
- `lib/email/wishlist-notifications.ts:8-20`.

To obuhvata reset lozinke i verifikacione bearer tokene. `.env.example` tvrdi da
produkcija treba da koristi `SMTP_TLS_REJECT_UNAUTHORIZED=true`, ali ovi
transporteri tu promenljivu ignorišu. `lib/email/mailer.ts` je jedini pregledani
transporter koji je poštuje.

Produkcija mora fail-close proveravati TLS sertifikat. Izuzetak je prihvatljiv
samo kao eksplicitna, lokalna razvojna opcija.

### 14.4. Auth i sesije

- Credentials login u `lib/auth/index.ts:14-44` nema rate limit ili lockout.
- `emailVerified` se ne proverava, pa je verifikacija mejla kozmetička.
- Verify ruta koristi poznati fallback `fallback-secret` ako nema
  `NEXTAUTH_SECRET`.
- Reset/verifikacioni tokeni su u bazi u čitljivom obliku.
- Promena/reset lozinke ne opoziva postojeće sesije.
- Uloga se čuva u JWT-u i može ostati aktivna do isteka sesije posle promene
  uloge.
- Verify tok postavlja 30-dnevni cookie, dok je auth session max age 24 sata;
  ponašanje i namena nisu usklađeni.

Potrebni su rate limit zasnovan na pouzdanom identitetu/IP-u, obavezna
verifikacija gde poslovna pravila to traže, hashovani jednokratni tokeni i
session-version/revocation mehanizam.

### 14.5. Newsletter, chat i state-changing GET

- Javni newsletter subscribe nema rate limit, captcha ili double opt-in.
- Može ponovo aktivirati proizvoljnu adresu ili korisnikov `newsletterOptIn`.
- Unsubscribe POST proverava token samo ako je poslat; sama adresa je dovoljna.
- GET unsubscribe menja stanje, pa mail scanner može automatski odjaviti
  korisnika.
- Newsletter HMAC ima poznati fallback `cms-unsubscribe-secret`.
- Chat limit je samo procesni/per-email; mejl je proizvoljan i lako se rotira.
- Wishlist-alert cron je dostupan kao state-changing GET admin sesiji; POST samo
  poziva isti GET handler.

Potrebni su obavezni potpisani tokeni, double opt-in, POST za mutacije, CSRF gde
se koristi cookie auth, pouzdano ograničenje i uklanjanje svih poznatih secret
fallback vrednosti.

### 14.6. Rate limit i proxy poverenje

`lib/rate-limit.ts` koristi procesni LRU od 500 zapisa/60 sekundi i neposredno
veruje `x-forwarded-for`. To je prihvatljivo samo iza jednog pravilno podešenog
trusted proxy-ja i jedne instance. Direktan port, lažni header ili više PM2
instanci mogu zaobići zaštitu. Za kritične rute koristiti zajedničko skladište i
eksplicitnu trusted-proxy konfiguraciju.

### 14.7. HTML injection i proizvoljni prilozi u mejlu

- Podaci kupca, adresa, napomena, nazivi proizvoda i admin vrednosti interpoliraju
  se u HTML transactional mejlova bez konzistentnog escaping-a.
- Contact/reclamation modeli sastavljaju proizvoljan HTML koji se šalje kao
  store-authored poruka.
- Reklamacija server-side proverava base64 veličinu i ime, ali ne MIME tip,
  ekstenziju ili sadržaj priloga. UI `accept` se može zaobići direktnim pozivom.

reCAPTCHA i rate limit smanjuju spam, ali ne sanitizuju sadržaj. Potrebni su
centralni HTML escaping/template sloj, server-side MIME/magic-byte provera i
bezbedna politika priloga.

### 14.8. CSP i transport

- CSP sadrži `'unsafe-inline'` za script/style, pa nije puna odbrana od XSS-a.
- HSTS je podrazumevano isključen i zavisi od produkcione konfiguracije.
- Bez potvrđenog HTTPS domena i proxy konfiguracije V2 nije deploy-ready.

## 15. V2 dependency i supply-chain stanje

Read-only audit zaključanog grafa na dan 29. avgusta 2026. dao je:

- produkcioni graf: 13 nalaza — 1 critical, 8 high, 3 moderate, 1 low;
- ceo graf: 25 nalaza — 1 critical, 17 high, 4 moderate, 3 low.

Direktno pogođene zaključane zavisnosti:

- `next-auth@4.24.13` — critical;
- `next@16.1.6` — high;
- `nodemailer@6.10.1` — high;
- `postcss@8.5.6` — high;
- `sharp@0.33.5` — high;
- `xlsx@0.18.5` — high, bez automatskog npm fix-a u trenutku audita;
- `next-intl@4.8.3` — moderate.

Ne mora svaki advisory biti ostvariv u trenutnom kodu; npr. XLSX se koristi za
admin export. Ipak, javni auth, mail, upload i checkout zahtevaju pojedinačnu
trijažu i upgrade pre produkcije.

CI i deploy instaliraju sa `--no-audit`. Nema Dependabot/Renovate,
dependency-review, CodeQL, SBOM ili provenance. Lockfile v3 koristi HTTPS npm
registry URL-ove i integrity hash vrednosti, što je pozitivno.

## 16. V2 pravni i privacy blokatori

Ovo nije pravno mišljenje; označava mesta koja zahtevaju podatke trgovca i
stručnu pravnu proveru pre produkcije.

`app/(legal)/uslovi-koriscenja/page.tsx` sadrži:

- vidljiv placeholder „Popunite ostale podatke… PIB, matični broj, telefon”;
- tvrdnju da je trgovac u sistemu PDV-a bez proverene konfiguracione vrednosti;
- kartično plaćanje u opštim uslovima iako capability može biti isključen;
- City Express kao hardkodovanu službu;
- dostavu od 350 RSD, dok `.env.example` navodi 450 i runtime je podesiv;
- pozivanje na član 32 za rok isporuke, dok novi Zakon o zaštiti potrošača iz
  2026. tu materiju uređuje u članu 33.

Zvanični tekst zakona:

<https://slgl.pravno-informacioni-sistem.rs/api/prins/viewdoc?uuid=5e1627a4-81c0-452d-9f5c-d8c3ab84ddd1>

Politika privatnosti je prekratka za stvarnu obradu. Ne opisuje dovoljno:

- naloge i credential tokove;
- IP/network identifikatore;
- porudžbine, adrese, wishlist, recenzije i chat;
- prijave za posao i priloge;
- reCAPTCHA, Google/analytics integracije ako se uključe;
- pravne osnove, rokove čuvanja, primaoce/obrađivače i transfere;
- pristup, ispravku, brisanje, ograničenje, prenosivost, prigovor i pritužbu.

Relevantna uputstva Poverenika:

- <https://poverenik.rs/zastita-podataka/obaveze-rukovaoca/>
- <https://poverenik.rs/zastita-podataka/kako-da-ostvarite-svoja-prava/?script=lat>

Stranica o odustanku pominje dokumente za preuzimanje, ali ne daje stvarne PDF
linkove. Newsletter consent nema dovoljno pouzdan audit trag/double opt-in.

## 17. V2 univerzalnost, i18n i sadržaj

- `messages/sr.json` i `messages/en.json` pokrivaju samo mali shell.
- Nema stvarne široke upotrebe `useTranslations/getTranslations`; većina UI,
  auth, admin i pravnog teksta ostaje hardkodovana na srpskom.
- Jezički prekidač menja locale i lokalizovana DB polja, ali ne prevodi celu
  aplikaciju.
- Import proizvoda može upisati isti srpski tekst u engleska polja.
- Filteri još sadrže hardkodovan pol, brendove i „Vrstu obuće”.
- Generički `ProductType` postoji, ali legacy `ProductSize/gender` putanja ostaje
  aktivna kao fazna migracija.
- Demo seed sadrži demo admin/operator lozinke i ticker koji ih prikazuje. To je
  prihvatljivo samo u izolovanom demo okruženju i mora imati production guard.
- Nema stvarnih fotografija proizvoda; koriste se ornament placeholderi.
- Lokacije prodavnica su označene sa „Uskoro”.

Zato tvrdnje „univerzalna” i „engleska verzija” treba opisivati kao delimično
implementirane, ne završene.

## 18. V2 CI/CD i deployment

Uspešan PR run je proverio:

- PostgreSQL 16 servis;
- Prisma validate/migrations/schema drift i DB invariante;
- lint i TypeScript;
- 40 unit/security testova;
- jedan Pixel 7 guest COD Playwright scenario;
- production build.

Produkcijski deploy job je pravilno preskočen na PR-u. Workflow ima značajne
pozitivne kontrole:

- akcije su vezane za pune commit SHA vrednosti;
- `contents: read`;
- branch/event guard zahteva `refs/heads/main` za produkciju;
- production environment;
- timeout i concurrency;
- verifikovan SSH known-host;
- release direktorijume, `flock`, preaktivacioni smoke, health, rollback i
  zadržavanje pet izdanja;
- schema drift fail-close; automatske DB migracije su namerno isključene.

Preostala ograničenja:

- E2E pokriva samo jedan mobilni guest COD tok preko `next dev`;
- nema auth, admin, kartičnog, a11y ni više-browser E2E pokrića;
- CI gradi i testira source, ali server zatim ponovo radi `npm ci` i build; ne
  deployuje se identičan provereni artefakt;
- `pm2 delete` pa `pm2 start` pravi stvaran downtime;
- health check koristi krhko substring poređenje očekivanog SHA;
- `ubuntu-latest`, Node 22, Postgres 16 i Playwright browser nisu potpuno vezani
  za digest/patch;
- `--legacy-peer-deps` maskira peer neusaglašenost.

Pre produkcije treba potvrditi, bez zapisivanja vrednosti u repo, sledeće
secrets/vars:

- `SSH_PRIVATE_KEY`;
- `SSH_KNOWN_HOSTS`;
- `SERVER_HOST`;
- `SERVER_USER`;
- `PRODUCTION_URL`;
- aplikacioni/health portovi;
- `DEPLOY_PATH`;
- `APP_NAME`;
- runtime auth, database, SMTP, reCAPTCHA i payment tajne.

Potrebni su HTTPS domen, tačna proxy konfiguracija, realni podaci trgovca i
dogovoren ručni DB migration plan.

## 19. V2 licenca, stale skripte i dokumentacija

### 19.1. Licenca

V2 diff briše root `LICENSE`. README-ova neformalna rečenica da je šablon za
ličnu i komercijalnu upotrebu nije dovoljna zamena. Pre merge-a treba:

1. vratiti ili izabrati eksplicitnu licencu;
2. razdvojiti licencu koda, sadržaja i vizuelnih resursa;
3. dokumentovati poreklo velikog snapshot-a i zavisne atribucije.

### 19.2. Opasno zastarela operativa

- `ecosystem.config.js` koristi aplikaciju `shopdemo` i `/var/www/shopdemo`;
- `scripts/backup.sh` koristi `planika_shop`, `planika_user` i
  `/var/www/planika`;
- `scripts/restore.sh` zaustavlja Planika PM2 proces, radi `DROP DATABASE`, restore
  i restart;
- restore tretira non-zero `pg_restore` kao moguća upozorenja;
- `scripts/server-setup.sh` pravi Planika putanje/korisnike i izvršava
  nepinnovani `curl | bash`.

Aktivni GitHub deploy ih ne poziva, ali dokumentacija ih može navesti operatoru.
Ukloniti ih, jasno arhivirati kao nevažeće ili potpuno prepisati pre produkcije.

### 19.3. Netočna/zastarela dokumentacija

- README kaže Node 18+, a Next 16.1.6 zahteva najmanje Node 20.9;
- navodi `cd EcommerceTemplate`;
- preporučuje `npm install`, dok CI/deploy koriste
  `npm ci --legacy-peer-deps`;
- daje Docker komande bez Dockerfile/compose fajlova;
- PM2 primer vodi na `shopdemo`;
- linkuje nepostojeći `docs/HETZNER-DEPLOY-GUIDE.md`;
- dnevnici mešaju stare brojeve testova, snapshot stanja i lokalne commitove koji
  nisu proverljivi u javnoj istoriji;
- rollout dokumenti se međusobno ne slažu oko već primenjenih migracija i stanja
  servera.

## 20. Konačan prioritet i odluka

### P0/P1 pre bilo kakvog V2 merge-a ili deploy-a

Nije potvrđen poseban P0 nalaz, ali više P1 nalaza pojedinačno blokira merge i
deploy. Kartično plaćanje mora ostati isključeno dok svi rollout uslovi nisu
dokazani na stagingu.

1. Validirati login `callbackUrl` i zatvoriti XSS sink.
2. Uvesti istek i pouzdan cleanup rezervisane zalihe.
3. Uključiti SMTP TLS certificate verification za sve transportere.
4. Ojačati login/reset/verify/session kontrole.
5. Popraviti newsletter unsubscribe/subscribe, chat, cron GET i rate limit.
6. Escape-ovati sav HTML u mejlovima i validirati priloge server-side.
7. Trijažirati i ažurirati critical/high produkcione zavisnosti; ponoviti pun
   CI/E2E i dodati dependency proveru.
8. Vratiti licencu i dokumentovati poreklo snapshot-a.
9. Ukloniti Planika/shopdemo operativne ostatke i uskladiti dokumentaciju.
10. Uneti stvarne podatke trgovca i sprovesti stručnu pravnu/privacy reviziju.
11. Potvrditi HTTPS, proxy, production secrets/vars i ručni migration plan.
12. Proširiti E2E na auth, admin, card callback, a11y i ključne failure scenarije.

### Odvojeni prioriteti za objavljeni statički `main`

1. Ispraviti UNESCO tvrdnju i ublažiti/potkrepiti ostale istorijske tvrdnje.
2. Dodati izvor i datum provere uz muzeje i ključne činjenice.
3. Popraviti 320 px reflow, kontrast i no-JS mobilnu navigaciju.
4. Popraviti ćiriličku pretragu i token-aware transliteraciju.
5. Uvesti centralnu data schemu i build containment validaciju.
6. Ispraviti heading/breadcrumb/search-live semantiku.
7. Uskladiti README/IZMENE/licencu i hostovati fontove lokalno ili precizirati
   privacy tvrdnju.

## 21. Tačan nastavak rada posle restarta

1. Proveriti lokalno stanje:

   ```sh
   git status --short --branch
   git rev-parse HEAD
   ```

2. Read-only proveriti remote glave:

   ```sh
   git ls-remote --heads origin
   ```

3. Uporediti `main` sa `31ebf14fe531c971d944fe4e8822830f644f66af` i V2 sa
   `438dc55b8b50291f7b955c0187c78a9db3f38aeb`.

4. Ako je bilo koji SHA promenjen, tretirati nove commitove kao novi audit; ne
   pretpostaviti da se stari nalazi ili zeleni CI i dalje odnose na vrh grane.

5. Za pregled V2 koristiti nov izolovan temp klon ili bezbedno osvežiti refs tek
   kada je to željeni sledeći korak. Ne oslanjati se na stari `/tmp` klon.

6. Ponovo proveriti Draft PR, Actions status i dependency audit pre izmene koda.

7. Preporučeni red rada:

   ```text
   security hotfixes
     → dependency upgrade/audit
     → inventory cleanup
     → auth/newsletter/email/TLS
     → licenca i poreklo
     → operativne skripte i dokumentacija
     → pravne/privacy stranice
     → staging/HTTPS/secrets/migracije
     → prošireni E2E
     → odluka o merge-u
   ```

8. `verzija/v2.0-prodavnica` ne koristiti kao bazu. Ako iz nje nešto treba,
   preneti samo jasno odabrane podatke ili ideje.

## 22. Završna napomena

Tokom audita nisu menjani izvorni fajlovi, grane, remote refs, GitHub PR, server,
baza, tajne ili javni deployment. Jedina naknadna namerna promena je dodavanje
ovog dokumenta u lokalni `main`, na zahtev da nalaz ostane sačuvan pre gašenja
računara.
