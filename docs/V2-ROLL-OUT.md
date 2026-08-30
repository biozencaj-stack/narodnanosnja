# V2 rollout: bezbedan prelazak

Ova grana menja Prisma šemu i **ne sme** direktno na postojeću produkcionu
bazu. Kod je kompatibilno proširen, ali baza prvo mora dobiti nove
order/payment kolone, payment event dnevnik, expand-only kataloške tabele i tri
odvojeno pregledane auth expand promene. Činjenica da su prve četiri migracije
ranije primenjene ne znači da su kasnije auth migracije već na produkciji.
Aktivni lanac ima sedam migracija, ali produkciona evidencija ovog preseka i
dalje ima samo prve četiri; verified-login rad nije čitao, menjao ili migrirao
produkcijsku bazu.

## Šta šema dodaje

- `Order.checkoutIdempotencyKey`, `Order.currency`,
  `Order.inventoryAllocated` i `OrderItem.inventoryStockId` za replay-safe
  checkout, pouzdan payment/inventory tok i precizno vraćanje rezervisane
  zalihe;
- `PROCESSING`/`REVIEW` payment statuse i neizmenjivi `PaymentEvent` dnevnik;
- opcioni `Product.productTypeId`;
- modele generičkog kataloga navedene u `CATALOG-MIGRATION-PLAN.md`;
- nullable compat `tokenHash` kolone i unique reset-user ugovor iz
  `20260830000000_expand_hashed_auth_tokens`;
- nullable/no-default `verificationEmailNextAllowedAt`,
  `verificationEmailResendWindowStartedAt` i
  `verificationEmailResendCount` iz
  `20260830010000_expand_email_verification_cooldown`;
- nullable/no-default `User.emailVerificationLoginGraceUntil`, bez dedicated
  indeksa ili backfilla, iz
  `20260830020000_expand_verified_login_grace`.

Ništa postojeće se ne uklanja. `ProductSize` ostaje aktivni izvor zalihe dok
se generičke varijante ne popune i ne provere.

## Obavezan redosled

1. Napraviti proverljiv PostgreSQL backup i testirati restore.
2. Klonirati produkcionu bazu u izolovano staging okruženje.
3. Potvrditi da realna šema odgovara current-state baseline-u i, nad postojećom
   produkcionom bazom bez Prisma istorije, evidentirati baseline kao primenjen
   prema `docs/PRISMA-BASELINE.md`.
4. Potvrditi tačno produkcijsko migration stanje. Prve četiri migracije su
   istorijski završene; auth-token, cooldown i verified-login grace expand su
   kasniji koraci koji zahtevaju zaseban audit/backup/restore/lock dokaz. Ne
   generisati novi expand SQL i ne koristiti `prisma db push`.
5. Primeniti migraciju na klonu i pokrenuti Prisma validate/generate,
   TypeScript i produkcijski build.
6. Smoke testirati: anonimnu i prijavljenu porudžbinu, izgubljen/replayed
   create-order odgovor, kupon, nedovoljnu zalihu, istovremene porudžbine
   poslednjeg komada, otkazivanje, decline/release kupona i ponovljen ili
   kontradiktoran payment callback.
7. Seedovati tipove/atribute i pokrenuti idempotentni backfill iz zasebnog
   budućeg PR-a. Uporediti legacy i novi model pre uključivanja dual-read-a.
8. Tek tada zakazati produkcijski prozor, ponoviti backup, primeniti pregledanu
   migraciju i objaviti kod.

## Auth/verified-login gate pre javnog V2 rada

Atomska registracija, verification resend/confirm, password reset/change i
audit-mode credentials login postoje u kodu, ali se ne smatraju produkcijski
spremnim samo zato što unit testovi ili migracija nad praznom CI bazom prolaze.
Pre bilo kakvog live-a obavezno je sledeće.

Strogi end-to-end redosled za ovu auth etapu je:

1. pokrenuti legacy aggregate audit nad još neproširenom produkcionom šemom;
2. pokrenuti zaseban authoritative-session expand preflight nad legacy
   `Session` namespace-om;
3. poslovno pregledati agregate bez automatskog `emailVerified` backfill-a ili
   automatskog brisanja sesija;
4. napraviti/proveriti backup i restore klon, pa na klonu probati sva četiri
   auth expand koraka;
5. posle expand-a pokrenuti current aggregate audit;
6. eventualni grace DML pregledati kao zasebnu data promenu samo za odobrene
   legacy `CUSTOMER` redove, sa jednim deadline-om i rollback planom;
7. uvesti i dokazati JWT session revision/revalidation/revocation;
8. uvesti shared limiter i trusted-proxy/client-IP ugovor;
9. pokrenuti staged preflight, koji do završetka tačaka 7–8 mora ostati crven;
10. tek posebnim odobrenjem uključiti staged i pratiti recovery period;
11. posle isteka grace-a koristiti novi, zaseban strict gate;
12. main-push/live workflow napraviti ili aktivirati isključivo kao poslednji
    korak ukupnog plana.

### Šema i podaci

1. Read-only auditirati duple `PasswordReset.userId` redove pre auth-token
   expand-a; svaki nalaz rešiti eksplicitnom pregledanom data odlukom.
2. Na restore klonu primeniti
   `20260830000000_expand_hashed_auth_tokens`, proveriti migrate status, drift,
   sedam auth indeksa i hash/legacy invarijante.
3. Na istom klonu primeniti
   `20260830010000_expand_email_verification_cooldown`. Potvrditi tri
   nullable/no-default kolone, tačne tipove/precision i odsustvo dedicated
   indeksa.
4. Na istom klonu primeniti
   `20260830020000_expand_verified_login_grace`. Potvrditi jednu nullable
   `timestamp(3)` kolonu bez defaulta, backfill DML-a i dedicated indeksa.
5. Pre `20260830030000_expand_authoritative_sessions` pokrenuti
   `scripts/auth-session-expand-preflight.sql`, zatim na klonu primeniti
   migraciju i potvrditi User/Session/policy constraint-e, singleton i indeks.
6. Izmeriti lock trajanje. Cooldown, grace i session metadata ALTER-i ne rade
   backfill preko defaulta, ali ipak kratko uzimaju `ACCESS EXCLUSIVE`; sva
   četiri auth SQL fajla imaju 10s lock i 2min statement timeout koji nisu
   zamena za maintenance plan.
7. Pokrenuti kompletan `scripts/db-invariant-smoke.sql` u rollback režimu.
8. Evidentirati tačan recovery postupak. Failed migracija se ne ponavlja
   naslepo; `migrate resolve --rolled-back` je dozvoljen tek posle potvrđenog
   rollback-a i otklanjanja uzroka.

### Legacy/current audit i verified-login preflight

Verified-login paket je trenutno **audit-only**. Produkcija mora imati
eksplicitno `AUTH_VERIFIED_LOGIN_POLICY=audit`: password-valid neverifikovan
nalog ostaje kompatibilno prijavljiv, dobija `requiresEmailVerification`, a
sistem beleži samo coarse `AUDIT_WOULD_DENY` događaj bez emaila, user ID-a,
hasha ili exceptiona. `staged` i `strict` postoje u kodu da bi politika bila
testabilna, ali nisu odobreni deployment izbori.

Pre bilo koje auth expand migracije pokrenuti baseline-safe, aggregate-only
audit:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-legacy.sql
```

`-X` isključuje lokalni `psqlrc`. `$DATABASE_URL` u ovom runbook-u mora biti
libpq/psql-kompatibilan, odobren read-only connection URI; ne ispisivati ga u
log, shell trace ili CI artefakt. Prisma-only URL opcije se ne prosleđuju psql-u.

Ova skripta koristi samo baseline kolone i namerno odbija proširenu auth šemu.
Posle kontrolisane primene svih triju auth expand migracija pokrenuti current
audit:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-current.sql
```

Obe skripte rade u `REPEATABLE READ READ ONLY` transakciji, uzimaju samo
`ACCESS SHARE` lockove, imaju `lock_timeout=5s` i `statement_timeout=60s`,
ispisuju isključivo `category|count` agregate bez PII/credential/timestamp
redova i završavaju sa `ROLLBACK`. Klasifikuju kanoničnost/duplikate emaila,
role i verified stanje, token/throttle/grace invarijante, podržani bcrypt cost
12, kao i aggregate aktivnosti neverifikovanih naloga (`Order`, `Address`,
`Wishlist`, `ProductReview`, aktivan `PasswordReset`, `CouponUsage`). `Session`
red je samo telemetrija: aplikacija koristi JWT i taj red nije dokaz da je
sesija revalidirana.

Tek posle posebno pregledane data odluke, bez automatskog
`emailVerified` backfilla, može se probati staged preflight. Tačna komanda je:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -v target_policy=staged \
  -v legacy_cutoff='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -v grace_deadline='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -f scripts/auth-email-verification-enforcement-preflight.sql
```

Obe vremenske vrednosti moraju biti kanonski UTC timestampovi sa tačno tri
decimale. `legacy_cutoff` ne sme biti u budućnosti; samo `createdAt < cutoff`
je legacy, pa jednakost pripada novim nalozima. `grace_deadline` mora biti
najmanje 7 i najviše 30 dana posle PostgreSQL vremena preflight-a. Svaki
non-`NULL` grace mora biti konačan i tačno jednak tom jednom deadline-u;
verifikovani i post-cutoff nalozi moraju imati `NULL`. Preflight prihvata samo
`target_policy=staged`; `strict` namerno zahteva poseban budući gate.

Ova revizija namerno uvek emituje
`preflight.jwt_session_revalidation.unavailable|1`, zato su
`preflight.ready|0`, izlazni status `3` i neuspešan gate očekivani čak i kada su
svi data nalazi nula. Ne uklanjati ili ručno zaobilaziti blocker. Rolling
NextAuth JWT se trenutno ponovo potpisuje bez svežeg DB policy/revocation
snapshot-a, pa promena politike, istek grace-a, promena lozinke ili role ne
opozivaju već izdate aktivne sesije. Pre staged/strict aktivacije moraju se
završiti DB-backed session revalidation/revocation i shared login/auth limiter
sa eksplicitnim trusted-proxy/client-IP ugovorom. Tek novi pregledani paket sme
izmeniti preflight i dodati zaseban strict gate.

Nezavisno od tog blokera smoke-testirati registration → inbox → explicit POST
verify, expired link → resend i SMTP failure → recovery tok nad staging
podacima. Audit/preflight nisu backfill, ne menjaju naloge i nisu dokaz da je
produkcija migrirana.

### Resend/throttle invarijante

- initial registracioni email je count `1`;
- cooldown je 60 sekundi;
- allowance je fiksni 24-časovni prozor sa najviše pet ukupnih verification
  emailova, uključujući initial;
- legacy throttle `NULL` stanje prvim resend-om počinje prozor sa count `1`;
- resend briše samo istekle tokene; svi ranije neistekli linkovi ostaju važeći;
- uspešan verify briše sve siblinge i čisti throttle;
- DB sat se čita tek posle User `FOR UPDATE` lock-a;
- verify i resend dele `User → EmailVerification` lock redosled;
- SMTP se poziva posle commita, a ambiguous failure ne briše credential ili
  vraća allowance.

### Login, verifikacija i password credential granice

Credentials login za svaki sintaksno validan kanonizovan email radi tačno
jedan bcrypt cost-12 compare; nepostojeći nalog koristi fiksni cost-12 dummy.
Tek posle uspešnog compare-a ponovo čita User policy snapshot, zaključava User
za stabilno čitanje i uzima PostgreSQL `clock_timestamp()::timestamptz(3)`
posle lock wait-a. Email, ID i password hash moraju i dalje odgovarati prvom
credential lookup-u. Ovo smanjuje enumeraciju i stale-credential trke, ali je
cost-12 rad CPU abuse površina i zato shared limiter ostaje live blocker.

Email verify, reset confirm i privilegovani account provisioning dele
User-first lock redosled. Verify zaključava `User`, zatim tačan
`EmailVerification` red, pa tek onda čita DB sat. Claim je vezan za tačan
email/passwordHash/role/ime snapshot iz kog je pripremljena 24h JWT sesija;
istek ili promena dok se čeka na lock daju read-only conflict/expired ishod bez
prepared cookie-ja. Uspešan commit troši tačan credential, postavlja
`emailVerified` DB vremenom, čisti grace/throttle i briše verification siblinge
u istoj transakciji.

Password reset request i confirm imaju zasebne trusted same-origin guardove,
prihvataju samo odsutan ili `identity` `Content-Encoding`, zahtevaju JSON media
type i sprovode deklarisani i stvarni streaming limit od najviše 1024 bajta.
Request prihvata samo plain JSON
objekat sa tačno jednim ključem `email`; confirm samo tačno dva ključa `token`
i `password`. Niz, `null`, class/prototype objekat, nedostajući ili dodatni
ključevi nisu dozvoljeni. Request prvo radi minimalni lookup, a u
write transakciji ponovo zaključava User, proverava email/role/PostgreSQL
`xmin` reviziju, tek potom čita DB sat i zamenjuje unique reset credential.
Promena između lookup-a i locka zato postaje private no-op/failure, ne stale
token za unapređen ili izmenjen nalog.

Reset confirm zaključava `User`, pa tačan `PasswordReset`, pa tek onda čita DB
sat i proverava expiry. Promena password hasha, claim tačnog reset credentiala,
brisanje reset siblinga i brisanje svih starijih `EmailVerification` linkova su
jedna transakcija; rollback vraća i hash i credential. Uspešan reset time
opoziva verification linkove zato što bi oni inače mogli izdati passwordless
sesiju. Autentifikovana promena lozinke analogno radi bcrypt izvan transakcije,
zatim User lock + exact-hash CAS i atomski briše reset/verification tokove.
Ni jedan od ovih tokova još ne opoziva već izdate rolling JWT sesije; to ostaje
isti obavezni session-revalidation paket pre enforcementa/live-a.

### Privacy, abuse i delivery

Registration created/existing odgovori moraju ostati byte-identical private
202. Njihov account-dependent put koristi 900 ms floor plus 0–200 ms
kriptografski jitter samo kao timing defense-in-depth. To nije dozvola da se
zadrži procesni limiter u produkciji.

Application body zaštita je završena: registration zahteva JSON media type,
prihvata samo odsutan ili `identity` `Content-Encoding` i sprovodi fail-closed
declared/streaming limit 4096
bajta; resend, reset request i reset confirm primenjuju isti ugovor sa 1024
bajta, uz gore navedene exact JSON shape-ove. Chunked ili nedostajući
`Content-Length` ne zaobilazi stvarni reader cap. Pre live-a reverse proxy ipak
mora dobiti usklađene body-size, request-rate, header/read timeout i connection
limite, jer route guard ne sprečava da promet prvo stigne do Node procesa.

Pre live-a su obavezni shared Redis/DB limiter i eksplicitan trusted-proxy/
client-IP ugovor. Trenutno poverenje u sirovi `x-forwarded-for` i procesni LRU
ne štite više instanci i mogu biti spoofovani ako proxy granica nije precizno
definisana.

Next.js `after()` nije durable queue. HTTP 202 može biti vraćen, a proces pasti
pre slanja ili recovery-ja. Potrebni su transactional auth-email outbox,
durable worker, retry/dedup, bounce/delivery monitoring, alert i dokaz ponašanja
preko shutdown/redeploy granice. Bez toga se kodni resend ne opisuje kao
garantovana isporuka.

Atomska registracija/resend imaju exact-head run `33317607438` na feature
`964831f490b54a3f5b11ec0cecce8b562551d4d8` i post-merge run `33317787952`
na V2 merge-u `15c18cf1de19ceee4de4a06eff28bf7114d3fc19`, oba attempt 1
SUCCESS. Oba su prošla migration deploy, drift, DB smoke, lint, typecheck,
237/237 testova sa svih 8 PostgreSQL scenarija, mobile Chromium E2E i build.
Post-merge release/deploy poslovi su SKIPPED; ovo nije live rollout.

## GitHub release gate — live je poslednji korak

Pull request i push na `verzija/v2.0-univerzalna-platforma` pokreću kompletan
CI, ali nikada deploy. Ručni `workflow_dispatch` takođe služi samo za proveru.
Produkcijski job može da se razmatra tek kada je sav prethodni rad završen i
kada se pushuje namenski tag oblika `prodavnica-v2-YYYYMMDD-N`.

Pre pravljenja taga obavezno:

1. izabrati pregledani SHA koji je već deo remote kanonske V2 grane;
2. potvrditi kompletan zeleni CI za isti sadržaj;
3. ponoviti production backup/restore, migration, capability i rollback gate;
4. potvrditi da `production` Environment dopušta samo `prodavnica-v2-*` tagove
   i zahteva reviewera;
5. tek tada napraviti i pushovati anotirani tag i ručno odobriti Environment.

Poseban workflow job proverava oblik taga, V2 projektno stablo i da je release
commit predak kanonske V2 grane pre otvaranja `production` Environment gate-a.
Produkcijski job iste uslove ponavlja pre bilo kakvog SSH koraka. Samo
postojanje taga ne zaobilazi Environment zaštitu. Tokom razvoja i svih ranijih
faza tag se ne pravi, server se ne menja i live verzija ostaje netaknuta.

Poseban workflow koji će na svaki push presentation `main` grane podići novu
javnu verziju sajta ne aktivira se u ovoj auth/DB fazi. Po eksplicitnom
redosledu on ostaje poslednji korak, posle security, legacy-email, migration,
outbox, proxy/limiter i operativnih gate-ova. V2 se i dalje nikada ne spaja u
presentation `main`.

## Environment pre puštanja

- postaviti jak, zaseban `ORDER_ACCESS_SECRET`;
- postaviti zaseban `ORDER_RESERVATION_CLEANUP_SECRET` od najmanje 32 znaka
  (`openssl rand -hex 32` daje odgovarajuću vrednost); prazan, slab ili
  neispravan secret namerno onemogućava cleanup endpoint;
- opciono postaviti `ORDER_PROCESSING_REVIEW_MINUTES` na ceo broj od 120 do
  10080 minuta; kada nije postavljen koristi se konzervativnih 1440 minuta;
- postaviti i proveriti oba reCAPTCHA v3 ključa; production checkout je
  namerno fail-closed bez njih;
- ostaviti `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED=false` do sertifikacije banke;
- za NestPay podesiti oba HPP URL-a i tačne `NESTPAY_OK_URL` /
  `NESTPAY_FAIL_URL` HTTPS callback putanje na istom origin-u kao
  `NEXT_PUBLIC_SITE_URL`; ovaj tok prihvata isključivo RSD (`941`) i `Auth`;
- proveriti javni site URL, dostavu i capability flagove iz `.env.example`;
- u produkciji eksplicitno postaviti `AUTH_VERIFIED_LOGIN_POLICY=audit` i ne
  postavljati staged grace kao aktivacioni signal. `staged`/`strict` ostaju
  blokirani session-revalidation i shared-limiter gate-ovima opisanim iznad;
- za SMTP potvrditi host, credential-e, sender i port kontrolisanim testom:
  465 koristi implicitni TLS, ostali portovi zahtevaju STARTTLS, a
  `SMTP_TLS_REJECT_UNAUTHORIZED` mora ostati `true` u produkciji;
- `APPLY_DATABASE_MIGRATIONS=true` koristiti samo u kontrolisanom izdanju sa
  kompletnim migration chain-om. U redovnom deployu ostaje isključeno.
- auth email primalac mora biti tačno jedan normalizovan mailbox; staging smoke
  mora proveriti escaped HTML, verification/reset URL i odbijanje display-name/
  group/list inputa;
- verified-login data remediation se ne radi dok legacy/current aggregate audit
  nije pregledan i odobren; audit nikada nije automatski backfill;
- shared limiter/trusted proxy i auth outbox moraju biti aktivni pre javnog
  registration/resend/reset/login saobraćaja.

## Demo seed je isključivo opt-in nad bezbednom bazom

`npm run db:seed-demo` sadrži javne, zajedničke demo credentiale i nikada se ne
pokreće nad produkcijom. Potrebna su oba nezavisna uslova:

```bash
DEMO_DATABASE_SEED=true npm run db:seed-demo
```

- `DATABASE_URL` mora biti validan PostgreSQL URL čiji naziv baze jasno sadrži
  odvojen marker `demo`, `e2e`, `test` ili `provera`;
- naziv ne sme sadržati odvojen marker `prod`, `production` ili `live`;
- skripta posle konekcije proverava `SELECT current_database()` i zahteva da se
  stvarni naziv tačno poklapa sa URL ciljem pre prvog seed upisa.

Demo korisnici se upisuju sa centralnim cost-12 hashom, `emailVerified` seed
vremenom, `emailVerificationLoginGraceUntil=NULL` i očišćenim reset/
verification credentialima u istoj transakciji. Ove zaštite ne pretvaraju demo
seed u produkcijsku operaciju; opt-in i DB guard se ne smeju zaobići u workflow-u
ili runbook-u.

## Legacy preflight i maintenance prozor

Za svaku buduću postojeću bazu, pre backup-a i bilo kakve migracije pokrenuti
read-only proveru:

```bash
psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db-legacy-preflight.sql
```

Skripta radi u `READ ONLY` transakciji, postavlja `lock_timeout=5s` i
`statement_timeout=60s`, ne menja podatke i završava sa `ROLLBACK`. Ona prekida
izvršavanje jasnom porukom ako pronađe exact ili `lower(trim(...))` duplikate
veličina, nevalidne nazive veličina, negativne cene/zalihe/mere/order iznose,
nevalidnu količinu ili aktivan legacy proizvod bez ijednog stock reda. Svaki
nalaz mora biti očišćen kontrolisanom, posebno pregledanom data migracijom, a
preflight potom ponovljen do uspeha.

Neposredno pre authoritative-session expand migracije pokrenuti i namenski
Session namespace gate (on ne zamenjuje opšti legacy preflight):

```bash
psql -X "$PSQL_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-session-expand-preflight.sql
```

Gate potvrđuje baseline `Session.sessionToken` ugovor i broji sve legacy
tokene oblika `v1:<64 lowercase hex>`, uključujući istekle. Ispisuje samo
`preflight.session.legacy_reserved_v1_token|count`; nenulti nalaz završava
statusom `3`, bez tokena, ID-a ili PII. Takve sesije se opozivaju/rotiraju samo
kroz posebno pregledanu operativnu odluku, nikada automatskim DML-om iz
preflighta. Posle remedijacije obavezno ponoviti isti gate do nule.

Produkcijski postupak za migraciju postojeće baze je:

1. uvežbati migraciju i izmeriti trajanje na svežem restore klonu;
2. napraviti i verifikovati neposredni backup;
3. uključiti maintenance/read-only režim i zaustaviti aplikacione upise;
4. pregledati aktivne transakcije i blokirajuće lockove; sesije se ne prekidaju
   bez eksplicitnog operativnog odobrenja;
5. pokrenuti samo pregledani migration chain sa ograničenim čekanjem na lock,
   na primer `PGOPTIONS='-c lock_timeout=5s -c statement_timeout=15min' npx
   prisma migrate deploy`; statement timeout se prilagođava rezultatu probe na
   restore klonu, ne nagađa se tokom produkcionog prozora;
6. proveriti `prisma migrate status`, drift, invalidne constraints/indekse,
   ključne countove i `scripts/db-invariant-smoke.sql`, pa tek onda vratiti
   aplikacione upise.

`ALTER TABLE`, unique constraint i standardno kreiranje indeksa mogu čekati
lock ili blokirati upise, zato se ovaj expand ne pušta pod redovnim saobraćajem.
Ako lock ili statement timeout prekine migraciju, ne ponavljati je naslepo:
zaustaviti rollout, pregledati `_prisma_migrations` i PostgreSQL stanje i
napraviti eksplicitan recovery/resolve plan. Četiri već primenjena
`migration.sql` fajla su nepromenljiva produkcijska istorija, a sva četiri kasnija
auth SQL fajla takođe se ne prepravljaju radi lakšeg rollout-a. Svaka buduća
promena ide u novu migraciju, nikada izmenom postojećeg sadržaja ili checksum-a.

## Cleanup rezervacija i VPS scheduler

Cleanup je namerno uži od opšteg „otkaži sve staro“ pravila:

- automatski otkazuje i vraća zalihu/kupon samo kada je stara porudžbina
  `CARD`, order status je `PENDING`, payment status je `PENDING`,
  `inventoryAllocated=true` i ne postoji ni `Transaction` ni `PaymentEvent`;
- stara porudžbina sa bilo kakvom payment aktivnošću i svaki stari
  `PROCESSING` prelaze u `REVIEW`, bez vraćanja zalihe ili kupona;
- `CASH` porudžbine se nikada ne menjaju ovim cleanup-om;
- svaka kandidatska porudžbina se ponovo proverava u sopstvenoj Serializable
  transakciji, pa concurrent payment start/callback ili greška na jednom redu
  ne smeju izazvati dvostruki povrat niti prekinuti obradu ostalih redova.

Endpoint je isključivo `POST /api/cron/order-reservations`, nema admin-session
fallback i zahteva tačno `Authorization: Bearer <secret>` zaglavlje. Secret
mora imati najmanje 32 znaka. Endpoint podrazumevano radi dry-run; operativni
pozivi ipak treba eksplicitno da šalju `{"apply":false}` ili
`{"apply":true}`. Unsafe API zaštita ostaje fail-closed, pa serverski poziv
mora poslati `Origin` jednak kanonskom `NEXT_PUBLIC_SITE_URL`. Ne dodavati cron
izuzetak u `proxy.ts`. Ako makar jedan kandidat ostane `failed`, endpoint vraća
HTTP 500 i `success:false` sa agregatima, tako da `curl --fail-with-body` i
systemd oneshot prijave operativni kvar.

Pre prvog poziva učitati postojeći server-side `.env` bez `set -x`. Sledeća
shell funkcija prosleđuje Bearer zaglavlje curl-u kroz standardni ulaz, pa
secret ne završava u argumentima procesa ili shell istoriji:

```bash
set -a
. /var/www/narodnanosnja/.env
set +a

run_reservation_cleanup() {
  cleanup_apply="${1:-false}"
  case "$cleanup_apply" in
    false|true) ;;
    *) echo "apply mora biti false ili true" >&2; return 2 ;;
  esac

  if [ "${#ORDER_RESERVATION_CLEANUP_SECRET}" -lt 32 ]; then
    echo "ORDER_RESERVATION_CLEANUP_SECRET nije podešen" >&2
    return 2
  fi

  cleanup_origin="${NEXT_PUBLIC_SITE_URL%/}"
  printf 'header = "Authorization: Bearer %s"\n' \
    "$ORDER_RESERVATION_CLEANUP_SECRET" |
    /usr/bin/curl --config - \
      --fail-with-body --silent --show-error \
      --proto '=https' --tlsv1.2 \
      --connect-timeout 10 --max-time 120 \
      --request POST \
      --header "Origin: ${cleanup_origin}" \
      --header "Content-Type: application/json" \
      --data "{\"apply\":${cleanup_apply}}" \
      "${cleanup_origin}/api/cron/order-reservations"
}
```

Redosled prvog operativnog puštanja je:

1. ostaviti `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED=false` i deployovati endpoint;
2. postaviti secret/prozor u server-side `.env` i restartovati aplikaciju;
3. pokrenuti `run_reservation_cleanup false` i pregledati samo agregatne
   brojače; odgovor ne sme sadržati order ID-eve, PII ili payment payload;
4. tek posle očekivanog dry-run rezultata pokrenuti
   `run_reservation_cleanup true`;
5. ponoviti dry-run, proveriti logove i ručno obraditi svaki `REVIEW` nalaz;
6. tek tada, uz posebno serversko odobrenje, instalirati i uključiti timer.

Za VPS je dovoljan root-owned wrapper
`/usr/local/sbin/narodnanosnja-order-reservations` koji koristi gornji poziv,
bez argumenta podrazumeva dry-run, a samo za tačan argument `true` šalje apply.
Primer oneshot jedinice (stvarni ograničeni deploy korisnik menja
`<DEPLOY_USER>`):

```ini
# /etc/systemd/system/narodnanosnja-order-reservations.service
[Unit]
Description=Narodna nosnja - cleanup karticnih rezervacija
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=<DEPLOY_USER>
EnvironmentFile=/var/www/narodnanosnja/.env
ExecStart=/usr/local/sbin/narodnanosnja-order-reservations true
TimeoutStartSec=150
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
```

```ini
# /etc/systemd/system/narodnanosnja-order-reservations.timer
[Unit]
Description=Narodna nosnja - periodican cleanup karticnih rezervacija

[Timer]
OnCalendar=*-*-* *:00/15:00
RandomizedDelaySec=60
Persistent=true
Unit=narodnanosnja-order-reservations.service

[Install]
WantedBy=timers.target
```

Pre uključivanja operator treba da pokrene `systemd-analyze verify`, a zatim
posle eksplicitnog odobrenja `daemon-reload` i `enable --now` nad timerom.
Proveriti `systemctl list-timers` i journal oneshot jedinice. HTTP `401`
označava pogrešan Bearer, `403` nedostajući/neusklađen Origin, a `503`
nedostajući ili slab server secret; svaki takav rezultat mora oboriti oneshot
i aktivirati operativni alarm. GitHub workflow ne instalira ovaj wrapper,
service ili timer. Ovaj dokument opisuje postupak; VPS ovom izmenom nije
menjan.

## Dodatni uslovi pre uključivanja kartica

- banka mora potvrditi stvarna imena/pokrivenost potpisanih callback polja;
- admin mora dobiti operativni inbox za `REVIEW` i reconciliation sa bankom;
- cleanup endpoint mora biti deployovan, a Bearer/Origin zaštita, dry-run,
  prvi apply smoke i periodični VPS timer dokazano operativni; auto-release
  ostaje ograničen na stari `CARD + PENDING/PENDING` bez payment traga, dok
  `PROCESSING`/payment aktivnost idu u `REVIEW` sa zadržanom rezervacijom;
- REVIEW reconciliation, refund i bankarski staging tokovi moraju biti
  završeni i uvežbani;
- email potvrde i ostali sporedni efekti treba da pređu na idempotentni outbox;
- staging mora dokazati preflight → kratkotrajni handoff → provider → callback
  tok, uključujući više tabova, refresh, 429/5xx i izgubljen odgovor.

Dok ove stavke nisu završene, capability ostaje isključen i javne stranice ne
obećavaju kartično plaćanje.

## Rollback

Expand migracija ne briše legacy podatke. Ako aplikacioni smoke test ne prođe,
vratiti prethodni build i ostaviti nove, neiskorišćene tabele/kolone na mestu;
njihovo hitno brisanje nije potrebno. Ako sama migracija ne prođe, ne podizati
novi build i vratiti staging/produkciju iz proverenog backupa prema unapred
uvežbanoj restore proceduri. Pre vraćanja na release koji nema kompatibilan
`POST /api/cron/order-reservations` zaustaviti i onemogućiti odgovarajući timer;
ne ostavljati periodičan poziv ka nepostojećem ili semantički drugačijem
endpointu.
