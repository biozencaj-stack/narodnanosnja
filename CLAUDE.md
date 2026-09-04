# CLAUDE.md

Uputstvo za Claude Code na ovom projektu. Pročitaj ga pre bilo kakve izmene.

## Šta je ovo

Prodavnica ručno tkanih proizvoda narodne nošnje. Next.js 16 + Prisma +
PostgreSQL, sa ugrađenim CMS-om. Nastalo iz `ecommerce-cms-template`.

Prezentacioni deo (priča o nošnjama, pojmovnik, tehnike) za sada živi kao
zaseban statički sajt i objavljuje se na GitHub Pages. Plan je da se ta građa
preseli ovde, u Articles.

## ⚠️ Ovaj projekat deli repozitorijum sa prezentacionim sajtom

Oba dela guraju u `biozencaj-stack/narodnanosnja`, ali su im istorije
**nepovezane** — prodavnica je počela kao zaseban `git init`, pa repo ima dva
korena.

| Grana | Šta je | Objavljivanje |
| --- | --- | --- |
| `main` | prezentacioni statički sajt | GitHub Pages |
| `verzija/v2.0-univerzalna-platforma` | **ova prodavnica** | CI bez deploya |
| `prodavnica-v2-YYYYMMDD-N` tag | pregledani V2 release | jedini dozvoljeni VPS deploy okidač |

**Nikada ne spajaj ovu granu u `main`.** Push na `main` objavljuje
prezentacioni sajt; spajanje bi oborilo njegov build ili objavilo pogrešan
sadržaj na javnu adresu. Git odbija spajanje bez
`--allow-unrelated-histories`, ali to je slučajna zaštita — ne oslanjati se
na nju.

Kad se u dokumentaciji pominje „spajanje prezentacionog dela u prodavnicu“,
misli se na **prenos sadržaja** u Articles, ne na git merge.

---

## ⚠️ Pravilo broj jedan: svaka izmena ide sa kanonske V2 grane

**Nikada ne radi direktno na `main` niti na kanonskoj V2 grani.** Svaki put kad
kreneš u novu verziju, funkcionalnost ili ispravku, napravi novu granu sa
aktuelnog remote V2 stanja:

```bash
git fetch origin verzija/v2.0-univerzalna-platforma
git switch --no-track -c dodatak/kratak-opis \
  origin/verzija/v2.0-univerzalna-platforma
```

| Vrsta posla        | Oblik imena                | Primer                        |
| ------------------ | -------------------------- | ----------------------------- |
| Nova verzija       | `verzija/vX.Y-kratak-opis` | `verzija/v1.1-fotografije`    |
| Nova funkcionalnost| `dodatak/kratak-opis`      | `dodatak/nestpay-kartice`     |
| Ispravka greške    | `ispravka/kratak-opis`     | `ispravka/zbir-u-korpi`       |
| Samo sadržaj       | `sadrzaj/kratak-opis`      | `sadrzaj/opisi-proizvoda`     |

Pull request se otvara ka `verzija/v2.0-univerzalna-platforma`. Push na tu
granu pokreće CI, ali nikada produkcijski deploy. Ručni `workflow_dispatch`
takođe je verification-only. Produkciju može da pokrene isključivo push
pregledanog taga oblika `prodavnica-v2-YYYYMMDD-N`, i to tek na poslednjoj
odobrenoj rollout fazi.

## ⚠️ Pravilo broj dva: održavaj ovaj fajl

Kad dodaš stranicu, model u bazi, skript ili promeniš način rada —
**dopuni CLAUDE.md u istom commit-u**.

---

## Naredbe

```bash
npm install --legacy-peer-deps   # OBAVEZNO --legacy-peer-deps, vidi zamke
npx prisma generate
npm run dev                      # razvojni server
npm run build                    # produkcijski build
npm run lint                     # ESLint 9 flat config; greške blokiraju CI
npm run typecheck                # stroga TypeScript provera bez emitovanja
npm test                         # automatski pronalazi sve lib/**/*.test.ts
npm run test:e2e                 # Playwright; samo nad jasno označenom test bazom
npx tsx scripts/uvoz-nosnja.ts   # uvoz kategorija i proizvoda iz podaci/
npx tsx scripts/create-admin.ts --email … --role ADMIN # maskirani TTY unos
```

## Slike i kretanje

**Granice otpremanja dolaze iz profila**, ne iz tvrdo upisanog broja.
`lib/media/profili.ts` drži po jedan profil za svaku fasciklu: zatečene
(`products`, `articles`, `categories`, `brands`) ostaju na 1 MB i 800×800, a
`sekcije-hero` prima 4 MB i 2000×1200. Isti modul čita i serverska ruta i
`ImageUpload` u pregledaču — zato u njemu nema uvoza React-a, Prisme ni Next-a.
Ako granicu promeniš samo na jednom mestu, veća vrednost na serveru postane
nedostižna jer je klijent odbije ranije.

**`quality` mora ostati u `[70, 75]`.** Ispod 70 se na tkaninama i vezu vide
artefakti, iznad 75 fajl raste bez vidljive razlike. `next.config.ts` to već
ograničava kroz `qualities`, ali **tiho** — vrednost van spiska ne obara
izgradnju. Zato pravilo drži i test (`lib/media/kvalitet-slika.test.ts`), koji
pada sa imenom fajla i linijom.

**Svaki karusel sa autoplayem mora imati vidljivo dugme za pauzu.** WCAG 2.2.2
traži mehanizam za zaustavljanje kretanja dužeg od pet sekundi.
`stopOnInteraction` iz embla-e ga ne zamenjuje — staje tek kad posetilac
dodirne sam sadržaj. Pauza na hover takođe ne prolazi: na dodirnom ekranu hover
ne postoji, a tastatura ga ne pokreće. Koristi `usePauzaKarusela` i
`DugmePauze`; pravilo čuva `lib/media/autoplay-pauza.test.ts`.

**Semafor nad `sharp` obradama nije zaštita od DoS-a.** `lib/media/semafor.ts` i
`checkRateLimit` žive u memoriji **jednog procesa**: pod PM2 cluster režimom
svaka instanca ima svoj brojač, a restart briše brojanje. Štite od nenamerne
preopterećenosti — administrator koji izabere trideset slika odjednom — i to je
sve što tvrde.

## Zamke koje su već jednom pojele vreme

- **`npm install` bez `--legacy-peer-deps` puca.** `next-auth@4` još ne
  prihvata React 19 kao peer zavisnost. Nije pokvareno — samo mora zastavica.
- **npm 11 blokira install skripte paketa.** Posle instalacije ručno pokreni
  `npx prisma generate`, inače Prisma klijent ne postoji.
- **Fontovima treba `latin-ext`.** Bez tog podskupa srpske dijakritike
  (č, ć, š, ž, đ) tiho padnu na rezervni font. Ako dodaješ ćirilicu, treba i
  `cyrillic`. Zatečeni `Libre_Baskerville` je imao samo `latin`.
- **Podrazumevana paleta stoji u CSS-u, runtime paleta u Settings.** Admin
  vrednosti se postavljaju kao CSS promenljive iz `app/layout.tsx`; pri
  dodavanju novog semantičkog tokena dopuni i registry i `storeThemeStyle`.
- **Portovi na serveru su zauzeti.** 3000 (shopdemo), 3001 (kore), 3002, 8000,
  8080. Ova prodavnica radi na **3007**, nginx je izlaže na **8090**.

## Struktura

```
app/            Next.js App Router
  (shop)/         prodavnica: katalog, proizvod, korpa, checkout
  (user)/         nalog kupca: porudžbine, adrese, favoriti
  (legal)/        pravne stranice propisane za webshop u Srbiji
  admin/          CMS — proizvodi, porudžbine, kategorije, članci, statistika
  api/            REST rute
components/     React komponente
lib/            poslovna logika
  email/smtp.ts   jedina SMTP transport/TLS konfiguracija
prisma/         schema.prisma i migracije
podaci/         izvorni podaci o nošnji — kategorije i proizvodi (JSON)
scripts/        uvoz-nosnja.ts, create-admin.ts, backup.sh, restore.sh
messages/       prevodi (sr, en)
```

## Podaci o proizvodima

Izvor istine za početno punjenje je `podaci/` — isti JSON koji koristi i
statički sajt. `scripts/uvoz-nosnja.ts` ih upisuje preko `slug`-a, pa se može
pokretati više puta bez dupliranja i **ništa ne briše**.

Posle prvog uvoza proizvode uređuj kroz admin panel, ne kroz JSON — inače
ponovni uvoz pregazi izmene urađene u panelu.

Mapiranje koje nije očigledno:
- sniženje: puna cena ide u `price`, snižena u `salePrice`, `onSale = true`
- `stanje: rasprodato` → veličina „Univerzalna“ sa zalihom 0
- `stanje: po-porudzbini` → zaliha 99 (može se naručiti, samo se duže čeka)
- engleski prevodi **ne postoje** — u `{ sr, en }` poljima svuda stoji srpski

## Generički katalog (v2, expand-only)

Arhitektonske granice platforme i redosled narednih faza su u
`docs/ARCHITECTURE-V2.md`.

`prisma/schema.prisma` sadrži novu, opcionu osnovu za više branši:

- `ProductType` i tipizovane definicije/vrednosti atributa određuju dinamička
  polja proizvoda;
- `ProductOption` / `ProductOptionValue` predstavljaju prodajne ose kao što su
  veličina, boja, pakovanje i ukus;
- `ProductVariantOptionValue` povezuje te vrednosti sa postojećim
  `ProductVariant` modelom.

Legacy `ProductSize` i specifična polja proizvoda se i dalje koriste. Ne
uklanjaj ih i ne prebacuj storefront na novi model bez planiranog backfilla i
dual-read provere. Potpun redosled je u
`docs/CATALOG-MIGRATION-PLAN.md`. Admin API za tipove i atribute postoji, ali
se ne poziva pre eksplicitne expand migracije baze.

## Checkout i porudžbine (v2)

- Browser šalje samo identitet artikla/opcije i količinu. `buildCheckoutQuote`
  iz baze računa cenu, popuste, dostavu i total.
- `createSecureOrder` u Serializable transakciji ponovo proverava cenu,
  atomarno skida zalihu i upisuje snapshot porudžbine.
- Svaki browser checkout pokušaj šalje stabilan `Idempotency-Key`, a
  `Order.checkoutIdempotencyKey` je unique. Ne uklanjaj ga: izgubljen odgovor
  inače pravi duple porudžbine i rezervacije.
- Otkazivanje/decline vraća zalihu i rezervisani kupon najviše jednom.
- Cleanup rezervacija automatski otkazuje i oslobađa zalihu/kupon samo za
  istekao `CARD` order koji je i dalje `PENDING`, ima payment `PENDING`,
  `inventoryAllocated=true` i nema ni `Transaction` ni `PaymentEvent` trag.
  `CASH` porudžbine se nikada ne otkazuju ovim tokom.
- Stara rezervacija sa bilo kakvom payment aktivnošću, kao i stari
  `PROCESSING`, prelazi u `REVIEW` i zadržava zalihu i kupon do ručnog
  reconciliation-a. Pending/recovery prozor je dva sata; processing review
  prozor je podrazumevano 24 sata i može se ograničeno podesiti kroz
  `ORDER_PROCESSING_REVIEW_MINUTES`.
- Maintenance endpoint je isključivo `POST /api/cron/order-reservations`,
  zahteva zaseban Bearer secret od najmanje 32 znaka i podrazumevano radi
  dry-run. Serverski poziv mora poslati i `Origin` jednak javnom origin-u jer
  unsafe API rute ostaju iza fail-closed same-origin provere. Svaki kandidat
  koji ostane `failed` obara poziv sa HTTP 500 da scheduler ne prijavi lažan
  uspeh.
- Gost pristupa detaljima porudžbine kratkotrajnim HMAC tokenom u zasebnom
  HttpOnly/SameSite cookie-ju po porudžbini; CUID nije autentifikacija.
  Recovery idempotency ključ je ograničen na minimalni CARD PENDING/PROCESSING
  snapshot i dva sata. Podesi zaseban `ORDER_ACCESS_SECRET`.
- reCAPTCHA token se proverava u samom order handleru neposredno pre quote-a i
  rezervacije zalihe; zasebna klijentska verifikacija nije autorizacija.
- Kartice su capability flagom isključene dok banka i NestPay tok nisu
  sertifikovani. Iznos payment zahteva uvek se čita iz porudžbine u bazi;
  preflight izdaje kratkotrajan handoff za pravi top-level POST banci.

## Centralna podešavanja (v2)

`Setting` tabela je dozvoljeni, tipizovani runtime registry. Admin stranica
`/admin/settings` uređuje identitet, kontakt, SEO, semantičku paletu, radno
vreme, dostavu i minimalnu porudžbinu. `.env` vrednosti su samo fallback za
prvo pokretanje; tajne baze, emaila i plaćanja nikada ne idu u `Setting`.

`lib/config/capabilities.ts` kontroliše module koji smeju da budu javno
vidljivi. Ne prikazuj kartice, lokacije, dokumente, jezike ili chat ako njihov
capability nije uključen i stvarna usluga nije spremna.

## Newsletter odjava (v2)

Tokeni i URL za odjavu nastaju isključivo kroz
`lib/newsletter/unsubscribe.ts`. U produkciji podesi jak, zaseban
`NEWSLETTER_UNSUBSCRIBE_SECRET`; jaki `NEXTAUTH_SECRET` se prihvata samo kao
prelazna kompatibilnost za ranije poslate linkove kada je
`NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY=true`; po završetku migracionog
perioda vrati flag na `false`. Ne uvodi javni fallback ključ. GET link nikada
ne menja stanje: vodi na `noindex`/`no-referrer` stranicu za potvrdu, a tek
potpisani POST nakon izričitog klika atomarno deaktivira korisničku i gostujuću
pretplatu. Uspešan odgovor je idempotentan i ne otkriva da li email postoji u
bazi.

## Autentifikacija i email verifikacija (v2)

`lib/auth/config.ts` je jedini izvor `NEXTAUTH_SECRET`, auth session/JWT roka i
izbora secure session cookie-ja. Ne uvoditi fallback secret niti ponavljati
NextAuth cookie heuristiku u ruti ili proxy-ju. Secret mora biti najmanje 32
UTF-8 bajta, bez okolnih razmaka, nov i kriptografski nasumičan; poznati javni
placeholder-i su namerno odbijeni. U produkciji su obavezni `NEXTAUTH_URL` i
HTTPS, dok `NEXT_PUBLIC_SITE_URL` prolazi kroz `getStorefrontUrl()`.

Standardna sesija, JWT i sesija iz email-verification toka imaju isti rok od 24
sata. `proxy.ts`, NextAuth i verify ruta moraju koristiti isti secret, isti
secure-cookie izbor i isto ime cookie-ja. Verifikaciona ruta mora pre DB
mutacije validirati konfiguraciju i redirect URL, potpisati sesiju i potpuno
pripremiti odgovor sa cookie-jem. Tek zatim jedna transakcija zaključava
`User FOR UPDATE`, pa tačan `EmailVerification FOR UPDATE`, i čita
`clock_timestamp()::timestamptz(3)` tek posle oba moguća lock wait-a. Claim je
vezan za tačan email, password hash, role, firstName i lastName snapshot iz kog
je pripremljen JWT. Promena bilo kog polja, zamena tokena ili expiry za vreme
čekanja daju conflict/expired ishod bez prepared cookie-ja. Uspešan commit
troši tačan još važeći credential, postavlja `emailVerified` DB vremenom, čisti
grace/resend throttle i briše sve sibling verification tokene. Svaka kasnija
greška rollback-uje i token i User mutaciju. Ovaj User-first redosled je
zajednička lock invarijanta verify, resend, password reset/change i
privileged-account toka; svaka izmena mora zadržati unit testove za
encode/response/commit greške i opt-in PostgreSQL lock/race/rollback testove.

Email verification je trajno prefetch-safe pravilo, ne privremeni UI detalj.
Kanonski link iz emaila vodi na serversku `/verify-email/[token]` stranicu koja
ne čita bazu, ne menja nalog, ne troši token i ne izdaje sesiju. Stranica mora
ostati upotrebljiva kao običan HTML: eksplicitni native same-origin `POST` se
šalje tek nakon korisničkog klika. Legacy API `GET` i `HEAD` smeju samo da vrate
`303 See Other` ka toj confirmation stranici, bez tela, session cookie-ja ili
DB/session/token rada. Prefetch, link preview i email skener nikada ne smeju
postati mutirajući signal; nova potvrda ili magic-login tok ne smeju vratiti
mutaciju na `GET`.

Mutirajući `POST /api/auth/verify-email/[token]` mora lokalno proveriti trusted
same-origin write pre čitanja parametara, auth konfiguracije, sesije ili baze,
jer je širi `/api/auth` prostor izuzet od globalnog origin guard-a zbog
NextAuth callbackova. Prihvata se samo tačno 64 heksadecimalna znaka, uz
lowercase kanonizaciju. Posle te lokalne provere, ali pre auth konfiguracije,
session čitanja i baze, zahtev mora biti i na kanonskom storefront originu.
Trusted alias-host POST sme samo da vrati `303` ka kanonskoj confirmation
stranici, bez lookup-a, commita ili cookie-ja; inače bi host-only session cookie
nestao pri redirectu na kanonski domen. Istekli token se prijavljuje bez
brisanja. Ako je u pregledaču aktivna sesija drugog korisnika, potvrda mora biti
odbijena bez izdavanja sesije i bez potrošnje tokena; ista ili odsutna sesija
sme da nastavi.

Uspešan redosled ostaje: session encode → potpuno pripremljen `303` odgovor sa
24-časovnim centralno imenovanim cookie-jem → User lock → exact credential lock
→ DB vreme/expiry → atomski token/User/sibling commit. Late expiry posle
session/response pripreme mora ostati read-only i ne sme poslati pripremljeni
cookie. Prepared odgovor se vraća tek posle uspešnog commita. Legacy claim mora
pored tačnog tokena zahtevati i `tokenHash: null`. Conflict ili bilo koja
kasnija greška ne smeju poslati prepared cookie; neuspeh ostaje retryable,
expired ili invalid-token ishod sa stage-only logom. Tako se magic-login dobija
tek posle eksplicitnog klika, nikada samim otvaranjem email URL-a.

Confirmation stranica i API ishodi moraju ostati `private, no-store`,
`no-referrer`, `noindex/nofollow/noarchive`, a `/verify-email` putanje isključene
iz svih third-party skripti. Zajednički sensitive-credential guard mora da
isključi i Google Analytics i globalni reCAPTCHA provider na
`/verify-email/*`, token putanji `/reset-password/*` i
`/newsletter/odjava`; nepoznat pathname je private-by-default. Reset-token i
newsletter odjava page/API granice koriste ista privacy zaglavlja. GA događaji
na dozvoljenim stranicama smeju da šalju samo origin + pathname, bez query-ja
ili hash-a u `page_location`. Ovo smanjuje browser, cache, crawler i analytics
curenje, ali ne uklanja prvi URL iz reverse-proxy/access logova; dok se ne
završe hash-only write, TTL+grace i contract faze, URL i compat plaintext DB
vrednost su i dalje poverljivi podaci.

Jednokratni auth credentiali sada imaju centralni storage ugovor u
`lib/auth/credential-token.ts`. Javni/email oblik je tačno 32 nasumična bajta,
odnosno 64 lowercase hex znaka. Storage lookup je verzionisan kao
`v1:<sha256>` i obavezno purpose-separated za `email-verification` i
`password-reset`, tako da isti raw token ne daje isti hash u dva toka. Parser
ne radi `trim()` niti coercion. Lookup u compat fazi uvek prvo koristi
`tokenHash`; plaintext fallback je dozvoljen tek posle hash promašaja i samo za
red čiji je `tokenHash IS NULL`. Red koji već ima bilo kakvu vrednost u
`tokenHash` koloni nikada ne sme da se vrati na plaintext kopiju.

Migracija `20260830000000_expand_hashed_auth_tokens` je samo expand/compat
korak. Dodaje nullable unique `tokenHash` u `PasswordReset` i
`EmailVerification`, čini postojeći `token` nullable i uvodi unique
`PasswordReset.userId`. Plaintext kolone i indeksi namerno ostaju, a trenutni
request/register upisi još dual-write-uju raw token i hash radi rollback
kompatibilnosti. Migracija koristi hardened
`search_path = pg_catalog, public`, `lock_timeout=10s` i
`statement_timeout=2min`, pre izmene šeme zaključava `PasswordReset` i
fail-closed odbija zatečene duplikate po `userId`; ne bira pobednika, ne briše
redove i nema drugi DML. DB smoke za svih sedam auth indeksa proverava valid/
ready stanje, tačnu tabelu, jednu tačnu kolonu, unique oblik i odsustvo partial/
expression zamene. Pre produkcionog izvršavanja obavezni su read-only audit,
backup i eksplicitno razrešenje svakog duplikata. Produkciona baza nije čitana
i ova migracija nije lokalno primenjena tokom implementacije.

`statement_timeout` je limit po naredbi, a DDL lockovi ostaju do `COMMIT`-a.
Ako Prisma evidentira ovu migraciju kao failed posle preflight-a ili timeout-a,
ne ponavljaj deploy naslepo: prvo potvrdi rollback i otkloni uzrok, zatim
kontrolisano izvrši
`prisma migrate resolve --rolled-back 20260830000000_expand_hashed_auth_tokens`.
`resolve` ne sme da prikrije neprovereno ili delimično DB stanje.

Ovo još **nije završni hash-only contract**. Posle compat runtime dokaza novi
upisi moraju preći na hash-only, zatim se čeka najmanje najduži token TTL plus
dogovoreni grace period, proverava da nema legacy čitanja, i tek posebna
contract migracija uklanja plaintext kolone/indekse. Ne preskači taj redosled i
ne predstavljaj dual-write kao zaštitu credentiala od DB čitaoca.

Migracija `20260830010000_expand_email_verification_cooldown` je zaseban
expand-only korak za DB-backed verification-email throttling. Dodaje tri
nullable kolone bez defaulta u `User`: `verificationEmailNextAllowedAt`,
`verificationEmailResendWindowStartedAt` i `verificationEmailResendCount`.
Nema backfill DML-a niti dedicated indeksa, pa legacy red sa sva tri `NULL`
polja postaje podoban za svoj prvi resend. PostgreSQL dodavanje nullable kolona
bez defaulta je metadata-only, ali `ALTER TABLE` ipak kratko zahteva
`ACCESS EXCLUSIVE` lock; migracija zato koristi hardened `search_path`,
`lock_timeout=10s` i `statement_timeout=2min`. Produkciona baza nije čitana i
ova migracija nije produkcijski primenjena u trenutku implementacije.

Migracija `20260830020000_expand_verified_login_grace` dodaje samo nullable
`User.emailVerificationLoginGraceUntil` kao `timestamp(3)` bez defaulta,
indeksa ili backfill DML-a. Ona omogućava da posebno pregledana buduća data
odluka dodeli jedan tačan staged deadline samo odgovarajućim legacy CUSTOMER
nalozima; ne označava nikoga verifikovanim i sama ne menja login ponašanje.
Isti metadata-only/`ACCESS EXCLUSIVE` oprez, `search_path`, 10s lock timeout,
2min statement timeout, restore-clone i maintenance pravila važe i za nju.
Aktivni lanac zato ima sedam migracija, dok je na produkciji dokazano samo
ranijih četiri. Sve tri auth expand migracije ostaju neprimenjene na produkciju
u ovom preseku.

Registracija sada koristi centralni email normalizer, strogi request shape,
trusted same-origin guard i centralnu bcrypt granicu od najviše 72 UTF-8 bajta.
Application route zahteva odgovarajući JSON `Content-Type`, prihvata samo
odsutan ili `identity` `Content-Encoding`, fail-closed proverava deklarisani
`Content-Length` i čita body kroz streaming limit od najviše 4096 bajtova.
Limit se sprovodi i kada
dužina nije deklarisana, pre tokena, SMTP pripreme, bcrypt-a ili baze.
Kanonski verification credential, hash, URL, SMTP transport i kompletna poruka
pripremaju se pre persistence-a, a bcrypt se završava pre određivanja token
TTL/cooldown početka. Taj početak se čita kao validirani PostgreSQL
`clock_timestamp()` posle bcrypt-a, pa različit Node sat ne skraćuje ili
produžava početni TTL, cooldown i allowance prozor. `User` i početni
`EmailVerification` nastaju u jednoj
transakciji. Novi User dobija jednočasovni token, 60-sekundni cooldown i
fiksni 24-časovni allowance prozor sa brojačem `1`, jer se početna poruka računa
u maksimum od pet verification emailova u tom prozoru.

Unique-email race se klasifikuje kao postojeći nalog tek posle rollback-a i
kanonskog lookup-a. Token/hash unique kolizija bez odgovarajućeg email naloga
ostaje operativni failure, ne lažni „existing” ishod. Za nov i već postojeći
email javni rezultat je byte-identical private HTTP 202. Account-dependent
persistence put dobija 900 ms osnovni response floor sa kriptografskim
0–200 ms jitterom kao defense-in-depth protiv timing enumeracije; to nije
zamena za shared limiter niti durable queue. Existing-account put sme recovery
da pokrene samo kroz isti resend servis i njegova cooldown/quota pravila.

`POST /api/auth/verify-email/resend` takođe mora lokalno proveriti trusted
same-origin pre limitera i body rada, zatim prihvatiti plain JSON objekat sa
tačno jednim `email` poljem. Zahteva JSON media type, prihvata samo odsutan ili
`identity` `Content-Encoding` i primenjuje 1024-byte deklarisani i stvarni
streaming limit pre parsiranja. Za
svaki sintaksno validan email čiji je callback
registrovan vraća isti neposredni private HTTP 202; lookup naloga, verified
stanje, cooldown, allowance, token i SMTP ostaju iza Next.js `after()`
callbacka. Nepostojeći, već verifikovan, cooling-down ili quota-exhausted nalog
je private no-op. Invalid input, account-independent IP limit, sinhroni limiter
kvar i neuspešno samo zakazivanje mogu imati 400/429/503 jer nastaju pre
account lookup-a.

Resend transakcija zaključava `User` sa `FOR UPDATE`, zatim čita
`clock_timestamp()` tek posle dobijenog lock-a. To sprečava da vreme provedeno
u lock wait-u skrati cooldown ili TTL. U istom User-first transaction redu
proverava email i `emailVerified`, 60-sekundni cooldown i fiksnu 24-časovnu
kvotu od najviše pet poruka uključujući initial, atomarno uvećava brojač,
briše samo istekle verification tokene i dodaje novi jednočasovni compat
raw+hash credential. Ranije poslat neistekli link namerno ostaje važeći;
uspešna verifikacija kasnije briše sve siblinge. SMTP se poziva tek posle
commita. Ambiguous SMTP failure ne briše token i ne vraća cooldown/brojač.

`after()` je lifecycle pomoć, ne durable queue. Pad procesa ili redeploy posle
već vraćenog 202 može izgubiti registracionu/resend obradu. Transactional
auth-email outbox, worker/retry, delivery monitoring i shutdown/redeploy smoke
ostaju obavezni pre live-a. Etapa je integrisana samo u V2 kroz PR #18:
feature `964831f490b54a3f5b11ec0cecce8b562551d4d8`, merge
`15c18cf1de19ceee4de4a06eff28bf7114d3fc19`, exact-head run `33317607438` i
post-merge run `33317787952`, oba attempt 1 SUCCESS. Lokalno je 237 testova:
229 pass, 8 očekivanih PostgreSQL skip-ova i 0 fail; u CI-ju svih 237 prolazi,
uključujući 8 PostgreSQL scenarija. Lint, typecheck, Prisma validate,
diff-check, mobile Chromium E2E i build 93/93 su zeleni. Release potvrda i
produkcijski deploy su preskočeni; nema V2 release taga/deploymenta i live/prod
stanje je netaknuto.

Ovi SHA/run brojevi dokazuju samo prethodni registration/resend presek. Za
aktuelni verified-login/reset/grace paket završni exact-head i post-merge dokaz
još se ne upisuje dok stvarni PR/CI ciklus nije završen; ne izmišljati brojeve
unapred i ne prepisivati stare run-ove kao dokaz novog sadržaja.

Verified-login runtime ima tri tačne politike: `audit`, `staged` i `strict`.
Produkcija zahteva eksplicitnu vrednost, a trenutno je jedini dozvoljeni izbor
`AUTH_VERIFIED_LOGIN_POLICY=audit`. Audit dopušta password-valid
neverifikovanom nalogu prijavu, postavlja `requiresEmailVerification` i beleži
samo coarse `AUDIT_WOULD_DENY` bez PII/credential/error sadržaja. `staged`
dopušta samo CUSTOMER nalog čiji je non-`NULL` grace tačno jednak kanonskom
`AUTH_VERIFIED_LOGIN_GRACE_DEADLINE`, još je aktivan po svežem DB vremenu i nije
duži od 30 dana; ADMIN/OPERATOR bez verifikacije se odbijaju. `strict` odbija
svaki neverifikovan nalog.

Credentials login za svaki sintaksno validan kanonizovan email radi tačno
jedan cost-12 bcrypt compare; nepostojeći nalog koristi fiksni cost-12 dummy.
Tek posle uspešnog compare-a uzima svež User policy snapshot i DB sat posle
lock wait-a, a ID/email/passwordHash moraju odgovarati prvom credential lookup-u.
To zatvara stale credential izdavanje, ali cost-12 rad ostaje CPU abuse površina
i nije zamena za shared limiter.

`staged` i `strict` se **ne aktiviraju** dok ne postoji DB-backed revalidacija i
revokacija rolling NextAuth JWT sesija i shared auth/login limiter sa preciznim
trusted-proxy/client-IP ugovorom. Trenutni JWT callback re-signuje aktivne
sesije bez svežeg DB policy snapshot-a, pa policy flip, istek grace-a, password
reset/change ili role promena ne opozivaju već izdatu sesiju. Zato je paket
audit-only čak i ako data nalazi izgledaju čisto.

Tačne read-only audit komande zavise od šeme. Pre auth expand migracija koristi
se samo legacy skripta:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-legacy.sql
```

Legacy skripta namerno odbija expanded auth šemu. Posle kontrolisane primene
sve tri auth expand migracije koristi se current skripta:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-current.sql
```

Obe rade `REPEATABLE READ READ ONLY`, uzimaju samo `ACCESS SHARE` lockove,
ispisuju isključivo `category|count` agregate bez emaila, ID-a, credentiala ili
timestamp redova i završavaju sa `ROLLBACK`. Ne rade backfill i njihov output
nije dozvola da se `NULL emailVerified` automatski pretvori u verified.

Staged preflight se sme pozvati samo nad current šemom i posle posebno
pregledane data odluke:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -v target_policy=staged \
  -v legacy_cutoff='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -v grace_deadline='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -f scripts/auth-email-verification-enforcement-preflight.sql
```

Cutoff/deadline moraju biti kanonski UTC sa tačno tri decimale; cutoff nije u
budućnosti, a deadline je 7–30 dana posle DB vremena preflight-a. Svaki
non-`NULL` grace mora biti tačno jednak tom deadline-u. Preflight odbija
`strict` i trenutno **uvek** emituje
`preflight.jwt_session_revalidation.unavailable|1`, `preflight.ready|0` i
završava statusom `3`. Ne zaobilaziti taj blocker; može ga promeniti tek zaseban
pregledani session-revalidation paket.

## Zahtev za reset lozinke (v2)

Za svaki sintaksno validan email čiji je callback uspešno registrovan
`POST /api/auth/reset-password/request` mora imati isti account-independent
javni ugovor: neposredni HTTP 202, generičku poruku i `no-store`/`no-cache`
zaglavlja. Lookup naloga, zamena tokena i SMTP ne smeju se vratiti u sinhroni
response put; produkcijska ruta ih registruje kroz Next.js `after()` tek kao
callback, nikada kao već pokrenut Promise. Nevalidan input, rate limit i
sinhroni kvar samog scheduler-a mogu imati 400/429/503 jer nastaju pre lookup-a
i ne zavise od postojanja naloga.

Request i confirm rute prvo lokalno proveravaju trusted same-origin, zahtevaju
JSON media type, prihvataju samo odsutan ili `identity` `Content-Encoding` i
sprovode i deklarisani i stvarni streaming limit od 1024 bajta čak i bez
`Content-Length`. Request prihvata samo plain JSON objekat sa tačno jednim
ključem `email`; confirm samo
plain objekat sa tačno dva ključa `token` i `password`. Dodatni/nedostajući
ključevi, niz, `null`, primitive ili neplain objekat su nevalidni.

Logovi ovog toka smeju da sadrže samo kontrolisanu fazu (`LOOKUP`,
`TOKEN_REPLACEMENT`, `DELIVERY`, `SCHEDULING` ili `BACKGROUND`). Ne logovati
email, token ili originalnu DB/SMTP grešku. Posle compat expand migracije
zamena reset credentiala koristi `upsert` preko unique `PasswordReset.userId`,
pa svaki korisnik ima najviše jedan aktivan reset red i paralelni requesti ne
ostavljaju sibling tokene. Upis je privremeni dual-write raw tokena i njegovog
purpose-separated hash-a. SMTP greška ne sme automatski obrisati novi token,
jer poruka može biti prihvaćena pre gubitka SMTP odgovora i korisnik bi dobio
već poništen link. Minimalni lookup nosi User ID/email/role i PostgreSQL `xmin`
reviziju. Write transakcija zaključava taj User, proverava isti snapshot i tek
posle lock wait-a čita DB sat i radi token upsert. Promena emaila/role/passworda
ili privilegovano provisionovanje između lookup-a i locka zato ne može
ponovo uvesti reset credential iz zastarelog zahteva; delivery koristi svež
locked email/ime.

`POST /api/auth/reset-password/confirm` ima sopstveni trusted same-origin guard
pre body/config/DB rada, rate limit, postojeću password politiku i eksplicitnu
bcrypt granicu od najviše 72 UTF-8 bajta. Ruta radi hash-first lookup, a legacy
lookup samo sa `tokenHash: null`; bcrypt i kompletan private success odgovor
pripremaju se pre mutacije. Commit zaključava `User FOR UPDATE`, zatim tačan
`PasswordReset FOR UPDATE`, pa tek posle oba moguća lock wait-a čita
`clock_timestamp()::timestamptz(3)` i proverava expiry/credential. U istoj
transakciji menja password hash, troši tačan reset red, briše reset siblinge i
briše sve `EmailVerification` linkove, jer bi stari verification link inače
mogao izdati passwordless sesiju. Conflict/expiry ne vraćaju pripremljen
success; operativni kvar daje generičan 503 i stage-only log. Real-PostgreSQL
testovi proveravaju jednog pobednika, expiry posle lock wait-a i rollback koji
vraća i hash i credential.

`after()` je lifecycle pomoć, ne durable delivery queue. Unique reset red i
exactly-once confirm zatvaraju DB konkurentnost tek kada expand migracija bude
bezbedno primenjena; ne rešavaju gubitak background posla posle već vraćenog
202. Pre produkcije još su potrebni transactional outbox i runtime smoke,
shared limiter i trusted-proxy client IP, kao i završni hash-only/grace/contract
prelaz. Autentifikovana promena lozinke sada radi bcrypt izvan transakcije,
zatim User lock + exact-hash CAS i atomski briše reset/verification tokove, ali
revokacija već izdatih JWT sesija posle reset/change/role promene ostaje poseban
P1 i enforcement blocker.

## Privilegovani nalozi (v2)

`scripts/create-admin.ts` nikada ne prihvata `--password` niti
`--password=<...>` zato što argument završava u shell istoriji i listi procesa.
Interaktivno koristi maskirani TTY prompt; za automatizovan kontrolisani tok
dozvoljen je samo preusmereni stdin uz `--password-stdin`, obavezne `--email` i
`--role`. Postojeći nalog se ne menja bez tačnog `--update-existing`.

Servis prihvata samo kanonski email, `ADMIN`/`OPERATOR` i podržani cost-12
bcrypt hash. Transakcija prvo zaključava postojeći User; za odsutan email koristi
transaction-scoped advisory lock i ponavlja lookup da dva procesa ne naprave
konkurentne naloge. DB sat se čita tek posle lock wait-a. Create/update postavlja
verified stanje, briše grace/throttle i u istoj transakciji briše sve reset i
verification credentiale. Rezultat i greške su coarse i bez PII. Promena uloge
ili lozinke i dalje ne opoziva stare rolling JWT sesije, pa CLI upozorenje ne
sme biti uklonjeno dok session-revocation paket ne postoji.

## SMTP i slanje emaila (v2)

Svaki email tok mora praviti transport isključivo kroz
`lib/email/smtp.ts`; ne dodavati zaseban `nodemailer.createTransport` u ruti ili
template modulu. Port 465 koristi implicitni TLS, a svaki drugi port zahteva
uspešan STARTTLS. Validacija sertifikata je podrazumevana i obavezna van
`development`/`test` okruženja. Lokalni self-signed izuzetak dodatno prihvata
samo loopback SMTP host. Host, korisničko ime, lozinka, boolean TLS zastavica i
port proveravaju se pre pravljenja transporta; produkcija ne sme tiho pasti na
localhost, plaintext ili no-auth slanje.

Auth email primalac mora prvo proći kroz centralni strogi email normalizer i
proslediti se Nodemailer-u kao tačno jedan address objekat
`{ name: "", address }`, nikada kao slobodan string koji može biti protumačen
kao display name, grupa ili lista primalaca. Svaka dinamička vrednost u auth
HTML-u, uključujući ime, naziv prodavnice, kontakt i URL, mora proći kroz
`escapeHtmlText`; plain-text alternativa ostaje literalni tekst. Ovaj završeni
auth-template presek ne predstavlja dokaz da su svi order/wishlist/contact
template-i ili MIME/magic-byte pravila priloga već auditovani.

## Admin uloge (v2)

Politika je deny-by-default u `lib/auth/admin-policy.ts` i sprovodi se u
`proxy.ts`. `ADMIN` ima pun pristup. `OPERATOR` ima samo porudžbine/status i
poruke kupaca. Svaka nova admin ruta mora dobiti eksplicitnu odluku u politici
i sopstvenu serversku proveru; skrivanje linka nije autorizacija.

## Rich HTML i browser bezbednost (v2)

Javni rich HTML nikada ne prosleđuj direktno u `dangerouslySetInnerHTML`.
Članci, FAQ odgovori i lokalizovani opisi proizvoda prolaze kroz allow-list
helper-e u `lib/security/html.ts` pri admin upisu i ponovo na javnoj read/render
granici. Novi HTML sink mora koristiti isti sloj i dobiti negativan XSS test.
JSON-LD se serijalizuje isključivo kroz `serializeJsonLd`.

Globalni browser headeri su u `next.config.ts`. `ENABLE_HSTS=true` se uključuje
tek kada javni domen i svi poddomeni zaista rade isključivo preko HTTPS-a.
Unsafe API write zahtevi moraju proći same-origin proveru u `proxy.ts`; javni
payment-provider callback ostaje eksplicitno izuzet pre te provere.

Login `callbackUrl` je nepoverljiv browser input. Pre prosleđivanja u
`router.push` uvek mora proći kroz `safeLoginCallbackPath` iz
`lib/security/navigation.ts`. Dozvoljene su samo kanonske root-relative
putanje; URL šeme, protocol-relative URL-ovi, backslash, kodirani separatori i
nekanonski segmenti padaju na fiksni `/` fallback. Svaka promena ovog pravila
mora dobiti pozitivne i negativne testove u `navigation.test.ts`.

## Browser E2E (v2)

`e2e/purchase-flow.spec.ts` proverava mobilni tok katalog → proizvod → korpa →
checkout → uspešna COD porudžbina. `scripts/seed-e2e.ts` je idempotentan, ali
namerno odbija svaku bazu čiji naziv jasno ne sadrži `e2e`, `test` ili
`provera`. Nikada ne zaobilazi tu zaštitu i nikada ne pokreći E2E seed nad
produkcijskom bazom. CI koristi zaseban PostgreSQL service i instalira Chromium
pre browser testa.

Demo seed ima još stroži opt-in: `npm run db:seed-demo` radi samo uz
`DEMO_DATABASE_SEED=true`, validan PostgreSQL `DATABASE_URL` čiji naziv baze
sadrži odvojen marker `demo`, `e2e`, `test` ili `provera`, a ne sadrži `prod`,
`production` ili `live`. Pre prvog upisa skripta poredi stvarni
`current_database()` sa nazivom iz URL-a. Demo credentiali su javni/zajednički,
zato se ovaj guard nikada ne zaobilazi i demo seed nikada nije deo produkcijskog
deploy workflow-a. Seed naloge upisuje kao verified, sa `NULL` login grace-om i
atomski očišćenim reset/verification tokenima.

## Server

Hetzner VPS `SERVER_HOST`, pristup preko `SSH_KEY_PATH` kao `SERVER_USER`.

```
/var/www/narodnanosnja     kod
PM2 proces: narodnanosnja  port 3007
nginx: /etc/nginx/sites-available/narodnanosnja  port 8090
baza: narodnanosnja_db, korisnik nosnja
```

Na istom serveru rade i `shopdemo`, `kore` i `kockica` — **ne diraj ih.**

`.env` postoji samo na serveru i nije u gitu. Šablon je `.env.example`.
GitHub deploy workflow ne instalira niti menja VPS systemd timer za cleanup
rezervacija. Timer, njegov Bearer secret, prvi dry-run i prvi apply smoke su
zasebna operativna radnja koja zahteva eksplicitno odobrenje. U ovoj izmeni
VPS nije menjan.

V2 workflow ne reaguje na presentation `main`. PR i push kanonske V2 grane
rade samo proveru. `workflow_dispatch` ne deployuje čak ni kada se ručno izabere
release tag. Tag deploy dodatno zahteva da je označeni commit već deo kanonske
V2 grane, da tag ima strogi oblik `prodavnica-v2-YYYYMMDD-N`, da production
Environment dozvoljava isti tag obrazac i da je odobren required reviewer.
Poseban `Potvrdi V2 release` job proverava identitet pre otvaranja Environment
gate-a, a produkcijski job proveru ponavlja pre SSH-a.
Release tag se ne pravi tokom običnog razvoja; verified-login paket nije live,
produkcijska baza/server nisu menjani, a main-push presentation workflow nije
aktiviran. Live i svaki-push-na-`main` objavljivanje ostaju poslednji korak.

## Sekcije stranica (faze 1 i 2 — registar, renderer, model i admin)

Početna strana je od sada **podatak, ne JSX**. `app/(shop)/page.tsx` je sveden na
`<RenderSekcije pageKey="home" />`; sav tekst, redosled i izgled sekcija dolaze
kroz registar tipova. Pun plan i naredne faze su u `docs/PLAN-SEKCIJE.md`.

```
lib/sekcije/polja.ts        tipovi polja, tokeni boja, oblik putanje medija
lib/sekcije/okvir.ts        četiri presečne grupe: zaglavlje, pozadina,
                            razdelnik, raspored — nosi ih SVAKA sekcija
lib/sekcije/registar.ts     tipovi sekcija; jedini autoritet nad oblikom config-a
lib/sekcije/validacija.ts   validirajSekciju / normalizujSekciju / sanitizujSekciju
lib/sekcije/prikaz.ts       druga granica sanitizacije, na renderu
lib/sekcije/podrazumevani-raspored.ts   PRIVREMENO: raspored početne u kodu
components/sekcije/         okvir, zaglavlje, mapa kind -> komponenta, renderer
```

**Kako se dodaje nov tip sekcije:** unos u `TIPOVI_SEKCIJA` u
`lib/sekcije/registar.ts` (polja + podrazumevane vrednosti) i jedna
prezentaciona komponenta upisana u `components/sekcije/mapa.ts`. Ništa drugo —
bez migracije, bez nove rute, bez novog admin ekrana.

Pravila koja se ne smeju razblažiti:

- **Mapa `kind -> komponenta` ne sme u registar.** Registar uvozi i admin
  obrazac; kad bi mapa bila u njemu, admin paket bi povukao ceo storefront.
- **U bazi nema CSS-a, klasa ni HEX vrednosti.** Konfiguracija čuva samo
  nabrojane ključeve; prevod u Tailwind klase je isključivo u
  `components/sekcije/stilovi.ts`.
- **Bogat tekst prolazi kroz sanitizer dvaput** — `sanitizujSekciju` pri upisu i
  `sanitizujZaPrikaz` na render granici. Komponenta koja puni
  `dangerouslySetInnerHTML` sme da zove samo `lib/sekcije/prikaz.ts`, jer
  `npm test` glob-uje isključivo `lib/**/*.test.ts` i testove izvan `lib/` ne
  vidi. Negativan XSS test postoji na obe granice.
- **Sekcija nikad ne pamti cenu.** Blok proizvoda čuva izvor i broj; cena se
  čita sa servera pri svakom prikazu, a `force-dynamic` na početnoj se ne dira.
- **Svaka asinhrona sekcija ide u sopstveni `Suspense`**, sa kosturom iz
  registra i `try/catch` unutar te granice. Bez toga stranica prestaje da
  strimuje, a snimak ekrana izgleda isto — pa se regresija ne primeti.
- **Validacija se piše ručno, bez `zod`-a.** `zod` nije u `package.json` nego
  dolazi kao tranzitivna razvojna zavisnost preko `eslint-config-next`.
- **Veze prolaze kroz `lib/security/navigation.ts`** (`safeInternalPath`,
  `safeExternalUrl`, `safeLinkTarget`). Sopstvena provera oblika putanje se ne
  piše — propušta `/\evil.com`, `/%2f%2fevil.com` i `..` segmente.
- **Ulazna animacija nikad ne ostavlja sadržaj nevidljivim.** Server ispisuje
  sekciju bez ijedne klase animacije; `hooks/useUOkviru.ts` sakriva samo ono što
  je još ispod vidnog polja i sam proverava `prefers-reduced-motion`, jer
  globalni CSS blok gasi trajanje ali ne i JavaScript.
- **Slika bez opisa se odbija**, osim kad je izričito označena kao ukrasna.
  `alt` je deo vrednosti polja `medij`, ne zasebno polje koje se zaboravi.

`lib/sekcije/podrazumevani-raspored.ts` je privremen. Njegovo brisanje je
stavka faze 3 i uslovljeno je proverom nad produkcijom da objavljene sekcije
zaista postoje — inače bi javna početna ostala prazna.

### Faza 2 — model, rute i admin ekran

Sekcije žive u bazi. Deveta migracija
`20260902120000_expand_page_sections` dodaje `PageSection`, `MediaAsset` i
`MediaAssetUsage` — samo nove tabele, indeksi i devet CHECK ograničenja.

```
lib/db/sekcije.ts           keširano čitanje OBJAVLJENIH sekcija + čitanje nacrta
lib/sekcije/invalidacija.ts pravilo koje oznake keša pada posle koje izmene
lib/sekcije/rute.ts         rukovaoci admin ruta kao fabrike sa zavisnostima
lib/sekcije/prisma-veze.ts  vezivanje tih fabrika za Prismu i next/cache
app/api/admin/sekcije/…     GET, POST, PUT, DELETE, redosled, objavi
app/admin/sekcije/          ekran i pregled nacrta
components/admin/sekcije/   obrazac generisan iz registra
components/admin/BogatiTekst.tsx   uređivač bogatog teksta za polja sekcija
```

**Nacrt ima tri kolone**, ne jednu: `draftConfig`, `draftOrder` i
`draftIsActive`. Bez druge dve bi preslagivanje i gašenje menjali javni sajt
uživo, dok pregled nacrta te promene ne bi pokazivao — čime nacrt gubi smisao.

**Javni čitač ne sme da vidi nacrt.** `citajObjavljeneSekcije` u `select`-u
namerno ne navodi nijednu nacrt-kolonu. To je granica, ne optimizacija: da su
tu, jedan pogrešan `??` u komponenti objavio bi neobjavljen sadržaj.

**Čuvanje nacrta NIŠTA ne poništava u kešu.** Javna stranica bi se pregradila
iz istih objavljenih podataka, pa bi svaki potez u obrascu rušio keš početne za
sve posetioce bez ikakve koristi.

**Objava ide po stranici**, ne po sekciji: nacrt je slika celog rasporeda, a
objavljivanje jedne po jedne pokazalo bi posetiocu novi naslov iznad starog
rasporeda.

### Medijateka

Slike otpremljene kroz `/api/admin/upload` dobijaju red u `MediaAsset`. Red se
upisuje **tek posle** uspešnog upisa na disk; obrnut redosled bi ostavljao
redove koji pokazuju na fajl kog nema. Neuspeh upisa u bazu ne obara odgovor:
fajl postoji i putanja je upotrebljiva, samo se slika ne pojavi u medijateci.

**Brisanje slike koja je u upotrebi se odbija sa 409 i spiskom sekcija.** Golo
„ne može” ostavlja administratora da pogađa po ekranima gde je slika.

Upotrebe drži `MediaAssetUsage`, a računaju se iz **objavljene** konfiguracije,
ne iz nacrta. Da se prati nacrt, slika izbačena u nacrtu odmah bi postala
„neupotrebljena” i mogla bi da se obriše — dok je javni sajt i dalje prikazuje.
Usklađivanje ide u istoj transakciji sa upisom sekcije.

`lib/sekcije/mediji-u-konfiguraciji.ts` obilazi konfiguraciju **po definiciji
polja iz registra**, ne po sadržaju: tako se običan tekst koji liči na putanju
ne može protumačiti kao medij.

**Brisanje ne dira fajl na disku.** Odluka „da li DELETE briše i fajl i ko čisti
siročiće” je u `docs/PLAN-SEKCIJE.md` navedena kao odluka vlasnika i još nije
doneta. Do tada se bira manja šteta: zaostao fajl zauzima prostor, obrisan fajl
se ne vraća. Kad odluka bude doneta, brisanje mora ići kroz `path.resolve` pa
proveru prefiksa pre `unlink`, i u istoj transakciji.

Fascikla se bira po **nameni polja** (`folderZaPolje` u `PoljeObrasca.tsx`), ne
jedna za sve: hero ide u profil sa 4 MB i 2000×1200, ikona u 256 KB i 256×256.

### Zamke koje su ovde već pojele vreme

- **Rute koje čitaju sesiju moraju biti fabrike sa ubrizganim zavisnostima.**
  `lib/auth/server-session-callsite-inventory.test.ts` dozvoljava
  `resolveServerSession` samo rutama upisanim u njegov `SESSION_FACTORY_SPECS`,
  a sirovi `getServerSession(authOptions)` stoji na spisku koji se **smanjuje**.
  Zavisnosti se pišu izričito (`nadjiSekciju: nadjiSekciju`) — skraćeni zapis je
  drugi AST čvor i test ga odbija. Test drži i tvrde ukupne brojeve; kad dodaješ
  poziv, osveži i njih.
- **ADMIN provera na admin STRANICI ide kroz `zahtevajAdminaNaStranici`.**
  `app/admin/layout.tsx` propušta i OPERATOR-a, jer `isAdminRole` obuhvata obe
  uloge. Pomoćnik je jedan zajednički da spisak raste za jedan unos umesto za
  svaku stranicu.
- **`Prisma.DbNull`, ne `null`,** kad se nullable Json kolona vraća na prazno.
  `null` upisuje JSON vrednost `null`, koju `draftConfig ?? config` čita kao
  postojeći nacrt.
- **Traka bogatog teksta sme da nudi samo ono što preživi
  `lib/security/html.ts`.** Poravnanje (`TextAlign`) proizvodi
  `style="text-align:…"`, a beli spisak ne dozvoljava `style` — dugme bi radilo
  u uređivaču, a poravnanje bi nestalo pri snimanju, bez ijedne poruke.
- **Ikone admin navigacije moraju u `ADMIN_ICONS`.** `DynamicIcon` za nepoznato
  ime tiho vraća `null`, pa stavka ostane bez ikone.

## Šta još nije urađeno

- [ ] Fotografije proizvoda — sve su prazne, stoje sivi mestodržači
- [ ] Pravi domen i HTTPS (sada samo IP i port 8090)
- [ ] Prenos građe o nošnjama iz statičkog sajta u Articles
- [ ] Baseline + expand migracija generičkog kataloga na klonu produkcione baze
- [ ] Backfill i dual-read generičkih atributa/opcija u ProductForm/storefrontu
- [ ] Dinamički filteri izvedeni iz `AttributeDefinition` umesto legacy polja
- [ ] Page builder za početnu, zajednička medijateka i redirect/404 SEO centar
- [ ] Zone/težinska pravila i integracija kurirske službe
- [ ] NestPay kartice — tek kad postoji ugovor sa bankom; do tada radi pouzeće
- [ ] Instalacija i provera VPS cleanup timera; kod endpointa postoji, ali još
      nije operativno zakazan niti smoke-testiran na serveru
- [ ] REVIEW reconciliation, refund tok i email outbox
- [ ] Transactional auth-email outbox i runtime dokaz da `after()` posao nije
      izgubljen pri shutdown/redeploy granici
- [ ] Završni hash-only auth-token rollout: primeniti pregledani compat expand,
      prebaciti nove upise sa dual-write na hash-only, sačekati najduži TTL +
      grace, dokazati nula legacy čitanja i tek contract migracijom ukloniti
      plaintext kolone/indekse
- [ ] Pre primene auth-token expand migracije uraditi read-only audit i backup;
      svaki duplicate `PasswordReset.userId` eksplicitno razrešiti jer migracija
      namerno radi fail-closed bez automatskog DML-a
- [ ] Pokrenuti i pregledati aggregate-only legacy audit pre auth expand-a i
      current audit posle sva tri auth expand-a nad restore klonom/produkcijskim
      read-only prozorom; skripte postoje, ali produkcijski audit nije izvršen
- [ ] Zasebno odobriti data remediation/backfill postojećeg `emailVerified` i
      tačnih legacy grace vrednosti; ne postoji automatski „svi su verified” put
- [ ] Kontrolisano primeniti auth-token, verification-cooldown i verified-login
      grace expand migracije uz backup/restore, lock plan i runtime dokaz;
      aktivni lanac ima sedam migracija, produkcija je i dalje na četiri
- [ ] DB-backed revalidacija/revokacija rolling JWT sesija posle policy/grace
      promene, reset/change lozinke i role promene; do tada politika ostaje audit
- [ ] Shared auth/reset/login limiter i eksplicitan trusted-proxy/client-IP
      ugovor, uključujući NextAuth credentials callback i bcrypt CPU zaštitu
- [ ] Reverse-proxy request body/rate/timeout limiti usklađeni su sa završenim
      application streaming limitima; aplikacionih 4096/1024 B nije zamena za
      upstream zaštitu konekcija i bandwidth-a
- [ ] Tek po zatvaranju svih prethodnih gate-ova kreirati/aktivirati workflow
      koji svaki push na presentation `main` objavljuje kao novu javnu verziju

## Bezbedno objavljivanje šeme

`scripts/deploy.sh` više nikada ne pada nazad na `prisma db push`. Automatske
migracije su podrazumevano isključene i zahtevaju
`APPLY_DATABASE_MIGRATIONS=true`. Za v2 prvo pratiti
`docs/V2-ROLL-OUT.md`; ne spajati/deployovati ovu granu na postojeću bazu pre
baseline probe i eksplicitne expand migracije. Auth-token compat migracija
posebno zahteva proveru duplikata `PasswordReset.userId`; njen exception je
operativna zaštita, ne dozvola da se problem zaobiđe ručnim brisanjem bez
audita i backup-a. Cooldown i grace expand takođe zahtevaju lock prozor i DB
smoke. Release tag, server, main-push workflow i live aktivacija ostaju
poslednji korak.
