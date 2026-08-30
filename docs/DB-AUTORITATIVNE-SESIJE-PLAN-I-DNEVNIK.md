# DB-autoritativne sesije — plan, odluke i dnevnik rada

Datum početka: 2026-08-30  
Radna grana: `ispravka/v2-db-authoritative-sessions`  
Polazni V2 SHA: `d926e152f51f363c66d37f46859fbecffbc634d2`  
Status: **u radu; faze 1–5, dormantni server guard, tranzicioni legacy-only facade i source-inventory gate faze 6 imaju zelen exact-head PostgreSQL/browser/build CI dokaz; prvi customer call-site batch je lokalno u radu, V2 aktivacija nije izvršena**

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
| 2 | Dormantni claim/HMAC/policy/JWT/DB validator moduli | završeno; exact-head PostgreSQL 16 CI dokaz zelen |
| 3 | Revocation u reset/change/privileged/demo write tokovima | završeno; exact-head PostgreSQL 16 CI dokaz zelen |
| 4 | Credentials i verification V2 session issuance/rotation | završeno kao dormantni paket; exact-head run `33330847915` zelen |
| 5 | Pouzdan current-session logout | završen kao dormantni paket; exact-head run `33331632579` zelen |
| 6 | Customer/ownership/admin server guard migracija | dormantni guard/facade i source-inventory gate imaju zelen exact-head CI; prvi read-only customer call-site batch lokalno u radu |
| 7 | Session contract migracija | nije započeto |
| 8 | Real-PG race/E2E matrica i uklanjanje preflight blockera | nije započeto |
| 9 | Završna dokumentacija, exact-head i post-merge V2 dokaz | nije započeto |

## 6. Dnevnik — faze 1–2: expand i dormantni core

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
`statement_timeout=2min`. Pre svog početnog policy `INSERT`-a eksplicitno
postavlja i `SET LOCAL TIME ZONE 'UTC'`, jer Prisma `DateTime` kolone koriste
`timestamp(3) without time zone` i taj migracioni upis ne sme naslediti
operatorov lokalni zidni sat. `SET LOCAL` važi samo u migracionoj transakciji:
ne podešava buduće runtime konekcije, DB role niti database default. Zato
poseban runtime UTC readiness gate iz odeljka 13 ostaje obavezan pre aktivacije.
Ako potrebni lock nije brzo dostupan, rollout treba da stane i bude ponovljen u
pregledanom prozoru umesto da neograničeno blokira aplikaciju.

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

Commit `baa39bdc0dfb4184c42e8d12c5c13a6a45baf39b` i PR run `33327741687`
naknadno su potvrdili oba opt-in PostgreSQL testa, kompletan suite, browser
smoke i production build. Release i deploy poslovi ostali su `SKIPPED`.

Ova faza nije auth aktivacija. Na njenom exact-head preseku security write
tokovi još nisu bumpovali revision, a NextAuth callback nije insertovao niti
revalidirao Session. Faza 3 ispod zatvara prvi deo tog duga; issuance,
verification rotation, logout i server/proxy guardovi i dalje ostaju naredne
faze i preflight JWT blocker ostaje namerno aktivan.

Stvarni `.env`, produkcijska baza i produkcijski credentiali nisu pregledani.
Za lokalne komande korišćene su eksplicitne test konfiguracione vrednosti;
opt-in real-DB testovi nisu lažno predstavljeni kao izvršeni.

## 7. Dnevnik — faza 3: atomska security revokacija

### 7.1. Password reset confirm

Uspešan reset već zaključava `User`, zatim tačan `PasswordReset` red i meri DB
sat tek posle oba moguća čekanja. U istoj transakciji sada:

1. exact User password write povećava `authSessionRevision` za jedan;
2. brišu se svi legacy i V2 `Session` redovi tog korisnika;
3. tek zatim se claim-uje reset credential i brišu njegovi sibling reset i
   email-verification credentiali.

Ako revision write, Session delete, exact credential claim ili kasniji cleanup
zakaže, cela transakcija se vraća. Unit test zaključava redosled i zero-session
idempotency. Real-PG fixture dodaje i legacy i kompletan V2 Session, potvrđuje
jednog reset pobednika, revision `+1`, nula sesija i rollback koji vraća i
password, revision, reset red i Session.

### 7.2. Authenticated password change

Bcrypt poređenje i novi hash ostaju izvan write transakcije. Posle
`User FOR UPDATE` i exact password-hash CAS-a, isti User write sada zajedno
menja hash i radi `authSessionRevision + 1`, zatim briše sve Session redove pre
reset/verification cleanup-a. Stale bcrypt snapshot ne menja revision i ne
briše sesije. Session-cleanup kvar ostaje coarse `COMMIT` i vraća ceo write.

### 7.3. Privileged account provisioning

Create putanja ostaje eksplicitno nova epoha `0`, bez izmišljene revokacije.
Kada se postojeći nalog menja uz odobreni `updateExisting=true`, User red je već
zaključan, password/role/verified write je završen u istoj transakciji, a zatim
jedan PostgreSQL data-changing CTE:

- povećava `authSessionRevision` tačno jednom;
- odbija write na PostgreSQL `integer` maksimumu umesto da dozvoli overflow;
- briše sve Session redove tog User-a;
- vraća samo boolean dokaz da je epoha zaista promenjena.

Tek posle toga se brišu verification/reset credentiali. ADMIN i OPERATOR
real-PG fixture-i proveravaju revision `0→1` i legacy+V2 sesije `2→0`;
postojeći injected-cleanup test dokazuje rollback security write-a, revisiona
i sesija.

### 7.4. Demo user seed

`prisma/seed-demo.ts` više ne koristi nevidljiv security `upsert` koji bi
zamenio javnu demo lozinku/role, a ostavio stare sesije. Novi
`lib/database/demo-user-sync.ts` koristi isti ugovor:

- canonical demo email i cost-12 bcrypt ulaz se proveravaju pre transakcije;
- postojeći User se zaključava, revision se CAS-uje na `+1`, pa se sve sesije
  brišu pre credential cleanup-a;
- nedostajući email se serijalizuje transaction advisory lock-om i novi User
  se kreira sa revision `0`;
- svi javni kvarovi su coarse i ne nose email, hash, ID ili DB exception.

Unit test pokriva redosled, create/update razliku, revision granicu, CAS i
Session-delete kvar. Opt-in PostgreSQL fixture prvo namerno obara Session
cleanup i dokazuje potpun rollback, zatim potvrđuje uspešan revision bump,
brisanje legacy+V2 sesija i create revision `0`.

### 7.5. Namerno odloženi i isključeni tokovi

Email verification nije u ovoj fazi parcijalno izmenjen. Ona mora u jednom
kasnijem User→AuthPolicyState→credential commitu bumpovati revision, obrisati
stare sesije i izdati tačno jednu novu V2 sesiju; samo logout-all bez rotacije
bi vratio cookie koji je odmah nevažeći.

Newsletter, profilna polja i verification-resend throttle nisu security
credential/role mutacije i zato ne bumpuju revision. Registracija kreira novog
User-a na DB default revision `0` i nema prethodne sesije za opoziv. U projektu
ne postoji zasebna runtime admin ruta za promenu User role/statusa; postojeći
role writeri su privileged CLI i eksplicitno zaštićen demo seed.

### 7.6. Lokalni dokaz faze 3

| Provera | Rezultat |
| --- | --- |
| Fokus reset/change/privileged/demo | `39` ukupno / `31` pass / `8` očekivanih real-PG skip / `0` fail |
| TypeScript bez emitovanja | PASS |
| ESLint quiet | PASS |
| `git diff --check` | PASS |
| Kompletan `npm test` | `361` ukupno / `340` pass / `21` očekivan real-PG skip / `0` fail |
| Novi real-PG rollback/revocation fixture-i | PASS u run-u `33328617960` |

Workflow dobija samo `RUN_DEMO_USER_SYNC_DB_TESTS=true`; postojeći reset,
password-change i privileged integration testovi već koriste ranije uključene
DB prekidače. Triggeri, release uslov i deploy posao ostaju nepromenjeni.

### 7.7. Exact-head CI dokaz faze 3

Commit `0790ccdb8e686b3a7e2358e8aecf11b2255bdbdc` potvrđen je na draft PR-u
#22 run-om `33328617960`, attempt 1. PostgreSQL 16 migracije, drift, DB
invarijante, svi opt-in security/session fixture-i, lint, TypeScript, browser
smoke i production build završili su sa `SUCCESS`. Time je potvrđen i naknadno
dodat migracioni `SET LOCAL TIME ZONE 'UTC'` red koji stariji expand run nije
obuhvatao. Release i produkcijski deploy poslovi ostali su `SKIPPED`; nije bilo
merge-a, taga, deployment zapisa niti pristupa produkciji.

## 8. Dnevnik — faza 4: dormantni V2 issuance i verification rotation

### 8.1. Zašto jezgra još nisu povezana na aktivni auth tok

Implementacija ove faze je namerno dormantna. Novi moduli nisu povezani na
`authorizeCredentialsLogin`, `authOptions`, aktivni verification route,
`signOut()` niti `proxy.ts`. Parcijalni cutover nije bezbedan zato što trenutni
proxy još donosi role odluku iz legacy JWT snapshot-a, dok strogi V2 JWT nosi
samo sedam security claim-ova i nema role/profile podatke. Uključivanje samo
issuance-a ostavilo bi legacy cookie ili proxy-only autorizacioni put koji ne
poštuje DB revokaciju.

Stvarno povezivanje zato ostaje jedan budući, pregledan activation paket:

- versioned V2 auth-cookie ime i cleanup svih legacy/chunked imena;
- custom NextAuth encode/decode bez rolling `sae`;
- DB revalidacija i jasno razlikovanje `invalid` od `unavailable`;
- current-session DB revoke pre cookie cleanup-a;
- centralni Node server guardovi i fail-closed Proxy ponašanje.

Do tog preseka verified-login JWT/session preflight blocker ostaje aktivan.

### 8.2. Dormantni credentials V2 session issuer

Novi `lib/auth/credentials-session-issuance.ts` prima samo kandidat koji je
upravo prošao realno bcrypt poređenje: exact User ID, canonical email i
podržani cost-12 bcrypt hash. Hash je isključivo lokalni CAS dokaz i nikada se
ne prenosi u NextAuth User/JWT/cookie rezultat.

Pre transakcije se generiše canonical 256-bitni SID. Jedna transakcija zatim:

1. poziva isključivo statičke `pg_catalog.set_config('TimeZone', 'UTC', true)`
   i `pg_catalog.current_setting('TimeZone')`, pa zahteva tačno jedan red u kom
   su i postavljena i pročitana vrednost `UTC`; to je transaction-local
   konfiguracija pre prvog `timestamp without time zone` čitanja, a ne row
   lock niti trajna promena DB role/database podešavanja;
2. zaključava exact `User` sa `FOR UPDATE` i ponovo čita password, email,
   profil, verification stanje i `authSessionRevision`;
3. odbija obrisan nalog, promenjen email/hash ili nevalidnu user revision;
4. čita `AuthPolicyState(id=1)` sa `FOR SHARE`, a zatim zahteva ukupan count
   tačno jedan i strict `parseAuthPolicyState` rezultat;
5. uzima jedan materialized apsolutni PostgreSQL sat kao
   `evaluatedAt timestamptz(3)` za policy odluku, a iz istog JS `Date` uzorka
   izvodi second-aligned `issuedAt` za claim/Session;
6. ocenjuje verified-login pravilo isključivo iz zaključanog DB singletona i
   svežeg User reda, bez env policy fallback-a;
7. formira immutable V2 claims sa exact user/policy revision vrednostima i
   `sae - sat = 86400`;
8. preko postojećeg locked inserta čuva samo purpose-separated HMAC digest,
   nikada raw SID, i vraća fresh principal+claims tek posle commita.

Policy `FOR SHARE` i dalje blokira konkurentni policy `UPDATE`, ali dozvoljava
paralelne login issuance transakcije različitih korisnika; time singleton nije
globalni login mutex. Svaki snapshot, policy, clock, SID ili insert kvar daje
jedan coarse `null` ishod. Budući NextAuth encode kvar posle uspešnog commita
može ostaviti samo nedostupan, bounded orphan Session red; browser credential
ne postoji, validator ga ne može pogoditi bez raw SID-a, a expiry cleanup ga
uklanja.

### 8.3. Dormantni email-verification session rotation

Novi `lib/auth/email-verification-session-rotation.ts` zadržava postojeći
hash-first/legacy-fallback credential claim, ali verification i novu sesiju
spaja u jednu transakciju. SID se generiše i secret proverava pre transakcije,
a zatim sledi tačan redosled:

1. ista statička, transaction-local UTC inicijalizacija i exact potvrda iz
   credentials issuera, pre čitanja Prisma `DateTime` vrednosti; konfiguracioni
   statement ne menja globalni redosled row lockova;
2. `User FOR UPDATE`, sa exact nepromenjenim email/password/role/name snapshotom
   i non-overflow `authSessionRevision`;
3. `AuthPolicyState FOR SHARE`, singleton count i strict DB-only parse;
4. exact `EmailVerification FOR UPDATE`, uključujući zabranu hash→plaintext
   downgrade-a;
5. precizni UTC-naive PostgreSQL `verifiedAt timestamp(3)` posle sva tri lock
   wait-a, exact expiry i policy odluka kao upravo verifikovan korisnik;
6. second-aligned `issuedAt`, `nextRevision` i immutable V2 claims;
7. JWE/kompletan HTTP rezultat preko callback-a pre prve mutacije, ali bez
   vraćanja odgovora pre commita;
8. conditional User verification write i revision `+1`;
9. brisanje svih legacy/V2 sesija, pa insert tačno jednog novog HMAC-only V2
   Session reda sa zaključanom policy revision;
10. exact consume pobedničkog credentiala i cleanup svih verification siblinga;
11. commit, pa tek tada vraćanje unapred pripremljenog rezultata.

Exact claim konflikt i DB expiry ostaju posebni bezbedni ishodi. Malformed
policy/clock/revision, invalid secret/SID, response/JWE kvar i persistence kvar
postaju jedan coarse unavailable ishod. Svaki kvar posle write-a rollback-uje
email verification, revision, grace/resend throttle polja, stare sesije, novu
sesiju i verification credential.

### 8.4. Lokalni dokaz faze 4

| Provera | Rezultat |
| --- | --- |
| Fokus credentials issuer + verification rotation | `16` ukupno / `13` pass / `3` očekivana real-PG skip / `0` fail |
| Kompletan `npm test` | `377` ukupno / `353` pass / `24` očekivana real-PG skip / `0` fail pre dodavanja naredne dormantne logout sekcije |
| TypeScript bez emitovanja | PASS |
| ESLint quiet | PASS |
| `git diff --check` | PASS |
| Novi real-PG issuance/rotation fixture-i | PASS u run-u `33330847915` |

Credentials fixture pod postojećim `RUN_VERIFIED_LOGIN_DB_TESTS=true` pokriva
HMAC-only upis, authoritative validation, rollback insertovanog reda, stvarni
stale bcrypt snapshot i `Europe/Belgrade` transaction TimeZone. Rotation
fixture-i pod postojećim `RUN_AUTH_VERIFICATION_DB_TESTS=true` pokrivaju
legacy+V2 → tačno jedan novi V2 red, revision `+1`, precizni `emailVerified`,
second-aligned claim/DB vreme pod ne-UTC sesijom i potpuni rollback na
injected Session-insert i credential-cleanup kvar. Workflow ne dobija novi
trigger niti novi env prekidač.

### 8.5. Prvi CI pokušaj i transaction-local UTC korekcija

Prvi exact-head pokušaj faze 4, commit
`098cfcfed53666ab09b408243b2667355800bd80` i PR run `33329700089`, nije
predstavljen kao zelen. Migracije, schema drift, DB invarijante, lint i
TypeScript prošli su, ali je real-PG credentials fixture pod
`SET LOCAL TIME ZONE 'Europe/Belgrade'` dobio coarse `null` umesto izdate
sesije. Browser smoke i build zato nisu ni pokrenuti; release i produkcijski
deploy ostali su `SKIPPED`.

Prva radna hipoteza bila je granica Prisma/PostgreSQL tipova, zato što su
`DateTime` kolone `timestamp(3) without time zone`, a failing fixture je nosio
oznaku `Europe/Belgrade`. Ta hipoteza u ovom trenutku nije bila dokazana; tek
kasniji coarse-stage signal ispod pokazao je da transakcija uopšte nije bila
otvorena i da stvarni uzrok prvobitnog pada nije bio DB sat.

Korekcija sada na početku oba jezgra transaction-local postavlja i zatim čita
`UTC`, preko eksplicitno kvalifikovanih `pg_catalog` funkcija. Missing,
duplikat, malformed, nepotvrđena ili non-UTC vrednost prekida tok pre User
locka i pre bilo kog write-a. Unit testovi zaključavaju da je ova konfiguracija
prva query operacija i da nema interpoliranih vrednosti, a oba real-PG testa
namerno započinju u `Europe/Belgrade` i proveravaju da je jezgro unutar iste
transakcije vidi kao `UTC`.

Ovo je dodatna odbrana za ova dva write toka, ali ne zamenjuje runtime readiness
gate: pre aktivacije DB role i database default i dalje moraju biti provereni
kao UTC, jer drugi Prisma čitači/upisivači nisu automatski obuhvaćeni ovim
dormantnim jezgrima. Novi exact-head PostgreSQL 16 CI dokaz biće upisan tek
nakon stvarno zelenog ponovljenog run-a.

Commit `027b806950fc768cc9fa5ec9a83f1689e226b651` je zatim kroz PR run
`33330178183` potvrdio da transaction-local UTC SQL, migracije, drift,
invarijante, lint i TypeScript prolaze, ali je isti credentials Belgrade
fixture i dalje dobio coarse `null`. Verification-rotation real-PG fixture-i
nisu pali. Browser/build su ponovo pravilno preskočeni posle testa, a release i
deploy poslovi ostali su `SKIPPED`. Zbog namerno jedinstvenog javnog `null`
ishoda ovaj run nije mogao da pokaže unutrašnju tačku prekida.

Naredni dijagnostički presek zato ne izlaže DB exception niti privatne podatke,
već dodaje optional, best-effort reporter sa zatvorenim skupom coarse faza:
transaction, timezone, User snapshot, policy snapshot, DB clock, policy
decision, Session insert i commit. Reporter nema polje za email, User ID,
password hash, SID, claims, DB red ili sirovu grešku; i njegov sopstveni kvar
ne menja `null`. Real-PG assertion ispisuje samo tu coarse fazu ako fixture
ponovo padne. Ovaj signal služi da sledeća korekcija bude zasnovana na dokazu,
a ne na slabljenju ne-UTC testa.

Isti presek uklanja i credentials-only dvosmislenost tipova bez menjanja auth
politike: UTC-naive User/policy kolone se u lock query-jima eksplicitno tumače
kao UTC i projektuju u apsolutni `timestamptz`, dok materialized clock query
vraća samo jedan `clock_timestamp()::timestamptz(3)`. `issuedAt` se zatim
floor-uje na ceo sekund iz tog istog `Date` uzorka. Time nema drugog
`timestamp without time zone` clock polja koje Prisma može drugačije mapirati,
a `sae - sat = 86400`, HMAC insert i policy hronologija ostaju nepromenjeni.

Treći pokušaj, commit `e773a91150e2ea765e41b54fc8fff307d77fc6e5` i run
`33330591629`, ponovo je stao na istoj assertion liniji, ali je novi coarse
signal bio prazna lista faza. To dokazuje da issuer nije ni otvorio transakciju:
odbio je ulaz pre `TIME_ZONE`. Pregled fixture-a je zatim dao egzaktan uzrok.
Lokalni deo generisanog emaila
`credentials-v2-belgrade-clock-<36-char UUID>` ima `66` znakova, dok zajednički
email ugovor ispravno dozvoljava najviše `64`. Kraći `success` fixture ima `59`,
`stale-bcrypt` tačno `64`, a `rollback` `60`, pa je samo navodno ne-UTC grana
bila odbijena kao nekanonski kandidat. Prethodna dva neuspeha zato nisu dokaz
DB timezone kvara i nisu stvarno izvršila Belgrade issuance transakciju.

Fixture oznaka je skraćena na `belgrade`, čime lokalni deo ima `60` znakova.
Helper sada za svaki kreirani credentials fixture eksplicitno proverava da
`normalizeEmailAddress(user.email) === user.email`, pa buduća preduga ili
nekanonska test adresa pada sa tačnim fixture objašnjenjem pre auth assertiona.
Transaction-local UTC i apsolutne timestamp projekcije ostaju pregledano
defense-in-depth ojačanje; njihov prvi stvarni real-PG Belgrade dokaz čeka
sledeći run i neće biti proglašen zelenim unapred.

Commit `6a42e49226f85e4c0c185d136878529dc17dc1b9` i exact-head PR run
`33330847915`, attempt 1, zatim su stvarno izvršili skraćeni Belgrade fixture.
PostgreSQL 16 migracije, drift, invarijante, svi opt-in security/session
testovi, uključujući credentials issuance i verification rotation pod ne-UTC
početnim stanjem, lint, TypeScript, Chromium instalacija, mobilni browser smoke
i probni production build završili su sa `SUCCESS`. Draft PR je ostao usmeren
isključivo na kanonsku V2 granu. Release potvrda i produkcijski deploy bili su
`SKIPPED`; nije bilo merge-a, taga, Environment pristupa niti live promene.

## 9. Dnevnik — faza 5: dormantni pouzdani current-session logout

### 9.1. Zašto NextAuth built-in signout nije dovoljan

Pregled lokalno instaliranog NextAuth v4 signout toka pokazuje da built-in
JWT signout dekodira token i poziva `events.signOut`, ali hvata event/decode
kvar i ipak nastavlja do `sessionStore.clean()`. Zato event hook ne može da
garantuje naš obavezni redosled „DB revoke ili coarse 503 bez `Set-Cookie`“.
On eventualno može biti observability dopuna, ali ne može biti autoritativni
logout mehanizam.

Faza 5 zato uvodi dormantnu orkestraciju za budući poseban same-origin `POST`
endpoint. Još nema nove rute, nema promene aktivnog `signOut()` UI toka i nema
cookie/auth cutovera. Time postojeće ponašanje korisnika nije parcijalno
prebačeno dok `authOptions`, server guardovi i Proxy još koriste legacy JWT
projekciju.

### 9.2. Jedan kanonski cookie-name ugovor

`lib/auth/config.ts` sada je jedini izvor četiri host-only base imena tokom
migracije:

- `next-auth.v2.session-token`;
- `__Secure-next-auth.v2.session-token`;
- `next-auth.session-token`;
- `__Secure-next-auth.session-token`.

Postojeći legacy `authSessionCookieName()` i budući
`authSessionV2CookieName()` izvode insecure/secure ime iz istog niza i istog
`NEXTAUTH_URL` ugovora. Cleanup helper uvozi i re-eksportuje upravo taj niz,
pa budući issuer/decoder i logout ne moraju održavati odvojene stringove.

### 9.3. Bounded i progresivno čišćenje kolačića

Novi `lib/auth/auth-session-cookie-cleanup.ts` nikada ne reflektuje proizvoljno
request cookie ime. Uvek emituje četiri poznata base descriptora, a request-u
veruje samo za exact `<known-base>.<canonical-decimal-index>` chunk. Odbija
prazne, negativne, zero-padded, alfanumeričke, višedelne i lookalike suffixe,
kao i CSRF, callback, order-access i druga cookie imena.

Chunk indeks je ograničen na `0..999`. To je daleko iznad realnog NextAuth i
browser chunk broja, ali sprečava da hostile suffix od hiljada cifara postane
veliki `Set-Cookie` naziv. Jedan odgovor sadrži najviše `32` descriptora:
četiri base-a i ukupno najviše `28` prepoznatih chunkova, sortiranih najpre po
kanonskom base redosledu, a zatim po numeričkom suffixu.
`hasRemainingRecognizedChunks=true` govori budućoj ruti da
ponovljen zahtev treba da očisti sledeći batch; response-header amplifikacija
ostaje tvrdo ograničena bez permanentnog `cap+1` exception loop-a.

Kanonski base niz, plan, descriptor niz i svaki descriptor objekat runtime su
`Object.freeze`-ovani. Descriptor ima praznu vrednost, `path=/`, `HttpOnly`,
`SameSite=Lax`, `maxAge=0`, zaseban epoch `Date` i `Secure` tačno prema
`__Secure-` prefiksu. Kao i svaki JavaScript `Date`, epoch objekat nije duboko
immutable; buduća HTTP granica mora ga neposredno serijalizovati bez mutacije.
`Domain` se namerno nikada ne postavlja, pa cleanup ostaje host-only.

### 9.4. Revoke-before-cleanup orkestracija

Novi `lib/auth/current-session-logout.ts` prima isključivo već dekodiran V2
claim objekat. Raw JWE/cookie string nije decoded claim i nikada se ne šalje u
DB; buduća HTTP ruta prvo mora da sastavi exact aktivni cookie i pozove
pregledani `decodeAuthSessionJwt`.

Za validne V2 claims orkestrator poziva postojeći HMAC-backed
`revokeCurrent()` pre planiranja ijednog cleanup descriptora:

- `revoked` ili idempotentni `invalid` daju `clear`, pa tek onda bounded cookie
  plan;
- `unavailable`, exception ili neočekivan adapter rezultat daju `retry` sa
  tačno praznim `cookies: []`;
- cleanup-plan kvar takođe ne tvrdi browser uspeh i daje coarse retry;
- optional reporter nosi samo `REVOKE_UNAVAILABLE` ili
  `COOKIE_CLEANUP_UNAVAILABLE`, bez ID-a, emaila, SID-a, claim-a ili sirove
  greške;
- reporter exception nikada ne menja bezbednosni ishod.

Time DB outage ne može da se predstavi kao uspešan autoritativni logout samo
zato što je browser cookie nestao. Legacy/malformed decoded ulaz nema V2 DB
identitet, ne poziva revoke i može bezbedno da dobije migracioni cleanup plan.

### 9.5. Lokalni i real-PG dokaz

| Provera | Rezultat |
| --- | --- |
| Fokus config + cookie cleanup + logout | `28` ukupno / `27` pass / `1` očekivani real-PG skip / `0` fail |
| Kompletan `npm test` | `393` ukupno / `368` pass / `25` očekivanih real-PG skip / `0` fail |
| TypeScript bez emitovanja | PASS |
| ESLint quiet | PASS |
| `git diff --check` | PASS |
| Two-session current logout real-PG fixture | PASS u run-u `33331632579` |

Novi fixture koristi postojeći `RUN_AUTH_SESSION_DB_TESTS=true`, pa workflow ne
dobija nov env prekidač. U lokalno zaštićenoj opt-in PostgreSQL bazi pravi dva
različita HMAC-only V2 Session reda za istog User-a uz User→policy lock
disciplinu. Logout claims-a A mora da vrati `revoked`, obriše tačno A i ostavi
tačno HMAC-adresirani sibling B red; replay A mora da vrati `invalid` i i dalje
bezbedan `clear`, dok B red ostaje netaknut. Direktna sibling-row provera je
namerno nezavisna od drugih paralelnih CI fixture-a koji kratko menjaju globalnu
policy revision. Fixture email je eksplicitno kratak i canonical.

Commit `6af8114b6b255c6f99886794d148c9251e59e936` i exact-head PR run
`33331632579`, attempt 1, potvrdili su i ovaj paket na PostgreSQL-u 16. Fresh
migracije, drift, DB invarijante, svi real-PG/security testovi, lint,
TypeScript, Chromium, mobilni smoke i probni production build završili su sa
`SUCCESS`. Draft PR je ostao clean i usmeren na kanonsku V2 granu, dok su
`Potvrdi V2 release` i `Objavi na produkciju` završili kao `SKIPPED`.

### 9.6. Šta namerno ostaje za activation paket

Budući dedicated endpoint mora pre bilo kakvog cookie/DB rada lokalno proveriti
same-origin trusted write, iz exact V2 base/chunk skupa sastaviti raw JWE bez
`Authorization` fallback-a, uraditi strict V2 decode i tek onda pozvati ovu
orkestraciju. Route test mora dokazati da `retry` nema nijedan `Set-Cookie`, da
cross-origin zahtev ne čita cookie niti DB i da validan encrypted V2 cookie
poziva exact revoke jednom.

UI i verification stranice koje danas koriste NextAuth signout moraju preći na
novi POST ugovor tek u istom preseku sa V2 `authOptions` codec/cookie wiring-om
i centralnim DB guardovima. Do tada su svi moduli ove faze dormantni i preflight
JWT/session blocker ostaje aktivan.

## 10. Dnevnik — faza 6: strogi Node guard i server access ugovor

### 10.1. Potpuni inventar aktivnih potrošača

Pre izmene call-site-ova urađen je novi statički inventar. Polazni production
source ima `99` literalnih poziva `getServerSession(authOptions)` u `56`
fajlova, ali dva pripadaju neizvezenim `legacyPOST` funkcijama u order route
fajlovima koji stvarno samo re-eksportuju zajednički handler. Aktivna migraciona
površina je zato `97` poziva u `54` fajla. Postoje još dva posebna `getToken`
poziva i osam klijentskih `useSession` potrošača. Novi tranzicioni facade dodaje
jednu namernu centralnu `getServerSession` tačku; ona nije aplikacioni call-site
i postaje jedini dozvoljeni direktni poziv kada migracija bude završena.

Aktivni server pozivi podeljeni su ovako:

| Grupa | Poziva | Fajlova/napomena |
| --- | ---: | --- |
| Jednostavni customer API | `11` | `7` fajlova: adrese, checkout-data, password, profile i wishlist |
| Ownership/mixed customer API | `4` | `3` fajla: reviews i pojedinačna order ruta |
| Admin API | `68` | `30` route fajlova, uz postojeći deny-by-default OPERATOR allowlist |
| Account layout i stranice | `5` | user layout i četiri account stranice |
| Admin layout i dashboard | `2` | poseban staff/layout i dashboard redirect ugovor |
| Order/payment result stranice | `3` | session je alternativa scoped order-access tokenu |
| Optional-auth commerce | `3` | checkout handler, promotions quote i NestPay start |
| Privileged machine endpoint | `1` | wishlist cron ima admin-session fallback uz machine secret |

Od dva `getToken` mesta, `proxy.ts` donosi request/path role odluke, dok email
verification ruta čita current legacy user i izdaje legacy cookie. Klijentski
`useSession` ostaje u Header/NavBar/checkout/product/review komponentama i na
account adresama/podešavanjima. Ovaj broj je razlog da se V2 issuer ne uključi
pre nego što centralni guard i svi enforcement potrošači budu spremni za isti
cutover.

### 10.2. Zašto se NextAuth `getToken` ne koristi

Pregled lokalno instaliranog NextAuth v4 pokazuje dve nedovoljno stroge
osobine za autoritativni dokaz:

1. `getToken` prihvata `Authorization: Bearer` kada session cookie nedostaje;
2. interni `SessionStore` skuplja svako ime koje samo počinje zadatim base-om,
   zatim ga sortira i spaja.

Novi Node guard zato uopšte ne prima request/header objekat. Prima samo listu
cookie parova, bira exact aktivni V2 base i nema kod kojim bi Bearer, legacy
cookie ili JWT profile/role mogao postati fallback.

### 10.3. Strogi i bounded V2 cookie reader

`lib/auth/auth-session-cookie-reader.ts` prihvata samo insecure ili secure V2
base iz runtime-frozen config ugovora. Dozvoljen je ili jedan exact base cookie
ili kompletan neprekinut chunk niz `.0`–`.N`; base+chunk miks, duplikat, rupa,
zero-pad i višedelni/alfanumerički suffix ispod exact aktivnog base-a daju
`invalid` pre kriptografije i baze. Drugi canonical secure režim, legacy ime i
base-lookalike nisu credential source, pa se ignorišu i sami daju `missing`;
ne mogu da se spoje sa aktivnim V2 tokenom.

Reader ima tvrde granice: najviše `8` chunkova, `4096` karaktera po vrednosti i
`32768` ukupno. Unrelated i legacy cookie imena nisu token source. Rezultat je
frozen `missing`, `invalid` ili `present`; raw token živi samo u kratkom
unutrašnjem prelazu ka decoderu i nikada ne ulazi u javni guard rezultat.

### 10.4. Kripto → DB → svež principal, bez cache-a

`lib/auth/authoritative-session-guard.ts` primenjuje fiksni redosled:

```text
exact V2 cookie
  → strict decodeAuthSessionJwt i ponovna seven-claim ekstrakcija
  → HMAC-backed AuthoritativeSessionDatabase.validate
  → samo normalizovan svež DB principal
```

Ishod je tačno jedan od:

- `authenticated` — frozen principal sa exact ID/email/name/role/verification
  poljima iz svežeg Session+User+policy+DB-clock upita;
- `anonymous/missing` ili `anonymous/invalid` — nema credentiala, JWE/claims su
  nevalidni, red je opozvan/istekao ili se revision/policy više ne poklapa;
- `unavailable` — DB validator, persisted invariant ili adapter nisu pouzdano
  dostupni; ovaj ishod nikad ne postaje anonymous ili JWT fallback.

Guard nikada ne vraća JWE, claims, SID, HMAC digest, DB red ili sirovu grešku.
Dependency/report exception ostaje coarse, a pozitivni cross-request cache se
ne uvodi.

### 10.5. Centralna access semantika i dormantni server adapter

`lib/auth/authoritative-session-access.ts` mapira customer API na
`ok/unauthenticated/unavailable`. Admin API i page mapa koriste postojeći
`getAdminApiAccess`/`getAdminPageAccess`, pa ADMIN, CUSTOMER i OPERATOR ne dobijaju
novu paralelnu role logiku: OPERATOR i dalje prolazi samo kroz centralnu
deny-by-default allowlistu. Budući HTTP adapter mapira anonymous na `401`,
validnog ali nedozvoljenog principal-a na `403`, a unavailable na coarse `503`.

`lib/auth/authoritative-session-server.ts` je `server-only` production wiring:
čita isključivo `cookies().getAll()`, jednom deli isti provereni secret između
V2 decodera i HMAC DB validatora i vraća `unavailable` ako request context ili
konfiguracija nisu dostupni. Statički safety test zabranjuje pozive
`getToken`, `getServerSession`, NextAuth import, Authorization čitanje i legacy
cookie resolver u tom adapteru.

Ovi moduli su još dormantni: nijedan aktivni layout, route, `authOptions` ili
`proxy.ts` ih ne uvozi. Zbog toga ovaj presek ne menja login, sesiju, response,
cookie ili ponašanje korisnika.

### 10.6. Dokaz i sledeći podkorak

| Provera | Rezultat |
| --- | --- |
| Fokus reader + guard + access + server safety + real-PG | `18` ukupno / `17` pass / `1` očekivani real-PG skip / `0` fail |
| Kompletan `npm test` | `411` ukupno / `385` pass / `26` očekivanih real-PG skip / `0` fail |
| TypeScript bez emitovanja | PASS |
| ESLint quiet | PASS |
| `git diff --check` | PASS |
| Cookie→JWE→DB-fresh-profile→exact-revoke fixture | PASS u run-u `33333262290` |

Opt-in fixture koristi isti `RUN_AUTH_SESSION_DB_TESTS=true` prekidač. U jednoj
interactive transakciji inicijalizuje UTC, drži `User FOR UPDATE` i policy
singleton `FOR SHARE`, upisuje HMAC Session, pravi stvarni V2 JWE i validira ga
iz exact cookie-ja. Zatim menja samo profil bez revision bump-a i dokazuje da
naredni guard read odmah vraća sveže ime; exact current-session revoke u istoj
zaključanoj transakciji pretvara isti JWE u `anonymous/invalid`. Time fixture
ne pušta globalni policy lock između ključnih asercija i ne uvodi paralelni CI
race. Dve nezavisne revizije nisu našle blokator; getter/Proxy totality minori
su zatvoreni dodatnim fail-closed testovima.

Commit `c9f7849691fbeee1922d40c5d3959454961d5aab` i exact-head PR run
`33333262290`, attempt 1, potvrdili su ovaj dormantni guard paket na
PostgreSQL-u 16. Fresh migracije, drift, DB invarijante, svi opt-in real-PG i
security testovi, lint, TypeScript, Chromium, mobilni smoke i probni production
build završili su sa `SUCCESS`. Draft PR je ostao clean prema kanonskoj V2
grani; `Potvrdi V2 release` i `Objavi na produkciju` ostali su `SKIPPED`.

Sledeći podkorak Faze 6 je migracija call-site-ova po grupama na zajednički
tri-state ugovor, ali bez parcijalnog V2 izdavanja. Aktivni credentials issuer,
email-verification rotation, NextAuth codec/cookie, logout HTTP/UI i uklanjanje
proxy JWT autorizacije ostaju jedan kasniji funkcionalni cutover.

### 10.7. Neutralni tranzicioni server-session facade

Pre mehaničke izmene `97` aktivnih potrošača dodat je stabilan neutralni ugovor
u `lib/auth/server-session-contract.ts`. Javni rezultat ima tačno tri grane:

- `authenticated` sa minimalnim frozen principal-om;
- `anonymous` bez optional principal-a;
- `unavailable`, koji budući HTTP adapter mora da mapira na coarse `503`, a ne
  na guest, login redirect ili staru JWT dozvolu.

Production ulaz `lib/auth/server-session.ts` je `server-only` i eksplicitno
označen kao `LEGACY_TRANSITIONAL_IMPLEMENTATION`. U ovoj etapi koristi isključivo
jedan `getServerSession(authOptions)` credential source. Ne čita V2 cookie,
`Authorization`, `getToken`, request headers ni autoritativni DB guard. Nema env
prekidač, runtime dual-mode niti „probaj V2 pa se vrati na legacy“ ponašanje.
Na atomskom V2 cutoveru implementacija ovog jednog ulaza mora fizički da bude
zamenjena V2-only resolverom, a legacy adapter obrisan; oba resolvera nikada ne
smeju da budu deo istog request puta.

`authOptions` se učitava lenjo unutar zaštićenog legacy `read()` poziva. To je
bitno zato što trenutni auth modul validira policy, URL i secret pri evaluaciji
modula: konfiguracioni/import kvar sada postaje frozen `unavailable`, umesto da
probije trostanjni facade ugovor pre samog poziva. Facade se namerno ne
re-eksportuje iz `lib/auth/index.ts`, jer bi povratna import ivica napravila
ciklus i zamaglila server-only granicu.

Čisti adapter `lib/auth/legacy-server-session.ts` za svaki `resolve()` radi
tačno jedno novo čitanje i nema pozitivan ni anonymous cross-request cache.
Samo exact `null` iz NextAuth-a mapira na `anonymous`; spoljašnji throw/reject i
svaki non-null malformed profil daju `unavailable`. Važno ograničenje je da
NextAuth v4 interno može da pretvori deo decode/session-callback kvarova u
`null`, pa tranzicioni `anonymous` znači samo „legacy NextAuth nije vratio
sesiju“. On još nije dokaz fizički nedostajućeg cookie-ja niti puna V2 outage
semantika; to ograničenje se uklanja tek autoritativnim cutoverom.

Principal prihvata samo sopstvena data polja `id`, `email`, `firstName`,
`lastName`, `role` i `requiresEmailVerification`. Accessor i inherited polja se
odbijaju bez izvršavanja; Proxy/descriptor kvar ostaje fail-closed. Role mora
biti tačno `CUSTOMER`, `OPERATOR` ili `ADMIN`, stringovi su neprazni, trimovani
i bez C0/DEL kontrolnih znakova, a verification flag je strogi boolean. `name`
se izvodi iz proverenog imena i prezimena; legacy display name, `expires`, SID,
token, secret i sva dodatna polja se odbacuju. Spoljašnji rezultat i novi plain
principal su runtime frozen. Reporter prima samo `LEGACY_SESSION_READ` ili
`LEGACY_SESSION_SHAPE`; sync throw i async rejection reportera ne menjaju ishod.

Statički test zaključava tačno jednu legacy credential tačku, dozvoljene
importe, odsustvo V2/header/env fallbacka i zabranu ciklusa kroz auth index.
Production-wiring test sa izolovanim Node module hookovima dokazuje da facade
prosleđuje tačno production `authOptions` objekat jedinom legacy readeru i
ponovo čita na sledećem zahtevu. Poseban test dokazuje da lazy auth konfiguracija
koja pada vraća `unavailable` bez poziva legacy readera. Compile-time dokaz
zaključava obostranu strukturnu kompatibilnost neutralnog principal-a sa
autoritativnim V2 principal-om.

| Lokalna provera tranzicionog facade-a | Rezultat |
| --- | --- |
| Fokus adapter + wiring + config-failure + static/type contract | `15` ukupno / `15` pass / `0` fail |
| Kompletan `npm test` | `426` ukupno / `400` pass / `26` očekivanih real-PG skip / `0` fail |
| TypeScript bez emitovanja | PASS |
| Kompletan ESLint quiet | PASS |
| `git diff --check` | PASS |

Commit `d08fa32e40b1476b8d587ef596ff5119be4f7f59` i exact-head PR run
`33334129994`, attempt 1, potvrdili su facade paket. PostgreSQL 16 migracije,
drift/invarijante, svi security/DB testovi, lint, TypeScript, Chromium, mobilni
smoke i probni production build završili su sa `SUCCESS`. Draft PR je ostao
clean prema kanonskoj V2 grani; release i production deploy poslovi ostali su
`SKIPPED`.

Facade još nema nijedan aplikacioni potrošač, pa ova izmena ne menja login,
cookie, autorizaciju, response ni korisničko ponašanje. Sledeći redosled je:

1. ukloniti dve neizvezene `legacyPOST` funkcije i zaključati tranzicioni
   repo-wide allowlist test;
2. migrirati jednostavne customer API-je, pa ownership/mixed tokove;
3. migrirati admin API isključivo kroz centralni `admin-policy`, uključujući
   postojeća uža OPERATOR ograničenja;
4. rešiti eksplicitni HTML unavailable/error ugovor pre account/admin layout-a;
5. migrirati alternativne capability tokove tako da validan order/cron dokaz
   može da autorizuje, ali session outage bez validne alternative ostaje `503`;
6. tek sa nulom direktnih aktivnih call-site-ova pripremiti jedan V2-only
   cookie/codec/issuance/verification/logout/proxy cutover bez downgrade puta.

### 10.8. Mrtvi route cleanup i tranzicioni source-inventory gate

Pre prvog stvarnog call-site batch-a uklonjena su dva neizvezena
`legacyPOST` stabla iz `app/api/order/route.ts` i `app/api/orders/route.ts`.
Oba fajla su i pre cleanup-a imala isti jedini javni runtime eksport:

```ts
export { POST } from "@/lib/checkout/order-handler";
```

Privatni handleri, njihovi tipovi, validatori i importi nisu bili eksportovani
niti pozvani. Cleanup zato uklanja `419` mrtvih source linija i dva neizvršiva
`getServerSession(authOptions)` poziva bez promene URL-a ili identiteta aktivnog
`POST` handlera. Novi `lib/checkout/order-route-aliases.test.ts` čita oba stvarna
route fajla i zahteva tačno jednu identičnu re-export liniju, pa se paralelni
stari checkout handler ne može tiho vratiti. Aktivni zajednički
`lib/checkout/order-handler.ts` i dalje koristi legacy sesiju; ovaj cleanup nije
V2 aktivacija niti menja checkout ponašanje.

Novi `lib/auth/server-session-callsite-inventory.test.ts` parsira production
TypeScript i JavaScript preko compiler AST-a, bez oslanjanja na tekstualni
`rg` broj. Ne prati symlinkove, ne čita testove, generated/build output,
migracije, dokumentaciju ni dependency direktorijume. Za svaki preostali
credential potrošač zaključava source fajl, originalni named import, local
binding, broj direktnih poziva i exact `authOptions` argument.

Tranzicioni snapshot sada zahteva:

- tačno `97` aktivnih consumer poziva u `54` fajla;
- tačno jedan centralni legacy read u `lib/auth/server-session.ts`, odnosno
  ukupno `98` production poziva u `55` fajlova;
- tačno dva izdvojena `getToken` poziva: `proxy.ts` i verification ruta;
- `authOptions` statički import samo u preostalim consumer fajlovima i
  NextAuth handleru, dok facade-ov lazy wiring ostaje posebno zaključan;
- nula `unstable_getServerSession`, namespace/property/computed poziva,
  dynamic/template/konkatenisanih `next-auth` importa, CommonJS `require` ili
  `module.require`, import-equals zaobilazaka, raw/namespace/default re-exporta i
  prosleđivanja/aliasovanja credential bindinga; namespace, property, computed,
  dynamic i re-export `authOptions` putevi su takođe zatvoreni. Ceo Node
  `module`/`node:module` runtime builtin, a time i `createRequire`
  loader-factory, zabranjen je u production source-u, jer bi bez punog data-flow
  engine-a omogućio da se modul i član sakriju iza lokalnih konstanti; projekat
  nema legitiman runtime potrošač tog builtin-a. Bare CommonJS `module` je
  takođe zabranjen; jedini uski izuzetak su postojeće leve strane
  `module.exports = ...` u `ecosystem.config.js` i `postcss.config.js`.
  `process`/`node:process` importi, aliasi i computed pristupi su zabranjeni;
  globalni `process` sme samo kroz postojeći direktni allowlist (`env`, `cwd`,
  `exit`, `stdin`, `stdout`, `argv`, `exitCode`), čime su zatvoreni i
  `mainModule`, `binding` i Node 24 `getBuiltinModule` loader putevi.

Bypass fixture-i dodatno zaključavaju kanonski i `/index` oblik auth modula,
relativno razrešavanje do `lib/auth/index`, originalno ime aliased destructuring
polja, statički konkatenisane computed članove, named-default `NextAuth` import,
default re-export i pokušaj iznošenja odobrene `NextAuth` fabrike kroz drugi
binding. Jedini dozvoljeni dinamički auth import ostaje precizno provereni
`const { authOptions } = await import("./index")` unutar centralnog facade-a;
binding mora biti `const` i imati samo jedan direktan `getServerSession`
potrošač. Alias, initializer, dodatno destructured polje, drugi fajl, drugi
module put ili drugo čitanje ne dobija taj izuzetak.

Snapshot je namerno „shrinking allowlist“: svaki naredni migration batch briše
ili smanjuje postojeće stavke. Nova stavka ili novi direktni credential put ruši
test. Kada consumer mapa postane prazna, facade mora biti jedini legacy reader;
na V2 cutoveru i taj izuzetak nestaje, bez zamene runtime prekidačem ili
downgrade fallbackom.

| Lokalna provera cleanup/source-gate paketa | Rezultat |
| --- | --- |
| Exact order route alias test | `1` pass / `0` fail |
| AST shrinking-allowlist inventory + bypass fixture-i | `2` pass / `0` fail; `97/54` consumer, `98/55` ukupno, `2/2` getToken |
| Kompletan `npm test` | `429` ukupno / `403` pass / `26` očekivanih real-PG skip / `0` fail |
| TypeScript bez emitovanja | PASS |
| ESLint sa nula upozorenja za izmenjene fajlove | PASS |
| `git diff --check` | PASS |

Commit `23501d592724a709000160cc68058ccac7a74beb` i exact-head PR run
`33336276720`, attempt 1, potvrdili su source-inventory paket. PostgreSQL 16
migracije, drift/invarijante, security/DB testovi, lint, TypeScript, Chromium,
mobilni checkout smoke i probni production build završili su sa `SUCCESS`.
Draft PR je ostao clean prema kanonskoj V2 grani; release i production deploy
poslovi bili su `SKIPPED`.

Ovaj paket sam za sebe nije promenio nijedan izvršivi session consumer. Prvi
funkcionalni batch iz sledećeg pododeljka zato počinje tek iza njegovog zelenog
exact-head dokaza.

### 10.9. Prvi customer consumer — read-only checkout podaci

Prvi stvarni call-site batch migrira samo
`GET /api/user/checkout-data`. Ruta je izabrana kao najmanji vertikalni presek:
read-only je, nema request body ni mutaciju, a jedini grant je čitanje podataka
korisnika čiji ID dolazi iz sesije. Stari direktni
`getServerSession(authOptions)` import uklonjen je i production composition root
sada poziva samo neutralni `resolveServerSession()` facade.

Nova granica je podeljena na:

- `lib/checkout/checkout-data-route.ts` — čisti dependency-injected HTTP
  factory, sa samo type-only importom neutralnog session ugovora i native
  `Response.json` odgovorima;
- `lib/checkout/checkout-data-route.test.ts` — izolovana Node matrica bez
  Prisma/NextAuth/module mockovanja;
- `app/api/user/checkout-data/route.ts` — tanko production povezivanje facade-a,
  postojećeg Prisma upita i coarse stage-only reportera.

Session/HTTP ugovor je eksplicitan:

| Session/lookup ishod | HTTP | Ponašanje |
| --- | ---: | --- |
| `anonymous` | `401` | postojeći `{ error: "Unauthorized" }`; nula DB poziva |
| `unavailable` | `503` | generički retry body; nula DB poziva; nikada se ne mapira u anonymous |
| resolver throw ili malformed rezultat | `503` | `{ stage: "SESSION" }` bez raw greške/PII; nula DB poziva |
| authenticated + User ne postoji | `404` | postojeći `{ error: "User not found" }` |
| authenticated + DB throw | `500` | postojeći coarse body i samo `{ stage: "LOOKUP" }` report |
| authenticated + User postoji | `200` | svež DB profil i prvi default address ili eksplicitni `null` |

Svi odgovori sada nose `Cache-Control: private, no-store, max-age=0`,
`Pragma: no-cache`, `Referrer-Policy: no-referrer` i noindex/noarchive header.
To je namerno PII cache hardening proširenje; postojeći statusi i JSON body
ugovori za `200/401/404/500` ostaju isti. Reporter nikada ne prima exception,
user ID, session ili DB red, a sync throw i async rejection reportera ne mogu
zameniti fail-closed odgovor.

Production Prisma semantika ostaje namerno ista: lookup koristi isključivo
`authenticated.principal.id`; User select ostaje `id`, `email`, `firstName`,
`lastName`, `phone`; address podupit ostaje `isDefault: true`, `take: 1` i
projekcija `street/apartment/city/postalCode/country`. User `id`, role, session
profil i verification stanje ne ulaze u response. Factory konstruiše i nov
address objekat samo od tih pet polja; dodatna adapter polja ili custom `toJSON`
ne mogu proširiti javni PII payload. Ovaj batch ne rešava moguće duple default
adrese i ne menja checkout klijent.

AST gate sada zaključava obe strane migracionog fronta:

- raw legacy consumer mapa pada sa `97/54` na `96/53`;
- zajedno sa jedinim centralnim facade read-om raw zbir pada sa `98/55` na
  `97/54`;
- nova exact mapa neutralnih `resolveServerSession()` potrošača počinje sa
  `1/1`, pa brisanje autentikacije ne može izgledati kao uspešna migracija;
  checkout wiring dodatno mora biti tačan request-lazy
  `resolveSession: () => resolveServerSession()` unutar factory composition-a,
  a dependency objekat mora imati tačno tri eksplicitna i jedinstvena polja bez
  spread/computed override-a; module-scope read, cross-request cache ili kasnije
  pregažen resolver ruše gate;
- `getToken` ostaje nepromenjen `2/2`.

Facade u ovom trenutku i dalje čita isključivo tranzicionu legacy NextAuth
sesiju. Zato ovo jeste aktivna call-site migracija, ali nije V2 cookie/codec,
issuance, proxy ili logout cutover i ne uvodi fallback između dva credential
izvora. Postojeći checkout klijent ne prikazuje poseban 503 tekst već samo
ostavlja autofill prazan; to je evidentiran UX rizik za kasniji UI batch, ne
auth bypass niti promena guest checkout mogućnosti.

| Lokalna provera checkout-data batch-a | Rezultat |
| --- | --- |
| Factory HTTP/session matrica | `8` pass / `0` fail; isti handler radi svež session i DB read po zahtevu |
| AST raw + neutralni migration-frontier gate | `2` pass / `0` fail; raw `96/53`, raw+facade `97/54`, neutralno `1/1`, getToken `2/2` |
| TypeScript bez emitovanja | PASS |
| ESLint za izmenjene TS fajlove | PASS, `0` upozorenja |
| `git diff --check` | PASS |

## 11. Obavezni transakcioni redosledi aktivacije i narednih faza

Faze 4 i 5 prvo grade i testiraju dormantne orkestracione jezgre. One se ne
povezuju parcijalno na aktivni `authOptions`, verification route, `signOut()`
ili `proxy.ts`: V2 cookie nema role/profile snapshot, dok trenutni proxy još
veruje legacy JWT ulozi. Stvarni cutover zato mora biti jedan pregledan paket
sa versioned cookie imenom, custom encode/decode lancem, pouzdanim logoutom i
centralnim Node DB guardovima. Pre tog preseka preflight JWT blocker ostaje
aktivan.

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
generiši canonical SID pre transakcije
User FOR UPDATE
  → AuthPolicyState lock
  → exact EmailVerification FOR UPDATE
  → DB clock i expiry provera
  → strict snapshot/policy odluka i next revision claims
  → pripremi JWE i kompletan HTTP odgovor, ali ga još ne vraćaj
  → conditional User verified + revision bump
  → delete svih starih Session redova
  → insert tačno nove Session digest vrednosti
  → exact consume i cleanup verification siblings
  → commit
  → tek sada vrati unapred pripremljen cookie/response
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

## 12. Test matrica

Faza 2 već zaključava canonical 32-byte SID, stabilan domain-separated HMAC,
odsustvo raw SID-a u DB-u, strict claim oblik, exact expiry, revision mismatch,
fresh DB principal, strict/staged policy odluku, exact revoke, UTC stabilnost i
legacy reserved-namespace preflight.

Faza 4 je lokalno dodala izolovane real-PG fixture-e za HMAC-only credentials
insert, stale bcrypt CAS, non-UTC clock, verification rotation i rollback.
Faza 5 dodaje exact current-session revoke, replay i očuvanje sibling sesije.
Faza 6 dodaje strict V2-only cookie reassembly, decode→DB guard, fresh profile
projekciju, exact revoke i centralnu customer/admin tri-state access semantiku.
Activation/race faze još moraju dodati sledeće integrisane dokaze:

- immutable `sae` kroz proizvoljno mnogo session refresh zahteva;
- stvarni Next 16 Proxy production bundle/runtime sa custom decoderom;
- Credentials sign-in → refresh → exact expiry sa atomski upisanim DB redom;
- DB role/database UTC readiness za default/runtime write putanje;
- login-vs-reset/change/role race;
- policy bump-vs-session issuance race;
- konkurentna verification rotacija i cross-device HTTP/cookie rezultat;
- kompletan raw chunked JWE → HTTP logout → `Set-Cookie` tok;
- DB outage kao 503, nikada kao guest ili stara JWT dozvola;
- direktan poziv svake admin API rute bez oslanjanja na proxy;
- statičku allow-listu jedinih dozvoljenih raw `getToken`/`getServerSession`
  call-site-ova;
- schema expand→contract prelaz i fail-closed invalid fixture-e.

## 13. Rollout i rollback rizici

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

## 14. Preostali redosled posle ove sekcije

Kada DB-authoritative session paket dobije exact-head i post-merge V2 dokaz,
redosled ukupnog projekta ostaje:

1. shared limiter i eksplicitan trusted-proxy/client-IP ugovor;
2. transactional auth-email outbox i durable worker;
3. hash-only token write, TTL+grace čekanje i contract migracija;
4. produkcioni DB setup/readiness, backup/restore i staging gate-ovi;
5. sadržaj, pravni, payment, observability i ostali live checklist gate-ovi;
6. tek na kraju main-push GitHub workflow i stvarno live puštanje.

## 15. Git/CI evidencija ove sekcije

Ova tabela se popunjava isključivo stvarnim dokazima. Trenutno nijedan pending
red nije tvrdnja o uspehu.

| Dokaz | Vrednost |
| --- | --- |
| Base V2 SHA | `d926e152f51f363c66d37f46859fbecffbc634d2` |
| Prvi expand commit | `9316e0eb5fff627d577badc9fdaf2c0b2a73734b` |
| V2-only PR | [draft PR #22](https://github.com/biozencaj-stack/narodnanosnja/pull/22) |
| Prvi expand CI run | [run `33326003849`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33326003849), attempt 1, `SUCCESS` |
| PostgreSQL 16 migration/invariant | `PASS` u run-u `33326003849` |
| Kasniji `SET LOCAL TIME ZONE 'UTC'` red u expand migraciji | nije obuhvaćen starim run-om `33326003849`; mora proći novi exact-head PostgreSQL run |
| Dormantni core commit | `baa39bdc0dfb4184c42e8d12c5c13a6a45baf39b` |
| Dormantni core exact-head CI run | [run `33327741687`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33327741687), attempt 1, `SUCCESS` |
| Dormantni core PostgreSQL/session/preflight fixture-i | `PASS` u run-u `33327741687` |
| Dormantni core E2E/build | `PASS` u run-u `33327741687` |
| Faza 3 revocation commit | `0790ccdb8e686b3a7e2358e8aecf11b2255bdbdc` |
| Faza 3 exact-head CI | [run `33328617960`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33328617960), attempt 1, `SUCCESS` |
| Faza 3 PostgreSQL/session/E2E/build | `PASS`; release i deploy poslovi `SKIPPED` |
| Faza 4 dormant issuance/rotation commit | `098cfcfed53666ab09b408243b2667355800bd80` |
| Faza 4 prvi real-PG pokušaj | [run `33329700089`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33329700089), credentials Belgrade fixture `FAIL`; release/deploy `SKIPPED` |
| Faza 4 transaction-local UTC commit | `027b806950fc768cc9fa5ec9a83f1689e226b651` |
| Faza 4 drugi real-PG pokušaj | [run `33330178183`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33330178183), isti coarse credentials ishod `FAIL`; ostali pre-test gate-ovi `PASS`, release/deploy `SKIPPED` |
| Faza 4 apsolutni timestamp/coarse-stage commit | `e773a91150e2ea765e41b54fc8fff307d77fc6e5` |
| Faza 4 treći real-PG pokušaj | [run `33330591629`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33330591629), `FAIL` pre transakcije; coarse faze `[]` otkrile predug fixture email; release/deploy `SKIPPED` |
| Faza 4 canonical-fixture commit | `6a42e49226f85e4c0c185d136878529dc17dc1b9` |
| Faza 4 zeleni exact-head dokaz | [run `33330847915`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33330847915), attempt 1, PostgreSQL/session/E2E/build `SUCCESS`; release/deploy `SKIPPED` |
| Faza 5 logout commit | `6af8114b6b255c6f99886794d148c9251e59e936` |
| Faza 5 zeleni exact-head dokaz | [run `33331632579`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33331632579), attempt 1, PostgreSQL/session/E2E/build `SUCCESS`; release/deploy `SKIPPED` |
| Faza 6 dormantni guard commit | `c9f7849691fbeee1922d40c5d3959454961d5aab` |
| Faza 6 dormantni guard exact-head dokaz | [run `33333262290`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33333262290), attempt 1, PostgreSQL/session/E2E/build `SUCCESS`; release/deploy `SKIPPED` |
| Faza 6 tranzicioni legacy-only facade commit | `d08fa32e40b1476b8d587ef596ff5119be4f7f59` |
| Faza 6 tranzicioni facade exact-head dokaz | [run `33334129994`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33334129994), attempt 1, PostgreSQL/session/E2E/build `SUCCESS`; release/deploy `SKIPPED` |
| Faza 6 mrtvi route cleanup/source inventory commit | `23501d592724a709000160cc68058ccac7a74beb` |
| Faza 6 source inventory exact-head dokaz | [run `33336276720`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33336276720), attempt 1, PostgreSQL/session/E2E/build `SUCCESS`; release/deploy `SKIPPED` |
| Faza 6 checkout-data consumer batch | lokalno u radu; čeka završni pregled, stabilan commit i exact-head run |
| Feature merge SHA | nije izvršen |
| Post-merge V2 run | nije izvršen |
| Release/deploy jobs | moraju ostati `SKIPPED` |
| V2 release tagovi | mora ostati `0` |
| Deployment zapisi | mora ostati `0` |
| Produkcijska baza/server/live | **NIJE RAĐENO** |
