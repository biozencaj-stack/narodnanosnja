# V2 rollout: bezbedan prelazak

Ova grana menja Prisma šemu i **ne sme** direktno na postojeću produkcionu
bazu. Kod je kompatibilno proširen, ali baza prvo mora dobiti nove
order/payment kolone, payment event dnevnik i expand-only kataloške tabele.

## Šta šema dodaje

- `Order.checkoutIdempotencyKey`, `Order.currency`,
  `Order.inventoryAllocated` i `OrderItem.inventoryStockId` za replay-safe
  checkout, pouzdan payment/inventory tok i precizno vraćanje rezervisane
  zalihe;
- `PROCESSING`/`REVIEW` payment statuse i neizmenjivi `PaymentEvent` dnevnik;
- opcioni `Product.productTypeId`;
- modele generičkog kataloga navedene u `CATALOG-MIGRATION-PLAN.md`.

Ništa postojeće se ne uklanja. `ProductSize` ostaje aktivni izvor zalihe dok
se generičke varijante ne popune i ne provere.

## Obavezan redosled

1. Napraviti proverljiv PostgreSQL backup i testirati restore.
2. Klonirati produkcionu bazu u izolovano staging okruženje.
3. Potvrditi da realna šema odgovara current-state baseline-u i, nad postojećom
   produkcionom bazom bez Prisma istorije, evidentirati baseline kao primenjen
   prema `docs/PRISMA-BASELINE.md`.
4. Pokrenuti samo četiri već pregledane i checksumovane migracije iz aktivnog
   lanca. Ne generisati novi expand SQL i ne koristiti `prisma db push`.
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
- za SMTP potvrditi host, credential-e, sender i port kontrolisanim testom:
  465 koristi implicitni TLS, ostali portovi zahtevaju STARTTLS, a
  `SMTP_TLS_REJECT_UNAUTHORIZED` mora ostati `true` u produkciji;
- `APPLY_DATABASE_MIGRATIONS=true` koristiti samo u kontrolisanom izdanju sa
  kompletnim migration chain-om. U redovnom deployu ostaje isključeno.

## Legacy preflight i maintenance prozor

Za svaku buduću postojeću bazu, pre backup-a i bilo kakve migracije pokrenuti
read-only proveru:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db-legacy-preflight.sql
```

Skripta radi u `READ ONLY` transakciji, postavlja `lock_timeout=5s` i
`statement_timeout=60s`, ne menja podatke i završava sa `ROLLBACK`. Ona prekida
izvršavanje jasnom porukom ako pronađe exact ili `lower(trim(...))` duplikate
veličina, nevalidne nazive veličina, negativne cene/zalihe/mere/order iznose,
nevalidnu količinu ili aktivan legacy proizvod bez ijednog stock reda. Svaki
nalaz mora biti očišćen kontrolisanom, posebno pregledanom data migracijom, a
preflight potom ponovljen do uspeha.

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
`migration.sql` fajla su nepromenljiva istorija; svaka buduća promena ide u
novu migraciju, nikada izmenom njihovog sadržaja ili checksum-a.

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
