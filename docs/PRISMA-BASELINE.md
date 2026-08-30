# Prisma produkcioni baseline

Aktivni Prisma migracioni lanac počinje migracijom
`20260829000000_baseline_production_before_v2`. Ona predstavlja schema-only
snimak produkcione PostgreSQL šeme neposredno pre V2 expand migracija.

Baseline je namerno normalizovan za Prisma Migrate izvršavanje. Iz izvornog
`pg_dump` sadržaja uklonjeni su promenljivi header i `psql`-only
`\\restrict`/`\\unrestrict` tokeni, a dump naredba koja postavlja prazan
`search_path` zamenjena je sa:

```sql
SET search_path = public, pg_catalog;
```

Ovo ne menja snimljene tabele, tipove, indekse ni ograničenja. Sprečava da
Prisma u istoj sesiji posle baseline-a izgubi `public` šemu i prijavi `P1014`
za sopstvenu `_prisma_migrations` tabelu.

Baseline već sadrži lokalizovane JSONB kolone i `User.preferredLocale`.
Prethodna parcijalna localized-JSON migracija zato je uklonjena iz aktivnog
`prisma/migrations` direktorijuma i sačuvana samo kao istorijska referenca u
`docs/migration-archive`. Ne sme se izvršavati posle baseline-a.

## Aktivni lanac naspram produkciono primenjenog stanja

Aktivni Git lanac trenutno ima osam SQL migracija. To nije isto što i osam
produkcijski primenjenih migracija:

| Redosled | Migracija | Produkcijski status ovog preseka |
| ---: | --- | --- |
| 1 | `20260829000000_baseline_production_before_v2` | evidentirana kao primenjena |
| 2 | `20260829010000_add_payment_status_processing` | primenjena |
| 3 | `20260829010100_add_payment_status_review` | primenjena |
| 4 | `20260829020000_expand_v2_platform` | primenjena |
| 5 | `20260830000000_expand_hashed_auth_tokens` | dokazana samo na praznoj izolovanoj CI bazi; nije primenjena na produkciju |
| 6 | `20260830010000_expand_email_verification_cooldown` | PASS u exact-head run-u `33317607438` i post-merge run-u `33317787952` na praznoj izolovanoj PostgreSQL 16 bazi; nije primenjena na produkciju |
| 7 | `20260830020000_expand_verified_login_grace` | PASS u exact-head run-u `33324304744` i post-merge run-u `33324541873` na praznoj izolovanoj PostgreSQL 16 bazi; nije primenjena na produkciju |
| 8 | `20260830030000_expand_authoritative_sessions` | PASS u prvom izolovanom draft-PR run-u `33326003849` na praznoj PostgreSQL 16 bazi; nije primenjena na produkciju, a runtime aktivacija nije izvršena |

Zato je tačna produkcijska tvrdnja i dalje: četiri završene migracije iz ranijeg
kontrolisanog prozora. Prisustvo pete, šeste, sedme i osme migracije u
repozitorijumu nije dokaz da ih produkciona `_prisma_migrations` tabela sadrži
ili da server može bez dodatne probe da pokrene novi kod. Produkciona baza nije
migrirana, čitana niti menjana tokom verified-login/session etape.

## Produkciona baza

Pre kontrolisane migracije 29. avgusta 2026. produkcija nije imala Prisma
migracionu istoriju, a njena šema je odgovarala ovom baseline-u. Posle
obaveznog backup/restore testa i završnog schema diff-a, baseline je nad
postojećom bazom evidentiran kao primenjen:

```bash
npx prisma migrate resolve \
  --applied 20260829000000_baseline_production_before_v2
```

Ova komanda je upisala Prisma migracionu evidenciju; nije izvršila baseline SQL
nad postojećim tabelama. Izvršena je tačno jednom, a zatim su tri tada postojeće
V2 expand migracije primenjene sa `prisma migrate deploy`. Završne provere tog
istorijskog prozora potvrđuju četiri završene migracije, nulti schema drift i
očuvane postojeće podatke. Četiri kasnije auth migracije nisu deo te tvrdnje.

## Auth-token compat expand

`20260830000000_expand_hashed_auth_tokens` dodaje nullable unique `tokenHash`
u `PasswordReset` i `EmailVerification`, čini plaintext `token` nullable i
uvodi unique `PasswordReset.userId`. To je compat/expand, ne hash-only contract.
Current kod još privremeno dual-write čuva raw token i purpose-separated hash.

Pre produkcione primene obavezni su:

1. read-only audit duplih `PasswordReset.userId` redova;
2. proverljiv backup i restore klon;
3. eksplicitno razrešenje svakog duplikata, jer migracija fail-closed ne radi
   automatski DML cleanup;
4. lock/statement-time plan i merenje na restore klonu;
5. `prisma migrate status`, drift i DB invariant smoke posle primene;
6. tek zatim compat runtime dokaz, odvojeni hash-only write presek, najduži TTL
   plus grace i posebna contract migracija.

Ako timeout/preflight prekine migraciju i Prisma je evidentira kao failed, ne
ponavljati deploy naslepo. Prvo potvrditi PostgreSQL rollback i stvarno stanje,
otkloniti uzrok, pa tek zatim kontrolisano izvršiti:

```bash
npx prisma migrate resolve \
  --rolled-back 20260830000000_expand_hashed_auth_tokens
```

`resolve` nije način da se prikrije delimično ili neistraženo stanje.

## Verification-email cooldown expand

`20260830010000_expand_email_verification_cooldown` dodaje tri `User` kolone:

| Kolona | Prisma/PostgreSQL ugovor |
| --- | --- |
| `verificationEmailNextAllowedAt` | nullable `DateTime?` / `timestamp(3) without time zone`, bez defaulta |
| `verificationEmailResendWindowStartedAt` | nullable `DateTime?` / `timestamp(3) without time zone`, bez defaulta |
| `verificationEmailResendCount` | nullable `Int?` / `integer`, bez defaulta |

Migracija nema `INSERT`, `UPDATE`, `DELETE`, backfill, dedicated indeks ili
default. Legacy User sa sva tri `NULL` polja ostaje kompatibilan sa starijim
kodom, a novi resend servis njegov prvi zahtev tretira kao početak svežeg
fiksnog 24-časovnog prozora sa brojem `1`.

SQL koristi:

```sql
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';
```

Dodavanje nullable kolona bez defaulta je metadata-only na podržanom
PostgreSQL-u, ali `ALTER TABLE` ipak zahteva kratak `ACCESS EXCLUSIVE` lock.
Zato se ni ova migracija ne primenjuje pod pretpostavkom da je „besplatna”.
Potrebni su restore-clone proba, pregled dugih transakcija/blokera, eksplicitan
maintenance/lock prozor i post-migration smoke.

DB invariant smoke proverava postojanje, nullability, tip, precision, odsustvo
defaulta i odsustvo dedicated single-column throttle indeksa. Equality pristup
u runtime-u koristi već postojeći User ID, pa dodatni write-overhead indeksa
nije uveden.

Ako Prisma evidentira ovu migraciju kao failed, recovery je analogan auth-token
koraku: prvo potvrditi rollback i otkloniti lock/schema uzrok. Tek zatim, uz
pregledano stvarno DB stanje, može se koristiti:

```bash
npx prisma migrate resolve \
  --rolled-back 20260830010000_expand_email_verification_cooldown
```

Produkcijska baza nije čitana, menjana ili korišćena za test ove etape.
Exact-head run `33317607438` na feature
`964831f490b54a3f5b11ec0cecce8b562551d4d8` i post-merge run `33317787952`
na `15c18cf1de19ceee4de4a06eff28bf7114d3fc19`, oba attempt 1 SUCCESS,
primenila su ceo migration chain na praznom izolovanom PostgreSQL 16 servisu i
zatim prošla drift, DB invariant smoke i svih 8 PostgreSQL test scenarija. To
je CI dokaz šeme, ne produkcijska primena.

## Verified-login grace expand

`20260830020000_expand_verified_login_grace` dodaje samo jednu `User` kolonu:

| Kolona | Prisma/PostgreSQL ugovor |
| --- | --- |
| `emailVerificationLoginGraceUntil` | nullable `DateTime?` / `timestamp(3) without time zone`, bez defaulta i bez dedicated indeksa |

Ovo je expand-only kompatibilnost za budući kontrolisani `staged` prelaz.
Migracija nema `INSERT`, `UPDATE`, `DELETE`, backfill ili automatsko
označavanje korisnika kao verifikovanih. Zatečeni i novi redovi zato posle DDL-a
imaju `NULL` dok zasebna, pregledana data odluka eventualno ne dodeli jedan
odobreni rok samo odgovarajućim legacy CUSTOMER nalozima. `NULL` ne znači
verifikovan nalog i ne sme se pretvarati u `emailVerified` bez poslovnog dokaza.

SQL koristi isti hardened operativni okvir kao cooldown expand:

```sql
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';
```

Nullable kolona bez defaulta je metadata-only na podržanom PostgreSQL-u, ali
`ALTER TABLE "User"` i dalje traži kratak `ACCESS EXCLUSIVE` lock. Pre
produkcione primene obavezni su svež backup/restore klon, merenje locka,
pregled blokera, maintenance prozor i post-migration `migrate status`, drift i
`scripts/db-invariant-smoke.sql`. Ako migracija bude evidentirana kao failed,
prvo potvrditi rollback i otkloniti uzrok; tek zatim se sme razmatrati:

```bash
npx prisma migrate resolve \
  --rolled-back 20260830020000_expand_verified_login_grace
```

Sama sedma migracija ne dozvoljava `staged` ili `strict` login. Produkcioni
runtime mora ostati na `AUTH_VERIFIED_LOGIN_POLICY=audit` dok se ne uvedu DB
revalidacija/revokacija rolling JWT sesija i shared limiter sa pregledanim
trusted-proxy/client-IP ugovorom. Read-only preflight namerno uvek emituje
`preflight.jwt_session_revalidation.unavailable|1` i završava neuspehom dok se
taj zasebni bezbednosni paket ne implementira i gate ne izmeni.

## DB-authoritative session compatibility expand

`20260830030000_expand_authoritative_sessions` je compatibility expand, ne
runtime aktivacija. Dodaje `User.authSessionRevision`, nullable V2 metapodatke
na `Session`, indeks isteka i strogo ograničen `AuthPolicyState` singleton koji
počinje u `(revision=1, policy='audit')`. Legacy Session red ostaje dozvoljen
samo ako su sva tri nova metadata polja `NULL` i njegov token ne koristi
rezervisani V2 namespace `v1:<64 lowercase hex>`.

Zbog poslednjeg uslova, pre ove migracije se na restore klonu, a zatim ponovo u
odobrenom maintenance prozoru, obavezno pokreće zaseban aggregate-only gate:

```bash
psql -X "$PSQL_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-session-expand-preflight.sql
```

`PSQL_DATABASE_URL` ovde znači odobren libpq/psql URI bez Prisma-only
`schema=public` parametra. Skripta radi u `REPEATABLE READ READ ONLY`
transakciji, uzima samo `ACCESS SHARE`, koristi UTC i ograničene timeout-e i
ispisuje tačno zbirni nalaz
`preflight.session.legacy_reserved_v1_token|count`. Proverava sve Session
redove, uključujući istekle. Ne ispisuje token, row/user ID, email ili vreme.

Nulti nalaz završava uspešno. Nenulti nalaz završava `psql` statusom `3` i mora
se rešiti posebno odobrenom revokacijom/rotacijom legacy sesija, pa gate
ponoviti. Skripta ništa ne briše; automatsko brisanje Session redova nije
dozvoljena preflight radnja. Posle expand-a postojeći JWT tok i dalje ostaje
nepromenjen sve dok se atomsko izdavanje, revokacija, DB guardovi, logout i
race testovi ne aktiviraju u kontrolisanom V2 preseku.

## Read-only email-verification audit granice

Pre auth expand migracija koristi se isključivo baseline-safe audit:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-legacy.sql
```

On namerno odbija šemu na kojoj postoji bilo koja od tri auth expand promene.
Posle kontrolisane primene sve tri auth migracije koristi se current audit:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/auth-email-verification-audit-current.sql
```

Obe skripte rade u `REPEATABLE READ READ ONLY` transakciji, uzimaju samo
`ACCESS SHARE` lockove, mere PostgreSQL sat tek posle lockova, ispisuju samo
`category|count` agregate bez emaila, ID-a, credentiala ili timestampova i
završavaju sa `ROLLBACK`. Audit nije backfill i nije dozvola za promenu podataka.

Staged enforcement preflight se nad current šemom poziva sa sve tri obavezne
`psql` promenljive:

```bash
psql -X "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -v target_policy=staged \
  -v legacy_cutoff='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -v grace_deadline='YYYY-MM-DDTHH:MM:SS.mmmZ' \
  -f scripts/auth-email-verification-enforcement-preflight.sql
```

Oba vremena moraju biti tačan kanonski UTC oblik sa milisekundama. Cutoff ne
sme biti u budućnosti; jednakost pripada novim nalozima (`createdAt >= cutoff`).
Grace deadline mora biti najmanje 7 i najviše 30 dana posle DB vremena
preflight-a, a svaki non-`NULL` grace u bazi mora biti tačno jednak tom jednom
odobrenom roku. Skripta prihvata isključivo `target_policy=staged`; `strict` je
namerno zaseban budući gate. Trenutno će uvek vratiti izlazni status `3`,
`preflight.ready|0` i blocker
`preflight.jwt_session_revalidation.unavailable|1`. To je očekivano fail-closed
stanje, ne nalaz koji treba ručno zaobići.

## Baza koja već beleži arhiviranu localized migraciju

Pre baseline postupka obavezno pokrenuti `prisma migrate status` i read-only
upit nad `_prisma_migrations`. Ako baza već ima uspešan zapis
`20250226120000_add_localized_json_fields`, ne pokretati aktuelni lanac i ne
koristiti `migrate reset`: takva baza ima drugačiju istoriju od produkcije na
kojoj je ovaj baseline napravljen.

Postupak za takvu instalaciju je:

1. napraviti proverljiv backup i sve raditi najpre na restore klonu;
2. potvrditi da su localized kolone stvarno prisutne i da cela šema odgovara
   current-state baseline-u;
3. sačuvati kompletan sadržaj postojeće `_prisma_migrations` evidencije;
4. napraviti zaseban, DBA-pregledan plan usklađivanja istorije kojim se stari
   redundantni zapis uklanja ili arhivira, a current-state baseline evidentira
   kao primenjen bez ponovnog DDL-a;
5. dokazati na klonu da `migrate status`, `migrate deploy`, drift, countovi i DB
   invariant smoke prolaze, pa tek onda ponoviti isti tačan postupak u
   maintenance prozoru.

Ne postoji bezbedna univerzalna komanda za baze sa dodatnim migracijama. Ako
istorija sadrži bilo šta osim tog jednog očekivanog zapisa, postupak se
zaustavlja i pravi se poseban reconciliation plan; `_prisma_migrations` se ne
menja ručno na produkciji bez klon-probe, backupa i eksplicitnog odobrenja.

## Nova ili prazna baza

Nad praznom PostgreSQL bazom ne koristi se `resolve`. `prisma migrate deploy`
izvršava baseline SQL i zatim svih šest kasnijih migracija redom. Posle toga su
obavezni schema drift i `scripts/db-invariant-smoke.sql`; sama činjenica da je
komanda završila nije kompletan dokaz. Izolovana prazna CI baza nije zamena za
restore-clone ili produkcioni audit legacy podataka i lockova.

Ne koristiti `prisma db push` za produkciju. Baseline se ne menja nakon što je
evidentiran kao primenjen; svaka naredna promena šeme dobija novu migraciju.
