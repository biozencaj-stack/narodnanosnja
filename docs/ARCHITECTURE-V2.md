# V2 arhitektura univerzalne prodavnice

## Odluka

Platforma je **white-label prodavnica po instalaciji**. Jedan deployment
predstavlja jednu prodavnicu i jednu bazu. Isti commerce core se koristi za
narodnu nošnju, odeću, obuću, hranu i druge delatnosti, dok se identitet,
tema, uključene funkcije i kataloška šema podešavaju bez forkovanja koda.

Multi-tenant SaaS nije deo ove faze. Uvođenje tenant scope-a u svaku tabelu,
keš, autorizacionu proveru i storage bez stvarne potrebe bi povećalo rizik od
curenja podataka i usporilo razvoj prodavnice.

## Slojevi koji se ne mešaju

1. **Commerce core** — korpa, serverski quote, porudžbine, zalihe, promocije,
   plaćanja, korisnici i autorizacija.
2. **Kataloška šema** — `ProductType`, definicije atributa, opcije i varijante.
   Branša određuje podatke, ne novu strukturu aplikacije.
3. **Store configuration** — naziv, kontakt, SEO, poslovna pravila, semantička
   paleta i capability flagovi.
4. **Presentation** — storefront sekcije i admin UI čitaju prethodna tri sloja;
   ne ugrađuju cene dostave, naziv prodavnice ili pretpostavku o odeći u kod.
5. **Integracije** — payment, email, ERP, dostava i analitika se povezuju kroz
   male adaptere sa jasnim statusima i idempotentnim događajima.

## Obavezne invarijante

- Browser nikada nije izvor cene, popusta, dostave ili dostupne zalihe.
- Anti-bot token mora biti vezan za poslovnu akciju na serveru; klijentska
  „provera” sama po sebi ne štiti javni API.
- Checkout rezerviše zalihu i kreira porudžbinu u jednoj serijalizovanoj
  transakciji.
- Client-generated, DB-unique checkout ključ čini create-order replay
  idempotentnim; izgubljen HTTP odgovor ne sme napraviti novu rezervaciju.
- Prikaz korpe i recovery koriste serverske line cene i originalni snapshot
  porudžbine, ne zastarelu cenu ili kasnije izmenjenu korpu.
- Payment callback je potpisan, idempotentan i ne sme vratiti terminalno stanje
  unazad; konflikt ide na ručni pregled.
- Terminalni decline/cancel u istoj transakciji najviše jednom vraća i zalihu
  i rezervisani kupon.
- Snapshot porudžbine ostaje čitljiv i kada se proizvod ili njegova šema kasnije
  promene.
- Admin je deny-by-default: svaka nova ruta mora eksplicitno dobiti ulogu.
- Arhiviranje čuva istoriju; fizičko brisanje poslovnih podataka nije normalan
  admin tok.
- Promena settings-a mora odmah dati isti rezultat u storefrontu, korpi,
  checkoutu, emailu i SEO metapodacima.

## Industrijski paketi

„Paket” je seed/config, ne fork aplikacije. Na primer:

- narodna nošnja: pol, region, deo kompleta, materijal, ručni rad, veličina;
- obuća: EU broj, kalup, materijal, sezona;
- hrana: masa/zapremina, sastojci, alergeni, rok, režim čuvanja;
- dekoracija: dimenzije, materijal, stil i način montaže.

Svaki paket može uključiti podrazumevane tipove proizvoda, atribute, navigaciju,
filtere, demo sadržaj i capability flagove. Podaci koji utiču na bezbednost ili
obračun i dalje prolaze kroz isto commerce jezgro.

## Admin ciljna mapa

- Dashboard i operativni inbox
- Katalog: tipovi, atributi, proizvodi, varijante, mediji, kolekcije i bundle-i
- Zalihe: lokacije, rezervacije, prijem, korekcije, pragovi i istorija
- Porudžbine: statusi, isporuke, refundacije, povrati i reklamacije
- Kupci: profili, segmenti, saglasnosti i istorija komunikacije
- Marketing: promocije, kuponi, gift kartice, loyalty i napuštene korpe
- Sadržaj: stranice, navigacija, baneri, SEO, pretraga i redirekcije
- Izveštaji: prodaja, marža, porezi, zalihe, konverzija i eksporti
- Podešavanja: identitet, tema, poslovna pravila, uloge, audit i integracije

Moduli se uvode vertikalno: schema + servis + autorizacija + admin UX + audit +
test. Stavka menija bez završenog toka ne smatra se funkcionalnošću.

## Sledeće faze

1. Pregledana baseline/expand migracija i staging smoke test.
2. Type-driven editor proizvoda, opcija i varijanti sa backfillom legacy polja.
3. Inventory ledger, povrati/refundacije i operativni admin dashboard.
4. Konfigurabilni page builder, filteri po ProductType-u i industrijski seedovi.
5. Adapteri za dostavu, ERP/računovodstvo, naprednu pretragu i analitiku.
