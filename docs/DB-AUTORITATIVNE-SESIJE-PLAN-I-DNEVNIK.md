# DB-autoritativne sesije — plan, odluke i dnevnik rada

Datum početka: 2026-08-30  
Radna grana: `ispravka/v2-db-authoritative-sessions`  
Polazni V2 SHA: `d926e152f51f363c66d37f46859fbecffbc634d2`  
Status: **u radu; expand i dormantni core su implementirani, aktivacija nije izvršena**

## 1. Granica ove sekcije

Cilj je da JWT prestane da bude samostalan dokaz aktivne prijave. JWT ostaje
potpisani nosilac kratkog skupa claim-ova, ali svaka bezbednosno značajna
serverska odluka mora dobiti svež dokaz iz PostgreSQL-a da:

- konkretna sesija i dalje postoji;
- sesija pripada konkretnom korisniku;
- nije istekla po PostgreSQL satu;
- korisnikova session revision vrednost nije promenjena;
- centralna auth-policy revision vrednost nije promenjena;
- trenutna role, profil i verification stanje odgovaraju svežem DB redu.

Ova sekcija ne pušta sajt uživo. Ne menja presentation `main`, ne pravi V2
release tag, ne otvara GitHub `production` Environment i ne pokreće deployment.
Workflow „svaki push na main objavljuje novu verziju“ ostaje poslednja sekcija
celog plana.

## 2. Problem koji se zatvara

Trenutni NextAuth v4 tok koristi rolling JWT strategiju. Pri loginu se u token
kopiraju user ID, role, ime, prezime i `requiresEmailVerification`. Sledeći
zahtevi mogu koristiti taj potpisani snapshot bez provere da li se DB stanje u
međuvremenu promenilo.

Zbog toga pre ove sekcije važi sledeće:

- password reset/change ne opoziva automatski sesije na drugim uređajima;
- promena ADMIN/OPERATOR role može ostati nevidljiva do isteka JWT-a;
- prelazak verified-login politike na novu reviziju ne opoziva stari JWT;
- istek staged grace-a ne prekida već izdatu rolling sesiju;
- cross-device email verifikacija ne osvežava nužno stari token;
- običan logout briše browser cookie, ali nema pouzdan DB dokaz opoziva tačno
  te sesije;
- `proxy.ts` trenutno može da donese role odluku samo na osnovu JWT snapshot-a.

Zato verified-login preflight namerno još sadrži hardcoded JWT/session blocker.
On se ne sme ukloniti samo zato što je dodata šema; uklanja se tek kada izdavanje,
revalidacija, svi security write tokovi, logout, server guardovi i real-DB race
testovi budu kompletni.

## 3. Izabrana arhitektura

### 3.1. JWT je nosilac, PostgreSQL je autoritet

Nova sesija će imati nasumični 256-bitni `sid`. Raw `sid` ostaje samo unutar
potpisanog JWT-a. PostgreSQL kolona `Session.sessionToken` čuva isključivo
purpose-separated HMAC digest u obliku:

```text
v1:<64 lowercase hexadecimal characters>
```

Time krađa read-only DB dump-a ne daje direktan bearer session credential.
Validator iz JWT-a izvede isti digest i radi exact lookup aktivnog reda.

### 3.2. Dve revizije

Svaka V2 sesija veže dve monotonije vrednosti:

1. `User.authSessionRevision` — menja se pri password reset/change, role ili
   drugoj privilegovanoj security mutaciji i omogućava logout-all;
2. `AuthPolicyState.revision` — menja se pri centralnoj auth-policy promeni i
   istovremeno invalidira sve sesije iz prethodne policy epohe.

Session red i JWT nose kopiju obe vrednosti. Validacija zahteva exact poklapanje
sa svežim DB stanjem.

### 3.3. Apsolutni, nerolling rok

V2 claim skup će imati immutable `sat` i `sae`:

- `sat` — session issued-at u epoch sekundama;
- `sae` — apsolutni session expiry;
- `sae - sat` ne sme preći 24 sata;
- `now >= sae` znači da je sesija istekla;
- refresh `/api/auth/session` ne sme izračunati novi 24-časovni rok;
- DB `Session.expires` i JWT `sae` moraju ostati isti kroz ceo život sesije.

Custom NextAuth encode/decode će ograničiti kriptografski `exp` na preostali
deo originalnog `sae`, nikada na novi rolling period.

### 3.4. DB outage je poseban fail-closed ishod

Nedostajući cookie može biti anonymous kada poslovni tok to dozvoljava. Validan
cookie čija autoritativna DB provera nije dostupna ne sme se pretvoriti u guest
ili staru JWT dozvolu. Interni rezultat je trostanje:

- `valid` — sve revizije, rok i relacije su potvrđeni;
- `invalid` — session/user/policy red ne postoji ili se ugovor ne poklapa;
- `unavailable` — DB/provera nije dostupna; za zaštićen tok sledi coarse 503.

Pozitivan cross-request cache se u prvoj verziji ne uvodi. Time password/role/
policy revokacija nema skriveni TTL prozor. Eventualni shared cache može se
razmatrati samo uz eksplicitno prihvaćen revocation lag i pouzdanu invalidaciju.

## 4. Expand/contract rollout

Promena je podeljena zato što stari i novi kod ne smeju da se mešaju bez jasno
definisanog ugovora.

### Expand

- dodaje metadata-safe `User.authSessionRevision NOT NULL DEFAULT 0`;
- dodaje nullable/no-default Session metapodatke;
- postojeći legacy Session redovi ostaju validni sa sva tri NULL polja;
- poseban read-only preflight pre migracije odbija legacy token koji već
  zauzima rezervisani `v1:<64 lowercase hex>` namespace;
- kompletan V2 red mora imati revizije, issued-at, bounded expiry i HMAC digest;
- dodaje singleton policy red u bezbednom početnom `audit` stanju;
- ne menja auth callback, cookie ili postojeće JWT ponašanje.

### Aktivacija

- uvodi versioned cookie i V2 claim parser/codec;
- svaki novi login atomski pravi DB Session red;
- email verification rotira staru sesiju i izdaje tačno jednu novu;
- sve security mutacije bump-uju User revision i opozivaju sesije;
- svaki serverski grant koristi centralni DB validator;
- logout opoziva tačno jedan HMAC session red pre čišćenja cookie-ja.

### Contract

- tek nakon cookie cutovera i najmanje jednog punog maksimalnog session roka
  uklanjaju se legacy/partial Session redovi;
- nullable metapodaci postaju obavezni;
- schema/preflight audit mora dokazati nula nevalidnih aktivnih redova;
- rollback na kod koji ignoriše DB revokaciju nije dozvoljen bez nove
  cookie/secret rotacije i namernog globalnog logout-a.

## 5. Faze rada i trenutni status

| Faza | Sadržaj | Status |
| --- | --- | --- |
| 0 | Nova grana iz tačno verifikovanog V2 head-a | završeno |
| 1 | Compatibility expand šema, migracija i DB invarijante | završeno; PostgreSQL 16 CI dokaz zelen |
| 2 | Dormantni claim/HMAC/policy/JWT/DB validator moduli | lokalno implementirano; real-PG CI dokaz sledi |
| 3 | Revocation u reset/change/privileged/demo write tokovima | nije započeto |
| 4 | Credentials i verification V2 session issuance/rotation | nije započeto |
| 5 | Pouzdan current-session logout | nije započeto |
| 6 | Customer/ownership/admin server guard migracija | nije započeto |
| 7 | Session contract migracija | nije započeto |
| 8 | Real-PG race/E2E matrica i uklanjanje preflight blockera | nije započeto |
| 9 | Završna dokumentacija, exact-head i post-merge V2 dokaz | nije započeto |

## 6. Dnevnik — faza 1: compatibility expand

### 6.1. Prisma šema

U `prisma/schema.prisma` lokalno su dodati:

- `User.authSessionRevision Int @default(0)`;
- `Session.authSessionRevision Int?`;
- `Session.authPolicyRevision Int?`;
- `Session.issuedAt DateTime?`;
- `Session` indeks nad `expires`;
- singleton model `AuthPolicyState` sa `id`, `revision`, `policy`, optional
  staged deadline i created/updated timestampima.

Session polja su namerno nullable i bez defaulta. `issuedAt DEFAULT now()` bi
stari proces naterao da pravi parcijalne redove ili bi postojećim redovima dao
izmišljeno vreme izdavanja. Expand zato jasno razdvaja legacy grupu (sva tri
NULL) i V2 grupu (sva tri non-NULL i potpuno validna).

### 6.2. Migracija `20260830030000_expand_authoritative_sessions`

Migracija je atomska i postavlja `search_path`, `lock_timeout=10s` i
`statement_timeout=2min`. Ako potrebni lock nije brzo dostupan, rollout treba
da stane i bude ponovljen u pregledanom prozoru umesto da neograničeno blokira
aplikaciju.

Dodati DB CHECK ugovori zahtevaju:

- User revision je uvek `>= 0`;
- legacy Session ima sva tri metadata polja NULL;
- V2 Session ima user revision `>= 0`, policy revision `>= 1`, finite
  `issuedAt/expires`, `expires > issuedAt`, rok najviše 24 sata i exact
  `v1:<64 lowercase hex>` token digest;
- policy tabela može imati samo `id=1` i `revision>=1`;
- politika je samo `audit`, `staged` ili `strict`;
- `staged` tačno zahteva finite deadline, dok `audit/strict` zahtevaju NULL;
- created/updated timestampi policy reda moraju biti finite.

Početni policy red je eksplicitno `(id=1, revision=1, policy='audit')`. Nema
`ON CONFLICT` koji bi prikrio neočekivano prethodno stanje.

### 6.3. PostgreSQL invariant fixture-i

`scripts/db-invariant-smoke.sql` je proširen da proverava stvarni katalog i
ponašanje constrainta. Pozitivni slučajevi su:

- User dobija revision `0` kada je kolona izostavljena;
- legacy Session bez metapodataka ostaje dozvoljen;
- kompletan V2 digest/session red sa tačno 24 sata roka prolazi;
- audit singleton postoji tačno jednom;
- validan staged policy sa finite deadline-om prolazi.

Negativni fixture-i moraju odbiti:

- negativnu User revision vrednost;
- rezervisani `v1:<64 hex>` digest bez sva tri V2 metadata polja;
- parcijalne Session metapodatke;
- negativnu session revision;
- policy revision `0`;
- nulti/negativni session interval;
- interval duži od 24 sata za jednu milisekundu;
- plaintext/nekanonski token u autoritativnom Session redu;
- drugi policy singleton;
- policy revision `0` i nepoznatu policy vrednost;
- staged bez deadline-a;
- audit sa deadline-om;
- staged sa `infinity` deadline-om.

Cela invariant skripta radi unutar transakcije i završava `ROLLBACK`, pa test
fixture-i ne ostaju u bazi.

### 6.4. Lokalni dokaz pre PostgreSQL CI-a

Na trenutnom lokalnom stablu završeno je:

| Provera | Rezultat |
| --- | --- |
| Prisma format/validate | PASS |
| ESLint quiet | PASS |
| TypeScript bez emitovanja | PASS |
| `npm test` | `316` ukupno / `299` pass / `17` očekivanih opt-in PG skip / `0` fail |
| `git diff --check` | PASS |
| Fresh PostgreSQL 16 migration/invariant | čeka GitHub CI; lokalni PG16 nije korišćen |

Prvi izolovani GitHub presek je naknadno potvrdio ovu fazu: draft PR #22 run
`33326003849` prošao je Prisma validate, fresh migration deploy, drift, DB
invariant, sve testove koji su postojali u schema commit-u `9316e0e`, browser
smoke i production build. Dormantni validator i novi preflight fixture dodati
su posle tog istorijskog run-a; njihov exact-head CI dokaz se ne tvrdi dok novi
run stvarno ne završi. Release potvrda i deploy posao ostali su `SKIPPED`.

### 6.5. Edge-safe claims i Node-only SID/HMAC granica

Claim ugovor je namerno podeljen na dva modula:

- `lib/auth/session-claims-edge.ts` sadrži strict parser, canonical SID proveru,
  claim creation i expiry semantiku bez `node:*` importa i bez `Buffer` API-ja;
- `lib/auth/session-claims.ts` je Node-only fasada za `randomBytes`, automatsko
  generisanje SID-a i HMAC storage ključ.

Zajedno uvode:

- kriptografski nasumičan 32-byte `sid` u jedinoj canonical unpadded base64url
  reprezentaciji od 43 znaka;
- strict parser koji odbija padding, pogrešnu dužinu, necanonical encoding,
  coercion i okolne razmake;
- purpose/domain-separated HMAC-SHA256 lookup ključ
  `v1:<64 lowercase hex>` izveden iz najmanje 32-byte server secret-a;
- isti storage digest za insert, lookup i exact revoke; različit „revoke
  purpose“ namerno nije dozvoljen jer bi proizveo drugi, neupotrebljiv ključ;
- exact claim skup `sv/sub/sid/ur/pr/sat/sae`;
- safe user/policy revision granice, bounded subject i cele epoch sekunde;
- `sae > sat`, najviše 86.400 sekundi i exact `now >= sae` expiry;
- immutable rezultate, bez vraćanja raw `sid` kao DB storage vrednosti.

Test zaključava i tačan HMAC fixture. Nenamerna promena domena/algoritma zato
ne može proći kao kompatibilna, jer bi u stvarnosti globalno odsekla sve
postojeće Session redove. Poseban statički Edge-safety test čita stvarne source
fajlove i obara proveru ako `session-jwt.ts` ponovo uveze Node fasadu ili ako se
u njegov import lanac vrate `node:*`, `require("node:...")` ili `Buffer`.

### 6.6. DB policy singleton parser i runtime autoritet

`lib/auth/auth-policy-state.ts` ne veruje automatski Prisma tipu. Raw rezultat
mora proći fail-closed parser:

- `id` je tačno `1`;
- `revision` je safe integer `>=1`;
- politika je tačno `audit|staged|strict`;
- staged tačno ima finite deadline;
- audit/strict tačno imaju `NULL` deadline;
- created/updated vrednosti su finite `Date` instance.

Posle jednokratnog, kontrolisanog legacy→V2 auth preseka DB singleton je jedini
runtime autoritet za policy i deadline. Request validator ne poredi DB stanje
sa process env vrednošću: takvo exact poređenje bi pri svakoj rolling promeni
politike napravilo neizbežan mixed-fleet 503 prozor. Budući policy writer mora
koristiti operator-only CAS i u istom DB commitu promeniti policy/deadline i
povećati revision. Time nove prijave odmah čitaju novu odluku, a sve sesije iz
prethodne policy epohe odmah postaju nevažeće.

Postojeći env-driven credentials tok ostaje nepromenjen dok se ne implementira
atomsko V2 izdavanje. DB-only model se neće aktivirati delimično; prvi presek
zahteva audit policy, maintenance/drain svih legacy instanci i versioned cookie.

### 6.7. Nerolling NextAuth JWT codec

Novi, još neaktivirani `lib/auth/session-jwt.ts` obavija postojeći NextAuth
encode/decode ugovor:

- uvozi samo Edge-safe claim modul, pa priprema decoder za Next 16 Proxy
  bundle bez Node crypto/Buffer zavisnosti;
- iz privremenog callback tokena izdvaja samo sedam pregledanih V2 claim-ova;
- stale role/profile/principal polja nikada se ne upisuju u šifrovani token;
- svaki refresh dobija najviše `sae - now`, ne novi 24-časovni rok;
- originalni `sae` se nikada ne pomera;
- decode uklanja standardna `iat/exp/jti` i druga prolazna polja;
- kriptografski kvar, legacy/malformed claim ili `now >= sae` daju zatvoren
  `null`/odbijanje bez privatnog detalja;
- stvarni NextAuth v4 encode/decode round-trip test potvrđuje kompatibilnost.

Codec još nije povezan u `authOptions`; postojeći korisnički tok zato ovom
etapom nije promenjen.

### 6.8. Jedan DB snapshot za autoritativnu validaciju

`lib/auth/authoritative-session-database.ts` sada sadrži dormantni adapter.
Jedan PostgreSQL statement čita:

- HMAC-indeksirani Session red;
- pripadajući User red i svežu role/profile/verification sliku;
- tačno jedan `AuthPolicyState` red i ukupan broj policy redova;
- `(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3)`.

Validator exact poredi JWT, Session, User i policy revision vrednosti, user ID,
issued-at i absolute expiry. Eksplicitna UTC-naive konverzija DB sata odgovara
Prisma `DateTime`/PostgreSQL `timestamp(3) without time zone` ugovoru i pri
čitanju ne zavisi od session `TimeZone` podešavanja. To nije dokaz da su
istorijski/default timestamp upisi napravljeni u UTC: pre aktivacije DB
role/database TimeZone mora biti zaključan i readiness-proveren kao UTC, uz
real-PG negativan test upisa iz ne-UTC sesije. Expiry se konačno meri DB satom.
Aktuelna DB politika se ponovo izvršava; strict/staged denial invalidira inače
potpisan i strukturno validan token.

Rezultati su eksplicitni:

- `valid` vraća samo svež principal bez `sid`, JWT-a ili storage digest-a;
- `invalid` pokriva missing/deleted/expired/revoked/mismatch/policy-denied
  sesiju;
- `unavailable` pokriva DB kvar, missing/duplicate/nevalidan singleton ili
  oštećen persisted state.

Nema pozitivnog cross-request cache-a. Dodat je exact current-session delete,
locked Session insert i locked logout-all helper. Poslednja dva namerno traže
caller-owned transakciju i dokumentovan User→policy lock redosled; helper ne
skriva niti izmišlja lock.

### 6.9. Novi testovi i CI wiring

Dodati testovi pokrivaju canonical SID, stabilan HMAC, malformed claims,
revision/expiry granice, strict DB-only policy singleton, nerolling
encode/decode, DB principal freshness, strict denial, missing/expired/mismatch
ishode, exact revoke, locked insert i logout-all ugovor.

Real-PostgreSQL test je iza `RUN_AUTH_SESSION_DB_TESTS=true` i koristi postojeći
loopback/test-database guard. On proverava:

- da DB čuva digest, a ne raw `sid`;
- tačne revision/issuedAt/expires vrednosti;
- validan svež principal;
- User revision bump kao trenutnu invalidaciju;
- policy revision bump kao trenutnu invalidaciju;
- svežu role projekciju iz DB-a;
- stabilno čitanje postojećeg UTC fixture-a unutar transakcije čiji je
  `TimeZone=Europe/Belgrade`;
- exact current revoke i replay denial.

Pre same expand migracije dodat je odvojen
`scripts/auth-session-expand-preflight.sql`. On je `REPEATABLE READ READ ONLY`,
uzima samo `ACCESS SHARE`, koristi UTC i ograničene timeout-e, proverava strict
baseline `Session.sessionToken` ugovor i ispisuje samo
`preflight.session.legacy_reserved_v1_token|count`. Nenulti nalaz — uključujući
istekao Session red — završava `psql` statusom `3`, bez tokena, ID-a ili PII.
Opt-in PG fixture izvršava baš tu skriptu nad izolovanom test šemom i dokazuje
clean i fail-closed collision slučaj. Preflight nikada ne briše sesije.

V2 verification workflow dobio je samo dva nova test env prekidača za DB
validator i expand-preflight fixture. Trigger, release uslov i deploy posao
nisu menjani.

Lokalni zbir posle dormantne faze:

| Provera | Rezultat |
| --- | --- |
| Novi fokusirani testovi | `34` ukupno / `32` pass / `2` očekivana real-PG skip / `0` fail |
| Kompletan `npm test` | `350` ukupno / `331` pass / `19` očekivanih real-PG skip / `0` fail |
| ESLint quiet | PASS |
| TypeScript bez emitovanja | PASS |
| `git diff --check` | PASS |

Ova faza još nije auth aktivacija. Password/role/verification write tokovi još
ne bump-uju revision, NextAuth callback još ne insertuje/revalidira Session, a
server/proxy guardovi još nisu prebačeni. Ti koraci ostaju naredne faze i
preflight JWT blocker ostaje namerno aktivan.

Stvarni `.env`, produkcijska baza i produkcijski credentiali nisu pregledani.
Za lokalne komande korišćene su eksplicitne test konfiguracione vrednosti;
opt-in real-DB testovi nisu lažno predstavljeni kao izvršeni.

## 7. Obavezni transakcioni redosledi narednih faza

### Login/session issuance

```text
bcrypt izvan write transakcije
  → User lock i svež password/profile/revision snapshot
  → AuthPolicyState lock i revision/policy snapshot
  → DB clock
  → ponovna policy odluka
  → Session HMAC digest insert
  → tek zatim browser dobija potpisani V2 cookie
```

### Password/reset/role logout-all

```text
User FOR UPDATE
  → exact credential/state CAS
  → security mutacija
  → authSessionRevision = authSessionRevision + 1
  → DELETE svih Session redova tog User-a
  → credential cleanup
  → jedan commit
```

### Email verification rotacija

```text
User FOR UPDATE
  → exact EmailVerification FOR UPDATE
  → AuthPolicyState lock
  → DB clock i expiry provera
  → User verified + revision bump
  → delete svih starih Session redova
  → insert tačno nove Session digest vrednosti
  → consume verification siblings
  → commit
  → vrati unapred pripremljen cookie/response
```

### Current-session logout

```text
same-origin POST
  → strogi V2 JWT decode
  → HMAC(sid) lookup/delete tačno jednog Session reda
  → commit
  → tek potom očisti versioned i legacy/chunked cookie-e
```

Ako DB revoke zakaže, endpoint vraća coarse retryable 503; ne tvrdi da je
sesija opozvana samo zato što je browser cookie obrisan.

## 8. Test matrica

Faza 2 već zaključava canonical 32-byte SID, stabilan domain-separated HMAC,
odsustvo raw SID-a u DB-u, strict claim oblik, exact expiry, revision mismatch,
fresh DB principal, strict/staged policy odluku, exact revoke, UTC stabilnost i
legacy reserved-namespace preflight.

Naredne faze još moraju dodati unit, bundle/E2E i real-PostgreSQL dokaze za:

- immutable `sae` kroz proizvoljno mnogo session refresh zahteva;
- stvarni Next 16 Proxy/Edge production bundle sa custom decoderom;
- Credentials sign-in → refresh → exact expiry sa atomski upisanim DB redom;
- DB/role UTC readiness i timestamp write ponašanje iz ne-UTC sesije;
- login-vs-reset/change/role race;
- policy bump-vs-session issuance race;
- verification rotation, rollback i cross-device rezultat;
- logout jednog uređaja uz očuvanje drugog;
- replay obrisanog session tokena;
- DB outage kao 503, nikada kao guest ili stara JWT dozvola;
- direktan poziv svake admin API rute bez oslanjanja na proxy;
- statičku allow-listu jedinih dozvoljenih raw `getToken`/`getServerSession`
  call-site-ova;
- schema expand→contract prelaz i fail-closed invalid fixture-e.

## 9. Rollout i rollback rizici

1. **Mešani old/new app pool nije dozvoljen pri aktivaciji.** Stari proces može
   izdati JWT koji nema DB allowlist red. Budući rollout mora koristiti drain,
   maintenance ili blue/green presek bez paralelnog legacy izdavanja.
2. **Rollback na stari kod može ignorisati revokaciju.** Versioned cookie i
   cleanup svih legacy cookie imena su obavezni. Posle aktivacije rollback
   zahteva novu secret/cookie rotaciju i namerni globalni logout.
3. **DB postaje auth hot path.** Potrebni su pool, timeout, latency i coarse 503
   metrički alarmi. DB outage ne sme otvoriti anonymous fallback za zaštićenu
   rutu.
4. **Expiry cleanup i indeks.** `Session_expires_idx` omogućava bounded cleanup;
   worker i operativne metrike dolaze pre live-a.
5. **Policy izmena je DB-only kontrolna operacija posle cutovera.** Mora
   atomski povećati revision i imati operator-only CAS CLI/runbook; ručni
   update bez revision bump-a i env↔DB dual-read su zabranjeni.
6. **Legacy token može slučajno ličiti na V2 digest.** Expand preflight zato
   proverava sve Session redove pre migracije. Nenulti aggregate se ručno
   remediira i ponavlja do nule; migracija niti preflight ne kriju auto-delete.
7. **`timestamp without time zone` upisi zahtevaju UTC ugovor.** UTC-normalized
   read clock nije dovoljan ako DB default pod ne-UTC sesijom upiše lokalni
   zidni sat. Aktivacija zato čeka eksplicitan UTC DB role/database readiness
   gate i real-PG write test.

## 10. Preostali redosled posle ove sekcije

Kada DB-authoritative session paket dobije exact-head i post-merge V2 dokaz,
redosled ukupnog projekta ostaje:

1. shared limiter i eksplicitan trusted-proxy/client-IP ugovor;
2. transactional auth-email outbox i durable worker;
3. hash-only token write, TTL+grace čekanje i contract migracija;
4. produkcioni DB setup/readiness, backup/restore i staging gate-ovi;
5. sadržaj, pravni, payment, observability i ostali live checklist gate-ovi;
6. tek na kraju main-push GitHub workflow i stvarno live puštanje.

## 11. Git/CI evidencija ove sekcije

Ova tabela se popunjava isključivo stvarnim dokazima. Trenutno nijedan pending
red nije tvrdnja o uspehu.

| Dokaz | Vrednost |
| --- | --- |
| Base V2 SHA | `d926e152f51f363c66d37f46859fbecffbc634d2` |
| Prvi expand commit | `9316e0eb5fff627d577badc9fdaf2c0b2a73734b` |
| V2-only PR | [draft PR #22](https://github.com/biozencaj-stack/narodnanosnja/pull/22) |
| Prvi expand CI run | [run `33326003849`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33326003849), attempt 1, `SUCCESS` |
| PostgreSQL 16 migration/invariant | `PASS` u run-u `33326003849` |
| Dormantni core exact-head CI run | čeka novi GitHub CI run |
| Feature merge SHA | nije izvršen |
| Post-merge V2 run | nije izvršen |
| Release/deploy jobs | moraju ostati `SKIPPED` |
| V2 release tagovi | mora ostati `0` |
| Deployment zapisi | mora ostati `0` |
| Produkcijska baza/server/live | **NIJE RAĐENO** |
