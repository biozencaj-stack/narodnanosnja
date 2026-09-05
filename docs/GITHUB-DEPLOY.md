# GitHub Actions objavljivanje

Workflow `.github/workflows/objavi.yml` je odvojen od presentation `main` grane.
CI radi nad kanonskom granom prodavnice, dok produkcijski job može da se pokrene
isključivo namenskim V2 release tagom.

**Trenutno ništa iz verified-login paketa nije pušteno live.** Nije napravljen
nov V2 release tag, nije odobren production Environment, server i produkcijska
baza nisu menjani, a poseban workflow koji bi na svaki push presentation
`main` grane objavio novu javnu verziju nije aktiviran. Po odobrenom redosledu
main-push objavljivanje ostaje poslednja sekcija rada, posle svih DB, session,
limiter, outbox i operativnih gate-ova.

| Događaj | CI provera | Produkcijski deploy |
| --- | --- | --- |
| Pull request ka `verzija/v2.0-univerzalna-platforma` | da | ne |
| Push na `verzija/v2.0-univerzalna-platforma` | da | ne |
| Ručni `workflow_dispatch` nad V2 ref-om | da | ne |
| Push taga `prodavnica-v2-YYYYMMDD-N` | da | da, tek posle svih zaštita |
| Push na presentation `main` | V2 workflow se ne pokreće | ne |

Tag deploy dodatno odbija tag koji nema strogi `prodavnica-v2-YYYYMMDD-N`
oblik, pogrešno projektno stablo ili commit koji nije već deo remote
`verzija/v2.0-univerzalna-platforma` grane. Ručni dispatch namerno nikada nije
release mehanizam. Poseban `Potvrdi V2 release` job proverava tag, stablo i
Git ancestry pre nego što se uopšte otvori `production` Environment gate;
produkcijski job iste uslove ponavlja pre SSH pripreme.

Verified-login etapa ne menja ovu matricu. Njene izmene workflow-a samo
proširuju izolovane audit fixture-e, DB invariant smoke i opt-in PostgreSQL
testove. Poseban main-push workflow koji će objaviti novu javnu verziju
presentation sajta ostaje poslednji korisnički korak; ne aktivira se tokom
auth/DB rada i nikada nije razlog da se V2 spoji u `main`.

## GitHub podešavanja

U `Settings → Environments` najpre kreirati environment `production`. U
njegovom odeljku `Deployment branches and tags` izabrati custom policy,
ukloniti ranije `main` pravilo i dozvoliti samo tag obrazac
`prodavnica-v2-*`. Dodati required reviewer i, kada GitHub plan/politika to
podržava, sprečiti da pokretač sam odobri sopstveni deploy. Preporučuje se i
ruleset koji ograničava kreiranje, izmenu i brisanje `prodavnica-v2-*` tagova.

Ova Environment/ruleset promena je namerno operativni poslednji korak. Dok
policy i secrets nisu spremni, tag deploy treba da ostane blokiran. Produkcijske
vrednosti čuvati u tom environmentu, ne u širem repository scope-u.

U environment `production` dodati secrets:

- `SSH_PRIVATE_KEY` — zaseban privatni deploy ključ bez passphrase-a;
- `SSH_KNOWN_HOSTS` — unapred verifikovan known-hosts red za produkcioni server;
- `SERVER_HOST` — hostname ili IP servera;
- `SERVER_USER` — ograničeni deploy korisnik koji poseduje deploy direktorijum
  i svoj PM2 proces.

U isti environment dodati variables:

- `PRODUCTION_URL` — konačna puna HTTPS adresa sajta, bez HTTP ili `www`
  preusmerenja;
- `SERVER_PORT` — opciono, podrazumevano `22`;
- `DEPLOY_PATH` — opciono, podrazumevano `/var/www/narodnanosnja`;
- `APP_PORT` — opciono, interni port aplikacije, podrazumevano `3007`;
- `SMOKE_PORT` — opciono, privremeni lokalni port za proveru novog release-a,
  podrazumevano `39007` i mora biti različit od `APP_PORT`;
- `APP_NAME` — opciono, PM2 ime procesa, podrazumevano `narodnanosnja`.

`PRODUCTION_URL` mora već pokazivati na ovaj produkcijski server, a
`/api/health` mora biti dostupan bez autentifikacije, preusmerenja ili CDN
keširanja. Javni health check potvrđuje tačan commit SHA i u suprotnom vraća
prethodni release.

`SSH_KNOWN_HOSTS` se ne generiše u workflow-u. Uzmite host ključ sa pouzdanog
računara, uporedite fingerprint sa serverom i tek onda ceo izlaz sačuvajte kao
secret. Za nestandardni SSH port red mora sadržati `[host]:port` oblik.

Required reviewer je obavezan deo release gate-a. Uspešan CI nije dozvola da
se aplikacija sama pusti: reviewer proverava tačan tag/SHA, capability zastavice,
backup/migracije, kartice i operativni prozor pre odobravanja Environment-a.

## Zahtevi na serveru

- Linux sa Node.js 22, npm, PM2, rsync, curl i `flock`; alati moraju biti
  dostupni deploy korisniku i u neinteraktivnoj SSH sesiji;
- postojeći `$DEPLOY_PATH/.env` sa produkcionim tajnama;
- za reservation cleanup: zaseban `ORDER_RESERVATION_CLEANUP_SECRET` od
  najmanje 32 znaka i opciono ograničeni
  `ORDER_PROCESSING_REVIEW_MINUTES` (120–10080, podrazumevano 1440);
- deploy korisnik ima write pristup `$DEPLOY_PATH` i upravlja PM2 procesom čije
  ime određuje `APP_NAME`;
- PostgreSQL je dostupan i njegova šema je već usklađena sa Prisma šemom.

Za ovaj auth release „usklađena šema” znači da su sve četiri kasnije auth
expand migracije kontrolisano primenjene posle read-only audita, backup/restore
i restore-clone probe: compat token hash, tri verification throttle kolone,
nullable/no-default `User.emailVerificationLoginGraceUntil` i authoritative
session kolone uz `AuthPolicyState`. Ranije četiri produkcione migracije nisu
dovoljne za aktuelni kod. Aktivni Git lanac ima osam migracija, dok produkcijska
evidencija ovog preseka i dalje ima četiri;
workflow namerno neće popravljati taj nedostatak preko SSH-a.

Reverse proxy mora prosleđivati zahteve na `APP_PORT`, a `SMOKE_PORT` mora biti
slobodan na lokalnom interfejsu servera. Ako se promene `APP_NAME`, `APP_PORT`
ili `DEPLOY_PATH`, PM2, reverse proxy i dozvole moraju biti usklađeni sa istim
vrednostima.

Workflow namerno ne primenjuje migracije. Ako Prisma otkrije razliku između
baze i koda, deploy staje pre aktivacije. Migracija se prvo pregleda i primenjuje
po proceduri iz `V2-ROLL-OUT.md`, pa se workflow ponovo pokrene.

Kartično plaćanje ostaje isključeno u produkcionom `.env` dok nisu završeni svi
uslovi iz rollout dokumenta, uključujući instaliran timer, uspešan cleanup
dry-run/apply smoke, `REVIEW` inbox i reconciliation/refund/bankarski staging.

## Verified-login audit je operativni gate, ne deploy korak

Workflow nikada ne pokreće audit nad produkcionom bazom i nikada ne radi
backfill. Operator pre auth expand-a ručno, u odobrenom read-only prozoru,
pokreće tačno baseline-safe skriptu:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-legacy.sql
```

Posle kontrolisane primene sve tri auth expand migracije koristi se current
skripta:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-current.sql
```

Legacy skripta namerno odbija expanded auth šemu, a current zahteva sve
expanded kolone. Obe vraćaju isključivo `category|count` agregate i završavaju
sa `ROLLBACK`; rezultat se čuva kao ograničeni operativni artefakt, bez
prepisivanja PII u GitHub log ili komentar PR-a.

Čak i posle pregledane remediation odluke staged preflight trenutno ostaje
negativan. Tačan poziv je:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -v target_policy=staged \
  -v legacy_cutoff='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -v grace_deadline='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -f scripts/auth-email-verification-enforcement-preflight.sql
```

Preflight prima samo `staged`, zahteva kanonski UTC millisecond cutoff i jedan
kanonski grace deadline 7–30 dana posle DB vremena. Svaki non-`NULL` grace mora
biti tačno jednak tom deadline-u. `strict` je namerno odbijen. Ova revizija
uvek ispisuje `preflight.jwt_session_revalidation.unavailable|1`, zatim
`preflight.ready|0` i završava statusom `3`. Zato GitHub Environment reviewer
ne sme odobriti staged/strict release niti tretirati druge nulte countove kao
ready dok zaseban session-revalidation paket ne promeni i kod i preflight gate.

Produkcijski `.env` u međuvremenu mora eksplicitno sadržati
`AUTH_VERIFIED_LOGIN_POLICY=audit`. `AUTH_VERIFIED_LOGIN_GRACE_DEADLINE` nije
dozvola za staged aktivaciju; tek pregledani budući rollout koristi potpuno
isti timestamp u runtime-u, bazi i preflight-u.

## VPS scheduler nije deo deploy workflow-a

Workflow objavljuje aplikacioni release, ali namerno ne kreira, ne menja i ne
uključuje systemd jedinice. `POST /api/cron/order-reservations` podrazumevano
radi dry-run i prihvata isključivo zaseban Bearer secret od najmanje 32 znaka;
nema admin-session fallback. VPS poziv mora poslati i `Origin` jednak
kanonskom `NEXT_PUBLIC_SITE_URL`, jer cleanup ruta ostaje iza iste fail-closed
same-origin zaštite kao ostale unsafe API rute.

Timer se postavlja ručno, uz posebno serversko odobrenje, tek po redosledu iz
`V2-ROLL-OUT.md`: eksplicitni `{"apply":false}` preko secret-safe curl poziva,
pregled agregata, kontrolisani `{"apply":true}` smoke i tek zatim periodični
oneshot. Preporučeni interval je 15 minuta. Oneshot mora završiti neuspehom za
HTTP `401`, `403`, `503` ili bilo koji drugi ne-2xx odgovor i mora biti povezan
sa operativnim nadzorom. Ruta zato i za parcijalni batch rezultat sa
`failed > 0` vraća HTTP 500 umesto lažnog uspeha.

Cleanup nikada automatski ne menja `CASH`. Zalihu i kupon oslobađa samo za
stari `CARD` sa order `PENDING`, payment `PENDING`,
`inventoryAllocated=true` i bez `Transaction`/`PaymentEvent`. Stara payment
aktivnost ili `PROCESSING` prelaze u `REVIEW` uz zadržanu rezervaciju do ručnog
reconciliation-a. Ovom dokumentacionom izmenom VPS nije menjan i timer nije
instaliran.

## Kako deploy radi

1. GitHub runner podiže praznu PostgreSQL 16 bazu, instalira zaključane
   zavisnosti, primenjuje celu Prisma migration istoriju i proverava da između
   baze i aktuelne Prisma šeme nema drifta. Zatim kroz `psql` pokreće rollback-only
   DB invariant smoke (uključujući očekivana odbijanja nevalidnih redova),
   proverava TypeScript, izvršava sigurnosne testove i pravi probni production
   build.

   Auth presek u ovom koraku postavlja
   `RUN_REGISTRATION_DB_TESTS=true`,
   `RUN_EMAIL_VERIFICATION_RESEND_DB_TESTS=true`,
   `RUN_AUTH_VERIFICATION_DB_TESTS=true`,
   `RUN_PASSWORD_RESET_CONFIRM_DB_TESTS=true` i
   `RUN_VERIFIED_LOGIN_DB_TESTS=true`. Time CI proverava atomsku
   User+credential registraciju, resend race/allowance, User-first verify i
   reset lock redosled, DB sat posle lock wait-a, stale snapshot/xmin granice,
   password reset/change rollback, credentials policy snapshot i konkurentno
   privilegovano provisionovanje. DB smoke dodatno proverava compat token,
   throttle i novu nullable/no-default grace kolonu bez dedicated indeksa.

   Pre lint/typecheck/test koraka `scripts/test-auth-email-verification-audits.ts`
   pravi zasebne fixture baze i proverava tačne izlaze legacy audita, current
   audita i fail-closed staged preflight-a. Preflight mora i na čistom fixture-u
   ostati blokiran sa
   `preflight.jwt_session_revalidation.unavailable|1`; CI ne sme taj status
   pretvoriti u lažni ready signal.

   Exact-head run `33317607438` na
   `964831f490b54a3f5b11ec0cecce8b562551d4d8` i post-merge run
   `33317787952` na `15c18cf1de19ceee4de4a06eff28bf7114d3fc19` ostaju istorijski
   dokaz prethodnog registration/resend preseka. Oni nisu dokaz novog
   verified-login/reset/grace paketa. Završni SHA/run ID za ovaj paket sme se
   upisati tek posle stvarno završenog exact-head i post-merge CI-ja; ovaj
   dokument ih ne izmišlja unapred.
2. Poseban, neprodukcijski release-gate job proverava strogi naziv taga, V2
   projektno stablo i da je označeni commit deo kanonske V2 istorije. Tek njegov
   uspeh dozvoljava otvaranje zaštićenog `production` Environment-a.
3. Produkcijski job ponavlja iste provere pre učitavanja SSH pristupa, pa se kod
   šalje u novu `$DEPLOY_PATH/releases/<commit>-<attempt>` fasciklu.
4. Produkcijski `.env` i `public/uploads` ostaju shared podaci i povezuju se
   simboličkim linkovima; korisničke slike se nikada ne brišu rsync-om.
5. Novi release se gradi i pokreće na privremenom lokalnom portu.
6. Tek posle uspešnog `/api/health` odgovora `current` link se atomski prebacuje
   i PM2 pokreće novu verziju.
7. Ako lokalna ili javna provera padne, skript automatski vraća prethodni
   release. Čuva se poslednjih pet release-a.

Deploy i cleanup starih release direktorijuma koriste isti server-side
`flock`, pa ni prekinuta SSH sesija ne može napraviti trku u kojoj se upravo
aktivirani release obriše. To nije reservation-cleanup scheduler, koji je
zasebna oneshot jedinica opisana iznad.

Javni health endpoint vraća `deployment` SHA, pa workflow proverava da server
zaista servira commit koji je upravo poslat, a ne samo neku prethodnu zdravu
verziju.

## Kontrolisani release tag — tek na kraju

Običan razvoj se završava PR-om ka kanonskoj V2 grani i zelenim CI-jem. To ne
objavljuje aplikaciju. Tek kada su svi rollout gate-ovi zatvoreni:

1. potvrditi da je izabrani SHA već na
   `origin/verzija/v2.0-univerzalna-platforma`;
2. potvrditi zeleni kompletan CI baš za taj sadržaj;
3. proveriti backup/migracije, production Environment, secrets/variables,
   domen/HTTPS, kartične capability zastavice i rollback prozor;
4. napraviti anotirani tag oblika `prodavnica-v2-YYYYMMDD-N` nad tačnim SHA-om;
5. pregledati tag još jednom, pa pushovati samo taj tag;
6. required reviewer odobrava `production` Environment tek posle pregleda;
7. pratiti release health i po potrebi aktivirati dokumentovani rollback.

Primer komandi je samo runbook; ne izvršavati ga tokom običnog razvoja:

```bash
git fetch origin verzija/v2.0-univerzalna-platforma
git switch --detach <PREGLEDANI_V2_SHA>
git tag -a prodavnica-v2-YYYYMMDD-N -m "V2 produkcijski release"
git push origin prodavnica-v2-YYYYMMDD-N
```

Sam workflow ne kreira GitHub Environment, ruleset, secrets, server niti tag.
`workflow_dispatch` može ponoviti proveru, ali nikada deploy.

Pre required-reviewer odobrenja auth deo dodatno mora imati:

- pregledan produkcioni legacy audit pre auth migracija, current audit posle
  sve tri auth expand migracije i posebno odobren data remediation/backfill;
  aggregate audit sam po sebi nikada ne menja `emailVerified` ili grace;
- produkcioni `AUTH_VERIFIED_LOGIN_POLICY=audit`. `staged` i `strict` su
  zabranjeni dok rolling JWT session revalidation/revocation nije uveden.
  Postojeći preflight to sprovodi stalnim blockerom
  `preflight.jwt_session_revalidation.unavailable|1` i zato trenutno nikad ne
  može vratiti ready;
- shared limiter i eksplicitan trusted-proxy/client-IP ugovor umesto procesnog
  LRU-a i sirovog `x-forwarded-for` identiteta, uključujući NextAuth credentials
  callback i cost-12 bcrypt CPU abuse granicu;
- reverse-proxy body-size, rate, timeout i connection limite usklađene sa
  završenim application cap-ovima: registration 4096 B; resend, reset request i
  reset confirm 1024 B. Reset request prihvata samo exact
  `{"email":"..."}`, a confirm samo exact
  `{"token":"...","password":"..."}` JSON shape; redosled ključeva nije
  bitan, ali dodatni ili nedostajući ključ jeste;
- transactional auth-email outbox/durable worker sa retry-em, monitoringom i
  shutdown/redeploy dokazom, jer Next.js `after()` može izgubiti posao posle
  već vraćenog HTTP 202;
- kontrolisanu primenu auth-token, cooldown, verified-login grace i
  authoritative-sessions expand migracija; aktivni lanac ima osam, produkcija i
  dalje samo četiri;
- potvrdu fixed 24h kvote od pet poruka uključujući initial, 60s cooldown-a i
  retained ranije neisteklih verification linkova;
- potvrdu da je 900+0–200 ms registration padding samo timing
  defense-in-depth, ne zamena za shared abuse zaštitu;
- potvrdu da demo seed nije deo release/deploy toka: mora ostati iza
  `DEMO_DATABASE_SEED=true`, bezbednog naziva baze i runtime
  `current_database()` equality guarda i nikada se ne pokreće nad produkcijom.

Dok ijedna od tih granica nema dokaz, ne pravi se release tag i ne odobrava se
production Environment. Main-push live objavljivanje ostaje poslednji korak.
