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
nad postojećim tabelama. Izvršena je tačno jednom, a zatim su tri V2 expand
migracije primenjene sa `prisma migrate deploy`. Završne provere potvrđuju četiri
završene migracije, nulti schema drift i očuvane postojeće podatke.

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
izvršava baseline SQL i zatim sve kasnije expand migracije redom.

Ne koristiti `prisma db push` za produkciju. Baseline se ne menja nakon što je
evidentiran kao primenjen; svaka naredna promena šeme dobija novu migraciju.
