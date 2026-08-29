# GitHub Actions objavljivanje

Workflow `.github/workflows/objavi.yml` proverava svaki pull request ka `main`
i svaki push na `main`. Pull request pokreće samo CI proveru i nikada ne pokreće
produkcijski deploy. Svaki push na `main` posle uspešne provere automatski
objavljuje novu verziju. Workflow može da se pokrene i ručno iz GitHub Actions
kartice.

## GitHub podešavanja

U `Settings → Environments` najpre kreirati environment `production`. U
njegovom odeljku `Deployment branches and tags` izabrati custom branch policy
i dozvoliti samo granu `main`. Produkcijske vrednosti je preporučeno čuvati u
tom environmentu, umesto u širem repository scope-u.

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

Required reviewers nisu obavezni i ne treba ih uključiti ako je cilj da svaki
uspešan push na `main` automatski objavi novu verziju. Mogu se privremeno
uključiti samo tokom kontrolisanog prvog produkcijskog puštanja.

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
2. Kod se šalje u novu `$DEPLOY_PATH/releases/<commit>-<attempt>` fasciklu.
3. Produkcijski `.env` i `public/uploads` ostaju shared podaci i povezuju se
   simboličkim linkovima; korisničke slike se nikada ne brišu rsync-om.
4. Novi release se gradi i pokreće na privremenom lokalnom portu.
5. Tek posle uspešnog `/api/health` odgovora `current` link se atomski prebacuje
   i PM2 pokreće novu verziju.
6. Ako lokalna ili javna provera padne, skript automatski vraća prethodni
   release. Čuva se poslednjih pet release-a.

Deploy i cleanup starih release direktorijuma koriste isti server-side
`flock`, pa ni prekinuta SSH sesija ne može napraviti trku u kojoj se upravo
aktivirani release obriše. To nije reservation-cleanup scheduler, koji je
zasebna oneshot jedinica opisana iznad.

Javni health endpoint vraća `deployment` SHA, pa workflow proverava da server
zaista servira commit koji je upravo poslat, a ne samo neku prethodnu zdravu
verziju.

## Prvi push

Lokalni repozitorijum mora imati GitHub remote i `main` mora biti poslat na taj
remote. Sam fajl workflow-a ne kreira GitHub repozitorijum niti postavlja
secrets. Kada su prethodna podešavanja završena, svaki sledeći push na `main`
automatski pokreće ovaj tok.
