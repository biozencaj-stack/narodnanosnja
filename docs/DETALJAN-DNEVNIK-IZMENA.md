# Detaljan dnevnik dosadašnjih izmena — V2 univerzalna web-shop platforma

> Datum preseka: 29. avgust 2026.<br>
> Projekat: `narodnanosnja-prodavnica`<br>
> Grana: `verzija/v2.0-univerzalna-platforma`<br>
> Lokalna polazna revizija: `f6e3dac`<br>
> GitHub snapshot commit: `3dc757ac6280b77c7951a888ec2d3ad609ddae1d`<br>
> Status dokumenta: V2 feature grana je commitovana i objavljena na GitHub-u; `main` i produkcija nisu promenjeni.

## 1. Svrha dokumenta

Ovaj dokument je detaljan tehnički i funkcionalni zapis promena urađenih u dosadašnjem radu na V2 verziji prodavnice. Napravljen je na osnovu stvarnog Git diff-a, pregleda novih fajlova, provere implementacije i pokrenutih validacija.

Dokument namerno razlikuje četiri vrste stanja:

- **implementirano** — kod postoji u lokalnom projektu;
- **lokalno provereno** — implementacija je prošla navedenu statičku proveru, test ili build;
- **pripremljeno, ali neaktivno** — kod postoji, ali zahteva migraciju baze, konfiguraciju, bankarsku sertifikaciju, Git push ili deploy;
- **nije završeno / poznat rizik** — nalaz revizije ili sledeći potreban korak, a ne gotova funkcionalnost.

Ovo razdvajanje je važno: prisustvo koda u radnom stablu ne znači automatski da je funkcionalnost već aktivna na javnom sajtu.

## 2. Kratak rezime obima

Dosadašnji rad više nije samo vizuelna dorada postojeće prodavnice. Napravljena je osnova za **white-label, single-store commerce platformu** koja se može zasebno instalirati i prilagoditi različitim branšama — narodnoj nošnji, odeći, obući, hrani i drugim vrstama proizvoda.

Glavni pravci rada bili su:

- centralna konfiguracija identiteta, teme, SEO-a i komercijalnih pravila;
- unapređen storefront UI/UX i pristupačnost;
- server-authoritative obračun cena, promocija, dostave i zalihe;
- idempotentno i transakciono kreiranje porudžbine;
- bezbedan guest pristup porudžbini;
- ojačana NestPay integracija i payment state machine;
- generički model tipova proizvoda, atributa, opcija i varijanti;
- centralna admin autorizaciona politika;
- bezbedniji javni formulari, reCAPTCHA i SMTP podešavanja;
- verifikacioni i deployment workflow za svaki push na `main`;
- release-based deployment sa smoke testom i automatskim rollback-om;
- arhitektonska, migraciona i operativna dokumentacija.

Git presek razlikuje funkcionalne promene od naknadne Git normalizacije redova:

| Stavka | Stanje |
| --- | ---: |
| Izmenjeni praćeni fajlovi sa funkcionalnim/sadržajnim promenama | 88 |
| Novi fajlovi, uključujući dnevnik i `.gitattributes` | 39 |
| Novi fajlovi pre dodavanja ovog dnevnika | 37 |
| Dodatni postojeći tekstualni fajlovi promenjeni samo LF/whitespace normalizacijom | 113 |
| Ukupno putanja u staged snapshotu prema staroj lokalnoj bazi | 240 |
| Funkcionalno dodate linije pre LF normalizacije | 5.316 |
| Funkcionalno uklonjene linije pre LF normalizacije | 2.739 |
| Staged insertions/deletions posle LF/whitespace normalizacije | 20.201 / 11.381 |
| Nova dokumenta pre ovog dnevnika | 4 |
| Ciljni automatski testovi | 17/17 prolazi |
| TypeScript provera | prolazi |
| Produkcioni build | prolazi |
| Prisma schema validacija | prolazi |

## 3. Arhitektonska odluka i granice platforme

### 3.1. White-label, ali ne multi-tenant SaaS

V2 je projektovan kao jedna kodna osnova koja se može postaviti kao zasebna prodavnica za jednog trgovca. Identitet, sadržaj, boje, pravila dostave i uključeni moduli mogu se menjati bez grananja commerce logike za svaku branšu.

Ovo trenutno **nije** multi-tenant SaaS u kome više prodavaca deli istu bazu i isti runtime. Ne postoje tenant ID, tenant izolacija podataka, centralno upravljanje pretplatama niti cross-tenant administracija. Svaka instalacija ostaje posebna prodavnica, što smanjuje rizik i složenost prve univerzalne verzije.

### 3.2. Razdvajanje slojeva

Dosadašnji rad ide ka sledećoj podeli odgovornosti:

1. **Store identity/config sloj** — naziv, kontakt, tema, SEO i capability flagovi.
2. **Catalog sloj** — proizvodi, tipovi proizvoda, atributi, opcije i varijante.
3. **Pricing/quote sloj** — jedini autoritativni obračun cena, promocija, dostave i minimuma porudžbine.
4. **Order sloj** — idempotentno kreiranje, snapshot podataka, zaliha i kuponi.
5. **Payment sloj** — payment attempt, callback klasifikacija, payment događaji i state machine.
6. **Storefront sloj** — navigacija, pretraga, katalog, detalj proizvoda, korpa i checkout.
7. **Admin sloj** — upravljanje poslovnim podacima uz deny-by-default autorizaciju.
8. **Deployment sloj** — verifikovan, izolovan release sa health proverom i rollback-om.

### 3.3. Dokumentacija arhitekture

Dodati su sledeći dokumenti:

- `docs/ARCHITECTURE-V2.md` — ciljna V2 arhitektura, granice modula i ključne invarijante;
- `docs/CATALOG-MIGRATION-PLAN.md` — plan bezbednog prelaska sa legacy kataloga na generički model;
- `docs/V2-ROLL-OUT.md` — fazni rollout, produkcioni preduslovi i rollback pristup;
- `docs/GITHUB-DEPLOY.md` — GitHub Actions, potrebne tajne/promenljive i serverski deployment tok.

## 4. Centralna white-label konfiguracija prodavnice

### 4.1. Novi konfiguracioni sloj

Dodati su:

- `lib/config/store-settings-schema.ts`
- `lib/config/store-settings.ts`
- `lib/config/store-identity.ts`
- `lib/config/storefront-url.ts`
- `lib/config/capabilities.ts`
- `components/StoreIdentityProvider.tsx`
- `components/admin/StoreSettingsPanel.tsx`

Uveden je allow-list registar od 24 runtime podešavanja koja administrator sme da menja:

- naziv, slogan i opis prodavnice;
- javni email i telefon;
- adresa i grad;
- Instagram i Facebook URL;
- radno vreme;
- fiksna cena dostave;
- prag za besplatnu dostavu;
- minimalna vrednost porudžbine;
- devet semantičkih boja teme;
- podrazumevani SEO naslov i opis.

Redosled izvora vrednosti je:

1. ugrađene bezbedne podrazumevane vrednosti;
2. početne/fallback vrednosti iz okruženja;
3. dozvoljene vrednosti iz `Setting` tabele.

Vrednost iz baze zato može promeniti javni identitet bez izmene koda, a aplikacija i dalje može da se podigne kada baza privremeno nije dostupna.

### 4.2. Bezbednosna granica settings sistema

`getStoreSettings()`:

- čita samo eksplicitno dozvoljene ključeve;
- ignoriše nepoznate DB ključeve;
- ne šalje tajne klijentskim komponentama;
- vraća fallback konfiguraciju ako DB poziv ne uspe;
- izdvaja poseban commerce prikaz za cenu dostave, besplatnu dostavu i minimum porudžbine;
- generiše skup semantičkih CSS promenljivih teme.

Tajne kao što su SMTP lozinka, reCAPTCHA secret, NestPay StoreKey, session secret i SSH ključ nisu deo `Setting` tabele niti javnog provider-a.

### 4.3. Novi admin panel za podešavanja

`/admin/settings` je prebačen na novi `StoreSettingsPanel` sa tabovima:

- Opšte;
- Izgled;
- Prodaja i dostava;
- SEO.

Panel sadrži:

- live preview teme;
- označavanje nesačuvanih izmena;
- upozorenje pri napuštanju stranice;
- lokalno vraćanje izmena;
- status čuvanja;
- povezivanje poruke greške sa poljem;
- fokusiranje prvog neispravnog polja;
- validaciju kontrasta boja pre čuvanja.

Admin settings API sada:

- dozvoljava mutaciju samo `ADMIN` ulozi;
- prima mapu dozvoljenih ključeva umesto proizvoljnog niza;
- proverava obavezna polja, email, HTTP(S) URL, HEX boje, numeričke granice i dužine;
- zahteva kontrast najmanje `4.5:1` za relevantne parove boja;
- upisuje promene u jednoj Prisma transakciji;
- invalidira settings cache odmah nakon uspešnog čuvanja.

Stara wishlist-notification settings implementacija ostala je kao neizvezena `LegacyAdminSettingsPage` funkcija i predstavlja tehnički dug za kasnije uklanjanje.

### 4.4. Proširen `.env.example`

Primer okruženja je proširen bez upisivanja stvarnih tajni. Dodate su grupe promenljivih za:

- poseban `ORDER_ACCESS_SECRET`;
- naziv, slogan, opis i kontakt prodavnice;
- adresu, grad, radno vreme, društvene mreže i mapu;
- locale i podrazumevanu državu;
- dostavu, besplatnu dostavu i minimalnu porudžbinu;
- capability flagove;
- URL eksternog obrasca za reklamacije;
- SMTP i TLS ponašanje;
- reCAPTCHA prag, dozvoljeni hostname i produkcioni fail-closed režim;
- NestPay test/production HPP URL, callback URL-ove, jezik, valutu, tip transakcije i rate.

## 5. Capability flagovi i prilagodljivost branši

`lib/config/capabilities.ts` centralizuje javne module:

- pouzeće;
- kartično plaćanje;
- prodajna mesta;
- karijera;
- recenzije;
- favorite/wishlist;
- newsletter;
- chat;
- engleski jezik.

Podrazumevano su kartice, prodajna mesta, karijera i engleski isključeni. Flagovi sada utiču na navigaciju, footer, nalog meni, wishlist dugmad, review upite, newsletter, chat, checkout metode plaćanja, pravne linkove i relevantne sitemap stavke.

Direktne stranice za kartično plaćanje, prodajna mesta i favorite vraćaju `404` kada odgovarajući modul nije uključen. Nisu još sve capability kontrole jednake jačine: na primer, karijera je uklonjena iz footera kada je isključena, ali direktna ruta još nije svuda blokirana.

## 6. Dinamički identitet, tema i SEO

### 6.1. Root layout

`app/layout.tsx` sada učitava locale, prevode i javna podešavanja prodavnice. Na `<html>` element postavlja semantičke CSS promenljive, a aplikaciju obavija `StoreIdentityProvider`-om.

Globalni metadata više nije čvrsto vezan za jednu prodavnicu. Koristi aktuelni:

- naziv;
- SEO naslov i opis;
- javni URL;
- kontakt;
- OpenGraph/Twitter identitet.

Organization i WebSite JSON-LD koriste isti konfiguracioni izvor. Serializovani JSON-LD dodatno zamenjuje znak `<` da sadržaj podešavanja ne bi mogao da prekine script kontekst. Google Analytics se renderuje samo kada ID odgovara očekivanom `G-...` obliku.

### 6.2. Kanonski storefront URL

`lib/config/storefront-url.ts` uvodi centralnu validaciju javnog URL-a:

- mora biti apsolutan HTTP(S) URL;
- u produkciji mora biti HTTPS;
- localhost se odbija u produkciji;
- koristi se u globalnom metadata, robots, sitemap i OG generatoru.

Auth layout je dobio dinamički metadata i `noindex, nofollow`.

### 6.3. Semantička tema

`app/globals.css` i root layout uvode runtime CSS promenljive za glavne semantičke boje. Klase poput `bg-primary`, `text-text`, `border-border` i `bg-povrsina` sada prate store settings.

Admin je dobio odvojenu `.admin-theme` paletu, pa administrator ne može slučajno učiniti admin nečitljivim lošim storefront izborom boja.

Tema još nije potpuno univerzalna: više legacy `stone/gray` nijansi, sekundarne izvedene boje i pojedinačni hardkodirani HEX stilovi nisu prebačeni na novi sistem.

### 6.4. Logo i identitet u komponentama

Logo više ne čita naziv direktno iz okruženja, već prima naziv i slogan kao propove. SVG ornament koristi tematske boje. Navbar, footer, auth stranice, mobile menu i deo pravnih stranica koriste `StoreIdentityProvider` ili server settings.

Vizuelni ornament je i dalje specifičan za narodnu nošnju. Upload logotipa, favicon-a, OG slike i hero vizuala još nije deo admin panela.

## 7. Storefront navigacija, layout i pristupačnost

### 7.1. Ujednačen javni layout

Shop i legal layout sada dele isti navbar, footer, cart drawer i search modal. Time su uklonjeni različiti header tokovi između prodavnice i pravnih stranica.

`NavBarWrapper` računa spacer prema tome da li ticker stvarno postoji:

- `6.5rem` kada je ticker prikazan;
- `4rem` kada ticker nije prikazan.

### 7.2. Navbar i mega-menu

Izmene uključuju:

- brend linkovi koriste stabilan slug umesto vidljivog naziva;
- `aria-expanded` i `aria-controls` na kontrolama menija;
- stabilne ID veze između triggera i panela;
- `role="region"` na mega-menu panelu;
- Escape zatvara panel i vraća fokus na trigger;
- capability flagovi sklanjaju nedostupne stavke;
- razmak ispod fiksnog headera više ne pretpostavlja da ticker uvek postoji.

### 7.3. Ticker

Animirana traka više nije screen readeru predstavljena kao beskonačno ponovljen sadržaj. Čitač dobija jednu skrivenu listu poruka, a animirani duplikati su `aria-hidden`.

Dodati su:

- pauziranje i ponovno pokretanje;
- `aria-pressed` stanje;
- pauza na hover;
- dostupno dugme za zatvaranje;
- semantički region.

### 7.4. Globalna pristupačnost

Dodato je:

- globalno „Preskoči na glavni sadržaj” dugme;
- `id="glavni-sadrzaj"` i `tabIndex={-1}` u glavnim layoutima;
- ujednačen `focus-visible` tretman;
- smanjenje/uklanjanje animacija za `prefers-reduced-motion: reduce`;
- `aria-current="page"` u admin navigaciji;
- jasne oznake mobile admin kontrola;
- vidljivo dugme za odjavu u adminu;
- dostupna loading/status/alert stanja u pretrazi, korpi, kuponima i checkoutu.

## 8. Pretraga, katalog i kartice proizvoda

### 8.1. Search modal

Search modal je prebačen sa nekompatibilnog legacy tipa na stvarni lokalizovani `ProductCardData` format.

Pre izmene je očekivao polja koja API više ne vraća (`picture`, `price1`, `price2`), vodio na ID URL i dozvoljavao da sporiji stari zahtev prepiše novi rezultat.

Sada:

- koristi `image1`, `salePrice`, `price`, lokalizovan naziv i slug;
- vodi na kanonski `/product/{slug}`;
- računa i prikazuje jedan procenat popusta;
- prekida zastareli zahtev preko `AbortController`-a;
- ispravno čita `total` i paginaciju;
- objavljuje status rezultata kroz `aria-live`;
- ima loading, error i empty stanje;
- ispravljen je natpis „Populrano” u „Popularno”.

### 8.2. Puna pretraga i paginacija

Search stranica normalizuje negativan ili neispravan `page` na 1 i koristi zajedničku pagination komponentu uz očuvanje query parametara.

Brend stranica više ne pravi pogrešne `/catalog/brend/...` linkove. Koristi postojeći `/catalog/brand/{slug}` put i zajedničku paginaciju.

### 8.3. Mobile filteri

Mobile filter drawer sada:

- ostaje na trenutnoj katalog/kategorija ruti;
- čuva search, sort i per-page parametre;
- menja samo filter parametre kojima upravlja;
- vraća `page` na početak posle promene filtera;
- uračunava izabrane brendove u broj aktivnih filtera;
- podržava oba postojeća oblika `/api/brands` odgovora.

Filteri su još hardkodirani za veličinu, boju, tip i muško/žensko grupisanje. Nisu povezani sa novim generičkim atributskim modelom.

### 8.4. Kartice proizvoda

`LocalProductCard` više nema `<button>` unutar `<Link>`. Slika i naslov imaju odvojene linkove, a wishlist je zasebna kontrola.

Dodatno:

- wishlist dugme ima najmanje 44×44 px;
- koristi `aria-pressed`;
- wishlist se ne inicijalizuje kada je modul isključen;
- `ProductCardData` uključuje `image2` za hover sliku;
- raspoloživa količina se prenosi u cart stavku.

### 8.5. Detalj proizvoda

Detalj proizvoda sada:

- automatski bira jedinu raspoloživu veličinu;
- ne dozvoljava izbor rasprodate opcije;
- koristi `aria-pressed` za izbor;
- proverava količinu iste opcije koja je već u korpi;
- sprečava dodavanje preko poznate zalihe;
- umesto browser `alert()` prikazuje jasno stanje CTA dugmeta;
- preskače review upit i review UI kada je modul recenzija isključen;
- koristi dinamičan seller naziv u metadata/JSON-LD.

## 9. Server-authoritative quote i obračun cena

### 9.1. Ključna promena poverenja

Browser više nije izvor istine za cenu, popust, dostavu ili total. On šalje samo:

- `productId`;
- izabranu legacy opciju `size`;
- `quantity`;
- opciono `couponCode`.

`lib/checkout/quote.ts` zatim:

1. normalizuje ulaz i spaja duple redove istog proizvoda/opcije;
2. ograničava korpu na najviše 100 redova;
3. dozvoljava količinu 1–99 po redu;
4. učitava samo aktivne proizvode;
5. uzima regularnu ili trenutno važeću sale cenu iz baze;
6. proverava postojanje izabranog `ProductSize` reda;
7. proverava raspoloživu zalihu;
8. validira kupon za konkretan kontekst;
9. obračunava automatske promocije;
10. čita cenu dostave, free-shipping prag i minimum porudžbine iz store settings;
11. vraća line cene, međuzbir, popust, dostavu i total u RSD.

Uvedeni su eksplicitni kodovi grešaka:

- `EMPTY_CART`
- `CART_TOO_LARGE`
- `INVALID_ITEM`
- `INVALID_QUANTITY`
- `PRODUCT_UNAVAILABLE`
- `OPTION_UNAVAILABLE`
- `INSUFFICIENT_STOCK`
- `MINIMUM_ORDER_NOT_MET`
- `INVALID_COUPON`
- `COUPON_CONDITIONS_NOT_MET`

`POST /api/promotions` sada vraća kompletan autoritativni quote, ima rate limit i šalje `private, no-store`. Ne prihvata klijentsku cenu kao osnovu obračuna.

### 9.2. Jedinstveni pricing context

`CheckoutPricingProvider` obavija shop layout i deli isto stanje između:

- cart stranice;
- cart drawera;
- checkout forme;
- order summary-ja;
- kupon komponente.

`useCartWithPromotions`:

- debouncuje quote poziv 300 ms;
- prekida zastareli zahtev;
- razlikuje kupon grešku od greške cele korpe;
- čuva serverske redove i total;
- uklanja nevažeći kupon;
- blokira checkout dok se quote učitava ili nije validan.

UI više ne prikazuje lokalnu cenu kao potvrđenu dok server nije odgovorio. Prikazuje „Provera cene…”, jasan alert pri grešci i onemogućava nastavak na checkout.

## 10. Korpa i perzistencija browser stanja

U `store/cart.ts` i `types/cart.ts` dodati su:

- `stock` snapshot po redu;
- `couponCode` u perzistentnom stanju;
- `hasHydrated` stanje;
- bezbedan wrapper oko `sessionStorage`;
- fallback rad u memoriji kada storage nije dostupan;
- ograničavanje količine na poznatu zalihu;
- zabrana dodavanja proizvoda sa `stock <= 0`;
- automatsko uklanjanje kupona kada je korpa prazna;
- uklanjanje lokalnog `getTotal` kao poslovnog autoriteta.

Korpa je i dalje vezana za browser tab/session, a ne za server nalog. To je poznata funkcionalna granica, ne greška novog quote sistema.

### 10.1. Bezbedno brisanje korpe posle porudžbine

Prethodni success ekran mogao je obrisati novu korpu samo zato što je korisnik otvorio istorijski success URL.

Sada se čuva marker sa:

- `orderId`;
- determinističkim fingerprintom redova korpe.

`ClearCartOnMount` briše korpu samo ako:

1. store je rehidriran;
2. marker pripada toj porudžbini;
3. trenutni fingerprint odgovara snapshotu porudžbine.

Ako storage nije dostupan, sistem čuva korpu umesto da rizikuje pogrešno brisanje.

## 11. Checkout forma i kreiranje porudžbine

### 11.1. Checkout UX

Checkout podržava gosta i prijavljenog korisnika, a payment metode se prikazuju prema capability flagovima.

Dodato je:

- odvojeno poštansko polje i država za alternativnu adresu;
- klijentska i serverska validacija obe adrese;
- honeypot;
- reCAPTCHA token;
- idempotency header;
- autoritativni quote;
- pending-card recovery;
- čekanje rehidratacije storage-a pre odluke da je korpa prazna.

Browser više ne šalje naziv, cenu, line subtotal, dostavu i total kao podatke kojima server veruje.

### 11.2. Jedinstveni order handler

Obe istorijske rute izvoze isti bezbedni handler:

- `POST /api/order`
- `POST /api/orders`

Aktivna implementacija je centralizovana u `lib/checkout/order-handler.ts`.

Handler proverava:

- rate limit do osam create-order zahteva po IP-u u prozoru limiter-a;
- oblik i prisustvo `Idempotency-Key` zaglavlja;
- honeypot;
- granice dužina i formate korisničkih polja;
- email, ime, prezime, telefon i adresu;
- poštanski broj i državu obe adrese;
- payment method i odgovarajući capability flag;
- reCAPTCHA unutar same poslovne akcije;
- novi serverski quote;
- vlasništvo pri idempotentnom replay-u.

Stari `legacyPOST` kod još postoji kao neizvezen mrtav kod u route fajlovima. Ne izvršava se, ali treba da se ukloni radi smanjenja zabune.

### 11.3. Idempotentnost checkouta

Browser generiše kriptografski idempotency ključ, čuva ga u `sessionStorage` i nakon uspeha ga vezuje za order ID.

Baza ima unique `Order.checkoutIdempotencyKey`. Server:

- prvo traži postojeću porudžbinu po ključu;
- dozvoljava replay samo istom korisniku ili istom guest emailu;
- ograničava replay prozor na dva sata;
- hvata concurrent unique race (`P2002`) i učitava već kreiranu porudžbinu;
- vraća `replayed: true` bez ponovnog skidanja zalihe i kupona;
- za istekao replay vraća `IDEMPOTENCY_REPLAY_EXPIRED`.

Glavna invarijanta: double-click, refresh ili izgubljen HTTP odgovor ne smeju napraviti drugu rezervaciju.

## 12. Zaliha, kupon i transakciona obrada porudžbine

### 12.1. Atomsko kreiranje

`createSecureOrder` u `lib/orders/index.ts` radi u Prisma `Serializable` transakciji.

U jednoj transakciji:

1. ponovo proverava proizvod i trenutnu cenu;
2. uslovno smanjuje tačan stock red samo ako ima dovoljno zalihe;
3. čuva snapshot stavke porudžbine;
4. čuva `inventoryStockId` za svaki praćeni red;
5. postavlja `Order.inventoryAllocated`;
6. rezerviše kupon i povećava `usedCount`;
7. uklanja kupljene artikle iz wishlist-e.

Mogući konfliktni kodovi uključuju:

- `QUOTE_CHANGED`
- `INSUFFICIENT_STOCK`
- `COUPON_EXHAUSTED`
- `COUPON_ALREADY_USED`

Naziv, kod, cena, opcija, količina i slika ostaju snapshot porudžbine i ne menjaju se kada se katalog kasnije izmeni.

### 12.2. Exactly-once oslobađanje

Dodati su:

- `lib/orders/inventory.ts`
- `lib/orders/coupon.ts`
- `lib/orders/payment.ts`

Pri bezbednom decline-u ili admin otkazivanju, u istoj `Serializable` transakciji rade:

- promena order/payment stanja;
- vraćanje tačnog stock reda;
- brisanje rezervisanog `CouponUsage` reda;
- smanjenje `usedCount`.

`inventoryAllocated` se menja conditional update-om i služi kao compare-and-set marker. Ponovljen callback ili ponovljeno otkazivanje ne može dvaput vratiti zalihu.

Zaliha se vraća preko snapshot `inventoryStockId`, a ne ponovnim traženjem promenljivog para `productId + size`. Ako mapping ne postoji, transakcija se namerno prekida umesto kreiranja phantom zalihe.

## 13. Privatnost i autorizacija pristupa porudžbini

Ranije je poznavanje order ID-a praktično omogućavalo čitanje guest porudžbine. To je uklonjeno.

`lib/orders/access.ts` uvodi:

- HMAC-SHA256 potpisan token;
- podrazumevani rok 24 sata;
- vezivanje za tačan `orderId`;
- constant-time verifikaciju;
- zaseban `ORDER_ACCESS_SECRET` sa kontrolisanim fallbackom;
- per-order HttpOnly cookie;
- `SameSite=Lax`;
- `Secure` u produkciji;
- hashovan suffix u cookie nazivu;
- kompatibilnost sa starim query tokenom i legacy cookie oblikom.

Kompletan pristup imaju:

- `ADMIN`;
- `OPERATOR`;
- prijavljeni vlasnik;
- gost sa važećim order-scoped tokenom/cookie-jem.

Kratkotrajni checkout recovery pristup je dodatno ograničen na:

- kartičnu porudžbinu;
- `PENDING` ili `PROCESSING` status;
- starost do dva sata;
- odgovarajući checkout idempotency ključ.

Recovery odgovor je redigovan i ne sadrži adresu, kompletne podatke kupca ni transaction detalje. Odgovori koriste `private, no-store`.

Testovi pokrivaju scope, istek, tampering i razliku između order-read i payment-handoff tokena.

## 14. Kartično plaćanje i NestPay hardening

### 14.1. Bezbedno podrazumevano stanje

Kartice su capability flagom isključene dok se ne završe bankarska sertifikacija, staging E2E testovi i operativni reconciliation/refund tokovi.

### 14.2. Payment start

`/api/payments/nestpay/start` je promenjen tako da browser šalje samo `orderId`.

Ruta sada:

1. proverava session owner, order-access token/cookie ili kratkotrajni recovery;
2. rate-limitira kombinaciju order ID-a i IP-a;
3. učitava amount, valutu, broj porudžbine i email sa servera;
4. dozvoljava samo `CARD` porudžbinu u prihvatljivom stanju;
5. atomarno prelazi `PENDING → PROCESSING`;
6. čuva generisani form payload u transaction snapshotu;
7. na retry-u istog aktivnog pokušaja vraća isti payload;
8. odbija terminalno ili kontradiktorno stanje.

Browser handoff je podeljen na dva koraka:

- same-origin JSON preflight vraća dvominutni handoff token;
- top-level POST sa `orderId + handoffToken` isporučuje auto-submit HPP dokument.

Handoff token je HMAC vezan za `payment-handoff:<orderId>`, ne daje pravo čitanja porudžbine, ne čuva se u URL-u niti trajnom storage-u.

HPP dokument dobija:

- `Cache-Control: no-store`;
- `Pragma: no-cache`;
- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`;
- CSP sa jednokratnim nonce-om;
- `form-action` ograničen na bankarski origin;
- `base-uri 'none'`;
- `frame-ancestors 'none'`.

### 14.3. Fail-closed NestPay konfiguracija

Konfiguracija zahteva:

- validan canonical storefront URL;
- HTTPS HPP URL;
- HTTPS success i fail callback;
- isti origin callback-a i prodavnice;
- tačne callback putanje;
- callback bez query/hash dela;
- RSD kod `941`;
- transaction type `Auth`.

URL sa username/password segmentom se odbija.

### 14.4. Callback klasifikacija

Success i fail endpoint više sami po sebi ne određuju poslovni rezultat. Obe rute klasifikuju potpisani provider payload.

Obrada sada:

1. zahteva validan callback hash;
2. koristi constant-time poređenje;
3. zahteva da `oid` bude potpisano polje;
4. čita outcome samo iz polja navedenih u `HASHPARAMS`;
5. za approval zahteva potpisane ključne outcome, amount, currency i transaction podatke;
6. poredi callback amount sa `Order.total`;
7. proverava RSD/941;
8. nepotpun ili tehnički nejasan rezultat vodi u `REVIEW`, ne u lažni decline;
9. čuva samo allow-list sanitized audit payload;
10. ne čuva hash, potpisanu konkatenaciju, PAN, email niti proizvoljna provider polja;
11. gradi event key iz potpisanog provider sadržaja.

Logovi više ne izlažu StoreKey, očekivani hash niti potpisane vrednosti.

### 14.5. Payment state machine i događaji

`PaymentStatus` sada podržava:

- `PENDING`
- `PROCESSING`
- `PAID`
- `FAILED`
- `REVIEW`
- `REFUNDED`

`PaymentEvent` čuva append-like trag callback događaja sa unique event key-em, providerom, vrstom callback-a, rezultatom (`APPLIED`, `REPLAYED`, `REVIEW`), razlogom, transaction ID-em, amount/currency podatkom, sanitized payloadom i vremenom.

`Transaction` ostaje trenutna projekcija payment pokušaja, a `PaymentEvent` istorijski trag.

State-machine pravila uključuju:

- potvrđen terminalni payment ne može postati declined;
- declined terminalni payment ne može naknadno automatski postati paid;
- identičan terminalni callback je replay;
- isti outcome sa drugim provider transaction ID-em ide u `REVIEW`;
- approval ne oživljava otkazanu porudžbinu;
- approval ne prolazi kada je praćena zaliha već oslobođena;
- success bez transaction ID-a ide u `REVIEW`;
- neusaglašeni Order/Transaction podaci idu u `REVIEW`;
- decline u istoj transakciji otkazuje order i oslobađa zalihu/kupon;
- tehnička greška posle validnog potpisa vraća retryable `503`, ne lažni decline.

Serializable callback transakcije imaju ograničene retry pokušaje za tipične concurrency greške.

## 15. Payment i order status UX

### 15.1. Pending-card recovery

Dodati su:

- `lib/payments/pending-card.ts`
- `lib/payments/browser-handoff.ts`
- `components/checkout/PendingCardRecovery.tsx`
- `components/checkout/ClearPendingCardPaymentOnMount.tsx`

Posle rezervacije kartične porudžbine browser čuva samo pending `orderId`. Ako payment start padne ili se stranica osveži:

- checkout ne pravi novu porudžbinu;
- učitava redigovan originalni order snapshot;
- prikazuje broj, stavke i total;
- nudi nastavak istog payment pokušaja;
- jasno navodi da nova porudžbina neće biti kreirana.

### 15.2. Statusne stranice

`/payment/success` prikazuje uspeh samo za autorizovanu `CARD + PAID` porudžbinu.

`/order/success` potvrđuje i briše korpu samo za `CASH`. Kartične porudžbine preusmerava prema stvarnom payment statusu pre nego što se montira komponenta za čišćenje korpe.

`/payment/failed` sada:

- preusmerava `PAID` na payment success;
- preusmerava `CASH` na order success;
- samo za stvarni `FAILED` prikazuje neuspeh i retry;
- za `PENDING`, `PROCESSING`, `REVIEW`, `REFUNDED`, nepoznato ili neautorizovano stanje prikazuje neutralnu proveru;
- upozorava na moguću rezervaciju/zaduženje;
- ne nudi retry za nejasno stanje;
- tumači provider `rawResponse` samo kada je serversko stanje već `FAILED`;
- čuva korpu netaknutom u svim neodgovarajućim statusnim tokovima.

## 16. Admin autorizacija i upravljanje porudžbinom

### 16.1. Deny-by-default politika

Dodati su `lib/auth/admin-policy.ts` i testovi.

Pravila su:

- `ADMIN` ima pristup svim admin stranicama i API rutama;
- `OPERATOR` ima samo orders subtree, chat messages i eksplicitno dozvoljene GET/PUT akcije;
- svaka nova admin ruta je za OPERATOR-a zatvorena dok se eksplicitno ne doda;
- proveravaju se i putanja i HTTP metod;
- prefix-lookalike putanje kao `/administrator` ne tretiraju se kao admin.

`proxy.ts` koristi istu politiku za stranice i direktne API zahteve, razlikuje `401` i `403` i OPERATOR-a preusmerava na njegov dozvoljeni workspace. Admin navigacija se filtrira istom ulogom, ali UI skrivanje nije jedina zaštita.

### 16.2. AdminShell

Unapređeni su:

- aktivno stanje rute;
- `aria-current`;
- oznake mobile kontrola;
- skip-to-main cilj;
- responsive navigacija;
- vidljivo dugme za odjavu.

### 16.3. Promena statusa porudžbine

Admin order status ruta sada:

- dozvoljava `ADMIN` i `OPERATOR`;
- zahteva tracking broj za `SHIPPED`;
- blokira promene dok je card payment `PROCESSING` ili `REVIEW`;
- ne dozvoljava `CONFIRMED`/`SHIPPED` za neplaćenu kartičnu porudžbinu;
- ne dozvoljava obično otkazivanje `PAID`, `PROCESSING` ili `REVIEW` paymenta bez refund/reconciliation toka;
- ne dozvoljava vraćanje otkazane porudžbine u aktivno stanje;
- ne dozvoljava obično otkazivanje već poslate porudžbine;
- koristi optimistic conditional update;
- koristi atomsko otkazivanje za vraćanje zalihe i kupona.

Email se šalje posle DB commita. Pad emaila ne poništava poslovnu transakciju, ali trajni outbox/retry još ne postoji.

## 17. Generički katalog za različite branše

### 17.1. Novi Prisma modeli

`prisma/schema.prisma` je proširena modelima za univerzalni katalog.

#### Tip proizvoda

`ProductType` ima stabilan unique code, lokalizovan naziv/opis, active/archive stanje, sort order i vezu sa proizvodima.

Planirani primeri:

- `generic`
- `clothing`
- `footwear`
- `food`

#### Definicija atributa

`AttributeDefinition` podržava:

- `TEXT`
- `RICH_TEXT`
- `INTEGER`
- `DECIMAL`
- `BOOLEAN`
- `DATE`
- `DATETIME`
- `SELECT`
- `MULTI_SELECT`
- `JSON`

Definicija ima jedinicu, filter/search flagove, podrazumevani required status, active stanje i sort order.

`ProductTypeAttribute` dodeljuje atribut tipu proizvoda i može promeniti required/sort ponašanje po tipu.

#### Vrednosti atributa

`ProductAttributeValue` koristi tipizovane kolone za tekst, broj, decimalu, boolean, datum i JSON.

`AttributeChoice` i `ProductAttributeSelectedChoice` pokrivaju select i multi-select. Kompozitne relacije proveravaju da izbor i vrednost pripadaju istoj definiciji i data type-u.

#### Opcije koje formiraju varijantu

Informativni atributi su odvojeni od prodajnih osa. Dodati su:

- `ProductOption`
- `ProductOptionValue`
- `ProductVariantOptionValue`

Opcija može predstavljati veličinu, boju, pakovanje, ukus ili bilo koju drugu osu. Kompozitni ključevi proveravaju da opcija i varijanta pripadaju istom proizvodu, da vrednost pripada navedenoj opciji i da varijanta bira najviše jednu vrednost iste opcije.

### 17.2. Novi admin API-ji

Dodate su rute:

- `GET/POST /api/admin/product-types`
- `GET/PUT/DELETE /api/admin/product-types/:id`
- `GET/POST /api/admin/attributes`
- `GET/PUT/DELETE /api/admin/attributes/:id`

Sve su `ADMIN`-only.

`lib/catalog/admin-input.ts`:

- normalizuje stabilne kodove na lowercase ASCII;
- transliteriše srpska slova;
- prihvata lokalizovan `{sr,en}` ili običan string;
- odbija duple assignment-e i choice kodove;
- proverava data type;
- normalizuje sort order, JSON i opcione vrednosti.

API invarijante:

- stabilni code se ne menja kroz PUT;
- tip koristi samo aktivne definicije;
- `DELETE` arhivira, ne radi fizičko brisanje;
- tip sa aktivnim proizvodima se ne arhivira;
- atribut vezan za aktivni tip/proizvod se ne arhivira;
- data type se ne menja ako postoje vrednosti ili choices;
- choices važe samo za select tipove;
- choices su upsert-only, a deaktivacija je eksplicitna;
- required atribut se ne uključuje dok proizvodi nisu backfillovani;
- veza atributa se ne uklanja dok postoje vrednosti;
- PUT product type zahteva `expectedUpdatedAt`;
- nedostajući precondition vraća `428`;
- stale/concurrent update vraća `409`;
- mutacije koriste `Serializable` transakcije.

### 17.3. Trenutna granica generičkog kataloga

Schema i osnovni admin API postoje, ali vertikalni tok još nije povezan. Trenutni storefront, korpa, checkout i porudžbina i dalje koriste legacy `ProductSize` i string `size`.

Još ne postoje:

- admin editor za tipove/atribute;
- product-editor upis atributskih vrednosti;
- UI za opcije i vrednosti;
- generički variant editor;
- cart identitet po `variantId`;
- OrderItem snapshot više opcija;
- generička variant zaliha;
- dinamički filteri;
- seedovi po branšama;
- dual-read poređenje legacy i V2 modela.

## 18. Javni formulari, reCAPTCHA i email sigurnost

### 18.1. reCAPTCHA u poslovnoj akciji

`lib/security/recaptcha.ts` je server-only provera koja validira:

- prisustvo secret-a i tokena;
- provider HTTP odgovor;
- očekivani `action`;
- score, podrazumevano najmanje 0,5;
- dozvoljeni hostname;
- remote IP;
- timeout od pet sekundi.

Produkcija bez konfigurisanog secret-a radi fail-closed. Razvojno okruženje bez ključa ima kontrolisan dev bypass.

Checkout koristi action `checkout`, a prijava za posao `job_application`. Pomoćna `/api/recaptcha/verify` ruta ostaje, ali prava zaštita se ponavlja unutar poslovnog endpointa.

### 18.2. Kontakt, reklamacije i prijava za posao

Forme su prebačene sa lako zaobilazne lokalne time/interact provere na kombinaciju tokena i honeypot-a.

Job application API dodatno ima:

- rate limit;
- limit tela od 15 MB;
- najviše dva fajla;
- do 5 MB po fajlu i 8 MB ukupno;
- proveru dozvoljenih ekstenzija;
- zamenu path/specijalnih znakova u filename-u;
- serversku validaciju obaveznih polja.

Reklamacija ograničava prilog i priprema ga za bezbednije slanje kao attachment.

### 18.3. SMTP

Mailer sada podrazumevano proverava TLS sertifikat i ograničava TLS na moderne verzije. Isključivanje validacije mora biti eksplicitno i namenjeno je samo kontrolisanom lokalnom self-signed okruženju.

## 19. Prisma schema promene

Pored generičkog kataloga, dodata/proširena su sledeća commerce polja i modeli:

- `Order.checkoutIdempotencyKey` — unique checkout ključ;
- `Order.currency`;
- `Order.inventoryAllocated`;
- `OrderItem.inventoryStockId` i indeks;
- `PROCESSING` i `REVIEW` payment stanja;
- dopunjena transaction projekcija i bezbedni raw payload komentari;
- `PaymentEvent` i prateći enum-i;
- relacija `Product.productTypeId`;
- relacije atributa, opcija i variant option vrednosti;
- dodatne kompozitne unique/FK invarijante.

### 19.1. Važna napomena o migracijama

SQL migracija za ove promene **nije napravljena niti primenjena**. To je namerna sigurnosna odluka dok se ne urade:

1. backup;
2. stvarni restore test;
3. staging klon produkcione baze;
4. inventar realne DB šeme;
5. Prisma baseline postojeće baze;
6. ručno pregledan expand SQL;
7. seed i backfill;
8. dual-read i integraciona provera;
9. tek zatim contract/cleanup faza.

Ne treba koristiti `prisma db push` nad produkcionom bazom.

## 20. GitHub Actions i automatsko objavljivanje

### 20.1. Workflow

`.github/workflows/objavi.yml` je prepravljen da reaguje na:

- svaki push na `main`;
- ručno pokretanje (`workflow_dispatch`).

Workflow koristi:

- `permissions: contents: read`;
- concurrency grupu koja serializuje produkcione deploy-eve;
- Node.js 22;
- `npm ci` sa lock fajlom;
- odvojen verify job pre deploy job-a;
- GitHub production environment;
- validaciju potrebnih vars/secrets;
- tajne samo u koraku gde su potrebne;
- prethodno verifikovan `SSH_KNOWN_HOSTS` bez runtime `ssh-keyscan` i bez gašenja host provere;
- jedinstveni release ID oblika `<sha>-<run-attempt>`;
- rsync u izolovani release direktorijum;
- isključenje `.git`, `.github`, `.env`, `.next`, `node_modules`, upload direktorijuma i drugih runtime podataka;
- poziv serverskog deployment skripta;
- cleanup neuspelog neaktivnog release-a;
- uklanjanje privatnog ključa na kraju.

### 20.2. Verify job

Pre deploymenta workflow pokreće:

1. `npm ci`;
2. Prisma schema validaciju;
3. TypeScript proveru;
4. 17 ciljnih sigurnosnih/commerce testova;
5. produkcioni build.

Deploy job se ne pokreće ako bilo koja od ovih provera padne.

### 20.3. Potrebna GitHub konfiguracija

Dokumentovani secrets:

- `SSH_PRIVATE_KEY`
- `SSH_KNOWN_HOSTS`
- `SERVER_HOST`
- `SERVER_USER`

Dokumentovane variables:

- `PRODUCTION_URL` — obavezna;
- `SERVER_PORT` — opciona;
- `DEPLOY_PATH` — opciona.

Stvarne vrednosti tajni nisu upisane u repozitorijum niti ovaj dokument.

### 20.4. Trenutno operativno stanje workflow-a

Workflow je commitovan i nalazi se na remote grani `verzija/v2.0-univerzalna-platforma`. Pošto reaguje samo na `main` i ručno pokretanje, samo objavljivanje feature grane nije pokrenulo produkcijski deploy. Automatski CI/CD za svaki `main` push postaće aktivan tek kada se V2 PR bezbedno spoji u `main` i kada se podese production environment, vars i secrets.

## 21. Release deployment skripta

`scripts/deploy.sh` je prepravljen u izolovani release tok.

### 21.1. Validacije i zaključavanje

Skripta proverava:

- oblik release ID-a;
- da release putanja pripada očekivanom root-u;
- portove i obavezne parametre;
- da se aktivacija i cleanup rade pod istim `flock` zaključavanjem.

### 21.2. Izgradnja release-a

Za svaki release:

- povezuje shared `.env` i uploads direktorijum simboličkim linkovima;
- pokreće `npm ci`;
- radi Prisma validate/generate;
- podrazumevano ne primenjuje migracije;
- dozvoljava migracije samo kroz eksplicitni flag;
- proverava schema drift i blokira neusklađeno stanje;
- gradi aplikaciju u izolovanom release direktorijumu.

### 21.3. Smoke test, aktivacija i rollback

Pre aktivacije:

- aplikacija se podiže na privremenom portu;
- `/api/health` mora vratiti očekivani deployment SHA;
- tek tada se atomarno menja `current` symlink;
- PM2 pokreće produkciju na portu 3007 ili konfigurisanom portu;
- rade lokalna i javna provera istog SHA-a.

Ako aktivacija ili health provera padne:

- trap pokušava rollback na prethodni release;
- proverava se da je prethodni release ponovo zdrav;
- neuspešan neaktivni release se uklanja;
- zadržava se ograničen broj prethodnih release-ova, trenutno pet.

### 21.4. Health endpoint

`app/api/health/route.ts` vraća:

- deployment SHA;
- DB connectivity stanje;
- `no-store` odgovor;
- HTTP 503 kada baza nije dostupna.

To omogućava da workflow razlikuje aplikaciju koja samo sluša port od tačno očekivane i DB-spremne verzije.

## 22. Git remote i istorija

Lokalni projekat je povezan sa postojećim javno čitljivim remote repozitorijumom. Fetch URL ostaje SSH, dok je push URL podešen na HTTPS kako bi koristio postojeću macOS Keychain GitHub autorizaciju:

```text
fetch: git@github.com:biozencaj-stack/narodnanosnja.git
push:  https://github.com/biozencaj-stack/narodnanosnja.git
```

Presek u vreme pisanja:

- lokalna i remote radna grana: `verzija/v2.0-univerzalna-platforma`;
- V2 snapshot commit: `3dc757ac6280b77c7951a888ec2d3ad609ddae1d`;
- lokalni `main`: `f6e3dac`;
- remote `main`: `31ebf14fe531c971d944fe4e8822830f644f66af` — nije promenjen;
- remote grana `verzija/v2.0-prodavnica`: `117d58a...`;
- V2 grana prati odgovarajuću `origin/verzija/v2.0-univerzalna-platforma` granu;
- stara lokalna tačka sačuvana je samo lokalno kao `arhiva/v2-pre-github-2026-08-29`.

Originalna lokalna webshop istorija i remote `main` nisu imali zajedničkog pretka, a stari lokalni commitovi sadržali su hardkodovanu demo DB vrednost. Zato ta istorija nije pushovana i nije korišćena kao merge roditelj.

Umesto toga napravljen je sanitizovan snapshot commit čiji je jedini roditelj postojeći remote `main`. Provere potvrđuju da je `origin/main` direktan roditelj, da je broj novih commitova tačno jedan i da stara lokalna istorija nije predak snapshot-a. Time je feature grana kompatibilna sa normalnim GitHub PR-om bez force push-a.

Commit i push feature grane su završeni. Nije urađen merge u `main` niti produkcijski deploy.

## 23. Lokalno pokrenute provere

### 23.1. Provere koje prolaze

| Provera | Rezultat | Napomena |
| --- | --- | --- |
| `npx prisma validate` | prolazi | upozorenje da je Prisma config u `package.json` deprecated za Prisma 7 |
| `npx tsc --noEmit --incremental false` | prolazi | TypeScript bez grešaka |
| ciljni Node/TS testovi | 17/17 prolazi | admin policy, NestPay, payment policy, order access |
| produkcioni Next build | prolazi | Next.js 16.1.6, TypeScript i 91/91 generisanih stranica |
| `bash -n scripts/deploy.sh` | prolazi | shell sintaksa validna |
| YAML parse workflow-a | prolazi | workflow sintaksno parsiran |
| `git diff --check` | prolazi | nema whitespace grešaka u tadašnjem diff-u |

Tokom builda lokalni PostgreSQL na `127.0.0.1` nije bio dostupan. Settings i određeni javni upiti koristili su predviđene fallback vrednosti, pa je build završen, ali to nije zamena za staging DB integracioni test.

### 23.2. Ciljni testovi

Pokrenuti test paket obuhvata:

- 5 admin-policy testova;
- 5 NestPay testova;
- 6 payment-policy testova;
- 1 order-access test.

Pokriveni su role/method/path slučajevi, callback origin i potpis, tajnost logova, nepouzdana provider polja, review klasifikacija, replay, terminalni konflikti, scope i istek access tokena.

### 23.3. Provera koja trenutno ne radi

`npm run lint` pada zato što package script i dalje poziva `next lint`, a ta komanda više nije validna u korišćenoj Next.js 16 verziji. Ovo nije ESLint nalaz u source kodu, već neusklađen lint script/tooling.

Potrebno je prebaciti skriptu na direktan ESLint poziv, dodati/uskladiti konfiguraciju i zatim lint uvrstiti u verify job.

### 23.4. Provere koje još nisu urađene

Nisu još urađeni:

- E2E browser test checkout toka;
- PostgreSQL concurrency integracioni testovi;
- stvarni NestPay staging/HPP test;
- Lighthouse budžeti;
- automatizovani accessibility audit;
- cross-browser/mobile QA;
- restore test produkcionog backup-a;
- staging deploy i rollback vežba.

## 24. Poznati kritični rizici i blokatori

### 24.1. P0 — nema pregledane i primenjene Prisma migracije

Nova schema trenutno predstavlja kodni ugovor, ali postojeća baza nema odgovarajuće SQL promene. Admin API generičkog kataloga i nova order/payment polja ne smeju se smatrati produkciono spremnim pre baseline/expand migracije.

### 24.2. P0 — admin product update ruši stabilni stock identitet

Postojeća `app/api/admin/products/[id]/route.ts` implementacija pri izmeni proizvoda briše sve `ProductSize` redove i pravi nove. Time se menjaju ID-evi koje stare porudžbine čuvaju kao `inventoryStockId`.

Posledica: kasnije otkazivanje stare porudžbine može ostati bez tačnog stock reda na koji treba vratiti zalihu. Pre produkcije treba zameniti delete/recreate stabilnim upsert/deactivate modelom ili ledger pristupom.

### 24.3. P0 — proizvod bez stock reda nema jedno značenje

Trenutno se isti slučaj tumači različito:

- quote ga tretira kao nepraćenu/neograničenu zalihu;
- admin prikazuje nula komada;
- trenutni detalj proizvoda ga praktično ne dozvoljava dodati.

Potrebno je eksplicitno polje/politika za tracked i untracked inventory i ista implementacija kroz admin, storefront i checkout.

### 24.4. P0 — generička varijanta nije snapshot porudžbine

Novi option/variant model postoji u schemi, ali cart i OrderItem i dalje identifikuju samo legacy `size` string. Ne postoji `variantId` niti snapshot više izabranih opcija, što blokira pravi univerzalni tok za boju + veličinu, pakovanje + ukus i slične kombinacije.

### 24.5. P0 — kartice nisu spremne za uključivanje

Pre aktivacije su obavezni:

- bankarska sertifikacija;
- potvrda stvarnih callback field naziva i signature coverage-a;
- staging HPP E2E;
- admin `REVIEW` inbox;
- reconciliation tok;
- refund tok;
- cleanup napuštenih `PENDING/PROCESSING` rezervacija;
- multi-tab, refresh, 429/5xx i network-loss testovi;
- trajan idempotentni email outbox.

Bez cleanup-a napušten payment može zadržati zalihu i kupon rezervisanim.

## 25. Ostale nedovršene tačke — commerce i admin

### 25.1. Promocije

- `maxUses` se pouzdano rezerviše samo za eksplicitni kupon; automatske promocije nemaju potpun reservation zapis po porudžbini.
- `FREE_SHIPPING` ima posebnu stacking ivicu jer mu je discount iznos nula.
- Nema eksplicitnog determinističkog priority modela za sve kombinacije promocija.
- Pojedinačni promo popusti se zaokružuju na ceo RSD, dok ostatak quote-a može koristiti dve decimale.
- Potrebno je dosledno normalizovati kupon kodove velikim slovima kroz sve admin i checkout putanje.

### 25.2. Admin proizvodi i brendovi

- Brand edit UI šalje lokalizovan objekat u putanju koja na serveru očekuje slug-friendly string; to može završiti greškom.
- Product validacija je i dalje slabija od novog katalog API-ja.
- Više legacy product mutacija koristi fizičko brisanje i višekoračne netransakcione upise.
- Nema univerzalnog product type/attribute/variant editora.
- Nema inventory ledger-a niti audit traga promene zalihe.

### 25.3. Admin porudžbine i operativa

- UI još svodi tok na ograničen broj statusa i nema kompletnu timeline istoriju.
- Nema actor zapisa, internih napomena i punog audit loga.
- Nema shipment provider integracije, parcijalne isporuke, return/RMA, refund i invoice modula.
- Cancellation note se oslanja na email, bez trajnog outbox događaja.
- Dashboard revenue može uključiti neplaćene porudžbine, a prosek otkazane.

### 25.4. Korisnici i uloge

- Postoji mrtav link ka `/admin/users/[id]`; korisnički admin je uglavnom list-only.
- Role promena može ostati u JWT-u do isteka sesije.
- `emailVerified` nije univerzalno sproveden kao uslov.
- Nema MFA, login lockout-a niti zasebnog login rate limit-a.

## 26. Ostale nedovršene tačke — storefront i sadržaj

### 26.1. Folk-specific početna strana

Aktuelna početna komponenta `components/home/nosnja.tsx` ostaje specifična za narodnu nošnju: tekstovi, motivi, sadržaj i deo boja nisu administrativno promenljivi. Prilagođeni `HeroSection` nije aktivna početna implementacija.

Za pravu branšnu prilagodljivost potreban je page-section/banner/content sistem sa podešivim desktop/mobile slikama i redosledom sekcija.

### 26.2. Mediji

- nema admin upload-a logotipa, favicon-a, OG slike i hero fotografija;
- nema pravog product/category media workflow-a za novu branšu;
- postojeći importer ne rešava kompletan import slika;
- nedostaju određeni card/payment vizuali ako se kartice uključe.

### 26.3. Katalog i URL problemi

- legacy category filter count nije svuda pouzdan;
- per-page selector ima nedoslednosti;
- deo sitemap/breadcrumb category URL-ova zahteva korekciju;
- deep-category resolver nije završen;
- kada je DB prazan, postoje fake fallback kategorije/brendovi koji mogu sakriti konfiguracionu grešku;
- brand stranica još ne normalizuje neispravan `page` kao search stranica.

### 26.4. Pretraga

- UI obećava pretragu po brendu/kategoriji, ali backend uglavnom pretražuje naziv, opis i SKU;
- popularni termini su statični i modno-orijentisani;
- nema typo tolerance, sinonima niti izdvojene search infrastrukture.

### 26.5. Product detail i sadržaj

- nema quantity selector-a pre dodavanja;
- thumbnail kontrole zahtevaju bolje dostupne oznake;
- opis proizvoda se renderuje kroz `dangerouslySetInnerHTML` bez centralnog HTML sanitizer-a;
- metadata put nije potpuno ujednačen sa novim canonical URL helperom.

### 26.6. Korpa, dostava i internacionalizacija

- korpa je `sessionStorage`/tab-local i ne sinhronizuje se sa nalogom;
- validacija telefona i poštanskog broja je prvenstveno srpska;
- dostava je flat-rate, bez zone/težine/dimenzija/courier pravila;
- pravni tekstovi još sadrže hardkodirane kurire, cene ili poslovne placeholder podatke;
- aplikacija je praktično i dalje Serbian-first.

### 26.7. Preostala accessibility/UI automatizacija

- mobile offscreen podmeni može zadržati fokusabilne elemente;
- nema UI/E2E accessibility regresionih testova;
- nisu uvedeni formalni dizajn-tokeni za spacing, type scale i komponente kroz ceo projekat.

## 27. Preostale sigurnosne i operativne tačke

### 27.1. Rate limiting i IP poverenje

Trenutni rate limiter je in-memory i nije deljen između više procesa/instanci. `X-Forwarded-For` obrada zahteva eksplicitnu trusted-proxy konfiguraciju; bez nje klijentski prosleđena leva IP vrednost može biti nepouzdana.

Za produkciju sa više procesa potreban je Redis ili drugi centralni limiter i precizan proxy trust model.

### 27.2. Session/auth zaštita

- login nema kompletan brute-force/lockout tok;
- nema MFA;
- role se može keširati u JWT-u;
- email verification nije svuda uslov;
- CSRF zaštita write ruta treba da bude dosledno fail-closed kada Origin nedostaje ili nije dozvoljen.

### 27.3. Browser sigurnosni headeri

Payment HPP dokument ima strogu CSP politiku, ali aplikacija još nema kompletan globalni paket CSP/HSTS/Permissions-Policy/Referrer-Policy headera za sve rute.

### 27.4. Rich HTML i audit

- rich HTML sadržaj nema centralni sanitizer;
- admin poslovne mutacije nemaju univerzalni audit log;
- nema centralizovanog error tracking/alert sistema;
- payment email i drugi poslovni emailovi nemaju outbox.

### 27.5. Legacy ops skripte i sanitizacija

Pre GitHub objave pronađene su hardkodovane demo DB vrednosti u dve već praćene legacy provisioning skripte. Trenutne verzije su sanitizovane:

- `scripts/db-setup.sql` je zamenjen parametrizovanim PostgreSQL šablonom koji zahteva vrednosti iz zaštićenog operator/secret-manager toka i ne ispisuje connection URL sa lozinkom;
- `scripts/cloud-init.yaml` je pretvoren u neutralan osnovni host šablon bez DB naloga, lozinke, SSH ključa ili aplikacionih tajni, uz eksplicitnu napomenu da Node.js, PM2, TLS i monitoring zahtevaju pregledanu produkcionu proceduru.

Sledeći stari operativni fajlovi još nisu refaktorisani i mogu sadržati Planika/shopdemo pretpostavke ili zastarele procedure:

- `scripts/backup.sh`
- `scripts/restore.sh`
- `scripts/server-setup.sh`
- `ecosystem.config.js`

Ni sanitizovane ni preostale legacy skripte ne treba tretirati kao odobrenu V2 produkcionu proceduru dok se zasebno ne testiraju. README takođe pominje neke deployment/Docker dokumente ili fajlove koji nisu prisutni.

### 27.6. GitHub pre-push zaštita

Pošto je repozitorijum javno čitljiv, pre pripreme snapshot-a urađeno je:

- proširenje `.gitignore` pravila na sva `.env*` okruženja osim `.env.example`, privatne key/certificate formate, credentials/service-account JSON, DB dumpove, coverage, Playwright, Turbo i Vercel artefakte;
- dodavanje `.gitattributes` pravila za stabilan LF format tekstualnih fajlova na macOS/Linux/Windows i eksplicitno binarne formate;
- uklanjanje hardkodovanih demo DB vrednosti iz trenutnog stabla;
- zamena konkretne javne server adrese u `IZMENE.md` neutralnim `SERVER_HOST` placeholderom;
- potvrda da Git-visible stablo nema privatne ključeve, poznate high-confidence tokene, build direktorijume, uploadove ni prevelike binarne fajlove.

Stara lokalna Git istorija i dalje sadrži raniju demo vrednost. Zbog toga nije pushovana niti korišćena kao roditelj merge commit-a. GitHub grana je napravljena kao sanitizovan snapshot sa postojećim remote `main` commitom kao jedinim roditeljem. Udaljeni SHA je naknadno provereno jednak lokalnom snapshot SHA-u.

## 28. Predloženi redosled nastavka rada

### Faza 0 — očuvanje rada i Git integracija

1. Završeno: pregledan je dnevnik, Git inventar i V2 dokumentacija.
2. Završeno: napravljen je jedan sanitizovan snapshot umesto prenosa nepovezane i kompromitovane lokalne istorije.
3. Završeno: V2 grana je objavljena bez izmene `main` i bez deploy-a.
4. Sledeće: otvoriti Draft PR i pregledati zamenu stare prezentacije novom aplikacijom.
5. Pre merge-a: podesiti production environment, vars/secrets i potvrditi DB/deployment spremnost.
6. Ne koristiti force push nad postojećim `main` niti `git push --all` iz lokalne arhive.

### Faza 1 — baza i kritične invarijante

1. Napraviti stvaran backup i dokazati restore.
2. Baseline-ovati produkcionu šemu.
3. Napraviti reviewable expand migraciju.
4. Ispraviti ProductSize delete/recreate problem.
5. Definisati tracked/untracked inventory.
6. Dodati PostgreSQL concurrency integracione testove.

### Faza 2 — vertikalni generički katalog

1. Admin UI za ProductType i AttributeDefinition.
2. Product editor za atribute, opcije i varijante.
3. Stabilni `variantId` u korpi i quote-u.
4. OrderItem snapshot svih izabranih opcija.
5. Dinamički storefront filteri.
6. Seed/backfill i dual-read poređenje.

### Faza 3 — storefront/content univerzalnost

1. Content/page-section sistem za početnu stranu.
2. Media library i upload logotipa/hero/category/product slika.
3. Generalizacija filtera, search termina i legal/contact podataka.
4. UX polish, responsive QA, accessibility i Lighthouse budžeti.

### Faza 4 — kompletna admin operativa

1. Inventory ledger i low-stock tokovi.
2. Order timeline, actor, interne napomene i audit log.
3. Shipment, return/RMA, refund i invoice moduli.
4. Promotion reservation i deterministički stacking.
5. User detail, role/session revocation i MFA.

### Faza 5 — payment aktivacija i produkcija

1. Bankarska sertifikacija i staging HPP E2E.
2. REVIEW inbox, reconciliation, refund i reservation cleanup.
3. Email outbox.
4. Staging deploy/rollback vežba.
5. Produkcioni secrets/vars i HTTPS provera.
6. Tek zatim uključiti card capability.

## 29. Novi fajlovi dodati u ovom preseku

### Git normalizacija

- `.gitattributes`

### Admin API i UI

- `app/api/admin/attributes/[id]/route.ts`
- `app/api/admin/attributes/route.ts`
- `app/api/admin/product-types/[id]/route.ts`
- `app/api/admin/product-types/route.ts`
- `components/admin/StoreSettingsPanel.tsx`

### Store config i identity

- `components/StoreIdentityProvider.tsx`
- `lib/config/capabilities.ts`
- `lib/config/store-identity.ts`
- `lib/config/store-settings-schema.ts`
- `lib/config/store-settings.ts`
- `lib/config/storefront-url.ts`

### Checkout i payment UX

- `components/checkout/CheckoutPricingProvider.tsx`
- `components/checkout/ClearPendingCardPaymentOnMount.tsx`
- `components/checkout/PendingCardRecovery.tsx`
- `lib/checkout/cart-clear.ts`
- `lib/checkout/idempotency.ts`
- `lib/checkout/order-handler.ts`
- `lib/checkout/quote.ts`
- `lib/payments/browser-handoff.ts`
- `lib/payments/pending-card.ts`

### Order, coupon, inventory i payment politika

- `lib/orders/access.ts`
- `lib/orders/authorize.ts`
- `lib/orders/coupon.ts`
- `lib/orders/inventory.ts`
- `lib/orders/payment-policy.ts`
- `lib/orders/payment.ts`

### Admin policy, katalog i sigurnost

- `lib/auth/admin-policy.ts`
- `lib/catalog/admin-input.ts`
- `lib/security/recaptcha.ts`

### Testovi

- `lib/auth/admin-policy.test.ts`
- `lib/nestpay/index.test.ts`
- `lib/orders/access.test.ts`
- `lib/orders/payment-policy.test.ts`

### Dokumentacija

- `docs/ARCHITECTURE-V2.md`
- `docs/CATALOG-MIGRATION-PLAN.md`
- `docs/GITHUB-DEPLOY.md`
- `docs/V2-ROLL-OUT.md`
- `docs/DETALJAN-DNEVNIK-IZMENA.md` — ovaj dokument

## 30. Izmenjeni postojeći fajlovi — kompletan grupisani inventar

### Root, dokumentacija i CI/CD

- `.gitignore`
- `.env.example`
- `.github/workflows/objavi.yml`
- `CLAUDE.md`
- `IZMENE.md`
- `README.md`

### Auth i pravni layout/sadržaj

- `app/(auth)/layout.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(legal)/contact/page.tsx`
- `app/(legal)/karijera/page.tsx`
- `app/(legal)/layout.tsx`
- `app/(legal)/nacin-placanja/page.tsx`
- `app/(legal)/o-nama/page.tsx`
- `app/(legal)/placanje-karticama/page.tsx`
- `app/(legal)/politika-privatnosti/page.tsx`
- `app/(legal)/povracaj-sredstava/page.tsx`
- `app/(legal)/pravo-na-odustanak/page.tsx`
- `app/(legal)/uputstvo/page.tsx`
- `app/(legal)/uslovi-koriscenja/page.tsx`
- `app/(legal)/zamena-proizvoda/page.tsx`

### Storefront stranice

- `app/(shop)/cart/page.tsx`
- `app/(shop)/catalog/brand/[groupId]/page.tsx`
- `app/(shop)/checkout/page.tsx`
- `app/(shop)/layout.tsx`
- `app/(shop)/order/success/page.tsx`
- `app/(shop)/page.tsx`
- `app/(shop)/payment/failed/page.tsx`
- `app/(shop)/payment/success/page.tsx`
- `app/(shop)/pretraga/page.tsx`
- `app/(shop)/prodajna-mesta/page.tsx`
- `app/(shop)/product/[id]/LocalProductDetail.tsx`
- `app/(shop)/product/[id]/page.tsx`

### Korisnički deo

- `app/(user)/layout.tsx`
- `app/(user)/moj-nalog/favoriti/page.tsx`

### Admin stranice

- `app/admin/chat/poruke/page.tsx`
- `app/admin/layout.tsx`
- `app/admin/settings/page.tsx`

### API rute

- `app/api/admin/orders/[id]/status/route.ts`
- `app/api/admin/settings/route.ts`
- `app/api/health/route.ts`
- `app/api/job-application/route.ts`
- `app/api/og/[itemId]/route.tsx`
- `app/api/order/route.ts`
- `app/api/orders/[id]/route.ts`
- `app/api/orders/route.ts`
- `app/api/payments/nestpay/callback/fail/route.ts`
- `app/api/payments/nestpay/callback/success/route.ts`
- `app/api/payments/nestpay/start/route.ts`
- `app/api/promotions/route.ts`
- `app/api/recaptcha/verify/route.ts`

### Globalni app fajlovi

- `app/globals.css`
- `app/layout.tsx`
- `app/robots.ts`
- `app/sitemap.ts`

### Komponente

- `components/admin/AdminShell.tsx`
- `components/checkout/CheckoutForm.tsx`
- `components/checkout/ClearCartOnMount.tsx`
- `components/checkout/CouponInput.tsx`
- `components/checkout/OrderSummary.tsx`
- `components/checkout/index.ts`
- `components/filter/MobileFilters.tsx`
- `components/home/HeroSection.tsx`
- `components/job/JobForm.tsx`
- `components/layout/CartDrawer.tsx`
- `components/layout/Footer.tsx`
- `components/layout/Logo.tsx`
- `components/layout/MobileMenu.tsx`
- `components/layout/NavBar.tsx`
- `components/layout/NavBarWrapper.tsx`
- `components/layout/Ticker.tsx`
- `components/product/LocalProductCard.tsx`
- `components/product/ProductCard.tsx`
- `components/reklamacije/Reklamacije.tsx`
- `components/search/SearchModal.tsx`

### Hooks, biblioteke, schema i tipovi

- `hooks/useCartPromotions.ts`
- `lib/email/mailer.ts`
- `lib/nestpay/index.ts`
- `lib/orders/index.ts`
- `lib/products.ts`
- `prisma/schema.prisma`
- `proxy.ts`
- `scripts/cloud-init.yaml`
- `scripts/db-setup.sql`
- `scripts/deploy.sh`
- `store/cart.ts`
- `types/cart.ts`
- `types/order.ts`

### Dodatni postojeći fajlovi promenjeni samo normalizacijom redova

Sledećih 113 fajlova nema novu poslovnu funkcionalnost u ovom koraku. Njihov staged sadržaj je normalizovan na LF i, gde je snapshot provera to zahtevala, uklonjen je trailing whitespace ili višak praznih redova na kraju fajla:

- `app/(auth)/verify-email/[token]/page.tsx`
- `app/admin/chat/page.tsx`
- `app/api/admin/chat/messages/route.ts`
- `app/api/admin/chat/route.ts`
- `app/api/admin/orders/export/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/verify-email/[token]/route.ts`
- `app/api/chat/faq/route.ts`
- `app/api/chat/messages/route.ts`
- `app/api/instagram-feed/route.ts`
- `app/api/newsletter/unsubscribe/route.ts`
- `app/api/wishlist/route.ts`
- `app/error.tsx`
- `app/loading.tsx`
- `app/providers.tsx`
- `components/ReCaptchaProvider.tsx`
- `components/admin/NewsletterPreview.tsx`
- `components/chat/ChatWidget.tsx`
- `components/filter/FilterMobile.tsx`
- `components/filter/PerPageSelector.tsx`
- `components/filter/PriceSlider.tsx`
- `components/home/FeaturedCarousel.tsx`
- `components/home/FeaturesStrip.tsx`
- `components/home/InstagramFeed.tsx`
- `components/home/MissionStatement.tsx`
- `components/home/NewArrivals.tsx`
- `components/home/StatsSection.tsx`
- `components/home/Testimonials.tsx`
- `components/home/TrustBar.tsx`
- `components/product/ProductGrid.tsx`
- `components/product/RecentlyViewed.tsx`
- `components/product/SearchProductGrid.tsx`
- `components/product/SimilarProducts.tsx`
- `components/product/SocialShare.tsx`
- `components/seo/BreadcrumbJsonLd.tsx`
- `components/seo/index.ts`
- `components/ui/Accordion.tsx`
- `components/ui/Drawer.tsx`
- `components/ui/Pagination.tsx`
- `components/ui/Skeleton.tsx`
- `components/ui/index.ts`
- `hooks/useReCaptcha.ts`
- `hooks/useRecentlyViewed.ts`
- `lib/config/store.ts`
- `lib/email/auth-emails.ts`
- `lib/hooks/index.ts`
- `lib/utils/cn.ts`
- `lib/utils/product.ts`
- `lib/utils/text.ts`
- `lib/utils/validation.ts`
- `postcss.config.js`
- `scripts/create-admin.ts`
- `store/quickView.ts`
- `store/ui.ts`
- `store/wishlist.ts`
- `tsconfig.json`
- `types/index.ts`
- `types/product.ts`
- `app/(auth)/reset-password/[token]/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/(shop)/product/[id]/ProductDetailClient.tsx`
- `app/(user)/moj-nalog/adrese/page.tsx`
- `app/(user)/moj-nalog/favoriti/FavoritesGrid.tsx`
- `app/(user)/moj-nalog/page.tsx`
- `app/admin/orders/ExportOrders.tsx`
- `app/admin/ticker/page.tsx`
- `app/api/admin/banners/route.ts`
- `app/api/admin/newsletter/images/route.ts`
- `app/api/admin/newsletter/route.ts`
- `app/api/admin/ticker/[id]/route.ts`
- `app/api/admin/ticker/route.ts`
- `app/api/admin/wishlist-alerts-log/route.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/reset-password/confirm/route.ts`
- `app/api/auth/reset-password/request/route.ts`
- `app/api/banners/route.ts`
- `app/api/newsletter/image/[id]/route.ts`
- `app/api/ticker/route.ts`
- `app/api/user/addresses/[id]/default/route.ts`
- `app/api/user/addresses/route.ts`
- `app/api/user/password/route.ts`
- `app/not-found.tsx`
- `components/filter/AccessoriesFilter.tsx`
- `components/filter/FilterSidebar.tsx`
- `components/filter/FiltersAside.tsx`
- `components/filter/SortDropdown.tsx`
- `components/filter/index.ts`
- `components/home/BrandSlider.tsx`
- `components/home/index.ts`
- `components/layout/Header.tsx`
- `components/layout/index.ts`
- `components/product/ProductAccordion.tsx`
- `components/product/ProductGallery.tsx`
- `components/product/QuickViewModal.tsx`
- `components/product/SizeGuideDialog.tsx`
- `components/product/SizeSelector.tsx`
- `components/ui/Badge.tsx`
- `components/ui/Button.tsx`
- `components/ui/Dialog.tsx`
- `components/ui/Input.tsx`
- `lib/auth/index.ts`
- `lib/auth/password.ts`
- `lib/banners/index.ts`
- `lib/db/index.ts`
- `lib/hooks/useFilterCounts.ts`
- `lib/nestpay/errors.ts`
- `lib/rate-limit.ts`
- `lib/utils/format.ts`
- `next.config.ts`
- `scripts/backup.sh`
- `scripts/restore.sh`
- `store/index.ts`
- `tailwind.config.ts`

## 31. Završna ocena trenutnog stanja

Dosadašnji rad je postavio ozbiljnu osnovu za univerzalni web shop: identitet i tema su centralizovani, checkout više ne veruje browser cenama, porudžbina i payment imaju znatno čvršće transakcione i bezbednosne invarijante, a CI/CD i release deployment imaju verifikaciju i rollback.

Najveći preostali posao nije još jedno površinsko UI proširenje, već završavanje vertikalnih tokova:

- stvarna i pregledana DB migracija;
- stabilan generički variant/inventory identitet od admina do OrderItem snapshot-a;
- kompletan content/media sistem za menjanje branše;
- operativni admin moduli;
- payment reconciliation/refund/cleanup;
- integracioni, E2E i accessibility testovi;
- pregled i merge GitHub PR-a, pa tek potom aktivacija deployment workflow-a.

Drugim rečima: platforma sada ima mnogo kvalitetniju arhitektonsku i bezbednosnu osnovu i bezbedno objavljenu V2 feature granu, ali zbog namerno neprimenjene migracije, isključenih kartica i nespojenog `main` PR-a još nije spremna da se tretira kao završena produkciona V2 verzija.
