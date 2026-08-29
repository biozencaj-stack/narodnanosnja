# GitHub Actions objavljivanje

Workflow `.github/workflows/objavi.yml` automatski proverava i objavljuje svaki
push na `main`. Može se pokrenuti i ručno iz GitHub Actions kartice.

## GitHub podešavanja

U `Settings → Secrets and variables → Actions` dodati repository secrets:

- `SSH_PRIVATE_KEY` — zaseban privatni deploy ključ bez passphrase-a;
- `SSH_KNOWN_HOSTS` — unapred verifikovan known-hosts red za produkcioni server;
- `SERVER_HOST` — hostname ili IP servera;
- `SERVER_USER` — ograničeni deploy korisnik koji poseduje deploy direktorijum
  i svoj PM2 proces.

Dodati repository variables:

- `PRODUCTION_URL` — puna javna adresa sajta, privremeno može biti
  `http://IP:8090`, a nakon domena treba da bude HTTPS;
- `SERVER_PORT` — opciono, podrazumevano `22`;
- `DEPLOY_PATH` — opciono, podrazumevano `/var/www/narodnanosnja`.

`SSH_KNOWN_HOSTS` se ne generiše u workflow-u. Uzmite host ključ sa pouzdanog
računara, uporedite fingerprint sa serverom i tek onda ceo izlaz sačuvajte kao
secret. Za nestandardni SSH port red mora sadržati `[host]:port` oblik.

Preporuka je da se secrets dodaju i u GitHub environment `production`. Ako taj
environment dobije required reviewers, svaki main push će proći provere, ali će
objavljivanje čekati ručno odobrenje.

## Zahtevi na serveru

- Node.js 22, npm, PM2, rsync, curl i `flock`;
- postojeći `$DEPLOY_PATH/.env` sa produkcionim tajnama;
- deploy korisnik ima write pristup `$DEPLOY_PATH` i upravlja PM2 procesom
  `narodnanosnja`;
- PostgreSQL je dostupan i njegova šema je već usklađena sa Prisma šemom.

Workflow namerno ne primenjuje migracije. Ako Prisma otkrije razliku između
baze i koda, deploy staje pre aktivacije. Migracija se prvo pregleda i primenjuje
po proceduri iz `V2-ROLL-OUT.md`, pa se workflow ponovo pokrene.

Kartično plaćanje ostaje isključeno u produkcionom `.env` dok nisu završeni svi
uslovi iz rollout dokumenta.

## Kako deploy radi

1. GitHub runner instalira zaključane zavisnosti, validira Prisma/TypeScript,
   izvršava sigurnosne testove i pravi probni production build.
2. Kod se šalje u novu `$DEPLOY_PATH/releases/<commit>-<attempt>` fasciklu.
3. Produkcijski `.env` i `public/uploads` ostaju shared podaci i povezuju se
   simboličkim linkovima; korisničke slike se nikada ne brišu rsync-om.
4. Novi release se gradi i pokreće na privremenom lokalnom portu.
5. Tek posle uspešnog `/api/health` odgovora `current` link se atomski prebacuje
   i PM2 pokreće novu verziju.
6. Ako lokalna ili javna provera padne, skript automatski vraća prethodni
   release. Čuva se poslednjih pet release-a.

Deploy i cleanup koriste isti server-side `flock`, pa ni prekinuta SSH sesija
ne može napraviti trku u kojoj se upravo aktivirani release obriše.

Javni health endpoint vraća `deployment` SHA, pa workflow proverava da server
zaista servira commit koji je upravo poslat, a ne samo neku prethodnu zdravu
verziju.

## Prvi push

Lokalni repozitorijum mora imati GitHub remote i `main` mora biti poslat na taj
remote. Sam fajl workflow-a ne kreira GitHub repozitorijum niti postavlja
secrets. Kada su prethodna podešavanja završena, svaki sledeći push na `main`
automatski pokreće ovaj tok.
