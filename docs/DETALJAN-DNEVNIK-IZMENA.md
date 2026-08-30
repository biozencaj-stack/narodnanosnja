# Detaljan dnevnik dosadašnjih izmena — V2 univerzalna web-shop platforma

> Datum preseka: 29. avgust 2026.<br>
> Projekat: `narodnanosnja-prodavnica`<br>
> Grana: `verzija/v2.0-univerzalna-platforma`<br>
> Lokalna polazna revizija: `f6e3dac`<br>
> GitHub snapshot commit: `3dc757ac6280b77c7951a888ec2d3ad609ddae1d`<br>
> Status dokumenta: V2 feature grana je objavljena na GitHub-u, produkciona baza je bezbedno migrirana na V2 šemu, dok `main` i javna aplikaciona verzija nisu promenjeni niti deployovani.

> **Operativna dopuna — 30. avgust 2026.** Istorijski opisi u ovom dnevniku
> ostaju sačuvani kao zapis stanja u trenutku kada su nastali. Za trenutno
> važeću GitHub Actions i release politiku merodavna je [sekcija 38](#38-p0-razdvajanje-v2-ci-ja-i-produkcijskog-release-a),
> koja zamenjuje ranije operativne tvrdnje da push na `main` ili ručni
> `workflow_dispatch` pokreću produkcijski deploy. Nijedna od promena iz te
> sekcije nije sama po sebi pustila V2 aplikaciju uživo.

> **Auth credential dopuna — 30. avgust 2026.** Expand/compat presek opisan u
> [sekciji 42](#42-p1-auth-credential-storage-i-atomska-reset-potvrda) integrisan
> je kroz PR #16 uz zeleni exact-head i post-merge CI. Produkcijska migracija,
> runtime dokaz i završna hash-only/TTL+grace/contract faza ostaju neizvršeni.

> **Atomska registracija/resend dopuna — 30. avgust 2026.** Aktuelni kodni
> presek opisan je u
> [sekciji 43](#43-p1-atomska-registracija-i-verification-resend). On zatvara
> atomic User+credential registraciju i uvodi DB-backed resend/cooldown/fixed
> allowance, ali ne aktivira verified-login, ne primenjuje migracije na
> produkciji i ne pušta aplikaciju live. Završni Git/PR/CI dokaz:
> `PENDING_FINAL_EVIDENCE`.

## 1. Svrha dokumenta

Ovaj dokument je detaljan tehnički i funkcionalni zapis promena urađenih u dosadašnjem radu na V2 verziji prodavnice. Napravljen je na osnovu stvarnog Git diff-a, pregleda novih fajlova, provere implementacije i pokrenutih validacija.

Dokument namerno razlikuje četiri vrste stanja:

- **implementirano** — kod postoji u lokalnom projektu;
- **lokalno provereno** — implementacija je prošla navedenu statičku proveru, test ili build;
- **primenjeno na produkcionu bazu** — pregledana promena šeme je izvršena uz backup, restore i post-migration proveru, ali to samo po sebi ne znači da je nova aplikaciona verzija objavljena;
- **pripremljeno, ali neaktivno** — kod postoji, ali zahteva konfiguraciju, bankarsku sertifikaciju, Git merge ili aplikacioni deploy;
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
| Ciljni automatski testovi | 33/33 prolazi |
| TypeScript provera | prolazi |
| Produkcioni build | prolazi |
| Prisma schema validacija | prolazi |
| Produkcioni DB baseline/expand | uspešno primenjeno; 4/4 migracije završene |

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

Prvobitna zaštita je uključila proveru TLS sertifikata u opštem maileru i
prijavi za posao, ali su auth, order i wishlist moduli zadržali zasebne
fail-open transportere. Naknadni P1 pregled i potpuna centralizacija opisani su
u odeljku 35.

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

SQL migracioni lanac je napravljen, pregledan, testiran nad praznom bazom i
restore klonom, a zatim uspešno primenjen na produkcionu bazu. Lanac čine:

1. current-state produkcioni baseline;
2. zasebna enum migracija za `PROCESSING`;
3. zasebna enum migracija za `REVIEW`;
4. transakcijski expand za order/payment polja, generički katalog,
   `ProductSize` stabilnost, DB `CHECK` ograničenja i deferred triggere.

Produkcioni seed/backfill generičkog kataloga, dual-read i buduća
contract/cleanup faza i dalje nisu izvršeni. To su odvojene poslovne migracije,
a ne preduslov za bezbedno additive proširenje šeme.

Ne treba koristiti `prisma db push` nad produkcionom bazom.

## 20. GitHub Actions i automatsko objavljivanje

### 20.1. Workflow

`.github/workflows/objavi.yml` je prepravljen da reaguje na:

- svaki push na `main`;
- svaki pull request ka `main`, samo kroz CI proveru bez deploy-a;
- ručno pokretanje (`workflow_dispatch`).

Workflow koristi:

- `permissions: contents: read`;
- odvojene concurrency grupe: serijsku za produkciju i zasebnu po pull request-u;
- Node.js 22;
- izolovani PostgreSQL 16 servis za CI;
- `npm ci` sa lock fajlom;
- odvojen verify job pre deploy job-a;
- GitHub production environment;
- validaciju potrebnih vars/secrets;
- obaveznu punu HTTPS validaciju `PRODUCTION_URL` vrednosti;
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
3. kompletan `prisma migrate deploy` nad praznom PostgreSQL 16 bazom;
4. Prisma schema-drift proveru;
5. rollback-only DB invariant smoke kroz `psql`;
6. TypeScript proveru;
7. 33 ciljna sigurnosna/commerce/inventory/payment testa;
8. produkcioni build.

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
- `DEPLOY_PATH` — opciona;
- `APP_PORT` — opciona;
- `SMOKE_PORT` — opciona i mora biti različita od `APP_PORT`;
- `APP_NAME` — opciono, validirano PM2 ime.

Stvarne vrednosti tajni nisu upisane u repozitorijum niti ovaj dokument.

### 20.4. Trenutno operativno stanje workflow-a

GitHub environment `production` je kreiran i njegova custom deployment branch
policy dozvoljava samo `main`. Naknadni read-only audit potvrđuje da environment
trenutno ima **0 secrets i 0 variables**. Potrebne vrednosti nisu upisane bez
eksplicitnog odobrenja vlasnika.

Workflow je na V2 feature grani. Sam push te grane nije pokrenuo produkcijski
deploy. Automatski tok može postati operativan tek kada se podese potrebni
environment secrets/variables i kada se V2 bezbedno spoji u `main`.

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

Commit i push ranijeg feature snapshot-a su završeni. Produkciona DB migracija
je naknadno primenjena zasebnim kontrolisanim postupkom, ali nije urađen merge
u `main` niti aplikacioni produkcijski deploy.

## 23. Lokalno pokrenute provere

### 23.1. Provere koje prolaze

| Provera | Rezultat | Napomena |
| --- | --- | --- |
| `npx prisma validate` | prolazi | upozorenje da je Prisma config u `package.json` deprecated za Prisma 7 |
| `npx tsc --noEmit --incremental false` | prolazi | TypeScript bez grešaka |
| ciljni Node/TS testovi | 33/33 prolazi | admin policy, NestPay, payment/order access, inventory sync, reservation, pending-card i quote fail-closed politika |
| produkcioni Next build | prolazi | Next.js 16.1.6, TypeScript i 91/91 generisanih stranica |
| `bash -n scripts/deploy.sh` | prolazi | shell sintaksa validna |
| YAML parse workflow-a | prolazi | workflow sintaksno parsiran |
| `git diff --check` | prolazi | nema whitespace grešaka u tadašnjem diff-u |

Tokom builda lokalni PostgreSQL na `127.0.0.1` nije bio dostupan. Settings i određeni javni upiti koristili su predviđene fallback vrednosti, pa je build završen, ali to nije zamena za staging DB integracioni test.

### 23.2. Ciljni testovi

Pokrenuti test paket obuhvata osam ciljnih test fajlova: admin policy, NestPay,
payment policy, order access, order inventory, stabilni ProductSize sync,
checkout quote/inventory i pending-card politiku — ukupno 33 testa.

Pokriveni su role/method/path slučajevi, callback origin i potpis, tajnost logova, nepouzdana provider polja, review klasifikacija, replay, terminalni konflikti, scope i istek access tokena.

### 23.3. Provera koja trenutno ne radi

`npm run lint` pada zato što package script i dalje poziva `next lint`, a ta komanda više nije validna u korišćenoj Next.js 16 verziji. Ovo nije ESLint nalaz u source kodu, već neusklađen lint script/tooling.

Potrebno je prebaciti skriptu na direktan ESLint poziv, dodati/uskladiti konfiguraciju i zatim lint uvrstiti u verify job.

### 23.4. Provere koje još nisu urađene

Nisu još urađeni:

- E2E browser test checkout toka;
- puni PostgreSQL concurrency/stress testovi izvan ciljanih inventory scenarija;
- stvarni NestPay staging/HPP test;
- Lighthouse budžeti;
- automatizovani accessibility audit;
- cross-browser/mobile QA;
- staging deploy i rollback vežba.

## 24. Poznati kritični rizici i blokatori

### 24.1. Zatvoreno — Prisma baseline i expand su primenjeni

Prethodni P0 je zatvoren: napravljen je produkcioni baseline, tri expand
migracije, restore/fresh/drift testovi i kontrolisana produkciona primena.
Produkcija sada ima četiri završena Prisma migration zapisa i šemu bez drifta.

### 24.2. Zatvoreno — ProductSize identitet je stabilan

Admin više ne radi delete/recreate. Postojeći redovi se zaključavaju i
reconcilišu po stabilnom ID-u; uklonjena veličina dobija `active=false`, a
ponovno dodavanje reaktivira isti red. DB dodaje `active`, unique
`(productId,size)`, indeks `(productId,active)` i validacije zalihe/naziva.

### 24.3. Zatvoreno — checkout bez inventory konfiguracije radi fail-closed

Aktivan proizvod mora imati bar jedan aktivni stock red. Quote odbija proizvod
bez konfigurisanog inventory-ja, nepostojeću/povučenu opciju i nedovoljnu
zalihu. Kreiranje porudžbine ponovo proverava tačan aktivni `stockId` i atomarno
smanjuje zalihu, pa nema više implicitnog „neograničenog” proizvoda.

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
- reservation-cleanup kod je u V2; svaka njegova izmena mora proći opt-in
  PostgreSQL race/prefilter test u CI-ju, a produkcija zatim zahteva zasebno
  odobren secret, dry-run/apply smoke i VPS timer;
- multi-tab, refresh, 429/5xx i network-loss testovi;
- trajan idempotentni email outbox.

Implementacija zatvara rupu u aplikacionoj politici, ali sama prisutnost koda
ne čini cleanup operativnim. Kartice ostaju isključene dok scheduler,
monitoring, `REVIEW`/reconciliation/refund i bankarski staging nisu dokazani.

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

1. Završeno: napravljen je stvaran backup i dokazan restore.
2. Završeno: baseline-ovana je produkciona šema.
3. Završeno: napravljen je i primenjen pregledani expand lanac.
4. Završeno: ProductSize delete/recreate je zamenjen stabilnim soft-retire tokom.
5. Završeno: checkout inventory politika radi fail-closed.
6. Sledeće: proširiti PostgreSQL concurrency testove na duže stress scenarije.

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
2. Završiti i pushovati reservation-cleanup granu i zahtevati prolaz opt-in
   PostgreSQL concurrency testa u CI-ju.
3. Postaviti zaseban cleanup secret, uraditi eksplicitan dry-run pa kontrolisan
   apply smoke i tek zatim instalirati nadgledani VPS timer.
4. Završiti `REVIEW` inbox, reconciliation i refund tok.
5. Uvesti email outbox.
6. Uvežbati staging deploy/rollback i kompletan HPP/callback scenario.
7. Potvrditi produkcione secrets/vars, domen i HTTPS.
8. Tek zatim uključiti card capability.

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

- aplikacioni deploy tek posle odobrene server/GitHub/HTTPS konfiguracije;
- stabilan generički variant identitet od opcija do OrderItem snapshot-a;
- kompletan content/media sistem za menjanje branše;
- operativni admin moduli;
- produkciona operacionalizacija reservation cleanup-a, payment
  reconciliation i refund;
- integracioni, E2E i accessibility testovi;
- pregled i merge GitHub PR-a, pa tek potom aktivacija deployment workflow-a.

Drugim rečima: produkciona baza je sada bezbedno proširena i spremna za V2 kod,
ali javna aplikacija još nije V2. Kartice su isključene, GitHub/server tajne i
HTTPS nisu završeni, a Draft PR #1 ka `main` nije spojen niti deployovan.
Reservation-cleanup kod je u V2, ali nije deployovan; VPS timer i prvi
dry-run/apply smoke nisu izvršeni.

## 32. Production-readiness rad — 29. avgust 2026.

Ovaj odeljak beleži naknadni operativni rad obavljen posle prvog V2 snapshot-a.
Vrednosti tajni, privatni ključevi, kredencijali i mrežne adrese namerno nisu
zapisani. Navedene checksum vrednosti su javni integritetski otisci fajlova, a
ne autentifikacioni podaci.

### 32.1. GitHub production environment

Na GitHub-u je kreiran environment `production`. Podešena je custom deployment
branch policy koja dozvoljava produkcijski deploy samo sa grane `main`.

Read-only audit environment-a posle podešavanja pokazao je:

- environment secrets: **0**;
- environment variables: **0**.

To znači da sam environment i deployment branch politika postoje, ali deploy i dalje ne
može početi. Nisu upisani sledeći obavezni secrets:

- `SSH_PRIVATE_KEY`;
- `SSH_KNOWN_HOSTS`;
- `SERVER_HOST`;
- `SERVER_USER`.

Nije upisana obavezna variable `PRODUCTION_URL`, niti opcione variables
`SERVER_PORT`, `DEPLOY_PATH`, `APP_PORT`, `SMOKE_PORT` i `APP_NAME`.
Vrednosti se neće pretpostavljati niti automatski kopirati iz lokalnog sistema;
zahtevaju eksplicitno odobrenje vlasnika i unos u odgovarajući GitHub
environment scope.

### 32.2. Read-only serverski i DB audit

Pre bilo kakve promene urađen je read-only pregled produkcionog servera i
PostgreSQL šeme. Audit je potvrdio:

- PostgreSQL 16 produkcionu bazu;
- postojeću legacy šemu sa localized JSONB kolonama i
  `User.preferredLocale`;
- odsustvo Prisma `_prisma_migrations` istorije pre baseline postupka;
- početne countove: `Product=18`, `ProductSize=18`, `Order=0`,
  `Transaction=0`;
- da novi V2 katalog/order/payment objekti pre migracije nisu postojali;
- da deploy korisnik, deploy SSH ključ, aplikacioni `.env`, PM2 i reverse-proxy
  promene nisu autorizovane samim auditom.

Audit nije ispisivao connection string, lozinke, ključeve, tajne ni konkretnu
mrežnu adresu. Naknadna DB migracija bila je zasebna, eksplicitno kontrolisana
operacija i nije proširila ovlašćenje na aplikacioni deploy ili serverske naloge.

### 32.3. Produkcioni backup-i i javni checksumovi

Pre migracije su napravljena dva schema/data backup preseka.

Prvi backup, korišćen za restore i pripremu baseline-a:

```text
/var/backups/narodnanosnja/prod-20260829-before-v2.dump
SHA-256: b2a75af62fb6df014588540bafa16cf726e3b88b8e3f25c8c5e6039930b7eed4
schema SHA-256: dabe254c3b2accaae4b0bf0d439d15065a7fff5a334682cbb8535aedb497b31d
```

Neposredni pre-migration backup, napravljen tik pre produkcione primene:

```text
/var/backups/narodnanosnja/prod-20260829-immediate-pre-v2.dump
SHA-256: 7c5e4ac67119d7dd40b58d6756b945d573e9810e4a4b664013b02fff361d
schema SHA-256: 07b604f29dd7a7ac5b139a75e03ed605e92ce008c8ed0420c310456f86caead8
```

Backup putanje su serverske operativne putanje, a checksumovi omogućavaju da se
pre restore-a potvrdi da fajl nije promenjen. Backup nije dodat u Git i ne
nalazi se u aplikacionom release paketu.

### 32.4. Prisma baseline i expand lanac

Aktivna migraciona istorija sada ima četiri koraka:

| Redosled | Migracija | SHA-256 |
| ---: | --- | --- |
| 1 | `20260829000000_baseline_production_before_v2` | `0aff56aa04c0bc388a5ca53f67c6a7ffc65c5d9ea2e41139789756186ef26942` |
| 2 | `20260829010000_add_payment_status_processing` | `b80018daa574c030f2a896d53aa23427627e5897f05348ecda5b3039d508c946` |
| 3 | `20260829010100_add_payment_status_review` | `831ecf4688ad95a700136fdaa04143dedb25da3994e52ea8b840f8d1d70cc48a` |
| 4 | `20260829020000_expand_v2_platform` | `d064d2b2af0275923546fcce5622e95cc83a2f0e940866ef14fc63d08b2d283a` |

Baseline je current-state schema-only snimak stare produkcije. Stara parcijalna
localized-JSON migracija nije bila evidentirana u produkcionoj bazi i nije bila
deo pouzdane aktivne istorije, pa je arhivirana van `prisma/migrations` lanca.
Postojeća produkcija je baseline samo evidentirala kao primenjen; baseline DDL
se nije izvršavao preko već postojećih tabela.

Dve `PaymentStatus` vrednosti su razdvojene zbog PostgreSQL kompatibilnosti i
imaju eksplicitan redosled:

- `PROCESSING AFTER PENDING`;
- `REVIEW AFTER FAILED`.

Glavni expand je transakcijski. Dodaje order/payment polja i `PaymentEvent`,
generičke kataloške tabele, kompozitne FK/unique invarijante, ručne `CHECK`
provere i deferred cardinality triggere za `SELECT`, `MULTI_SELECT` i skalarne
atribute.

### 32.5. Fresh-DB P1014 nalaz i baseline popravka

Prvi test kompletnog migracionog lanca nad praznom bazom otkrio je runtime
problem koji običan `prisma validate` ne može da vidi. Originalni schema-only
`pg_dump` sadržao je:

```sql
SELECT pg_catalog.set_config('search_path', '', false);
```

Prisma je posle baseline-a nastavio u istoj sesiji sa praznim `search_path` i
prijavio `P1014` za sopstvenu `_prisma_migrations` tabelu. Baseline je zato
namerno normalizovan na:

```sql
SET search_path = public, pg_catalog;
```

Ova korekcija ne menja poslovne tabele, podatke, indekse ili ograničenja. Ona
samo čuva `public` dostupnim Prisma migration engine-u. Posle izmene fresh-DB
test je ponovljen i kompletan lanac je uspešno primenjen.

### 32.6. Restore, fresh, drift, negative i smoke provere

Pre produkcione primene sprovedene su sledeće provere:

1. backup je vraćen u izolovanu PostgreSQL bazu;
2. realna pre-V2 šema je popisana i korišćena za current-state baseline;
3. kompletan lanac je primenjen od nule nad praznom PostgreSQL 16 bazom;
4. restore klon je prošao baseline/expand proceduru bez gubitka legacy redova;
5. Prisma diff posle migracije vratio je drift rezultat `0`;
6. katalog je posle migracije imao `0` invalidnih constraints i `0` invalidnih
   indeksa;
7. negativne transakcione probe potvrdile su da DB odbija pogrešan typed-scalar
   atribut, nedozvoljen choice tip/cardinality, negativnu cenu/zalihu/iznos,
   praznu ili netrimovanu veličinu i dupli `(productId,size)`;
8. validni smoke test je ubacio sopstveni rollback-only Product fixture i svih
   deset `ProductAttributeDataType` vrednosti;
9. `SET CONSTRAINTS ALL IMMEDIATE` je uspešno pokrenuo deferred triggere za
   `SELECT` sa jednim i `MULTI_SELECT` sa više izbora;
10. smoke transakcija je završena sa `ROLLBACK`, bez trajnih fixture podataka.
11. posle P1 hardening-a novi read-only legacy preflight je ponovo prošao nad
    produkcijom, a prošireni validni/negativni invariant smoke nad izolovanim
    restore klonom; i ta provera se završila sa `ROLLBACK`.

Reusable smoke scenario sačuvan je kao `scripts/db-invariant-smoke.sql`.
Naknadnim P1 hardening-om u isti rollback-only scenario dodate su kontrolisane
negativne probe unutar PL/pgSQL exception subtransakcija. Zato cela skripta
uspeva samo ako baza očekivano odbije nevalidne redove, bez ostavljanja fixture
podataka.

### 32.7. Uspešna produkciona DB primena

Posle neposrednog backup-a i svih izolovanih provera migracioni lanac je
uspešno primenjen na produkcionu bazu. Post-migration audit potvrđuje:

- broj tabela posle expand-a: **42**;
- završeni Prisma migration zapisi: **4**;
- invalid constraints: **0**;
- invalid indeksi: **0**;
- Prisma schema drift: **0**.

Pre/post countovi poslovnih tabela su očuvani:

| Tabela | Pre | Posle |
| --- | ---: | ---: |
| `Product` | 18 | 18 |
| `ProductSize` | 18 | 18 |
| `Order` | 0 | 0 |
| `Transaction` | 0 | 0 |

Ovo potvrđuje additive prirodu migracije: postojeći proizvodi i zalihe nisu
obrisani niti duplirani. Produkciona DB primena nije menjala Git `main`, nije
slala novu aplikacionu verziju i nije uključila payment capability.

### 32.8. Stabilan ProductSize identitet i fail-closed checkout

Prethodni delete/recreate admin tok je zamenjen stabilnim reconciliation
modelom:

- svaki postojeći `ProductSize.id` ostaje isti tokom izmene;
- red koji administrator ukloni iz ponude dobija `active=false` umesto fizičkog
  brisanja;
- ponovno dodavanje iste veličine reaktivira postojeći red;
- parent `Product` red se zaključava tokom sync-a radi serijalizacije paralelnih
  admin izmena;
- admin za svaki postojeći red šalje `expectedStock`; server odbija zastarelu
  izmenu sa `409 PRODUCT_SIZE_STALE_STOCK`, a postojeći red bez očekivane
  verzije sa `409 PRODUCT_SIZE_VERSION_REQUIRED`, pa admin unos ne može da
  prepiše rezervaciju ili povrat koji se dogodio u međuvremenu;
- case-insensitive duplikati, tuđi/dupli ID-evi, negativna zaliha i nevalidan
  naziv odbijaju se pre upisa;
- checkout, release/cancel i admin sync koriste iste sortirane parent Product
  lockove, što smanjuje deadlock rizik kod porudžbina sa više proizvoda;
- reaktivacija povučenog reda sabira novu količinu sa eventualnim povratom koji
  je stigao dok je red bio neaktivan, umesto da povrat neprimetno prepiše;
- DB dodatno garantuje unique `(productId,size)`, `stock >= 0`, trimovan naziv
  dužine 1–100 i indeksira `(productId,active)`.

Checkout sada radi fail-closed:

- proizvod bez aktivnog stock reda vraća `INVENTORY_NOT_CONFIGURED`;
- povučena ili nepostojeća opcija vraća `OPTION_UNAVAILABLE`;
- nedovoljna količina vraća `INSUFFICIENT_STOCK`;
- order transakcija rezerviše isključivo tačan aktivni `stockId`;
- `OrderItem.inventoryStockId` ostaje pouzdan za exactly-once vraćanje zalihe.

### 32.9. CI workflow ojačavanje

CI više ne proverava samo Prisma datamodel sintaksu. Verify job sada:

1. podiže PostgreSQL 16 service;
2. čeka DB health;
3. pokreće `prisma validate`;
4. primenjuje celu migration istoriju na praznu bazu;
5. blokira schema drift;
6. kroz `psql` pokreće rollback-only DB invariant smoke;
7. proverava TypeScript;
8. pokreće ciljane sigurnosne testove, uključujući REVIEW cleanup i
   pending-card politiku;
9. pravi produkcijski Next.js build.

Pull request ka `main` pokreće samo CI i nikada deploy. Svaki PR ima sopstvenu
concurrency grupu i noviji run može otkazati zastareli run istog PR-a.
Produkcijski push i ručni deploy dele jednu serijsku concurrency grupu i ne
prekidaju aktivan deploy.

Deploy validacije sada zahtevaju:

- ispravan `SERVER_PORT`, `APP_PORT` i `SMOKE_PORT`;
- različite app/smoke portove;
- bezbedan `APP_NAME`;
- aplikacioni `DEPLOY_PATH` pod `/var/www` ili `/srv`;
- `PRODUCTION_URL` koji počinje isključivo sa `https://`;
- tačan release ID;
- strogu known-hosts SSH proveru.

Ručni deploy je takođe ograničen na `main`, korišćene GitHub Actions su pinovane
na pune commit SHA vrednosti, a produkcioni `.env` symlink se u novom release-u
pravi tek posle uspešnog `npm ci`, tako da install lifecycle ne dobija pristup
produkcijskim tajnama.

Serverski deploy i cleanup koriste isti `flock`; javni health check mora vratiti
tačan deployment SHA i ne prihvata HTTP→HTTPS ili `www` preusmerenje kao zamenu
za direktno zdrav HTTPS poreklo.

### 32.10. Aplikacione provere

Posle inventory, payment-review i migracionih promena potvrđeno je:

- `33/33` ciljna Node/TypeScript testa;
- `npx tsc --noEmit --incremental false` prolazi;
- produkcioni Next.js build prolazi;
- Prisma schema validacija prolazi;
- migration deploy i drift provera prolaze nad praznom PostgreSQL 16 bazom;
- DB invariant smoke prolazi za validne redove i sva očekivana odbijanja;
- `git diff --check` prolazi.

Ove provere ne zamenjuju browser E2E, accessibility, bankarski staging i stvarni
HTTPS deployment smoke test, koji ostaju deo kasnije aplikacione objave.

### 32.11. Precizni preostali produkcioni blokatori

DB šema je spremna, ali aplikacioni deploy ostaje blokiran sledećim stavkama:

1. **Deploy korisnik i dozvole** — kreiranje/izbor ograničenog serverskog
   deploy korisnika, vlasništvo nad deploy putanjom i PM2 proces zahtevaju
   eksplicitno odobrenje. Read-only audit i DB migracija nisu dozvola za ove
   sistemske promene.
2. **Deploy SSH ključ** — javni ključ još nije odobreno instaliran za ciljnog
   deploy korisnika; privatna polovina ne sme biti kopirana u repo ili server.
3. **Produkcioni server `.env`** — mora biti zasebno pregledan i postavljen uz
   eksplicitno odobrenje; GitHub workflow očekuje postojeći `$DEPLOY_PATH/.env`.
4. **GitHub environment vrednosti** — `production` trenutno ima 0 secrets i 0
   variables; bez četiri SSH/server secrets i `PRODUCTION_URL` deploy staje pre
   slanja koda.
5. **Domen i HTTPS** — konačni domen, DNS, TLS sertifikat i reverse proxy moraju
   biti spremni tako da kanonski `PRODUCTION_URL` i `/api/health` rade direktno
   preko HTTPS-a bez preusmerenja.
6. **`ORDER_ACCESS_SECRET`** — potreban je jak, zaseban produkcioni secret koji
   nije isti kao `NEXTAUTH_SECRET`; nijedna stvarna vrednost nije generisana ili
   zabeležena ovde.
7. **reCAPTCHA** — oba produkciona ključa, očekivane action vrednosti, score prag
   i hostname allow-list moraju biti potvrđeni. Checkout u produkciji namerno
   radi fail-closed bez ove konfiguracije.
8. **SMTP** — host, port, nalog, credential, sender identitet i TLS validacija
   moraju biti potvrđeni stvarnim kontrolisanim testom.
9. **Reservation cleanup operativa** — svaka promena cleanup koda mora proći
   opt-in PostgreSQL race/prefilter test u CI-ju. Produkcijski server zatim
   zahteva zaseban `ORDER_RESERVATION_CLEANUP_SECRET`, prvi eksplicitan dry-run,
   kontrolisani apply smoke, nadgledani systemd timer i proveru agregatnih
   rezultata. Nijedna od tih server radnji nije izvršena ovom izmenom.
10. **Capability/feature flagovi** — COD, wishlist, reviews, newsletter, chat,
   locations i druge javne funkcije treba eksplicitno potvrditi za ovu
   prodavnicu. Kartično plaćanje ostaje `false` do bankarske sertifikacije,
   operativnog cleanup timera i završenih REVIEW/reconciliation/refund tokova.
11. **Git merge i deploy odluka** — production-readiness promene su sačuvane na
    V2 feature grani; remote `main` nije promenjen i javna aplikacija nije V2.
    Merge u `main` automatski aktivira workflow, pa se ne radi pre završetka
    svih prethodnih stavki.

Konačni production-readiness zaključak: **DB sloj je migriran i verifikovan;
aplikacioni deploy još nije odobren ni konfigurisan.**

### 32.12. P1 legacy preflight i DB/CI hardening

Posle produkcione expand primene dodat je hardening za buduće postojeće baze,
bez izmene produkcije i bez menjanja četiri već primenjena migration fajla:

- `scripts/db-legacy-preflight.sql` je izvršiva read-only provera sa lokalnim
  lock/statement timeoutima i završnim `ROLLBACK`-om;
- preflight zaustavlja postupak jasnim exception porukama za exact i
  case/trim-normalizovane `ProductSize` duplikate, blank/netrimovane/preduge
  veličine, negativne zalihe/cene/mere/order iznose, nevalidne količine i
  aktivan legacy proizvod bez size reda;
- rollout dokument sada zahteva maintenance/read-only prozor, zaustavljanje
  aplikacionih upisa, pregled lockova, timeout kalibrisan na restore klonu i
  eksplicitan recovery plan umesto slepog ponavljanja prekinute migracije;
- reusable DB smoke sada, pored validnih vrednosti svih deset attribute tipova,
  dokazuje odbijanje pogrešne scalar kolone, `SELECT` sa 0 i 2 izbora, izbora
  iz druge definicije i negativne zalihe;
- očekivane greške su izolovane PL/pgSQL exception subtransakcijama, a cela
  smoke transakcija se na kraju vraća sa `ROLLBACK`;
- CI posle migrate/drift koraka pokreće smoke direktno kroz `psql` sa
  `ON_ERROR_STOP=1` i uključuje novi `lib/payments/pending-card.test.ts` u
  ciljanu test listu; REVIEW cleanup je obuhvaćen postojećim payment-policy
  testovima.

Checksumovi četiri primenjene migracije ostaju kanonski i ne smeju se menjati:

| Migracija | SHA-256 |
| --- | --- |
| baseline | `0aff56aa04c0bc388a5ca53f67c6a7ffc65c5d9ea2e41139789756186ef26942` |
| `PaymentStatus.PROCESSING` | `b80018daa574c030f2a896d53aa23427627e5897f05348ecda5b3039d508c946` |
| `PaymentStatus.REVIEW` | `831ecf4688ad95a700136fdaa04143dedb25da3994e52ea8b840f8d1d70cc48a` |
| glavni expand | `d064d2b2af0275923546fcce5622e95cc83a2f0e940866ef14fc63d08b2d283a` |

Ovaj P1 rad nije pokrenuo novu migraciju nad produkcijom niti menjao produkcione
podatke. Sačuvan je na V2 feature grani; nije pushovan niti spojen u `main`.

## 33. Prvi UX, bezbednosni i operativni sprint

Posle pregleda storefronta, checkout-a, admin operacija i tehničkog kvaliteta
urađen je prvi paket popravki sa najvećim odnosom efekta i rizika. Sprint ne
uvodi novu Prisma migraciju, ne menja produkcione podatke i ne aktivira
aplikacioni deploy. Promene ostaju na V2 feature grani do prolaska CI-ja i
posebne merge odluke.

### 33.1. Stored-XSS zaštita i bezbedno prikazivanje rich HTML-a

Dodat je centralni `lib/security/html.ts`, zasnovan na provereno održavanoj
`sanitize-html` biblioteci. Dozvoljena je mala urednička allow-lista za pasuse,
naslove, liste, naglašavanje, linkove, kod i slike. Automatski se uklanjaju:

- `script`, `iframe`, SVG i drugi nedozvoljeni elementi;
- inline event handleri kao `onclick`, `onerror` i `onmouseover`;
- inline stilovi i proizvoljni atributi;
- `javascript:` i druge nedozvoljene URL šeme;
- protocol-relative URL-ovi.

Link sa `target="_blank"` dobija `rel="noopener noreferrer"`, a dozvoljene slike
podrazumevano dobijaju lazy loading. Lokalizovani opisi proizvoda zadržavaju
samo podržane `sr` i `en` vrednosti.

Zaštita je postavljena na dve granice:

1. pri admin create/update upisu članaka, FAQ odgovora i opisa proizvoda;
2. ponovo pri javnom čitanju/renderovanju postojećeg sadržaja.

Time su zaštićeni i budući unosi i ranije sačuvani redovi bez masovne izmene
baze. Admin API odbija članak ili FAQ odgovor koji posle sanitizacije ostane
prazan. Blog, detalj proizvoda i javni FAQ tok koriste sanitizovane vrednosti.
Newsletter sadržaj se takođe sanitizuje pre slanja i upisa istorije, naslov se
escape-uje pre umetanja u email HTML, a admin preview radi u sandboxovanom
iframe-u bez dozvole za izvršavanje skripti.

JSON-LD više ne koristi običan `JSON.stringify` direktno u script elementu.
Novi `serializeJsonLd` escape-uje znakove koji mogu zatvoriti script kontekst i
koristi se za organization, website, breadcrumb i product strukturisane
podatke.

Dodato je sedam negativnih/pozitivnih testova za HTML, plain-text escaping i
same-origin zaštitu.

### 33.2. Browser security headeri i fail-closed Origin provera

`next.config.ts` sada šalje globalne browser headere:

- Content Security Policy sa eksplicitnim izvorima potrebnim za aplikaciju,
  Google Analytics, reCAPTCHA i YouTube;
- `X-Content-Type-Options: nosniff`;
- zabranu frame-ovanja kroz CSP `frame-ancestors` i `X-Frame-Options`;
- strožu referrer politiku;
- Permissions Policy koja isključuje kameru, mikrofon, geolokaciju i Topics.

HSTS je namerno iza `ENABLE_HSTS=true` zastavice. Ne sme se uključiti pre nego
što domen i svi relevantni poddomeni rade isključivo preko validnog HTTPS-a.

Prethodna CSRF provera je prihvatala unsafe API zahtev kada `Origin` ili `Host`
nedostaje. Novi `isTrustedWriteRequest` radi fail-closed: zahteva podudaran
Origin ili browserov `Sec-Fetch-Site: same-origin` signal. NextAuth i potpisani
NestPay callback tokovi ostaju eksplicitno izuzeti pre ove provere.

### 33.3. Mobilni katalog, filteri, navigacija i pretraga

Storefront više ne prikazuje izmišljene demo kategorije, brendove i linkove
kada navigacioni DB upit vrati prazno ili grešku. Umesto toga ostaje bezbedan
link ka kompletnom katalogu. Uklonjen je link „Popularno” jer trenutni model
nema pouzdan popularity signal; prethodni parametar je zapravo vraćao najnovije
proizvode i davao pogrešno obećanje kupcu.

Mobilni katalog sada:

- prikazuje dve kartice po redu;
- ima jednostavniju filter/sort alatku bez `perPage` kontrole na malom ekranu;
- prikazuje horizontalne aktivne filter chips;
- omogućava uklanjanje pojedinačnog filtera ili svih filtera;
- pravilno računa veličinu, boju, tip, brend, cenu, pol, akciju i novo u badge-u;
- u praznom rezultatu nudi direktan reset filtera.

Isti reset tok dodat je kategorijskim rezultatima. Brand nazivi za chips se
lokalizuju na serveru i prosleđuju mobile filteru.

Search modal sada razlikuje legitimnih nula rezultata od mrežne/API greške,
prikazuje dostupnu poruku i `Pokušaj ponovo`, resetuje zastareli rezultat i ima
eksplicitan pristupačni naziv inputa. Hardkodirane „popularne pretrage” su
uklonjene dok ne postoji data-driven izvor.

### 33.4. Checkout UX i pristupačnost

Checkout više ne vraća prazan ekran dok Zustand korpa i pending payment stanje
nisu hidrirani. Prikazuje skeleton sa `role=status`, `aria-live` i `aria-busy`.

Pregled porudžbine je sada jedna responsive komponenta:

- na telefonu je sklopivi pregled sa ukupnim iznosom iznad duge forme;
- na desktopu ostaje sticky sidebar;
- nema dva odvojena izvora prikaza cene.

Validacija forme sada vraća strukturisanu listu grešaka, prikazuje error summary
na početku forme i fokusira prvo neispravno polje. Svaki `Input` povezuje grešku
preko `aria-invalid` i `aria-describedby`. Serverske/quote greške imaju
`aria-live`, forma prijavljuje busy stanje, napomena ima povezanu labelu, a
checkbox uslova stabilan ID i opis greške.

Polje `Country` je prevedeno u `Država`. Završni CTA je sticky na telefonu i uz
dugme prikazuje autoritativni ukupni iznos.

### 33.5. Admin payment, KPI i low-stock quick wins

Lista porudžbina sada prikazuje i filtrira svih šest payment statusa:
`PENDING`, `PROCESSING`, `PAID`, `FAILED`, `REVIEW` i `REFUNDED`. Payment filter
se pravilno kombinuje sa order statusom, tekstualnom pretragom i paginacijom.
Svaki status ima zaseban naziv i vizuelni badge umesto ranije podele samo na
„Plaćeno” i „Čeka”.

Dashboard i statistika više ne nazivaju svaku neotkazanu porudžbinu prihodom.
„Plaćeni prihod” i „Prosečna plaćena porudžbina” računaju samo `PAID`,
neotkazane porudžbine i jasno prikazuju korišćeni scope.

Nepostojeći `/admin/users/[id]` link uklonjen je sa detalja porudžbine i
zamenjen bezbednom oznakom registrovanog kupca.

Dashboard je dobio akcioni low-stock pregled nad postojećim `ProductSize`
modelom, bez migracije:

- broj aktivnih lager stavki sa pet ili manje komada;
- pet najkritičnijih stavki sortirano po zalihi;
- posebno označeno stanje nula;
- direktan link ka izmeni proizvoda i listi proizvoda.

### 33.6. ESLint 9, automatski test discovery i Playwright

Nevažeća `next lint` komanda zamenjena je ESLint 9 flat konfiguracijom.
Stvarne lint greške blokiraju CI. Novi React compiler dijagnostički set ostaje
vidljiv kao upozorenje za postepenu migraciju zatečenih hydration/URL-sync
komponenti, umesto da prvi dan blokira celu granu.

Usput su uklonjene zatečene blokirajuće lint greške u internim linkovima,
newsletter toolbar komponenti, admin icon registry-ju, Node crypto importu i
promotion tipu. Dodate su standardne komande `lint`, `typecheck` i `test`.
`npm test` automatski pronalazi svaki `lib/**/*.test.ts`, pa novi test više ne
mora ručno da se upisuje u workflow.

Dodat je Playwright mobile Chromium smoke tok:

1. otvara katalog;
2. bira E2E proizvod i dostupnu opciju;
3. dodaje ga u korpu;
4. prolazi u checkout;
5. potvrđuje novi error-summary/focus tok;
6. popunjava guest podatke i prihvata uslove;
7. završava COD porudžbinu i proverava success stranicu.

`scripts/seed-e2e.ts` je idempotentan, ne briše podatke i odbija rad ako naziv
baze jasno ne sadrži `e2e`, `test` ili `provera`. GitHub CI koristi zaseban
PostgreSQL 16 service, instalira Chromium i pokreće browser smoke pre build-a.

### 33.7. Provere i granice ovog sprinta

Lokalno je potvrđeno:

- `40/40` Node/TypeScript testova prolazi;
- ESLint završava sa `0` blokirajućih grešaka;
- `npm run typecheck` prolazi;
- Playwright uspešno pronalazi mobile purchase test i učitava konfiguraciju;
- produkcioni Next.js build prolazi sa bezbednim test HTTPS URL-om;
- `git diff --check` prolazi.

Na radnoj stanici ne postoji lokalni PostgreSQL servis, pa kompletan browser
tok sa stvarnim upisom porudžbine nije pokrenut protiv placeholder `.env` baze.
Namerno nije korišćena produkciona baza kao zamena. Pun E2E izvršava se u
GitHub CI-ju nad izolovanim PostgreSQL service-om.

Ovaj sprint ne rešava dinamičke `ProductType`/attribute filtere, jedinstven
inventory ledger, kompletan order timeline, RMA/refund tok, media biblioteku,
page builder, produkcione secrets niti domen/HTTPS. To ostaju sledeći epici.

## 34. P1 hotfix: validacija login callback putanje

Read-only pregled V2 commita `438dc55` označio je direktno prosleđivanje
`callbackUrl` vrednosti iz query stringa u `router.push` kao HIGH XSS/open
navigation nalaz. Naknadni remote commitovi do `5312ab2` menjali su samo
dokumentaciju, pa je nalaz ostao primenljiv na isti kod.

### 34.1. Granica poverenja

Dodat je browser-safe helper `safeLoginCallbackPath` u
`lib/security/navigation.ts`. Ulaz je nepoverljiv i helper fail-closed vraća
fiksni `/` kada vrednost nije prihvatljiva. Dozvoljena destinacija mora:

- početi tačno jednim `/` i ostati na sintetičkom internom originu posle
  standardnog `URL` parsiranja;
- imati putanju bez backslash-a, kontrolnih bajtova, kodiranih slash/backslash
  separatora, duplih separatora i `.`/`..` segmenata;
- moći da zadrži bezbedan query i fragment, uključujući Unicode i spoljašnji
  URL kada je on samo kodirana vrednost parametra pretrage.

Apsolutni URL, URL šema, protocol-relative forma ili parserom promenjen origin
nikada se ne prosleđuju routeru. Nema caller-controlled fallback-a.

### 34.2. Integracija i regresiona zaštita

`app/(auth)/login/page.tsx` sada poziva helper odmah pri čitanju
`searchParams`, pre uspešne prijave i `router.push`. Novi
`lib/security/navigation.test.ts` pokriva legitimne nalog/admin/pretraga
putanje i negativne scheme, absolute, protocol-relative, backslash, encoded
separator, control-byte i dot-segment ulaze.

Provere na grani `ispravka/v2-bezbedan-callback-url`:

- `npm test`: 43/43 prolazi;
- `npm run typecheck`: prolazi;
- `npm run lint`: 0 grešaka, 72 ranije postojeća upozorenja;
- `npm run build` sa test HTTPS site/auth URL-om: prolazi; lokalna baza nije
  pokrenuta, pa očekivani Prisma logovi koriste postojeće safe-default grane;
- `git diff --check`: prolazi.

Ova promena ne uvodi migraciju, ne pristupa produkcionoj bazi i nije
deployovana. Server, tajne, auth sesije i ostali P1 blokatori nisu menjani.

## 35. Centralizacija SMTP TLS politike

Naknadni bezbednosni pregled pronašao je pet nezavisnih Nodemailer
konfiguracija. Auth, order i wishlist transporteri su bezuslovno postavljali
`rejectUnauthorized: false`, pa su reset/verifikacioni tokeni, podaci
porudžbine i wishlist poruke ignorisali dokumentovanu produkcionu TLS
zastavicu. Sva petorka je imala `secure: false` bez `requireTLS`, što je port
587 ostavljalo na oportunističkom STARTTLS-u, a port 465 bez implicitnog TLS-a.

Dodat je jedini transport adapter `lib/email/smtp.ts`, koji koriste:

- auth poruke za reset, dobrodošlicu i verifikaciju;
- potvrde porudžbine i promene statusa;
- wishlist obaveštenja;
- kontakt, reklamacije i generički mailer;
- API za prijavu za posao.

Adapter sprovodi sledeće invarijante pre pravljenja transporta:

- port mora biti strogo parsiran ceo broj od 1 do 65535;
- 465 koristi implicitni TLS, a svi drugi portovi zahtevaju uspešan STARTTLS;
- TLS minimum je 1.2, bez ručno pinovane nepotpune cipher liste;
- sertifikat se podrazumevano proverava;
- isključivanje provere sertifikata dozvoljeno je samo u `development` ili
  `test` režimu i samo za loopback host;
- host, korisničko ime i lozinka su obavezni, bez tihog localhost/no-auth
  fallback-a;
- canonical `SMTP_SERVER_*` vrednosti i zatečeni legacy alias-i prolaze kroz
  istu politiku.

Wishlist transport se više ne pravi pri importu modula, već tek pri pokušaju
slanja. `lib/email/smtp.test.ts` proverava STARTTLS/implicitni TLS, validaciju
sertifikata, lokalni self-signed izuzetak, portove, obaveznu konfiguraciju,
legacy alias-e i eksplicitni SMTP nalog bez otvaranja mrežne veze.
Promena nema Prisma migraciju, ne menja podatke i ne aktivira deploy.

## 36. Cleanup napuštenih kartičnih rezervacija

Na grani `ispravka/v2-istek-rezervacija` implementiran je P1 cleanup za
rezervacije koje nastanu pre odlaska kupca na kartično plaćanje. Uklapanje u V2
ne predstavlja produkcijski deploy. Promena je aplikaciona i ne uvodi novu
Prisma migraciju; produkcijski server i podaci nisu menjani.

### 36.1. Bezbednosna granica politike

Centralna čista politika u `lib/orders/reservation-policy.ts` razlikuje
`EXPIRE`, `REVIEW` i `SKIP`. Automatski `EXPIRE` je dozvoljen samo kada su
istovremeno ispunjeni svi uslovi:

- payment metod je `CARD`;
- order status je `PENDING`;
- payment status je `PENDING`;
- `inventoryAllocated=true`;
- prošao je pending/recovery rok;
- ne postoji `Transaction`;
- ne postoji nijedan `PaymentEvent`.

Samo ovaj netaknuti pre-provider slučaj prelazi u `CANCELLED/FAILED` i može da
oslobodi stock i kupon. `CASH` porudžbina, zatvoren order, terminalni payment,
već oslobođena rezervacija ili svež pokušaj ostaju bez izmene.

Svaka stara rezervacija sa transaction/event tragom i svaki stari
`PROCESSING` prelaze u `REVIEW` bez oslobađanja zalihe ili kupona. Isti oprez
važi za `PROCESSING` bez transaction-a i anomaliju u kojoj je Order aktivan, a
Transaction već terminalan. Najnoviji timestamp između ordera, transaction-a
i payment događaja produžava REVIEW sat, pa star order ne proglašava noviji
provider pokušaj zastarelim.

### 36.2. Centralni rokovi i payment-start zaštita

`lib/config/order-reservations.ts` zamenjuje ranije odvojene dvočasovne rokove
jednim izvorom istine. Fiksni `ORDER_PENDING_RECOVERY_WINDOW_MS` od dva sata
sada dele:

- checkout idempotency replay;
- pending-card recovery/autorizacija nastavka;
- istek netaknute kartične rezervacije.

Payment-activity/processing REVIEW rok je konzervativno 24 sata. Opciona
`ORDER_PROCESSING_REVIEW_MINUTES` vrednost mora biti kanonski ceo broj od 120
do 10080 minuta. Nedostajuća vrednost koristi 1440, dok prisutna prazna,
razmaknuta, decimalna, potpisana ili vrednost van granica radi fail-closed.

`beginCardPayment` pre postojeće payment state machine-e učitava Transaction i
poslednji/broj PaymentEvent redova i primenjuje istu politiku:

- netaknuta rezervacija starija od dva sata vraća HTTP 410 kod
  `PAYMENT_RESERVATION_EXPIRED` i ne pravi provider payload;
- order sa `inventoryAllocated=false` vraća
  `PAYMENT_INVENTORY_NOT_RESERVED` i ne može oživeti oslobođenu rezervaciju;
- stari payment pokušaj atomarno prebacuje aktivnu Transaction projekciju i
  Order payment status u `REVIEW`, bez novog ili replayovanog HPP payload-a.

Postojeća callback politika ostaje poslednja sigurnosna mreža: naknadni
approval ne oživljava otkazan order i ne re-alocira već oslobođenu zalihu, već
nejasan konflikt ostavlja za `REVIEW`.

### 36.3. Serializable per-order obrada i poison fallback

`lib/orders/reservation-cleanup.ts` koristi ograničen i deterministički DB
prefilter samo da pronađe kandidatske ID-eve. Podrazumevani batch je 50, a
interni maksimum 200; HTTP pozivalac ne bira cutoff, order ID ili batch.

Svaki kandidat se obrađuje odvojeno:

1. otvara se Prisma Serializable transakcija;
2. Order, Transaction i poslednji/broj PaymentEvent redova ponovo se učitavaju;
3. čista politika se ponovo izvršava nad svežim snapshotom;
4. stanje se preuzima uskim compare-and-set `updateMany` uslovom;
5. za `EXPIRE`, promena statusa i postojeći exactly-once inventory/coupon
   helperi završavaju u istoj transakciji;
6. tipični `P2034`/CAS konflikti dobijaju najviše tri pokušaja sa novim
   snapshotom.

Payment start i callback koriste kompatibilan Transaction → Order redosled
upisa, što smanjuje Transaction/Order deadlock rizik. Coupon release dodatno
sortira promotion ID-eve pre uslovnog smanjenja `usedCount`.

Greška jednog ordera ne prekida batch. Ako tačan inventory snapshot ne može da
se preuzme ili coupon marker/count nije dosledan, originalni expire pokušaj se
rollback-uje. Zatim zasebna Serializable transakcija ponovo proverava isti
order i pokušava uski CAS u `REVIEW`, bez vraćanja zalihe ili kupona. Ako i taj
poison fallback izgubi trku ili padne, kandidat se broji kao `failed`, a petlja
nastavlja sledećim ID-em.

Dry-run prolazi istu kandidatsku pretragu, per-order re-read i politiku, ali ne
izvršava order/transaction upise niti inventory/coupon helper-e. Javni rezultat
sadrži samo `scanned`, `expired`, `reviewed`, `skipped`, `failed` i `dryRun`,
bez ID-eva porudžbina, PII-ja ili provider payload-a. Ako makar jedan kandidat
ostane `failed`, HTTP odgovor je 500 sa `success:false` i istim agregatima, pa
scheduler ne može da tretira parcijalni kvar kao uspešan prolaz.

### 36.4. POST/Bearer/Origin maintenance endpoint

Nova ruta `POST /api/cron/order-reservations` je Node-only, dinamička i
`no-store`. Nema `GET` handler i nema admin-session/cookie fallback.

Autorizacija zahteva tačan `Authorization: Bearer <secret>` format i zaseban
`ORDER_RESERVATION_CLEANUP_SECRET` od najmanje 32 znaka. Bearer helper radi
constant-time poređenje fiksnih SHA-256 digestova i odbija neispravnu šemu,
whitespace i nevalidan token oblik. Nepodešen/slab server secret vraća `503`,
a pogrešna autorizacija `401` sa Bearer challenge-om.

Postojeća fail-closed unsafe-API provera u `proxy.ts` nije oslabljena niti ruta
izuzeta. VPS poziv mora poslati `Origin` koji odgovara kanonskom
`NEXT_PUBLIC_SITE_URL`; nedostajući ili neusklađen Origin vraća `403` pre same
rute.

Prazno telo i izostavljen `apply` namerno znače dry-run. Dozvoljeni operativni
oblici su `{"apply":false}` i `{"apply":true}`; dodatna polja, pogrešan tip,
nevalidan JSON ili telo preko 256 bajtova se odbijaju. Promena stanja zato
zahteva i validan Bearer i eksplicitni `apply: true`.

### 36.5. Automatske i PostgreSQL concurrency provere

Dodati focused testovi pokrivaju:

- granice oba roka i fail-closed parsiranje konfiguracije;
- `EXPIRE` samo bez ikakvog payment traga;
- `REVIEW` za stare/anomalne payment projekcije uz zadržanu rezervaciju;
- strogi Bearer format, minimalnu dužinu i timing-safe proveru;
- default dry-run bez upisa ili release poziva;
- exactly-once CAS, individualni serialization retry i izgubljenu trku;
- izolaciju greške jednog kandidata;
- inventory/coupon poison rollback i zaseban `REVIEW` fallback;
- payment-start istek, inactive-inventory zabranu i REVIEW prelaz;
- route body/auth/status/no-store ugovor i alerting HTTP 500 za `failed > 0`.

`lib/orders/reservation-cleanup.integration.test.ts` je opt-in test nad pravim
PostgreSQL-om. Najpre proverava da realni Prisma prefilter bira netaknutu staru
rezervaciju, ali isključuje star order sa svežom payment aktivnošću. Zatim dva
paralelna cleanup radnika ciljaju isti stari order sa stock i coupon fixture-om;
očekivanje je jedan `EXPIRED`, jedan `SKIPPED`, jedan povrat stock-a i jedno
uklanjanje coupon usage-a. Test se sam odbija ako naziv baze jasno ne sadrži
`test`, `e2e` ili `provera`, a fixture briše u `finally`.

Lokalno ovaj race test nije izvršen jer na radnoj stanici nema dostupne
bezbedne PostgreSQL test baze; bez eksplicitnog
`RUN_RESERVATION_CLEANUP_DB_TESTS=true` ostaje skipovan i ne otvara Prisma
klijent. GitHub verify job ga obavezno uključuje nad svojim izolovanim
PostgreSQL 16 servisom pre browser smoke-a i builda.

Završna lokalna provera kombinovanog stabla 30. avgusta nalazi 103 testa: 102
prolaze, a jedini PostgreSQL test je očekivano preskočen bez bezbedne test baze.
`lint --quiet` završava sa 0 grešaka, TypeScript, produkcijski build sa lažnim
test podešavanjima i `git diff --check` prolaze. GitHub verify job uključuje DB
test nad izolovanim PostgreSQL 16 servisom; istorijske brojke iz prethodnih
odeljaka nisu prepisivane.

### 36.6. Operativno stanje i preostale granice

Implementacija i dokumentacija su uklopljene u V2 istoriju, ali nisu
deployovane. Produkcijski `.env` nije dobio
`ORDER_RESERVATION_CLEANUP_SECRET`, VPS nije menjan, a systemd oneshot/timer
nije instaliran. GitHub workflow takođe namerno ne upravlja server timerom.

Prvi produkcioni koraci ostaju zasebno odobren rollout: deploy sa card
capability-jem i dalje na `false`, secret-safe `{"apply":false}` poziv sa
matching Origin-om, pregled agregata, kontrolisani `{"apply":true}` smoke,
ponovni dry-run, monitoring i tek zatim uključivanje periodičnog timera.

Ovaj cleanup ne rešava admin `REVIEW` inbox, reconciliation sa bankom, refund,
email outbox, bankarski staging/HPP sertifikaciju niti multi-tab/network-loss
scenario. Kartice ostaju isključene dok svi ti tokovi, timer i produkcioni
smoke nisu završeni. PostgreSQL test trenutno dokazuje cleanup-vs-cleanup
exactly-once trku; zasebna real-DB cleanup-vs-payment-start/callback trka ostaje
dodatna P2 verifikacija pre uključivanja kartica.

## 37. Bezbedna newsletter odjava

P1 pregled je našao dva vezana problema: unsubscribe URL je koristio poznati
javni fallback ključ, a GET zahtev je direktno menjao stanje pretplate. Time je
link mogao da bude falsifikovan kada stvarni secret nije podešen, dok su email
skeneri i prefetch klijenti mogli da odjave korisnika bez njegove odluke.

### 37.1. Centralna token i secret politika

`lib/newsletter/unsubscribe.ts` je jedini izvor unsubscribe tokena i URL-ova.
Email se najpre trimuje, normalizuje na mala slova i validira. HMAC-SHA256
potpis se izdaje kao strogo formatiran token i proverava timing-safe poređenjem.
Nevalidan email ili token pada pre deactivation callback-a i Prisma upita.

Konfiguracija radi fail-closed:

- `NEWSLETTER_UNSUBSCRIBE_SECRET` i kompatibilni `NEXTAUTH_SECRET` moraju imati
  najmanje 32 bajta;
- podešen ali slab dedicated secret je greška i nikada se tiho ne zamenjuje;
- novi token se potpisuje dedicated ključem kada je on podešen;
- jaki raniji `NEXTAUTH_SECRET` može privremeno samo da verifikuje stare linkove
  kada je `NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY=true`;
- nepoznata boolean vrednost migracionog flaga se odbija, a podrazumevana
  vrednost je `false`.

### 37.2. GET potvrda i POST mutacija

Legacy campaign GET endpoint sada samo validira email/token i 307 preusmerava
na `/newsletter/odjava`. GET nikada ne menja bazu. Confirmation stranica je
dinamička, `noindex`, `no-referrer` i bez keširanja; prikazuje eksplicitno dugme
za odjavu ili neutralnu poruku za nevalidnu/nedostupnu konfiguraciju.

Tek korisnički klik šalje JSON POST istom API-ju. Posle uspešne autorizacije
jedna Prisma transakcija preko `updateMany` idempotentno isključuje
`User.newsletterOptIn` i `NewsletterSubscriber.active`. Isti uspešan odgovor
važi kada adresa pripada korisniku, gostujućem subscriber-u, oboma ili nijednom,
pa ruta ne otkriva postojanje naloga. Greške ne loguju email ni Bearer token.
Klijent posle uspeha koristi `router.replace` da ukloni oba podatka iz URL-a i
browser istorije.

### 37.3. Regresiona zaštita i status

`lib/newsletter/unsubscribe.test.ts` pokriva secret matricu, legacy migraciju,
normalizaciju i validaciju emaila, pogrešne/rotirane tokene, URL izgradnju,
zabranu deactivation poziva bez validne autorizacije, propagaciju DB greške i
uspešnu idempotentnu deaktivaciju. Mailer sada svaki unsubscribe link pravi
centralnim helperom i kanonskim storefront URL-om.

PR #4 je spojen u V2, a njegova puna provera i kasniji objedinjeni V2 CI su
zeleni. Promena ne uvodi Prisma migraciju i nije aktivirala deploy. Produkcioni
secret i vremenski ograničena legacy migracija ostaju deo odobrenog rollout-a;
newsletter subscribe abuse/double-opt-in tok je zaseban preostali P1.

## 38. P0 razdvajanje V2 CI-ja i produkcijskog release-a

Dana 30. avgusta 2026. u aktuelnom radnom stablu uvedena je eksplicitna release
granica između dva različita projekta koja dele isti GitHub repozitorijum:

- presentation sajt ostaje na `main` grani i ima sopstveni GitHub Pages tok;
- V2 Next.js prodavnica živi na kanonskoj grani
  `verzija/v2.0-univerzalna-platforma`;
- produkcijski VPS deploy V2 prodavnice nije posledica običnog push-a na bilo
  koju granu, već zasebno odobrenog i strogo proverenog release taga.

Ovim je zatvoren P0 rizik u kome bi naziv workflow fajla ili ranija pretpostavka
o `main` grani mogli da povežu presentation projekat sa produkcionim deploy-em
prodavnice. Istorijske reference na automatski deploy svakog push-a na `main`
ostaju u starijim sekcijama samo kao hronologija; ne predstavljaju više važeće
operativno uputstvo.

### 38.1. Nova matrica okidača

`.github/workflows/objavi.yml` sada razdvaja verifikaciju od objavljivanja:

| Događaj | Pokrenute provere | Produkcijski deploy |
| --- | --- | --- |
| Pull request ka `verzija/v2.0-univerzalna-platforma` | kompletan V2 CI | ne |
| Push na `verzija/v2.0-univerzalna-platforma` | kompletan V2 CI | ne |
| Ručni `workflow_dispatch` | kompletan V2 CI | ne |
| Push taga `prodavnica-v2-*` | kompletan V2 CI, pa release potvrda | moguć tek posle svih gate-ova |
| Push na `main` | ovaj V2 workflow se ne pokreće | ne |

Tačan dozvoljeni format release identiteta je
`prodavnica-v2-YYYYMMDD-N`, na primer `prodavnica-v2-20260830-1`.
Širi GitHub trigger `prodavnica-v2-*` služi samo da workflow može bezbedno da
odbije pogrešno oblikovan kandidat; release potvrda pre produkcionog
Environment-a prihvata isključivo regularni izraz
`^prodavnica-v2-[0-9]{8}-[1-9][0-9]*$`.

Ručni dispatch je namerno **verification-only**. Može da ponovi lint,
TypeScript, testove, migracionu proveru, browser smoke i build, ali nema put do
`production` Environment-a, SSH-a ili serverskog deploy skripta.

### 38.2. Fail-closed identitet V2 stabla

CI pre instalacije zavisnosti potvrđuje da checkout zaista predstavlja V2
prodavnicu. Obavezno moraju postojati:

- `package.json` i `package-lock.json`;
- `next.config.ts`;
- `prisma/schema.prisma`;
- `scripts/deploy.sh`;
- `app/api/health/route.ts`.

Istovremeno `scripts/build.mjs`, karakterističan za presentation projekat, ne
sme da postoji. Nedostatak makar jednog V2 markera ili prisustvo presentation
build skripta prekida job pre daljeg rada. Ista provera se ponavlja u release
potvrdi i još jednom u deploy job-u pre validacije deploy podešavanja i pre
nego što se bilo koja SSH tajna upotrebi za uspostavljanje veze.

Checkout koraci koriste `persist-credentials: false`, a workflow zadržava
minimalnu globalnu dozvolu `contents: read`. Time build i deploy job ne ostavljaju
GitHub token u lokalnoj Git konfiguraciji checkout-a.

### 38.3. Fail-closed release poreklo i redosled gate-ova

Produkcijski put postoji samo kada je događaj `push`, a ref počinje sa
`refs/tags/prodavnica-v2-`. Posle uspešnog punog CI-ja poseban
`potvrdi_release` job, pre otvaranja produkcionog Environment-a, proverava:

1. da je checkout V2 stablo, a ne presentation stablo;
2. da je GitHub ref zaista tag;
3. da ime taga tačno prati `prodavnica-v2-YYYYMMDD-N` format;
4. da je označeni commit predak kanonske udaljene grane
   `origin/verzija/v2.0-univerzalna-platforma`.

Ancestry provera sprečava da tag napravljen nad proizvoljnom feature granom ili
nad presentation `main` commitom postane release kandidat. Deploy job zavisi i
od kompletnog `provera` job-a i od `potvrdi_release` job-a. Pre SSH-a ponavlja
identitet stabla, tip i format taga i ancestry proveru, tako da se ključna
release svojstva ne oslanjaju samo na raniji job.

Tek nakon uspešnog CI-ja i pre-Environment `potvrdi_release` provere deploy job
može da zatraži `production` Environment. Kada reviewer odobri taj gate,
deploy job ponavlja ključne uslove pre SSH-a. Za završnu live fazu i dalje je
potreban spoljašnji GitHub Environment/ruleset gate koji dozvoljava namenski V2
tag obrazac i obavezan pregled odobrioca. Kodna promena ne pretpostavlja da je
taj spoljašnji gate već konfigurisan.

### 38.4. Concurrency i pinovane GitHub akcije

Concurrency je razdvojen prema posledici događaja:

- release tagovi dele serijsku `production-<repository>` grupu i ne otkazuju se
  kada stigne noviji run;
- svaki pull request ima zasebnu otkazivu CI grupu po broju PR-a;
- push kanonske V2 grane i ručni verification run imaju otkazive CI grupe po
  ref-u.

Ovo sprečava paralelne produkcijske aktivacije, a istovremeno dopušta da noviji
CI rezultat zameni zastareli rezultat na istoj razvojnoj referenci.

Supply-chain pinovi u oba checkout konteksta i Node setup-u osveženi su na
eksplicitne pune commit SHA vrednosti:

- `actions/checkout` — `3d3c42e5aac5ba805825da76410c181273ba90b1`
  (`v7.0.1`);
- `actions/setup-node` — `820762786026740c76f36085b0efc47a31fe5020`
  (`v7.0.0`).

### 38.5. Usklađena operativna dokumentacija

Uz workflow su usklađeni izvori operativne istine:

- `CLAUDE.md` razdvaja presentation `main`, kanonsku V2 granu i release tag;
- `README.md` opisuje provereni tag-gated V2 release umesto automatskog
  produkcijskog push-a na `main`;
- `docs/GITHUB-DEPLOY.md` definiše trigger matricu, budući Environment reviewer
  i kontrolisani postupak pravljenja anotiranog release taga;
- `docs/V2-ROLL-OUT.md` beleži da su tag, Environment promena i live deploy
  poslednji odobreni koraci;
- `IZMENE.md` i detaljni izveštaj beleže sprovedenu P0 kodnu granicu i odvojeno
  navode spoljašnje korake koji još nisu završeni.

Dokumentacija zato razlikuje tri stanja: implementirano u kodu, provereno kroz
CI i stvarno aktivirano u produkcionom okruženju. Sekcije 38.7 i 38.8 beleže
lokalni i GitHub CI dokaz; produkciona aktivacija ostaje zasebno odobren rollout.

### 38.6. Šta namerno nije promenjeno

Ova P0 etapa je ograničena na workflow i dokumentacionu release granicu.
Tokom nje:

- nije napravljen niti pushovan `prodavnica-v2-YYYYMMDD-N` tag;
- nisu menjana pravila GitHub `production` Environment-a ili branch/tag
  ruleset-a;
- nisu čitane, dodavane, rotirane niti menjane GitHub ili serverske tajne;
- nije uspostavljena SSH veza sa produkcionim serverom;
- nisu menjani server, PM2/systemd, reverse proxy, produkcijski `.env` ili
  produkciona baza;
- nije pokrenut `scripts/deploy.sh` nad VPS-om;
- V2 nije pušten uživo i presentation sajt na `main` nije menjan ovim radom.

Release tag, spoljašnji Environment gate i bilo kakva serverska aktivacija
ostaju završna faza plana. Do tada su push kanonske V2 grane i ručni dispatch
isključivo verifikacioni događaji, a kartično plaćanje i ostale produkcione
capability promene ostaju van opsega ovog P0 koraka.

### 38.7. Lokalna verifikacija pre PR-a

Aktuelno radno stablo je pre slanja na GitHub prošlo:

- `actionlint 1.7.12` nad `.github/workflows/objavi.yml` bez nalaza;
- lokalnu release-gate simulaciju u kojoj validan V2 tag/ancestor prolazi, a
  pogrešan format taga očekivano pada;
- `git diff --check` bez whitespace grešaka;
- proveru da sve relativne Markdown veze i interni anchor-i postoje;
- `npm run lint -- --quiet`;
- `npm run typecheck`;
- `npm test`: 103 ukupno, 102 uspešna i jedan lokalno očekivano preskočen
  opt-in PostgreSQL test;
- `npm run build` sa isključivo neprodukcijskim CI vrednostima.

Build je završen uspešno. Pošto lokalni PostgreSQL servis nije bio pokrenut,
prerender je beležio očekivane poruke o nedostupnoj bazi i koristio bezbedne
storefront podrazumevane vrednosti. Zbog toga su exact-head GitHub CI sa
PostgreSQL 16, svim migracijama, uključenim opt-in DB testom i Chromium E2E i
dalje obavezni dokaz pre integracije.

Read-only provera zvaničnih Action tag ref-ova potvrdila je da pinovi u
workflow-u tačno odgovaraju `actions/checkout@v7.0.1` i
`actions/setup-node@v7.0.0`. Ta provera, kao ni lokalni testovi, nije menjala
GitHub ili produkciono stanje.

### 38.8. PR, merge i post-merge CI dokaz

Repository-side P0 granica je zatim integrisana bez dodirivanja presentation
`main` grane:

1. feature commit `471e395ba09a67505c03a68af01f66520924efc8`
   pushovan je bez release taga;
2. [PR #8](https://github.com/biozencaj-stack/narodnanosnja/pull/8) otvoren je
   isključivo ka `verzija/v2.0-univerzalna-platforma` i bio je mergeable;
3. exact-head PR run
   [`33302673497`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33302673497)
   završio je uspešno za 2 min 41 s;
4. `Provera verzije` prošla je PostgreSQL migracije/drift/invarijante, lint,
   typecheck, kompletan test paket sa uključenim opt-in DB testom, Chromium
   mobilni E2E i production build;
5. `Potvrdi V2 release` i `Objavi na produkciju` bili su `SKIPPED`, svaki za
   0 s;
6. PR je merge-ovan samo u V2 kao
   `6aa506924aa5b95d30e638adffa209c307aed6b0`;
7. post-merge push run
   [`33302806208`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33302806208)
   ponovio je kompletan CI uspešno za 2 min 28 s, dok su oba release posla
   ponovo bila `SKIPPED`;
8. istorijski Draft PR #1 ka `main` zatvoren je bez merge-a uz objašnjenje da
   ga je zamenio V2-only release put.

Read-only provera posle merge-a našla je 0 production deployment zapisa.
`production` Environment ostao je nepromenjen sa starom `main` branch
politikom, bez required reviewera, secrets i variables. Nije napravljen V2
release tag, nije uspostavljen SSH, server i baza nisu menjani i ništa nije
pušteno live.

## 39. P1 auth secret, cookie ugovor i atomska email verifikacija

Posle zatvaranja P0 release granice rad je nastavljen prvom P1 auth sekcijom na
grani `ispravka/v2-auth-secret-verifikacija`, izvedenoj direktno iz kanonskog
V2 merge-a `328b4027f1ed3f357ced86564f52dfefa36b85a1`. Ova etapa je namerno
ograničena na konfiguracionu granicu autentifikacije i exactly-once
verification tok. Ne uvodi novu Prisma migraciju i ne uključuje live release.

### 39.1. Početni nalazi i izabrana granica

Pre izmene su postojala četiri međusobno povezana problema:

1. `app/api/auth/verify-email/[token]/route.ts` je koristio javni
   `fallback-secret` ako `NEXTAUTH_SECRET` nije podešen;
2. ruta je prvo menjala `User.emailVerified` i brisala token, a tek zatim
   pokušavala JWT encode, redirect i cookie pripremu;
3. regularna NextAuth sesija trajala je 24 sata, dok je ručno izdata
   verification sesija/cookie trajala 30 dana;
4. NextAuth, proxy i verification ruta nisu imali jedan zajednički ugovor za
   secret, secure-cookie odluku i ime session cookie-ja.

Nezavisni read-only review radne izmene otkrio je još dve važne ivice pre
commita. NextAuth `getToken()` bi bez eksplicitnog cookie imena koristio svoju
HTTPS heuristiku, koja ne mora da bude ista kao centralna politika. Takođe je
prvobitna verzija pripremala redirect response tek posle DB commita. Oba nalaza
su ispravljena pre dokumentovanja i završne lokalne provere.

Globalni login deny za svaki `emailVerified = NULL` namerno nije uveden.
Postojeći nalozi nisu prethodno auditovani/backfill-ovani, registracija još nema
pouzdan resend posle SMTP greške, a neposredna zabrana bi mogla da zaključa
legitimne legacy korisnike.

### 39.2. Centralna fail-closed auth konfiguracija

Novi `lib/auth/config.ts` definiše:

- `AUTH_SESSION_MAX_AGE_SECONDS = 86_400` kao jedini rok za session, JWT i
  verification cookie;
- `resolveAuthSecret()` kao jedini način čitanja `NEXTAUTH_SECRET`;
- `shouldUseSecureAuthCookies()` kao jedinu HTTPS/cookie odluku;
- `authSessionCookieName()` kao jedini izbor između
  `__Secure-next-auth.session-token` i `next-auth.session-token`;
- `AuthConfigurationError` za eksplicitne konfiguracione greške.

Secret resolver odbija:

- nedostajuću, praznu ili whitespace-only vrednost;
- manje od 32 UTF-8 bajta;
- početne ili završne razmake, koji mogu napraviti različite ključeve u
  različitim procesima;
- poznate javne placeholder vrednosti iz primera dokumentacije.

Dužina nije predstavljena kao dokaz entropije. `.env.example` zato jasno kaže
da je javni primer namerno neupotrebljiv dok ga operater ne zameni zasebno
generisanim CSPRNG ključem, na primer `openssl rand -base64 32` rezultatom.

Cookie/URL resolver u produkciji zahteva eksplicitni HTTPS `NEXTAUTH_URL`.
Nedostajući URL, produkcijski HTTP, okolni razmaci, nevalidan URL i protokol van
HTTP(S) rade fail-closed. Lokalni development/test HTTP ostaje dozvoljen.

`lib/auth/index.ts` sada koristi centralni secret, eksplicitni session i JWT
`maxAge` i centralni secure-cookie izbor. `proxy.ts` prosleđuje `getToken()` i
isti secret i eksplicitni `secureCookie` i tačno centralno ime cookie-ja, pa
proxy ne zavisi od odvojene NextAuth URL heuristike. Playwright dobija zasebnu,
dovoljno dugu neprodukcijsku test vrednost.

### 39.3. Redosled bez parcijalne verifikacije

Verification ruta sada sprovodi sledeći redosled:

1. `getStorefrontUrl()` validira kanonski storefront URL; produkcija zahteva
   javni HTTPS URL;
2. pre DB čitanja nastaju sve četiri redirect mete: invalid, expired, success
   i failure;
3. centralni helperi validiraju auth secret i cookie konfiguraciju;
4. ruta tek tada čita verification token i pripadajućeg korisnika;
5. za još važeći token NextAuth `encode()` potpisuje sesiju sa rokom od 24
   sata;
6. uspešni redirect response i HttpOnly/SameSite cookie potpuno se pripremaju
   u memoriji;
7. tek nakon toga DB helper pokušava atomski commit;
8. pripremljeni odgovor vraća se samo ako je commit uspeo.

Generički `prepareVerificationSuccessBeforeCommit()` čini ovu granicu
testabilnom. Greška JWT encode-a ne poziva ni pripremu odgovora ni DB commit.
Greška redirect/cookie pripreme ne poziva commit. Greška commita ne vraća već
pripremljeni uspešan odgovor. Time token ostaje ponovljiv kad infrastruktura
zakaže pre mutacije, a klijent ne dobija lažni uspeh kada transakcija ne uspe.

Expired token se i dalje uklanja conditional `deleteMany` upitom i vodi na
neutralni expired rezultat. Nevalidan ili već iskorišćen token ne menja bazu.
Neobrađene greške se loguju bez samog tokena i vraćaju failure redirect; ako je
kanonski URL toliko neispravan da se redirect ne može ni konstruisati, vraća se
HTTP 500 JSON bez prethodne token/user mutacije.

### 39.4. Atomski claim i konkurentni replay

Novi `lib/auth/email-verification.ts` prima minimalni claim:

- verification red ID;
- user ID;
- originalni token.

U jednoj Prisma transakciji prvi `deleteMany` zahteva istovremeno isti ID,
user, token i `expires > verifiedAt`. Samo `count === 1` znači da je ovaj radnik
claim-ovao aktivni token. Svaki replay, paralelni gubitnik, promenjen token ili
istekao claim baca `EmailVerificationConflictError` pre izmene korisnika.

Pobednička transakcija zatim:

1. postavlja `User.emailVerified` na istu referentnu vrednost `verifiedAt`;
2. briše sve preostale `EmailVerification` redove tog korisnika;
3. commit-uje claim, user promenu i sibling invalidaciju kao jednu celinu.

PostgreSQL zaključavanje reda obezbeđuje da dva konkurentna conditional delete
upita ne mogu oba prijaviti `count = 1`. Ako bilo koji kasniji upit u
transakciji zakaže, prvobitno brisanje claim-a se rollback-uje.

### 39.5. Testovi i CI ugovor

Dodati testovi su podeljeni po odgovornosti:

- `lib/auth/config.test.ts` pokriva missing/blank/short secret, okolne razmake,
  UTF-8 broj bajtova, poznati placeholder, tačan 24h rok, HTTPS/HTTP cookie
  matricu i produkcijske URL greške;
- `lib/auth/email-verification.test.ts` pokriva strogi redosled session encode →
  kompletna response priprema → commit, plus failure na svakoj granici;
- `lib/auth/email-verification.integration.test.ts` proverava stvarnu Prisma/
  PostgreSQL transakciju.

DB test je opt-in preko `RUN_AUTH_VERIFICATION_DB_TESTS=true`. Pored tog
eksplicitnog flaga odbija ne-PostgreSQL URL, udaljeni host i bazu čiji naziv ne
sadrži jasno odvojeno `test`, `e2e` ili `provera`. UUID izoluje podatke, cleanup
briše tačno kreiranog korisnika po ID-u, a FK cascade uklanja njegove tokene.

Test uvodi two-worker barijeru unutar dve već otvorene interaktivne
transakcije. Zato nije samo serijski replay test: oba radnika moraju stići do
claim granice pre nego što bilo koji nastavi. Očekivani rezultat je tačno jedan
fulfilled, tačno jedan `EmailVerificationConflictError`, postavljen
`emailVerified` i nula verification tokena korisnika.

`.github/workflows/objavi.yml` uključuje flag samo u CI test koraku, posle
podizanja PostgreSQL 16 i primene migracija. Lokalno bez bezbedne test baze oba
opt-in DB testa ostaju namerno preskočena. Aktuelni lokalni paket ima 115
testova: 113 prolazi, 2 DB testa su očekivano preskočena, a nema padova.
`actionlint`, `git diff --check`, ciljani auth testovi, ESLint i TypeScript
takođe prolaze. GitHub PostgreSQL/Chromium CI bio je obavezan pre merge-a i
završen je dokazima iz odeljka 39.7.

### 39.6. Granice etape i sledeći auth koraci

Ova promena ne menja Prisma šemu, istorijske migracije, registracioni model,
password-reset modele ili postojeće korisničke redove. Tokom rada nisu čitane
stvarne `.env` vrednosti, nisu postavljene/rotirane produkcione tajne, nije
kontaktiran server, nije menjan GitHub `production` Environment i nije
napravljen release tag.

Auth redosled je u međuvremenu napredovao. Stavke 1–3 integrisane su kroz
odeljke 40–42, a atomska registracija/resend iz stavke 4 implementirani su u
aktuelnom preseku iz odeljka 43. Stavke 5–8 i durable-outbox deo stavke 4 ostaju
otvoreni:

1. reset zahtev sa identičnim javnim statusom/telom za nepostojeći nalog, SMTP
   uspeh i SMTP kvar — integrisano kroz PR #12;
2. prefetch-safe korisnička potvrda pre mutacije, umesto GET auto-login toka
   koji email skener može prerano da aktivira — integrisano kroz PR #14;
3. hashovanje verification/reset tokena i exactly-once reset confirm —
   integrisano kroz PR #16, uz otvoren hash-only/grace/contract rollout;
4. atomska registracija i stvarni enumeration-safe resend sa cooldown-om,
   fixed 24h kvotom i retained neisteklim linkovima — implementirano u §43;
   transactional outbox/durable worker ostaje otvoren;
5. audit postojećeg `emailVerified` stanja i kontrolisani backfill;
6. tek zatim verified-login enforcement;
7. `sessionVersion` ili ekvivalentna server-side revokacija posle promene/
   resetovanja lozinke i promene role;
8. shared login limiter, trusted-proxy/client-IP ugovor, bezbedna lockout
   politika i kasnije MFA za administratore.

PR mora biti otvoren isključivo ka kanonskoj V2 grani. Običan push i ručni
workflow ostaju verification-only; produkcijski poslovi moraju biti preskočeni.
Live release, Environment pravila, tajne, server i kartice ostaju poslednja,
posebno odobrena faza.

### 39.7. PR #10, exact-head i post-merge dokaz

P1 auth presek je integrisan bez dodirivanja presentation `main` grane:

1. feature commit `db35f6efce16535e6f831fcf98549934c018d0cf`
   pushovan je na `ispravka/v2-auth-secret-verifikacija`, bez release taga;
2. [PR #10](https://github.com/biozencaj-stack/narodnanosnja/pull/10) otvoren
   je sa base granom `verzija/v2.0-univerzalna-platforma`, bio je non-draft,
   mergeable i clean;
3. exact-head pull-request run
   [`33305077539`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33305077539)
   završio je SUCCESS za 2 min 46 s;
4. `Provera verzije` prošla je instalaciju zaključanih zavisnosti, Prisma
   validaciju, sve migracije, drift, DB invarijante, lint, TypeScript, kompletan
   test paket sa oba uključena PostgreSQL testa, mobilni Chromium COD E2E i
   produkcijski build;
5. `Potvrdi V2 release` i `Objavi na produkciju` bili su SKIPPED;
6. PR je spojen samo u kanonsku V2 granu kao
   `d6d44c806447d5e7211c9312fcaa0d98ef8f2c1b`;
7. post-merge push run
   [`33305210714`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33305210714)
   ponovio je ceo pipeline uspešno za 2 min 45 s;
8. oba release posla bila su ponovo SKIPPED.

Read-only GitHub API provera nakon merge-a potvrdila je da PR zaista ima V2
base, tačan head i navedeni merge commit, kao i da repozitorijum i dalje ima 0
`production` deployment zapisa. Nisu menjana Environment pravila, required
reviewer, secrets/variables, server ili produkciona baza. Nije napravljen
release tag, nije uspostavljen SSH i V2 nije pušten live.

## 40. P1 privatnost password-reset zahteva i asinhrona obrada

Drugi P1 auth presek pokrenut je na grani `ispravka/v2-reset-privacy`, izvedenoj
direktno iz kanonskog V2 stanja
`396ab8641d1923bd6f0f5c4b2953a48e103f69cb`. Cilj je ograničen na javni zahtev
za reset lozinke: ukloniti account-existence signal iz statusa, tela i
account-dependent latencije, bez promene Prisma šeme i bez dodirivanja reset-
confirm mutacije. Produkcijski deploy, server, tajne i release ostaju izvan
ove etape.

### 40.1. Početni SMTP/account oracle

Pre izmene je `app/api/auth/reset-password/request/route.ts` obrađivao ceo tok
unutar jednog HTTP zahteva:

1. proveravao procesni rate limit;
2. parsirao email i tražio korisnika;
3. za nepostojeći nalog odmah vraćao generički HTTP 200;
4. za postojeći nalog brisao stare tokene, kreirao novi i čekao SMTP;
5. tek posle isporuke vraćao isti generički tekst;
6. DB ili SMTP grešku hvatao spoljnim `catch`-om i vraćao HTTP 500 sa
   specifičnim error telom.

Generička poruka zato nije bila dovoljna zaštita. Kada SMTP ili baza ne rade,
status i telo su direktno razlikovali postojeći od nepostojećeg naloga. Kada
sve radi, nepostojeći nalog je čekao samo jedan DB lookup, dok je postojeći
čekao dodatna dva DB upita i mrežni SMTP poziv. Ta razlika je ostavljala jak
timing oracle i bez eksplicitnog 500 odgovora.

Početni read-only pregled je otkrio i dve povezane failure granice. Brisanje
starih i kreiranje novog tokena bili su odvojeni upiti, pa kvar između njih
ostavlja korisnika bez ijednog reset linka. Takođe, automatski cleanup novog
tokena na SMTP grešku nije bezbedan: `sendMail()` može prijaviti grešku nakon
što je udaljeni server već prihvatio poruku, pa bi eventualno isporučen link
odmah postao nevažeći.

### 40.2. Jedinstveni neposredni 202 ugovor

Nova route logika živi u testabilnom
`lib/auth/password-reset-request-route.ts` factory-ju. Produkcijska ruta samo
vezuje stvarne zavisnosti: procesni limiter, Next.js `after()`, Prisma i
centralni `sendPasswordResetEmail()` SMTP tok.

Za svaki sintaksno validan email važi sledeći javni ugovor kada je background
callback uspešno registrovan:

| Polje | Vrednost |
| --- | --- |
| HTTP status | `202 Accepted` |
| Telo | ista generička poruka, bez emaila i delivery rezultata |
| `Content-Type` | JSON |
| `Cache-Control` | `no-store, max-age=0` |
| `Pragma` | `no-cache` |
| Account lookup pre odgovora | ne |
| Token/SMTP pre odgovora | ne |

Poruka je promenjena iz prošlog vremena „poslali smo” u buduću, uslovnu
formulaciju: ako nalog postoji, uputstva će biti poslata. Isto je ispravljeno u
`app/(auth)/reset-password/page.tsx`, tako da UI ne tvrdi da je background
isporuka već završena.

Nevalidan JSON ili email vraćaju kontrolisani HTTP 400, a iscrpljeni limiter
HTTP 429. Ti ishodi nisu account oracle zato što nastaju pre svakog lookup-a.
Ako samo pozivanje scheduler-a sinhrono zakaže, ruta prijavljuje
`SCHEDULING` i vraća generički HTTP 503 sa retry porukom; privatni posao nije
pokrenut i rezultat je isti za postojeći i nepostojeći nalog. Ovo je izabrano
umesto lažnog 202, jer zahtev koji nije ni registrovan za obradu nije stvarno
prihvaćen.

### 40.3. Next.js `after()` i stage-only observability

`acceptPasswordResetRequest()` prima scheduler kao zavisnost i registruje
callback oblika `() => processPasswordResetRequest(...)`. Važno je da se
prosleđuje funkcija, a ne već pokrenut Promise; u suprotnom bi lookup ponovo
počeo pre javnog odgovora. Produkcijska kompozicija koristi
`schedule: (task) => after(task)`. Lokalni Next.js 16.1.6 tip i implementacija
potvrđuju da callback pripada post-response lifecycle-u.

Sve poznate private failure tačke svode se na mali enum:

- `LOOKUP` — DB čitanje korisnika;
- `TOKEN_REPLACEMENT` — generisanje ili transakcioni upis tokena;
- `DELIVERY` — SMTP slanje;
- `SCHEDULING` — callback nije registrovan;
- `BACKGROUND` — neočekivana greška izvan unutrašnjih kontrolisanih grana.

Produkcijski logger dobija samo `{ stage }`. Submitted email, korisnički ID,
reset token i originalni exception/message ne prosleđuju se reporteru. I sam
reporter je iza zaštitnog `try/catch`-a, pa kvar observability sistema ne može
promeniti odgovor, odbiti validan background tok ili ponovo napraviti account
oracle.

### 40.4. Atomska zamena tokena i SMTP ambiguity politika

Privatni servis u `lib/auth/password-reset-request.ts` prvo normalizuje javni
input na trimovan lowercase email, uz maksimalnu dužinu 254 i osnovnu email
strukturu. Posle background lookup-a nepostojeći nalog tiho završava bez tokena
i SMTP-a. Postojeći nalog dobija CSPRNG token iz postojećeg
`generateResetToken()` helpera i rok od jednog sata.

Produkcijska `replaceTokensForRequest` zavisnost sada u jednoj Prisma
transakciji:

1. briše prethodne `PasswordReset` redove korisnika;
2. kreira novi red sa `userId`, tokenom i istekom;
3. commit-uje oba upita zajedno ili ih oba rollback-uje.

Ovo je atomska garancija po jednom zahtevu: korisnik neće ostati bez starog
tokena samo zato što je sledeći create upit zakačio DB grešku. Naziv i
dokumentacija namerno ne tvrde da uvek postoji tačno jedan aktivni token.
`PasswordReset.userId` nema unique ograničenje, a transakcija nema per-user
advisory lock, Serializable retry ili conditional claim. Dva paralelna zahteva
zato još mogu oba proći delete/create interleaving i ostaviti dva važeća reda.

SMTP se pokreće tek posle uspešnog DB commita, tako da poslati link nikada ne
pokazuje na token koji još ne postoji. Ako SMTP zatim prijavi grešku, token se
ne briše. Razlog je ambivalentna mrežna granica: poruka može biti prihvaćena,
a odgovor izgubljen. Zadržani token važi najviše jedan sat i sledeći uspešan
zahtev ga zamenjuje. Potpuna atomska DB+email isporuka nije obećana; zahteva
transactional outbox i zaseban worker.

### 40.5. UI, testovi i lokalna validacija

Dodato je 11 testova u dva nova test fajla:

- `lib/auth/password-reset-request-route.test.ts` — četiri HTTP-contract testa;
- `lib/auth/password-reset-request.test.ts` — sedam service/scheduler testova.

Route test koristi pravi `NextRequest`/`NextResponse`, ali injektovani fake
scheduler. On hvata callback i dokazuje da background processor ima nula poziva
u trenutku kada je response već vraćen. Tek eksplicitno pokretanje uhvaćenog
callbacka poziva servis sa normalizovanim `kupac@example.com` inputom.

Raw HTTP snapshot je upoređen za tri private scenarija: nepostojeći nalog,
uspešna isporuka i background kvar. Sva tri imaju identičan status, sirovo JSON
telo, content type i cache zaglavlja. Telo ne sadrži email, SMTP tekst ili
internu fazu. Dodatno su provereni malformed JSON, nevalidan email, rate-limit
429 i scheduler 503, uz dokaz da nijedan od njih ne zakazuje account-dependent
posao.

Service testovi proveravaju:

- normalizaciju i odbijanje neispravnog javnog inputa;
- stop posle lookup-a za nepostojeći nalog;
- redosled lookup → token → transakciona zamena → SMTP;
- jednočasovni expiry;
- stage-only `DELIVERY` bez curenja emaila, tokena ili SMTP poruke;
- zaustavljanje pre SMTP-a kada lookup ili token upis zakažu;
- vraćanje javnog odgovora pre početka privatnog rada;
- kontrolisani scheduler/background/logger failure oblik.

Završni lokalni dokaz na radnoj grani je:

| Provera | Rezultat |
| --- | --- |
| ciljani reset testovi | 11/11 prolazi |
| `npm test` | 126 ukupno; 124 prolaze; 2 postojeća opt-in DB testa preskočena |
| `npm run lint -- --quiet` | prolazi bez grešaka |
| `npm run typecheck` | prolazi |
| `git diff --check` | prolazi |
| produkcijski build sa lažnim CI vrednostima | prolazi; 91 ruta završena |

Lokalni PostgreSQL nije bio pokrenut. Build je zato ispisao očekivane poruke za
nedostupan `127.0.0.1:5432` i koristio postojeće safe-default storefront grane,
ali se završio exit kodom 0. Stvarna produkciona baza i stvarne `.env` vrednosti
nisu pregledane niti korišćene kao test podaci.

### 40.6. Granice etape i preostali recovery rad

Ova etapa rešava account-dependent HTTP status, telo i DB/SMTP latenciju, ali
ne tvrdi da je email recovery završen. Preostaju:

1. transactional outbox/worker sa retry-em, deduplikacijom, alertom i
   shutdown/redeploy dokazom;
2. shared Redis/DB limiter po IP-u, nalogu/email digestu i akciji;
3. eksplicitan trusted-proxy hop/client-IP ugovor umesto verovanja celom
   `x-forwarded-for` headeru;
4. hashovanje reset tokena u bazi;
5. concurrency-safe jedan aktivni token po korisniku, uz realni PostgreSQL
   two-worker test;
6. exactly-once reset-confirm claim i opoziv postojećih sesija posle promene
   lozinke;
7. bezbedno escaped auth-email ime i širi email template hardening;
8. staging/runtime smoke stvarnog Next `after()` lifecycle-a.

Procesni LRU sada ima još veći operativni značaj jer brz 202 omogućava klijentu
da ne čeka SMTP. Zbog toga ova promena ne sme biti predstavljena kao abuse
zaštita. Ona zatvara privacy oracle; shared throttling ostaje zaseban P1.

Nije menjana Prisma šema, nije dodata migracija i nisu dirani produkcioni
podaci. Nisu kontaktirani VPS/SSH, DNS, TLS, reverse proxy, PM2 ili GitHub
`production` Environment. Nisu postavljene tajne, nije napravljen release tag,
kartice nisu uključene i ništa nije pušteno live.

### 40.7. PR, exact-head i post-merge CI dokaz

Planirani V2-only redosled je završen stvarnim GitHub dokazima:

1. feature commit
   `d7bf89494098c8d88d5f81ddd08af31e07e3b136` pushovan je samo na
   `ispravka/v2-reset-privacy`;
2. [PR #12](https://github.com/biozencaj-stack/narodnanosnja/pull/12) otvoren
   je kao non-draft sa base granom
   `verzija/v2.0-univerzalna-platforma` i tačnim feature headom;
3. exact-head pull-request run
   [`33307015696`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33307015696)
   završio je `SUCCESS` za 2 min 47 s;
4. `Provera verzije` je prošla PostgreSQL 16, sve migracije, drift i DB
   invarijante, lint, TypeScript, svih 126 testova sa oba uključena real-DB
   scenarija, mobilni Chromium COD E2E i produkcijski build;
5. `Potvrdi V2 release` i `Objavi na produkciju` bili su `SKIPPED`;
6. PR je spojen samo u kanonsku V2 granu kao merge
   `9f998866b1be2dad576f5c626fee05c41a978572`;
7. post-merge push run
   [`33307162583`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33307162583)
   završio je `SUCCESS` za 2 min 40 s i ponovio kompletan pipeline;
8. oba release posla bila su ponovo `SKIPPED`.

Read-only GitHub API provera posle merge-a potvrdila je zatvoren/merged PR,
tačan V2 base, feature head, merge SHA i kanonski V2 head. Ista provera nalazi
0 `production` deployment zapisa. Presentation `main` nije bio base ili merge
cilj, GitHub `production` Environment nije menjan, nije napravljen release tag,
nije kontaktiran server i ništa nije pušteno live.

Produkcijska aktivacija ostaje poslednja, posebno odobrena faza posle svih
preostalih P0/P1, legalnih, infrastrukturnih, backup/restore i operativnih
gate-ova.

## 41. P1 prefetch-safe email potvrda i eksplicitni POST

Treći P1 auth presek urađen je 30. avgusta 2026. na radnoj grani
`ispravka/v2-prefetch-safe-verifikacija`, izvedenoj direktno iz kanonskog V2
documentation head-a `8d22116543c3bf2f2e76080758d9814b0e61c2fe`. Cilj je
bio usko definisan: sačuvati ranije uvedenu exactly-once DB verifikaciju i
24-časovni auth cookie ugovor, ali ukloniti mutaciju sa svake GET navigacije.
Lokalno provereni diff postao je feature commit
`6ffd173b3eda59815894ea43181543791dba58a0`, spojen isključivo u kanonsku V2
granu kroz [PR #14](https://github.com/biozencaj-stack/narodnanosnja/pull/14)
kao merge `c96473c22fb56f8b6c1b5b34570936d526577c10`. Exact-head i
post-merge GitHub provere završene su uspešno bez release/deploy posledice.

### 41.1. Zašto je stari GET auto-login bio opasan

Pre ovog preseka email je vodio na `/verify-email/[token]`, a klijentska
stranica je po mount-u radila redirect na
`GET /api/auth/verify-email/[token]`. API GET je zatim čitao token, upisivao
`emailVerified`, brisao verification tokene, izdavao session cookie i
automatski prijavljivao korisnika. Atomski DB deo je već bio ojačan u §39, ali
HTTP metod i dalje nije predstavljao bezbednu browser granicu.

Email bezbednosni skeneri, webmail preview, browser prefetch, unfurl botovi i
crawleri rutinski otvaraju link pre korisnika. Ako GET troši credential, takav
automat može:

- verifikovati nalog bez korisničkog pristanka;
- potrošiti jednokratni link pre stvarnog klika;
- izdati magic-login cookie u pogrešnom user-agentu;
- ostaviti korisnika sa „nevažećim“ linkom i bez pravog resend toka;
- uneti jednokratni token u analytics, referrer, crawler ili cache površinu.

Zato prefetch header heuristika nije izabrana kao glavna zaštita. Ne šalju svi
skeneri `Purpose`, `Sec-Purpose` ili konzistentan user-agent. Trajna invarijanta
je metodska: GET/HEAD samo čitaju ili preusmeravaju, a jedina mutacija je
eksplicitni same-origin POST koji nastaje posle korisničkog klika.

### 41.2. Serverska confirmation stranica bez mutacije i bez JS zavisnosti

`app/(auth)/verify-email/[token]/page.tsx` sada je server component. Nema
`"use client"`, `useEffect`, `fetch`, `router.replace` ni automatski API poziv.
Za završetak potvrde nije potreban client-side JavaScript: regularan HTML
`<form action="/api/auth/verify-email/..." method="post">` i native browser
submit predstavljaju jedini action. Tek vidljiv klik na dugme „Potvrdi email i
prijavi me“ šalje POST i jasno najavljuje obe posledice.

GET render obavlja samo sintaksnu proveru `/^[a-f0-9]{64}$/i`. Token mora biti
tačno 64 hex znaka, što odgovara 32-byte CSPRNG vrednosti u postojećem toku.
Pogrešan oblik odmah prikazuje generičnu poruku i link ka prijavi, bez forme i
bez DB lookup-a. Validan oblik prikazuje:

- eksplicitnu poruku da samo otvaranje linka nije promenilo nalog;
- native POST dugme;
- link za regularnu prijavu;
- retry poruku kada API vrati `error=temporary`;
- session-mismatch poruku i sign-out izbor kada je aktivan drugi nalog.

Kod session mismatch-a forma je namerno uklonjena sa stranice. Korisnik dobija
uputstvo da odjavi trenutni nalog ili da link otvori u privatnom prozoru. Time
UI ne nudi dugme koje bi samo ponovilo ishod koji zaštita mora da odbije.

Stranica je `dynamic = "force-dynamic"` i `revalidate = 0`. Metadata postavlja
`robots.index=false`, `follow=false`, `nocache=true` i
`referrer="no-referrer"`. Ovo je dodatna render-time zaštita; response headeri
opisani u §41.6 ostaju autoritativna HTTP granica.

### 41.3. Legacy API GET i HEAD su navigation-only 303

`app/api/auth/verify-email/[token]/route.ts` i novi testabilni
`lib/auth/email-verification-route.ts` zadržavaju kompatibilnost sa starim
direktnim API linkovima. `GET` i `HEAD` pozivaju samo `getConfirmationUrl()` i
vraćaju `303 See Other`:

- validan token vodi na kanonski lowercase `/verify-email/[token]`;
- nevalidan oblik vodi na `/login?error=invalid_token`;
- odgovor nema telo;
- odgovor nema `Set-Cookie`;
- nema verification DB lookup-a;
- nema čitanja postojeće sesije;
- nema JWT encode-a;
- nema token claim-a, `emailVerified` upisa ili sibling cleanup-a.

`303`, a ne 307/308, namerno normalizuje sledeću navigaciju na GET i sprečava
browser da kasnije ponovi mutirajući POST ka redirect cilju. Produkcijska
kompozicija i dalje fail-closed validira konfiguraciju. Params failure ili
nedostupan kanonski storefront URL vraćaju zaštićeni generički 503. Kada je
submitted token validnog oblika i kanonski URL poznat, kasniji auth-config kvar
vraća read-only 303 na confirmation ekran sa `error=temporary`. Nijedan od tih
ishoda ne čita bazu niti mutira token; u konfigurisanom toku legacy GET/HEAD
ugovor je isključivo read-only 303.

### 41.4. Lokalni same-origin/CSRF guard pre konfiguracije i baze

Globalni `proxy.ts` mora da izuzme deo `/api/auth` prostora kako eksterni
NextAuth provider callbackovi ne bi bili pogrešno blokirani. Zbog toga novi
verification POST ne može da se osloni samo na globalni unsafe-method guard.
Ruta eksplicitno poziva `isTrustedWriteRequest(request.headers)` pre:

1. čekanja route parametara;
2. čitanja `NEXT_PUBLIC_SITE_URL`/storefront URL konfiguracije;
3. čitanja `NEXTAUTH_SECRET` i cookie politike;
4. `getToken()` session dekodiranja;
5. bilo kog Prisma lookup-a ili commita.

Factory istu proveru ponavlja kako test ili buduća kompozicija ne bi slučajno
uklonili invarijantu. Zahtev se smatra trusted samo kada `Origin` postoji i
njegov normalizovani host odgovara `Host` headeru, ili kada browser bez Origin-a
pošalje `Sec-Fetch-Site: same-origin`. Pogrešan/malformed Origin, cross-origin,
missing Host ili odsustvo oba trusted signala vraćaju 403. U tom ishodu nema
params rada, lookup-a, sesije, cookie-ja ni token consumption-a.

Druga, odvojena origin granica rešava storefront alias. NextAuth session cookie
je host-only. Kada bi trusted same-origin POST stigao preko alias hosta, a
success redirect vodio na kanonski `getStorefrontUrl()` origin, browser bi
potrošio verification token na aliasu i zatim izgubio novu sesiju pri prelasku
na kanonski host. Ruta zato posle lokalnog guard-a i razrešavanja params/
storefront URL-a, ali pre auth secret/cookie konfiguracije, session čitanja i
baze, poziva `isCanonicalEmailVerificationRequest()`.

Trusted alias POST nije greška i ne troši token: vraća samo zaštićeni `303` ka
kanonskoj `/verify-email/[token]` stranici, bez lookup-a, commita ili
`Set-Cookie` headera. Korisnik na kanonskom originu ponovo vidi eksplicitno
dugme i tek naredni POST može da mutira stanje. Zahtev sa Origin-om mora da se
poklopi sa kanonskim originom; fallback bez Origin-a poredi Host sa kanonskim
hostom. Time local CSRF guard i canonical-cookie guard rešavaju različite
probleme i oba ostaju pre credential consumption-a.

Ovo je CSRF granica, ne opšta XSS ili compromised-origin zaštita. Skripta koja
već izvršava kod na legitimnom storefront originu i dalje može poslati trusted
POST; zato CSP, HTML sanitizacija, dependency hardening i ostale browser
zaštite ostaju nezavisno važne.

### 41.5. POST pipeline i session-mismatch pravilo

Posle lokalne i kanonske origin provere POST ima sledeći tačan redosled:

1. iz route konteksta uzima submitted token;
2. odbija sve osim tačno 64 hex znaka;
3. kanonizuje token u lowercase;
4. radi `EmailVerification.findUnique` lookup;
5. računa jedan `verifiedAt` trenutak i zahteva `expires > verifiedAt`;
6. čita eventualni current-session user ID centralnim NextAuth secret/cookie
   ugovorom;
7. proverava da current session ne pripada drugom korisniku;
8. izdaje session JWT sa centralnim rokom od 86.400 sekundi;
9. priprema kompletan success 303 i auth cookie;
10. atomskom transakcijom claim-uje token, verifikuje korisnika i briše
    sibling tokene;
11. vraća pripremljen odgovor samo posle commita.

Nepostojeći token daje invalid-token redirect bez kasnijeg rada. Istek na
tačnoj boundary vrednosti je zatvoren (`expires <= verifiedAt`) i vodi na
`/login?error=expired_token`. Ruta ga namerno ne briše: request path ostaje
read-only za expiry, dok će cleanup, resend ili maintenance kasnije odlučiti o
retentionu. Time transientni problem ne uništava credential pre nego što
postoji pouzdan recovery tok.

Ako `getToken()` vrati user ID različit od verification `userId`, odgovor je
303 nazad na confirmation stranicu sa `error=session_mismatch`. Nema session
encode-a, nema prepared success response-a, nema cookie-ja i nema DB commita.
Token ostaje potpuno retryable. Ako nema aktivne sesije ili ona pripada istom
korisniku, tok nastavlja. Ovo sprečava da email link za nalog A tiho zameni
aktivnu sesiju naloga B, a ne blokira legitimni repeat za isti nalog.

### 41.6. Encode → prepared 303 cookie → atomic commit

`prepareVerificationSuccessBeforeCommit()` i dalje sprovodi response-before-
commit invarijantu iz §39, sada iza eksplicitnog POST-a:

1. `next-auth/jwt.encode()` potpisuje token centralnim secretom i rokom od 24
   sata;
2. priprema se `303 /moj-nalog?verified=true`;
3. response dobija centralno ime session cookie-ja, `HttpOnly`,
   `SameSite=Lax`, `Path=/`, centralnu secure odluku i `Max-Age=86400`;
4. tek zatim `commitEmailVerification()` otvara Prisma transakciju;
5. conditional `deleteMany` zahteva isti `id`, `userId`, lowercase token i
   `expires > verifiedAt`;
6. tačno jedan claim postavlja `User.emailVerified=verifiedAt` i briše sve
   preostale verification tokene tog korisnika;
7. bilo koji failure rollback-uje celu transakciju.

Ako conditional claim izgubi race, baca se
`EmailVerificationConflictError`. Prepared success objekat se ne vraća;
failure helper dodatno uklanja svaki `Set-Cookie`, pa gubitnik dobija generični
invalid-token redirect bez autentifikacije. Isto važi kada JWT encode,
response priprema ili DB commit zakažu: token ostaje retryable kada commit nije
uspeo, operational failure vodi na confirmation ekran sa `error=temporary`, a
prepared cookie se nikada ne šalje.

Ovaj redosled znači da „magic login“ nije uklonjen, već precizno ograničen:
korisnik dobija standardnu 24-časovnu sesiju tek posle eksplicitnog POST klika i
uspešnog exactly-once commita. Sam email GET, preview ili scanner nema put do
sesije.

### 41.7. Jedinstvena cache, referrer, robots i GA politika

`lib/auth/email-verification-route.ts` centralizuje privacy headere i primenjuje
ih na svaki redirect, JSON fallback i failure odgovor:

| Header | Vrednost | Svrha |
| --- | --- | --- |
| `Cache-Control` | `private, no-store, max-age=0` | zabrana čuvanja credential URL odgovora |
| `Pragma` | `no-cache` | kompatibilnost sa starijim cache slojevima |
| `Referrer-Policy` | `no-referrer` | token se ne šalje kao outbound Referer |
| `X-Robots-Tag` | `noindex, nofollow, noarchive` | crawler ne indeksira, ne prati i ne arhivira tok |

`next.config.ts` istu politiku postavlja na
`/verify-email/:path*`, `/api/auth/verify-email/:path*`, bearer-token stranicu
`/reset-password/:token`, kao i `/newsletter/odjava` i njen unsubscribe API.
Time verification page/API i postojeće reset/newsletter credential površine
dele pun no-store/no-referrer/noindex/noarchive ugovor; newsletter je ranije
imao samo `no-referrer`. Factory ponavlja headere na svim verification
dinamičkim ishodima i briše cookie pre svakog failure return-a.

Stari globalni GA inline blok zamenjen je
`components/analytics/GoogleAnalytics.tsx` komponentom i čistim helperom
`lib/analytics/google-analytics.ts`. Konačna odluka je centralizovana u
`lib/security/credential-path.ts`, jer `Referrer-Policy` ne sprečava skriptu
koja već radi na stranici da pročita `window.location`. Sensitive putanje su
tačan `/verify-email`, sve `/verify-email/*` podputanje, token-bearing
`/reset-password/*` i `/newsletter/odjava`, čiji credential živi u query-ju.

I Google Analytics i globalni reCAPTCHA provider koriste isti
`shouldLoadThirdPartyScripts()` guard. Na sensitive putanji se zato ne učitava
ni `gtag.js` ni reCAPTCHA third-party skripta. Dok `usePathname()` ne razreši
vrednost, odluka je private-by-default. Obična `/reset-password` request forma,
`/newsletter`, `/verify-email-address`, login i ostale storefront putanje
ostaju normalno funkcionalne/trackable.

Ručni GA page view za dozvoljenu stranicu šalje `page_path=pathname`, a
`page_location` eksplicitno sklapa samo kao `window.location.origin +
pathname`. Query string i hash se ne prosleđuju čak ni na običnim stranicama.
To zatvara slučajno analytics curenje budućih query credentiala i drugih
osetljivih parametara.

`no-referrer`, no-store i GA exclusion ograničavaju sekundarno browser curenje,
ali ne mogu da uklone prvi zahtev iz browser history-ja ili HTTP access loga.
CDN, reverse proxy i application server već vide puni verification URL pre
nego što response header može da deluje. Dok se token ne hash-uje i log
redaction/retention ne proveri operativno, prvi URL u access logu ostaje poznat
residual, a token se tretira kao plaintext secret.

### 41.8. Kanonski email link, registration copy i account završetak

`lib/email/auth-emails.ts` više ne koristi opšti `siteUrl` string za verification
link. URL se pravi kao `new URL('/verify-email/' + encodedToken,
getStorefrontUrl())`, čime se dobija ista kanonska origin validacija kao u
ostatku storefronta i izbegava ručno spajanje slash-eva. HTML link nosi
`rel="noreferrer"`.

Email copy je usklađen sa stvarnim dvokoračnim tokom:

- dugme sada kaže „Otvori stranicu za potvrdu“;
- poruka objašnjava da samo otvaranje neće promeniti nalog;
- korisnik mora na stranici da izabere „Potvrdi email i prijavi me“;
- tek taj korak završava potvrdu i prijavu;
- postojeći jednočasovni verification link expiry ostaje isti.

U `app/api/auth/register/route.ts` delivery failure više ne ispisuje raw SMTP
exception. Log sadrži samo tekst toka i `{ stage: "DELIVERY" }`, bez emaila,
tokena ili transport detalja. Registration response više ne kaže „proverite
email, poslali smo“ kada je SMTP možda pao, već samo da je nalog napravljen i da
je za aktivaciju potrebna email potvrda. Login registration banner koristi isti
oprezni ugovor: proveriti inbox/spam i kontaktirati podršku ako poruka ne stigne.
To je sitna, ali važna ispravka istinitosti; resend/outbox još ne postoji.

Uspešan verification POST vodi na `/moj-nalog?verified=true`.
`app/(user)/moj-nalog/VerifiedEmailNotice.tsx` prikazuje pristupačni statusni
banner „Email je uspešno potvrđen“ i zatim preko `history.replaceState` briše
samo `verified` parametar. Ostali query parametri i hash ostaju sačuvani. Tako
refresh/back/clipboard ne ponavljaju success signal, a verification token se
nikada ne prenosi na account URL. Client helper postoji tek na već
autentifikovanoj account strani; confirmation mutacija i dalje ne zavisi od JS-a.

### 41.9. Stage-only observability i failure matrica

Novi route factory prati samo grubu fazu:

- `PARAMS`;
- `LOOKUP`;
- `EXPIRY_CHECK`;
- `CURRENT_SESSION`;
- `SESSION_ISSUE`;
- `RESPONSE_PREPARATION`;
- `COMMIT`.

Produkcijska kompozicija dodaje samo `CONFIGURATION`. Reporter nikada ne dobija
submitted token, verification URL, email, session JWT, user ID ili originalni
DB/JWT exception. I reporter je iza `try/catch` granice, pa kvar loggera ne
menja generični retry ishod.

Javni ishodi su kontrolisani ovako:

| Granica | Ishod | DB/token/session posledica |
| --- | --- | --- |
| cross-origin/missing trusted signal | 403 JSON | ništa nije pročitano ni promenjeno |
| trusted alias origin | 303 kanonska confirmation stranica | bez lookup-a, commita i cookie-ja |
| malformed 64-hex token | 303 invalid login cilj | bez lookup-a |
| token ne postoji | 303 invalid login cilj | samo read lookup |
| token istekao | 303 expired login cilj | bez delete-a i bez cookie-ja |
| aktivna druga sesija | 303 confirmation + `session_mismatch` | token ostaje aktivan |
| encode/response/operativni kvar | 303 confirmation + `temporary` | bez success cookie-ja; commit nije uspeo |
| concurrent claim conflict | 303 invalid login cilj | gubitnik nema cookie; pobednik je jedini commit |
| uspeh | 303 account + `verified=true` | 24h cookie tek posle atomskog commita |
| params ili kanonski URL nisu dostupni | generički 503 JSON | bez DB mutacije i bez raw detalja |
| kasniji auth-config kvar uz validan token/poznat URL | 303 confirmation + `temporary` | bez lookup-a, commita i cookie-ja |

Svaki od ovih odgovora dobija kompletnu private/no-store/no-referrer/noindex
politiku. Statusi nisu account-enumeration ugovor kao reset request, jer sam
verification token predstavlja high-entropy capability; ipak se nijedan raw
interni detalj ne vraća ili loguje.

### 41.10. Testovi i završni lokalni dokaz

Novi `lib/auth/email-verification-route.test.ts` sadrži tačno 13 testova —
prvobitnih 12 route ugovora i naknadni canonical-origin test:

1. response helperi primenjuju sva četiri privacy headera;
2. canonical-origin helper prihvata kanonski origin/host, a odbija trusted
   alias pre token use-a;
3. legacy GET i HEAD su tačni read-only 303 bez tela/cookie-ja;
4. lokalni trusted-write guard radi pre params i lookup-a;
5. validan POST poštuje lookup → current session → encode → response → commit;
6. asinhrona response priprema mora završiti pre commita;
7. malformed i absent token ne pokreću kasniji rad;
8. expired/boundary token je read-only;
9. sesija drugog korisnika ne troši token;
10. sesija istog korisnika sme da završi potvrdu;
11. svih sedam operational failure faza daju stage-only retry bez cookie-ja;
12. commit conflict odbacuje prepared success cookie;
13. kvar reportera ne menja generičan javni ishod.

`lib/analytics/google-analytics.test.ts` dodaje tri odvojena wrapper testa:
credential path exclusion matricu, normalne/slično nazvane trackable putanje i
private-by-default ponašanje za null/undefined/prazan pathname.
`lib/security/credential-path.test.ts` dodaje još tri testa same centralne
politike: verification/reset-token/newsletter putanje nikada ne učitavaju
third-party skripte, obične auth/storefront putanje smeju da ih učitaju i
nerazrešeno stanje ostaje privatno. Tako GA i reCAPTCHA ne zavise od dve ručno
održavane liste.

Opt-in `lib/auth/email-verification.integration.test.ts` je proširen sa same DB
commit primitive na stvarnu route granicu. Nad bezbedno imenovanom PostgreSQL
test bazom pravi korisnika, primarni i sibling 64-hex token, pa proverava:

1. prefetch GET i HEAD vraćaju 303 bez cookie-ja;
2. route lookup count ostaje nula;
3. `emailVerified` i `updatedAt` ostaju nepromenjeni;
4. oba verification reda ostaju prisutna;
5. dva preklopljena POST radnika oba vide isti token;
6. tačno jedan vraća 303 sa session cookie-jem;
7. drugi vraća conflict/invalid ishod bez cookie-ja;
8. samo jedan commit pobeđuje;
9. korisnik dobija tačan `verifiedAt`;
10. primarni i svi sibling tokeni nestaju posle pobedničke transakcije.

Završna lokalna matrica posle funkcionalnog preseka:

| Provera | Rezultat |
| --- | --- |
| email-verification route testovi | 13/13 prolazi |
| GA privacy testovi | 3/3 prolaze |
| central sensitive-credential policy testovi | 3/3 prolaze |
| ciljani paket | 20 ukupno; 19 prolazi; 1 auth real-DB test preskočen |
| kompletan `npm test` | 145 ukupno; 143 prolaze; 2 opt-in PostgreSQL testa preskočena |
| razlog za skip | nema pokrenute, jasno imenovane bezbedne lokalne test baze |
| `npm run lint -- --quiet` | prolazi |
| `npm run typecheck` | prolazi |
| `git diff --check` | prolazi |
| production build sa lažnim CI vrednostima | prolazi; završena je matrica od 91 rute |
| nezavisni završni read-only review | ranija dva HIGH i canonical-host MEDIUM su zatvoreni; nema novih blocker/high nalaza |

Dva skip-a nisu failure: oba su postojeći real-DB testa koja se namerno
uključuju samo eksplicitnim flagom i bezbednim PostgreSQL URL-om. Lokalni build
je koristio eksplicitno zadate lažne CI vrednosti i postojeće safe-default
grane. Agent nije otvarao, čitao niti ispisivao vrednosti iz `.env`; relevantne
postavke bile su pregažene lažnim vrednostima, a DB URL je pokazivao na
nedostupan loopback port 9, pa produkciona baza nije kontaktirana. Lokalni dokaz
je zatim ponovljen u izolovanom GitHub CI-ju nad tačnim feature headom i nad
kanonskim V2 merge commitom, sa uključenim opt-in PostgreSQL testovima,
Chromium smoke-om i produkcijskim buildom; detalji su u §41.12.

Canonical-origin helper je direktno unit-testiran, ali production route modul
nema zaseban import test jer vezuje server-only i Prisma kompoziciju. Njegov
redosled local guard → params/storefront → alias 303 ili canonical auth/DB put
nezavisno je read-only pregledan i ocenjen ispravnim. Budući route-module
harness može povećati dubinu automatizovanog testa; ovo nije ostavljen
blocker/high funkcionalni nalaz.

### 41.11. Ograničenja i sledeći P1 redosled

Prefetch-safe granica je završena, ali auth/email platforma nije kompletna:

1. verification i reset tokeni su još plaintext u bazi; hashing je sledeći
   credential-at-rest korak;
2. prvi email URL može ostati u browser/CDN/reverse-proxy/server access logu;
3. ne postoji pravi verification resend sa cooldown/concurrency pravilima;
4. ne postoji transactional auth-email outbox, retry worker, deduplikacija,
   delivery monitoring ili alert;
5. registracija nije atomski povezana sa pouzdanom email isporukom;
6. globalni verified-login uslov nije uključen, jer postojeći nalozi još nemaju
   audit/backfill i bezbedan recovery;
7. sesije se ne opozivaju ovom promenom i role freshness ostaje zaseban rad;
8. verification/login abuse zaštita još koristi postojeće procesne granice;
   nema shared Redis/DB limitera;
9. reset-confirm exactly-once claim i concurrency-safe jedan reset token ostaju
   odvojeni P1 zadaci;
10. staging/runtime delivery i auth smoke tek treba izvršiti u kontrolisanom
    okruženju.

Nije menjana Prisma šema i nema nove migracije. Nisu čitani ili menjani
produkcioni podaci, server, SSH/VPS, `.env`, tajne, DNS, TLS, reverse proxy,
PM2, GitHub Environment, required reviewer, repository/environment
secrets/variables ili release workflow. Nije napravljen release tag, nije
pokrenut deploy i ništa nije pušteno live.

### 41.12. PR #14, exact-head i post-merge CI dokaz

Planirani V2-only integracioni redosled završen je stvarnim GitHub dokazima:

1. feature commit `6ffd173b3eda59815894ea43181543791dba58a0`
   objavljen je na `ispravka/v2-prefetch-safe-verifikacija`;
2. [PR #14](https://github.com/biozencaj-stack/narodnanosnja/pull/14) imao je
   base isključivo `verzija/v2.0-univerzalna-platforma`;
3. exact-head `pull_request` run
   [`33309850609`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33309850609)
   na feature SHA-u završio je `SUCCESS` od 11:48:34 do 11:51:13 UTC, oko
   2 min 39 s;
4. njegov `Provera verzije` job završio je uspešno, dok su `Potvrdi V2 release`
   i `Objavi na produkciju` bili `SKIPPED`;
5. PR je spojen samo u kanonsku V2 granu kao
   `c96473c22fb56f8b6c1b5b34570936d526577c10`;
6. post-merge `push` run
   [`33309984025`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33309984025)
   na merge SHA-u završio je `SUCCESS` od 11:51:49 do 11:54:39 UTC, oko
   2 min 50 s;
7. post-merge `Provera verzije` ponovo je završila uspešno, a oba release posla
   ponovo su bila `SKIPPED`;
8. remote `verzija/v2.0-univerzalna-platforma` head potvrđen je kao isti
   `c96473c22fb56f8b6c1b5b34570936d526577c10`.

Oba CI pipeline-a podigla su izolovani PostgreSQL 16, primenila migracije i DB
provere, uključila opt-in PostgreSQL testove, izvršila kompletan test paket,
Chromium smoke, lint, TypeScript i produkcijski build. Time lokalna 145-test
matrica ima exact-head i post-merge replay nad stvarnim GitHub checkout-ima.

Read-only GitHub provera posle merge-a nalazi 0 deployment zapisa za merge SHA
i 0 tagova koji pokazuju na taj commit. Presentation `main`, javni/live sajt i
GitHub `production` Environment ostali su netaknuti. Nije otvoren production
gate, nije kontaktiran server i integracija nije promenila prethodno
dokumentovano pravilo da live puštanje ostaje poslednja, posebno odobrena faza.

## 42. P1 auth credential storage i atomska reset potvrda

Četvrti P1 auth presek započet je 30. avgusta 2026. na radnoj grani
`ispravka/v2-hashovani-tokeni-reset-claim`, napravljenoj direktno iz tadašnjeg
kanonskog V2 documentation head-a
`4e53d138b6b2c3c0c206ab6a28d169fecbbe4ab`. Promena je postala feature commit
`b6c7aada0a692b826ff04443308f62584c96fe0a`, prošla exact-head run
`33313169708`, kroz PR #16 spojena samo u V2 kao
`8cf83e56be9cf0775db92ba9319eac5d993994e0` i ponovljena zelenim post-merge
run-om `33313329660`. Probni lokalni build i oba izolovana PostgreSQL CI run-a
su uspešni; produkcijska baza nije čitana ili menjana, migracija nije primenjena
na produkciju, a server i live sajt nisu menjani.

Cilj preseka je da se četiri ranije odvojena problema reše jednim doslednim
ugovorom:

1. verification i reset tokeni moraju imati isti strogi javni format;
2. current aplikacija mora da traži indeksirani purpose-separated hash pre
   legacy plaintexta;
3. paralelni reset requesti moraju ostaviti najviše jedan aktivni red po
   korisniku;
4. reset confirm mora claim, promenu lozinke i cleanup da commit-uje tačno
   jednom ili da sve rollback-uje.

### 42.1. Bezbednosna granica: compat nije hash-only

Ova faza je namerno projektovana kao **expand/compat** migracija. Ona dodaje
hash kolone i omogućava hash-only redove, ali trenutni registration i
password-reset request upisi privremeno rade dual-write: u istom redu čuvaju i
raw bearer vrednost i njen hash. Postojeće plaintext kolone, unique constraints
i equality indeksi ostaju aktivni da bi prethodna aplikaciona verzija i već
izdati linkovi mogli da rade tokom kontrolisanog rolling/rollback prozora.

Zato nije bezbedno tvrditi da su credentiali „hashovani u bazi” u konačnom
smislu. Current lookup i claim koriste hash, ali novi dual-write red još sadrži
upotrebljiv plaintext bearer. Čitalac baze koji vidi taj red i dalje može da
iskoristi raw link. Dobit ove etape je:

- jedan kanonski format i storage verzija;
- hash-first lookup koji se može meriti i kasnije učiniti jedinim putem;
- zabrana downgrade-a current reda na plaintext kopiju;
- unique reset-user invarijanta;
- exactly-once DB claim za reset confirm;
- bezbedna osnova za kasniji hash-only write i contract cleanup.

Završni prelaz zahteva poseban aplikacioni presek koji gasi dual-write, zatim
čekanje najmanje najdužeg token TTL-a plus dogovoreni grace period i dokaz da
legacy fallback više nije potreban. Tek tada zasebna contract migracija sme da
ukloni plaintext kolone i indekse. Ovaj redosled ne sme da se skrati radi
jednostavnijeg deploya.

### 42.2. Centralni `credential-token` helper

Novi `lib/auth/credential-token.ts` uklanja duplirane ad hoc generatore i
definiše šest važnih invarijanti:

1. `generateRawCredentialToken()` koristi `randomBytes(32)` i vraća tačno 64
   lowercase hex znaka, odnosno 256-bitni bearer credential;
2. `normalizeRawCredentialToken()` prima `unknown`, prihvata samo string koji
   odgovara `/^[0-9a-f]{64}$/i` i vraća lowercase oblik;
3. parser namerno ne radi `trim()`, Unicode normalizaciju, coercion ili
   prihvatanje `v1:` prefiksa na javnoj granici;
4. `hashCredentialToken()` prihvata samo purpose `email-verification` ili
   `password-reset`;
5. SHA-256 ulaz je namespaced i verzionisan kao
   `narodna-nosnja:credential-token:v1\0<purpose>\0<raw-token>`;
6. current storage oblik je isključivo lowercase `v1:<64-hex-digest>`.

NUL-separated purpose domain znači da isti raw token ne daje isti digest u
verification i reset tabeli. Verzijski prefiks omogućava buduću rotaciju
algoritma/formata bez nevidljivog mešanja različitih storage ugovora.

`createCredentialTokenLookupKeys()` vraća tri imenovane vrednosti:

| Ključ | Namena |
| --- | --- |
| `normalizedRawToken` | kanonska browser/email capability vrednost |
| `currentHash` | prvi i preferirani indexed DB lookup |
| `legacyPlaintext` | privremeni fallback samo za red sa `tokenHash IS NULL` |

`isCurrentCredentialTokenHash()` odbija raw token, uppercase storage vrednost,
drugu verziju, prekratak/predugačak digest i non-string. Šest unit testova u
`lib/auth/credential-token.test.ts` proverava 32 nezavisna generator uzorka,
tačan byte/hex format, strogi parser, poznate digest vrednosti za oba purpose-a,
njihovu međusobnu različitost, version recognizer, lookup redosled i
fail-closed input bez izbacivanja credentiala kroz exception.

Raniji `generateResetToken()` u `lib/auth/password.ts` uklonjen je kao
nepotreban paralelni generator. Password policy, bcrypt hash i verify helperi
ostaju u tom modulu.

### 42.3. Prisma model: nullable compat kolone i unique reset user

`prisma/schema.prisma` menja `PasswordReset` ovako:

- `userId String @unique` zamenjuje stari ne-unique user indeks;
- `token String? @unique` ostaje legacy/rollback kolona;
- `tokenHash String? @unique` postaje current indexed storage;
- `expires` i `createdAt` ostaju bez promene;
- eksplicitni `@@index([token])` ostaje kao postojeći equality indeks;
- `@@index([userId])` se uklanja jer ga unique user indeks nadomešta.

Time jedan korisnik može imati nula ili jedan reset red, dok PostgreSQL i dalje
dozvoljava više `NULL` vrednosti u nullable unique hash/plaintext kolonama.

`EmailVerification` dobija nullable unique `token` i nullable unique
`tokenHash`, ali `userId` ostaje ne-unique i zadržava indeks. Više sibling
verification linkova istog korisnika ostaje dozvoljeno jer uspešan exactly-once
verification tok treba da ih očisti u svojoj transakciji. Unique user ugovor
zato pripada samo reset toku.

### 42.4. Migracija `20260830000000_expand_hashed_auth_tokens`

Migracija je ručno pregledan expand SQL, ne Prisma-generated cleanup
pretpostavka. Njena struktura je:

1. `BEGIN` i hardened `SET LOCAL search_path = pg_catalog, public`;
2. `SET LOCAL lock_timeout = '10s'`;
3. `SET LOCAL statement_timeout = '2min'`;
4. `LOCK TABLE "PasswordReset" IN SHARE ROW EXCLUSIVE MODE`;
5. fail-closed duplicate preflight;
6. nullable `tokenHash` i nullable plaintext izmene oba modela;
7. tri nova unique indeksa;
8. uklanjanje redundantnog ne-unique reset-user indeksa;
9. `COMMIT`.

Timeouti sprečavaju da auth write saobraćaj neograničeno čeka iza migracije ili
da migracija ostane zaglavljena. Timeout prekida i rollback-uje celu transakciju;
ne ostavlja polovično primenjen contract. Ipak, ALTER/CREATE INDEX zahtevi mogu
biti operativno značajni, pa maintenance prozor i lock monitoring ostaju
obavezni. `statement_timeout='2min'` meri svaku SQL naredbu zasebno, ne ukupno
trajanje transakcije, a ACCESS EXCLUSIVE lockovi stečeni DDL-om ostaju do
`COMMIT`-a.

Preflight pod istim lock-om radi `GROUP BY "userId" HAVING COUNT(*) > 1`.
Ako pronađe makar jedan duplikat, baca:
`Cannot add PasswordReset_userId_key: duplicate PasswordReset.userId rows exist`.
Migracija ne sadrži nijedan `INSERT`, `UPDATE` ili `DELETE`. Ne pretpostavlja da
je najnoviji red jedini ispravan, ne zna koji email je stigao korisniku i ne
briše capability podatke bez poslovne odluke.

Operativni odgovor na exception nije ručno nasumično brisanje. Potrebni su:

1. read-only produkcioni audit broja i starosti duplikata;
2. svež backup i dokazan restore;
3. eksplicitna odluka za svaki konflikt;
4. ponovljena read-only provera;
5. kontrolisano izvršavanje migracije uz praćenje lock/statement timeouta.

Ako `prisma migrate deploy` posle preflight exception-a ili timeout-a ostavi
failed zapis u `_prisma_migrations`, ponovni deploy se ne radi naslepo. Prvo se
potvrđuju potpuni PostgreSQL rollback i otklanjanje uzroka, a tek zatim se
kontrolisano izvršava
`prisma migrate resolve --rolled-back 20260830000000_expand_hashed_auth_tokens`
i ponavlja deploy. `resolve` nije dozvola da se preskoče audit ili provera
stvarnog DB stanja.

Tokom ovog preseka produkcijska baza nije čitana, kontaktirana niti migrirana.
Migracija nije primenjena ni nad lokalnom produkcionom kopijom.

### 42.5. Ojačan DB invariant smoke

`scripts/db-invariant-smoke.sql` zadržava globalni `BEGIN`/`ROLLBACK` ugovor;
svi auth fixture redovi postoje samo unutar test transakcije. Za četiri auth
kolone proverava očekivanu nullability. Za sledećih sedam indeksa proverava ceo
katalog ugovor, a ne samo prisustvo imena:

| Indeks | Tabela/kolona | Unique |
| --- | --- | --- |
| `PasswordReset_tokenHash_key` | `PasswordReset.tokenHash` | da |
| `EmailVerification_tokenHash_key` | `EmailVerification.tokenHash` | da |
| `PasswordReset_userId_key` | `PasswordReset.userId` | da |
| `PasswordReset_token_key` | `PasswordReset.token` | da |
| `PasswordReset_token_idx` | `PasswordReset.token` | ne |
| `EmailVerification_token_key` | `EmailVerification.token` | da |
| `EmailVerification_token_idx` | `EmailVerification.token` | ne |

Svaki mora da pripada `public` šemi, tačnoj tabeli i tačnoj nedropped koloni,
da ima očekivanu uniqueness vrednost, `indisvalid=true`, `indisready=true`,
tačno jednu key/total kolonu, bez predicate-a i bez expression-a. Smoke zatim
zahteva i `indnullsnotdistinct=false`, odnosno standardni `NULLS DISTINCT`
ugovor potreban nullable compat kolonama, pa potvrđuje odsustvo tri redundantna
user/hash indeksa. Time indeks istog imena na pogrešnoj tabeli, invalid
concurrent-build ostatak, pogrešan NULL ugovor ili pogrešan composite/partial
shape ne može da prođe proveru.

Rollback fixture matrica dalje dokazuje:

- hash-only `PasswordReset` red;
- odbijanje drugog reset reda istog korisnika;
- odbijanje duplicate reset hasha;
- čist legacy reset red sa `tokenHash=NULL`;
- dva sibling hash-only verification reda istog korisnika;
- odbijanje duplicate verification hasha;
- čist legacy verification red;
- uklanjanje svih fixture podataka završnim rollback-om.

### 42.6. Reset request: upsert umesto delete/create prozora

`lib/auth/password-reset-request.ts` proširuje dependency ugovor sa
`hashToken()`. Privatni background pipeline posle user lookup-a:

1. generiše raw credential;
2. odmah izračunava purpose-separated password-reset hash;
3. nevalidan generator/hash rezultat mapira na kontrolisanu
   `TOKEN_REPLACEMENT` failure fazu;
4. tek validan par prosleđuje persistence adapteru;
5. email delivery dobija samo raw credential.

Persistence input jasno imenuje privremeni `legacyPlaintextToken` i current
`tokenHash`, da dual-write ne izgleda kao trajni storage contract.

`app/api/auth/reset-password/request/route.ts` zadržava immediate HTTP 202 i
Next.js `after()` granicu iz §40. DB deo sada radi jedan
`prisma.passwordReset.upsert({ where: { userId } })`. Create i update grane
upisuju user, raw token, hash i expiry. Unique `PasswordReset.userId` osigurava
najviše jedan red pod paralelnim zahtevima; kasniji successful writer određuje
koji poslednji email link ostaje aktivan.

Ovim je uklonjen raniji deleteMany/create race, ali nije uveden durable email
outbox. Proces može pasti posle javnog 202, a pre završenog lookup/upisa/SMTP-a.
SMTP i dalje može prihvatiti email pre gubitka odgovora. Zbog toga token nije
automatski obrisan na delivery failure-u, a outbox/retry/monitoring ostaju
zaseban P1.

`lib/auth/password-reset-request.test.ts` sada proverava hash dependency,
dual-write persistence payload i činjenicu da invalid generated credential
zaustavlja persistence i delivery.

### 42.7. Reset confirm route granica

`lib/auth/password-reset-confirm-route.ts` uvodi testabilni handler koji
sprovodi sledeći javni redosled:

1. `isTrustedWriteRequest()` se proverava pre body parsiranja, token helpera,
   rate-limit ključa izvedenog iz zahteva i bilo kog DB rada;
2. cross-origin ili zahtev bez trusted browser signala dobija 403;
3. procesni limiter koristi `reset-confirm:<x-forwarded-for-or-unknown>` i
   postojeći limit 5;
4. malformed JSON daje 400 bez lookup-a;
5. token mora biti string sa tačno 64 hex znaka;
6. password mora biti string i imati najviše 72 UTF-8 bajta;
7. postojeći `validatePassword()` zatim sprovodi poslovnu password politiku;
8. current hash lookup se poziva prvi;
9. legacy lookup se poziva samo kada current lookup vrati null;
10. expiry mora biti strogo posle prvog `lookupAt` trenutka;
11. bcrypt hash se izračunava pre transakcije;
12. kompletan success response i sva privacy zaglavlja pripremaju se pre
    transakcije;
13. vreme se meri ponovo posle bcrypt/response rada;
14. credential mora i dalje imati `expires > resetAt`;
15. tek tada se poziva atomic commit servis.

72-byte ograničenje meri `TextEncoder` UTF-8 bajtove, a ne JavaScript broj
karaktera. Time višebajtna Unicode lozinka ne može neprimetno preći bcrypt
granicu i biti skraćena na isti efektivni input kao druga lozinka.

Drugo vreme bira `max(beforeCommit, lookupAt)`, pa čak ni anomalija/test clock
koji se pomeri unazad ne može produžiti važenje tokena. Boundary
`expires === resetAt` je invalid. Credential koji istekne tokom bcrypt-a ili
response pripreme dobija generičan invalid ishod bez DB commita.

Svaki 200/400/403/429/503 odgovor nosi:

- `Cache-Control: private, no-store, max-age=0`;
- `Pragma: no-cache`;
- `Referrer-Policy: no-referrer`;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

Javne poruke ne razlikuju missing, expired, boundary ili lost-race credential.
Operational failure daje retryable 503. Reporter dobija samo jednu od faza
`RATE_LIMIT`, `PASSWORD_VALIDATION`, `TOKEN_KEYS`, `HASH_LOOKUP`,
`LEGACY_LOOKUP`, `EXPIRY_CHECK`, `PASSWORD_HASH`, `RESPONSE_PREPARATION` ili
`COMMIT`; nikada token, hash, email, password, user ID ili originalni exception.
Kvar samog reportera ne menja generičan javni odgovor.

### 42.8. Atomic conditional claim i rollback

`lib/auth/password-reset-confirm.ts` razdvaja current i legacy claim:

- current claim nosi tačan `storedValue` iz `tokenHash` reda;
- legacy claim nosi tačan stored raw token i dozvoljen je samo za red bez
  current hash vrednosti.

`commitPasswordResetConfirmation()` otvara jednu Prisma transakciju. Prvi
`deleteMany` zahteva istovremeno:

- isti reset row `id`;
- isti `userId`;
- `expires > resetAt`;
- ili tačan `tokenHash`;
- ili tačan legacy `token` **i** `tokenHash: null`.

Legacy `tokenHash: null` je ponovljen u conditional delete-u, ne samo u lookup-u.
Ako concurrent backfill/write promeni red između lookup-a i claima, plaintext
ne može postati downgrade put. `count !== 1` baca
`PasswordResetConfirmConflictError` pre password update-a.

Samo pobednik zatim menja `User.passwordHash` i briše eventualne reset siblinge
istog korisnika. Ako password update ili cleanup zakažu, transakcija vraća i
prvobitno obrisani claim red. Isti credential zato ostaje retryable posle
operativnog rollback-a. Ako dva radnika claim-uju isti red, tačno jedan može
dobiti count 1; drugi dobija generičan invalid ishod i nikada ne vraća unapred
pripremljeni success response.

`app/api/auth/reset-password/confirm/route.ts` vezuje factory za centralni
helper, Prisma hash-first/legacy-null upite, postojeći rate limiter/password
helper, atomic service i stage-only production log.

### 42.9. Reset confirm unit i PostgreSQL concurrency testovi

`lib/auth/password-reset-confirm.test.ts` proverava tačan transaction redosled
za current hash, exact legacy selector sa `tokenHash:null` i rollback bez
password/sibling rada kada je claim count nula.

`lib/auth/password-reset-confirm-route.test.ts` pokriva 11 ugovora:

- origin guard pre svih kasnijih dependency poziva;
- malformed input i bcrypt >72-byte stop pre lookup-a;
- password-policy ishod;
- hash-first success i response-before-commit redosled;
- legacy tek posle hash miss-a;
- zabranu downgrade-a reda koji ipak ima current hash;
- isti generic outcome za missing/expired/boundary;
- late expiry tokom bcrypt/response pripreme;
- conflict koji odbacuje prepared success;
- stage-only operational failure matricu;
- kompletnu privacy politiku na rate limitu i uspehu.

Opt-in `lib/auth/password-reset-confirm.integration.test.ts` se pokreće samo uz
`RUN_PASSWORD_RESET_CONFIRM_DB_TESTS=true`. Pre importa Prisma klijenta zahteva
PostgreSQL URL na loopback hostu i ime baze sa jasnim `test`, `e2e` ili
`provera` markerom. Test zatim:

1. pravi hash-only reset red;
2. dva handler radnika sa različitim novim lozinkama zaustavlja barijerom
   unutar dve preklopljene transakcije;
3. zahteva dva hash lookup-a i nula legacy lookup-a;
4. zahteva tačno dva commit pokušaja, jednog pobednika i jednog conflict-a;
5. bcrypt verify-jem potvrđuje samo pobedničku lozinku;
6. potvrđuje nula preostalih reset redova;
7. pravi čist legacy fixture i dokazuje hash-miss → legacy success;
8. ubrizgava password-update failure posle conditional delete-a;
9. potvrđuje da rollback čuva token i staru lozinku;
10. istim claim-om ponavlja uspešan commit i proverava novu lozinku.

### 42.10. Email verification: hash claim, no downgrade i late expiry

`app/api/auth/verify-email/[token]/route.ts` sada za validan raw token pravi
purpose-separated lookup ključeve. Prvo radi unique `tokenHash` lookup. Samo
posle promašaja radi legacy `findFirst` sa oba uslova:
`token = legacyPlaintext` i `tokenHash = null`.

Lookup rezultat uključuje oba storage polja. Novi
`createStoredEmailVerificationClaim()` u `lib/auth/email-verification.ts`:

1. bira current hash kada je `tokenHash` kanonski lowercase `v1` oblik;
2. odbija red čiji `tokenHash` nije null, ali nije validan current hash;
3. ne dozvoljava da takav red padne na plaintext kopiju;
4. čist legacy red prihvata samo kada stored token već jeste tačan kanonski
   lowercase 64-hex oblik;
5. u transakciju prenosi credential stvarno pročitan iz storage-a.

`commitEmailVerification()` current claim veže za hash. Legacy conditional
delete sada eksplicitno zahteva i tačan token i `tokenHash:null`, pa concurrent
backfill između lookup-a i claima ne može otvoriti downgrade. Existing
id/userId/expiry, `emailVerified` update i sibling cleanup invarijante ostaju.

Adversarial review je otkrio da session encode i priprema response-a mogu, kao
i bcrypt u reset toku, preći expiry granicu. `lib/auth/email-verification-route.ts`
zato sada ponovo meri vreme neposredno pre atomic claima, uz monotono
`max(beforeCommit, lookupAt)` pravilo. Ako `expires <= verifiedAt` u toj drugoj
proveri, vraća se read-only expired ishod: nema claima, `emailVerified` upisa,
sibling cleanup-a ni session cookie-ja. Unit test matrica dobila je poseban
late-expiry slučaj, a postojeći real-DB verification scenario je prilagođen
hash storage-u i exact claim-u.

Prefetch-safe GET/HEAD, explicit same-origin POST, canonical-host redirect,
session-mismatch i privacy pravila iz §41 ostaju nepromenjeni.

### 42.11. Registracija i kanonski auth-email URL-ovi

`app/api/auth/register/route.ts` više ne koristi sopstveni `crypto.randomBytes`
poziv. Centralni helper pravi raw verification token i njegov
`email-verification` hash. Nevalidan hash ishod zaustavlja tok. Compat create
trenutno čuva oba polja, da stara aplikacija može da se vrati tokom expand
prozora.

Registration delivery log je već bio stage-only; sada i top-level catch ne
ispisuje raw exception ili submitted account podatke, već samo kontrolisani
`{ stage: "REQUEST" }`. Ipak, `User.create` i `EmailVerification.create` još
nisu jedna transakcija. Kvar između njih i dalje može ostaviti nalog bez
credentiala, a stvarni resend/cooldown/outbox još ne postoji. Ova etapa ne sme
da se predstavi kao završena atomska registracija.

Ovo je istorijska granica stanja iz etape 42. Atomski User+verification upis i
stvarni resend/cooldown kasnije su implementirani u §43; durable outbox nije.

Novi `lib/email/auth-email-links.ts` centralizuje URL boundary:

- `createEmailVerificationUrl()` koristi `/verify-email/<raw-token>`;
- `createPasswordResetUrl()` koristi `/reset-password/<raw-token>`;
- oba dobijaju već validiran kanonski storefront `URL`;
- oba ponovo primenjuju strogi credential parser;
- raw token se normalizuje i URL-enkoduje;
- malformed, whitespace ili query-injected vrednost vraća `null`.

`lib/email/auth-emails.ts` koristi ove helpere za oba template-a i prekida
slanje ako URL nije moguće bezbedno napraviti. Dva direktna testa potvrđuju
kanonski origin/path i fail-closed matricu.

### 42.12. CI flag i lokalni dokaz

`.github/workflows/objavi.yml` dodaje
`RUN_PASSWORD_RESET_CONFIRM_DB_TESTS=true` u kompletan test job. Exact-head i
post-merge CI su zatim, pored reservation i verification DB scenarija,
izvršili novi reset race/legacy/rollback test nad izolovanim PostgreSQL 16
servisom. Pre testova su primenili novu migraciju i pokrenuli ojačani DB
invariant smoke.

Tačan lokalni presek u trenutku ove dokumentacije:

| Provera | Rezultat |
| --- | --- |
| kompletan `npm test` | 172 ukupno; 169 prolazi; 3 očekivana opt-in PostgreSQL skip-a; 0 failure-a |
| tri skip-a | reservation-cleanup, email-verification i password-reset-confirm real-DB scenariji bez pokrenute bezbedne test baze |
| `npm run lint -- --quiet` | PASS |
| `npm run typecheck` | PASS |
| Prisma schema validate | PASS sa eksplicitnim lažnim loopback DB URL-om; bez DB konekcije |
| `git diff --check` | PASS |
| probni produkcijski Next.js build | PASS; svih 91/91 stranica, lažne CI tajne/URL-ovi i namerno nedostupan `127.0.0.1:9` DB URL |
| nova migracija + DB smoke nad realnim PostgreSQL-om | lokalno nije pokrenuto; PASS na praznoj izolovanoj CI PostgreSQL 16 bazi u oba run-a |
| PR/exact-head/post-merge CI | PR #16 MERGED samo u V2; runovi `33313169708` i `33313329660` SUCCESS |

Lokalni test skip-ovi nisu označeni kao prolasci; oni su tačno granica dokaza.
Produkcijska baza nije čitana ili kontaktirana, auth migracija nije lokalno
primenjena, a sadržaj `.env` nije ručno otvaran niti ispisivan. Build loader je
fajl automatski učitao, dok su DB, auth, site URL i card-payment vrednosti
eksplicitno pregazile lažne CI vrednosti. Build je očekivano prijavio
nedostupnost loopback baze i koristio postojeće safe-default grane. Real-DB
dokaz je naknadno dobijen isključivo na praznoj izolovanoj CI bazi; to nije
produkcijska migracija niti runtime smoke.

### 42.13. Inventar promenjenih putanja ove etape

| Putanja | Uloga |
| --- | --- |
| `lib/auth/credential-token.ts` | centralni generator, parser, versioned purpose-separated hash i lookup ključevi |
| `lib/auth/credential-token.test.ts` | šest direktnih format/hash testova |
| `prisma/schema.prisma` | nullable plaintext/hash compat i unique reset user contract |
| `prisma/migrations/20260830000000_expand_hashed_auth_tokens/migration.sql` | fail-closed expand sa timeoutima i bez DML cleanup-a |
| `scripts/db-invariant-smoke.sql` | tačan seven-index katalog ugovor i rollback auth fixture-i |
| `lib/auth/password-reset-request.ts` i test | hash dependency, dual-write payload i invalid-credential stop |
| `app/api/auth/reset-password/request/route.ts` | centralni generator/hash i userId upsert |
| `lib/auth/password-reset-confirm.ts` i test | atomic conditional claim/password update/sibling cleanup |
| `lib/auth/password-reset-confirm-route.ts` i test | same-origin, validation, hash-first, late-expiry, response/failure ugovor |
| `lib/auth/password-reset-confirm.integration.test.ts` | two-worker, legacy i rollback/retry PostgreSQL dokaz |
| `app/api/auth/reset-password/confirm/route.ts` | produkcijska Prisma/bcrypt/rate-limit kompozicija |
| `lib/auth/email-verification.ts` i test | stored hash/legacy claim i no-downgrade selector |
| `lib/auth/email-verification-route.ts` i test | drugi expiry check posle session/response pripreme |
| `lib/auth/email-verification.integration.test.ts` | hash storage i exact concurrent claim scenario |
| `app/api/auth/verify-email/[token]/route.ts` | hash-first, legacy-null lookup i stored claim |
| `app/api/auth/register/route.ts` | centralni dual-write verification credential i stage-only top-level log |
| `lib/email/auth-email-links.ts` i test | kanonski verification/reset URL helper |
| `lib/email/auth-emails.ts` | oba auth emaila koriste isti strict URL boundary |
| `lib/auth/password.ts` | uklonjen duplirani reset-token generator |
| `.github/workflows/objavi.yml` | uključuje reset-confirm DB integration test u CI-ju |

### 42.14. Otvorene granice i tačan sledeći redosled

Implementirani kod zatvara centralni credential format, hash-first/no-downgrade
lookup, reset-user uniqueness i exactly-once reset confirm. Feature commit,
V2-only PR, exact-head real-DB CI, V2 merge i post-merge verification CI su
završeni. Sledeće stavke još nisu završene:

1. read-only produkcioni duplicate audit, backup/restore i lock-time plan;
2. posebno odobrena compat expand runtime primena;
3. merenje hash-first i legacy fallback ponašanja;
4. zaseban hash-only write presek;
5. najduži token TTL plus grace period i dokaz nula legacy čitanja;
6. contract migracija za uklanjanje plaintext kolona/indeksa;
7. atomska registracija i stvarni resend/cooldown;
8. transactional auth-email outbox, durable worker/retry i monitoring;
9. verified-login audit/backfill pre enforcementa;
10. session revocation posle promene lozinke i sveža role provera;
11. shared limiter i eksplicitan trusted-proxy/client-IP ugovor.

Stavka 7 ovog istorijskog spiska zatvorena je u kodu kroz §43, uz promenjen
precizniji ugovor: resend zadržava sve ranije neistekle linkove umesto da
forsira samo jedan aktivni token. Stavka 8 i dalje ostaje pre-live blokator, kao
i produkcijska primena obe auth expand migracije.

Nisu menjani VPS/server, produkcioni podaci ili tajne, DNS, TLS, reverse proxy,
PM2, GitHub `production` Environment, required reviewer ili
repository/environment secrets/variables. Nije napravljen ili pushovan release
tag i ništa nije pušteno live. Live rollout ostaje poslednja, posebno odobrena
faza tek po zatvaranju prethodnih security, DB, legalnih i operativnih gate-ova.

### 42.15. PR #16 i ponovljeni real-DB CI dokaz

Feature commit `b6c7aada0a692b826ff04443308f62584c96fe0a` objavljen je na
radnoj grani, a [PR #16](https://github.com/biozencaj-stack/narodnanosnja/pull/16)
otvoren je sa base granom isključivo
`verzija/v2.0-univerzalna-platforma`.

Exact-head `pull_request` run
[`33313169708`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33313169708),
attempt 1, završio je `SUCCESS` na tačnom feature SHA-u. Njegov kompletan
`Provera verzije` job obuhvatio je PostgreSQL 16, `prisma migrate deploy`, drift
proveru, ojačani DB invariant smoke, sva tri opt-in real-DB integration testa,
kompletan test paket, lint, TypeScript, Chromium COD E2E i produkcijski build.
`Potvrdi V2 release` i `Objavi na produkciju` bili su `SKIPPED`.

PR je potom spojen samo u kanonsku V2 granu kao merge
`8cf83e56be9cf0775db92ba9319eac5d993994e0`. Post-merge `push` run
[`33313329660`](https://github.com/biozencaj-stack/narodnanosnja/actions/runs/33313329660),
takođe attempt 1, završio je `SUCCESS` i ponovio isti kompletan job nad merge
SHA-om. Oba release/deploy posla ponovo su bila `SKIPPED`. Remote V2 head pri
toj post-merge proveri bio je isti merge SHA i baza je ove docs grane, a repo
nije imao nijedan `prodavnica-v2-*` release tag.

Deployment evidencija mora da se čita precizno. Read-only GitHub provera 30.
avgusta 2026. našla je pet istorijskih deployment zapisa, od kojih su svi vezani
za presentation `main` i `github-pages`; najnoviji je kreiran
`2026-08-30T08:30:02Z`. Nijedan zapis ne pripada feature ili merge
V2 SHA-u/ref-u i nijedan nije environment `production`. Zato je dokaz ove
etape: **0 V2/production deployments**, ne globalno 0 deployments.

CI je dokazao migraciju i concurrency invarijante samo na praznoj izolovanoj
bazi. Nije čitao ili menjao produkcionu bazu, nije primenio produkcionu
migraciju, nije kontaktirao VPS/server i nije promenio live sajt. Compat
runtime, hash-only writes, TTL+grace i contract cleanup ostaju sledeće odvojene
faze.

## 43. P1 atomska registracija i verification resend

Ova etapa nastavlja direktno na compat credential i exactly-once reset presek
iz §42. Cilj nije bio samo dodavanje još jedne forme, već zatvaranje celog
registracionog recovery ugovora: User ne sme da ostane bez početnog
verification credentiala, duplikat emaila ne sme da se otkrije javnim odgovorom
ili očiglednom timing granom, a resend mora istovremeno da bude upotrebljiv,
konkurentno bezbedan i ograničen u bazi.

Implementacija je urađena na zasebnoj feature grani izvedenoj iz kanonskog V2
stanja posle dokumentacionog preseka za PR #16. Tačan feature SHA, PR broj,
exact-head run, merge SHA, post-merge run i remote V2 head biće dopisani tek po
stvarnom završetku tih koraka: `PENDING_FINAL_EVIDENCE`.

Odeljak strogo razlikuje četiri stanja:

- kod postoji u radnom V2 stablu;
- lokalni i CI dokazi dobijaju tačne brojeve tek po završnoj proveri;
- dve nove auth expand migracije još nisu produkcijski primenjene;
- server, `main`, GitHub `production` Environment, release tag i live sajt nisu
  menjani ovom etapom.

### 43.1. Početni registracioni i recovery nalazi

Pre ove etape registracija je pravila `User`, a tek zatim posebnim DB pozivom
`EmailVerification`. Greška drugog upita mogla je ostaviti postojeći email koji
više ne može ponovo da se registruje, ali nema važeći verification link.
Delivery je bio background side-effect bez samouslužnog resend puta. Postojeći
nalog i nov nalog imali su različite DB grane, a jednostavna generička poruka
sama nije bila dovoljna da ukloni timing signal.

Istovremeno je globalni login i dalje dozvoljavao `emailVerified = NULL` naloge.
To je svesno zadržana kompatibilnost, ne završeno pravilo: legacy produkcioni
nalozi nisu auditovani ili backfill-ovani, pa bi neposredni enforcement mogao
zaključati legitimne korisnike. Ispravan redosled je najpre atomska registracija
i recovery, zatim produkcioni audit/backfill, pa tek kontrolisani login deny.

Adversarial pregled je otvorio i tri dodatne granice koje su uključene u ovaj
presek:

1. bcrypt tiho zanemaruje ulaz posle 72 bajta, što nije isto što i 72
   JavaScript karaktera;
2. širok email regex može prihvatiti Nodemailer komentar, display name, group
   ili list expression i time razdvojiti DB identitet od stvarnog primaoca;
3. procesni IP limiter koji veruje celom `x-forwarded-for` headeru nije shared
   niti predstavlja trusted-proxy ugovor.

Prve dve granice zatvorene su u kodu. Treća ostaje eksplicitan pre-live
blokator; trenutni limiter se ne predstavlja kao kompletna abuse zaštita.

### 43.2. Centralna email i bcrypt granica

Novi `lib/auth/email-address.ts` je zajednički javni account-boundary
normalizer. On:

- ne radi coercion non-string ulaza;
- trimuje i lowercase-uje adresu zbog postojećeg `User.email` unique ugovora;
- ograničava vrednost na 254 znaka pre DB lookup-a ili bcrypt-a;
- zahteva jednu mailbox adresu sa tačnim lokalnim/domain oblikom;
- odbija whitespace u adresi, domene bez tačke i nevalidne label granice;
- odbija `()<>[],:;"` i druge metaznake koji bi Nodemailer-u mogli značiti
  komentar, display name, grupu ili listu primalaca;
- zadržava legitimna dotted i plus-tag imena.

Isti helper koriste registracija, password-reset request i verification resend.
Auth email sloj dodatno normalizuje primaoca i Nodemailer-u šalje address object
`{ name: "", address }`, nikada caller string. Time validacija identiteta i
stvarni SMTP recipient koriste isti kanonski mailbox.

`lib/auth/password.ts` sada izlaže `MAX_BCRYPT_PASSWORD_BYTES = 72` i
`isBcryptSafePassword(unknown)`. Merenje se radi `TextEncoder` UTF-8 bajtovima.
Route validacija odbija prekoračenje pre hashovanja, `hashPassword()` ponavlja
guard kao defense-in-depth, a `verifyPassword()` takav ulaz odmah odbija. Ova
granica je odvojena od postojeće semantičke password politike; lozinka i dalje
mora da zadovolji minimum/kompleksnost čak i kada staje u 72 bajta.

### 43.3. Strogi registration HTTP boundary

Produkcijska ruta je svedena na kompoziciju testabilnog
`createRegistrationHandler()` factory-ja. Redosled je nameran:

1. trusted same-origin provera;
2. account-independent procesni IP limiter;
3. JSON parse;
4. plain object/allow-list body provera;
5. email, ime, prezime, telefon i password tip/dužina validacija;
6. centralna password politika i 72-byte guard;
7. verification token/hash i delivery priprema;
8. bcrypt van transakcije;
9. atomski persistence;
10. post-response delivery ili recovery callback;
11. privatni account-independent rezultat.

Same-origin mora biti prvi jer je širi `/api/auth` namespace izuzet iz globalne
unsafe-write zaštite radi NextAuth provider callbackova. Nevalidan origin zato
ne može da pokrene limiter, body parse, SMTP config, token, bcrypt ili DB rad.

Posle origin/limiter granice registration body prolazi application-level DoS
guard pre JSON parse-a. Zahteva se JSON `Content-Type`, svaki
`Content-Encoding` se odbija, deklarisani `Content-Length` mora biti validan i
najviše 4096 bajtova, a reader prekida i stvarni stream čim pređe 4096 bajtova.
Zato chunked/missing-length zahtev ne može zaobići limit. Ovo ograničava
application memoriju i parse rad, ali nije zamena za reverse-proxy limit koji
prekida pre nego što ceo promet stigne do Node procesa.

Dozvoljena body polja su tačno `email`, `password`, `firstName`, `lastName` i
opciono `phone`. Ime i prezime se trimuju, moraju biti neprazni i imaju maksimum
100 karaktera. Email ima maksimum 254, telefon 32, a kontrolni znakovi su
zabranjeni. UI `maxLength`/`autoComplete` atributi ogledaju serverske granice,
ali server ostaje autoritativan.

### 43.4. Dvofazna priprema bez spoljnog side-effecta pre commita

Ruta prvo centralno generiše 32-byte/64-hex raw token i purpose-separated
`email-verification` hash. `prepareVerificationEmail()` zatim sinhrono:

- potvrđuje tačno jednog normalizovanog primaoca;
- validira kanonski storefront URL;
- pravi strogi `/verify-email/<credential>` URL;
- kreira SMTP transport i validira njegovu konfiguraciju;
- renderuje subject, HTML i plain-text telo;
- escape-uje sve dinamičke HTML vrednosti.

Vraćena funkcija još nije poslala poruku. Ona sadrži samo budući `sendMail()`
side-effect. Time konfiguraciona/URL/template greška pada pre User/credential
upisa, dok stvarna mrežna isporuka ostaje posle commita.

Bcrypt se takođe završava pre transakcije. Tek posle te namerno skupe operacije
uzima se `issuedAt`, pa registracioni jednočasovni token i cooldown ne gube
trajanje dok se password hash računa. Production dependency zatim čita i
validira PostgreSQL `clock_timestamp()`; Node wall clock se ne koristi za
početni TTL, cooldown ili 24-časovni prozor.

### 43.5. Atomski User + početni credential

`lib/auth/registration.ts` dobija minimalni DB adapter i u jednoj interaktivnoj
transakciji prvo kreira User, zatim njegov početni `EmailVerification`. User
payload sadrži:

- kanonski email i prethodno pripremljen password hash;
- trimovana imena i opcioni telefon;
- `verificationEmailNextAllowedAt = issuedAt + 60 sekundi`;
- `verificationEmailResendWindowStartedAt = issuedAt`;
- `verificationEmailResendCount = 1`.

Početni verification red sadrži temporary rollback-compatible raw token,
current purpose-separated hash i `expires = issuedAt + 1 sat`. Broj `1` je
važna kvota invarijanta: initial email nije „besplatan” van limita, već prvi od
najviše pet verification emailova u fixed 24h prozoru.

Svaki failure drugog inserta rollback-uje i User. P2002 se ne mapira automatski
na existing. Posle rollback-a servis radi `findUserByEmail(normalizedEmail)`:

- ako nalog postoji, rezultat je privatni `{ kind: "existing" }`;
- ako nalog ne postoji, originalna unique greška se ponovo baca, jer je uzrok
  mogao biti token/hash collision;
- non-unique greške se uvek propagiraju kao operativni failure.

Ovim su atomarnost i concurrent duplicate-email klasifikacija odvojene, a
credential kolizija ne može biti prikrivena kao legitiman postojeći nalog.

### 43.6. Byte-identical 202 i response timing defense

Za `{ kind: "created" }` i `{ kind: "existing" }` handler vraća isti status,
isti JSON i ista privacy zaglavlja:

- HTTP `202 Accepted`;
- uslovna poruka da će uputstvo biti poslato ako je registracija moguća;
- `Cache-Control: private, no-store, max-age=0`;
- `Pragma: no-cache`;
- `Referrer-Policy: no-referrer`;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

Odgovor ne govori da je User kreiran, da email već postoji ili da je SMTP
isporučio poruku. Login registration banner koristi isti neutralni copy.

Validni account-dependent persistence put prolazi kroz
`protectRegistrationResponseTiming()`. Cilj je ukupni privatni prozor od
najmanje 900 ms plus kriptografski nasumičan jitter `0..200 ms`. Ako je obrada
već trajala duže, dodatno se ne čeka. Neispravna timing zavisnost se stage-only
prijavljuje i ne sme promeniti account rezultat.

Ovo je namerno dokumentovano kao defense-in-depth, ne kao formalna
constant-time garancija. Scheduler, OS, mreža, DB cache i više instanci mogu
ostaviti residual. Shared limiter/trusted proxy i durable queue zato ostaju
zasebne obavezne kontrole.

### 43.7. Registration delivery naspram existing recovery-ja

Posle persistence-a handler registruje Next.js `after()` callback:

- `created` poziva već pripremljen delivery callback;
- `existing` ne šalje unapred pripremljen novi-nalog token, već poziva isti
  privatni verification-resend servis, koji ponovo proverava verified stanje,
  cooldown i fixed-window allowance;
- delivery i recovery failure-i daju samo kontrolisanu fazu;
- sinhroni scheduling failure posle commita ne menja 202, jer eksplicitni
  resend ostaje recovery put.

Ovo izjednačava javni ugovor bez preskakanja abuse pravila. Ipak, `after()` ne
upisuje durable posao. Process crash između 202 i callbacka može izgubiti
delivery/recovery; taj residual se ne skriva generičkim odgovorom.

### 43.8. Resend route i privatni background pipeline

Nova `/verify-email/resend` stranica šalje
`POST /api/auth/verify-email/resend`. Route factory primenjuje sledeći redosled:

1. trusted same-origin pre svega;
2. account-independent limiter ključ `verify-email-resend:<client-input>`;
3. strogi plain JSON objekat sa tačno jednim `email` ključem;
4. centralna email normalizacija;
5. registracija background callbacka;
6. neposredni private 202.

Nepostojeći, već verifikovan, cooling-down, allowance-exhausted, uspešno poslat
i SMTP-failed nalog imaju isti već vraćeni valid-request response. Invalid JSON/
email može vratiti 400, exhausted account-independent limiter 429, a sinhroni
limiter/scheduler failure 503. Te grane nastaju pre account lookup-a.

Resend koristi isti fail-closed media/encoding/declared/streaming ugovor sa
užim maksimumom od 1024 bajta, jer body sadrži samo email. Exact-body provera se
izvršava tek nakon tog byte limita. Nevažeći media type, encoded body,
neispravan/prevelik Content-Length i stvarni stream preko limita ne zakazuju
account-dependent posao.

Background servis radi lookup. Odsutan ili verified nalog završava bez tokena i
SMTP-a. Za neverifikovan nalog generiše i proverava exact raw/hash par, zatim
pre DB mutacije priprema delivery. Nevalidan raw token, pogrešan purpose hash,
neispravna SMTP konfiguracija ili URL završavaju stage-only pre cooldown/token
promene.

### 43.9. User-first DB throttle i vreme posle lock-a

`commitEmailVerificationResend()` koristi User red kao zajedničku
serializacionu tačku. Transakcija radi:

1. `SELECT ... FROM public."User" WHERE id = ... FOR UPDATE`;
2. potvrdu da locked User i dalje ima očekivani email i nije verifikovan;
3. `clock_timestamp()` tek posle dobijenog lock-a;
4. cooldown i fixed-window računanje nad zaključanim stanjem;
5. conditional `User.updateMany` throttle claim;
6. brisanje samo isteklih verification redova;
7. insert novog raw+hash jednočasovnog tokena;
8. zajednički commit ili rollback.

DB sat se namerno čita posle `FOR UPDATE`, ne na početku transakcije.
PostgreSQL `CURRENT_TIMESTAMP` bi bio vezan za transaction start, a i raniji
wall clock read bi dozvolio da lock wait skrati nov cooldown/TTL. Test drži User
lock u drugoj konekciji, posmatra stvarni lock wait i proverava da oba roka
počinju tek od release granice.

Verify transakcija je preuređena na isti lock order. Conditional User
`updateMany` prvo zahteva `emailVerified:null`, postavlja tačan `verifiedAt` i
čisti sva throttle polja. Zatim token claim zahteva exact stored hash ili čisti
legacy token sa `tokenHash:null` i `expires > verifiedAt`. Claim failure baca
konflikt i rollback-uje User upis. Tek pobednik briše sve sibling tokene.

### 43.10. Fixed 24h allowance i retained unexpired links

Throttle je DB-backed po nalogu, pa konkurentni procesi dele isto zaključano
stanje. Politika je:

- cooldown: 60 sekundi;
- token TTL: 1 sat;
- fixed allowance window: 24 sata;
- maksimum: 5 verification emailova po prozoru;
- initial registraciona poruka ulazi u tih 5;
- legacy `(NULL, NULL, NULL)` stanje prvim resend-om počinje prozor sa `1`;
- istekli prozor se resetuje na `issuedAt` i `1`;
- aktivan cooldown ili count `>= 5` je private no-op.

Parcijalno/nevalidno throttle stanje, poput datuma bez validnog pozitivnog
broja, fail-closed prekida transaction umesto da resetuje kvotu. Boundary je
uključiva: resend je dozvoljen kada je `nextAllowedAt <= issuedAt`.

Uspešan resend namerno ne rotira sve sibling tokene. Brišu se samo redovi
istekli do `issuedAt`; svaki ranije emailovan neistekli link ostaje validan.
Ovo sprečava da double-click ili kasniji zahtev poništi link već u korisnikovom
inboxu. Tačno jedno aktivno stanje obezbeđuje se tek uspešnom verifikacijom,
koja briše sve siblinge, ne samim resend-om.

SMTP se poziva posle DB commita. Ako `sendMail()` vrati grešku, token, cooldown
i count ostaju. To je konzervativno prema ambiguous acceptance granici i
sprečava da potencijalno isporučen link odmah postane nevažeći.

### 43.11. Prisma expand i rollback granica

`prisma/schema.prisma` dodaje u `User`:

```text
verificationEmailNextAllowedAt         DateTime?
verificationEmailResendWindowStartedAt DateTime?
verificationEmailResendCount           Int?
```

Migracija `20260830010000_expand_email_verification_cooldown` u jednoj
transakciji postavlja hardened `search_path`, `lock_timeout='10s'` i
`statement_timeout='2min'`, pa jednim `ALTER TABLE` dodaje tri nullable kolone
bez defaulta. Nema backfill-a, DML čišćenja, constrainta ili dedicated indeksa.
Old application code može ignorisati nova nullable polja, a legacy User je
odmah podoban za prvi resend.

Nullable/no-default add je PostgreSQL metadata-only, ali ipak zahteva kratak
`ACCESS EXCLUSIVE` lock. Pre produkcije zato ostaju restore-clone proba, pregled
aktivnih transakcija, lock plan i maintenance odluka. Timeout/failed Prisma
record ne sme se ponavljati naslepo: prvo se potvrđuju rollback i stvarno DB
stanje, otklanja uzrok, pa se tek onda kontrolisano koristi odgovarajući
`prisma migrate resolve --rolled-back` postupak.

`scripts/db-invariant-smoke.sql` proverava za sva tri polja:

- tačnu public.User kolonu;
- nullable oblik;
- timestamp without time zone sa precision 3 ili integer tip;
- odsustvo defaulta;
- odsustvo dedicated single-column indeksa.

### 43.12. Auth email HTML i recipient hardening

`lib/email/auth-emails.ts` sada koristi `escapeHtmlText()` za dinamičke auth
HTML vrednosti, uključujući firstName, storeName, logo/home/auth URL i kontakt
vrednosti. URL i dalje prvo prolazi kroz kanonski storefront i strict
credential helper. Plain-text deo ne koristi HTML escaping jer nije HTML sink.

Password reset, welcome i verification poruke šalju se tačno jednom
normalizovanom address object primaocu. Verification preparation test dokazuje
da SMTP nije pozvan pri pripremi, da HTML payload ne interpretira adversarial
ime/URL kao markup i da callback šalje tačno već pripremljenu poruku.

Scope je ograničen na auth emailove. Ostali order/wishlist/contact/job template
sinkovi i upload MIME/magic-byte politika ostaju u globalnom P1 inventaru.

### 43.13. UI i korisnički recovery

Registraciona forma dobija serveru usklađene `maxLength` i autocomplete
granice. Login `registered=true` banner više ne tvrdi da je nalog sigurno
napravljen ili da je email isporučen; prikazuje neutralan accepted copy, inbox/
spam smernicu, minimum jednog minuta i resend link. Regularni login ekran
takođe nudi resend.

Confirmation stranica za nevalidan ili istekao token vodi prvo na resend, pa na
login. Resend stranica koristi pristupačne status/alert regione, ograničeni
email input i generičku accepted poruku. Ona eksplicitno govori da raniji
neistekli link ostaje važeći, što odgovara DB politici, a ne samo UX copy-ju.

### 43.14. Test matrica i CI ugovor

Nova test pokrivenost obuhvata:

- `email-address.test.ts`: type/length/canonical format, plus-tag i odbijanje
  comment/display/group/list izraza;
- `password.test.ts`: UTF-8 byte boundary, hash defense i verify truncation
  regresiju;
- `auth-emails.test.ts`: escaped HTML, tačan address object i zero-send-before-
  callback;
- `registration.test.ts`: atomic payload, unique email, token/hash collision,
  non-unique error i malformed prepared input;
- `registration-route.test.ts`: origin/body/password/order, identical 202,
  timing/scheduler/delivery/recovery failure granice;
- request-body testovi: obavezan JSON media type, zabranjen Content-Encoding,
  fail-closed Content-Length i stvarni 4096/1024 B streaming cap bez lookup-a;
- `registration-response-timing.test.ts`: tačan remaining floor, no-extra-wait
  posle poda i invalid jitter;
- `registration.integration.test.ts`: deterministički concurrent duplicate,
  rollback i real hash collision na PostgreSQL-u;
- `email-verification-resend-route.test.ts`: origin/limit/body, immediate 202,
  scheduler i background matrica;
- `email-verification-resend.test.ts`: pipeline redosled, no-op ishodi, exact
  hash, SMTP ambiguity, fixed allowance, legacy state i retained links;
- `email-verification-resend.integration.test.ts`: two-worker resend, DB clock
  posle lock wait-a, verify-vs-resend i rollback/boundary scenario;
- `email-verification.test.ts`: User-first conditional claim i rollback bez
  token mutation kada User claim izgubi.

Workflow test job dodaje oba opt-in flaga:

```text
RUN_REGISTRATION_DB_TESTS=true
RUN_EMAIL_VERIFICATION_RESEND_DB_TESTS=true
```

CI mora podići izolovani PostgreSQL 16, primeniti ceo aktivni migration chain,
pokrenuti drift i DB invariant smoke, zatim sve auth integration scenarije,
kompletan unit paket, lint, TypeScript, Chromium COD E2E i production build.
Lokalni real-DB skip nije PASS i mora biti naveden kao skip.

Tačni lokalni totals/pass/skip, broj build ruta, feature SHA, PR, exact-head
run, merge SHA i post-merge run nisu unapred izmišljeni:
`PENDING_FINAL_EVIDENCE`.

### 43.15. Pre-live blokatori posle ove etape

Završena kodna registracija/resend sekcija ne zatvara sledeće:

1. **Legacy email audit.** Read-only prebrojati i klasifikovati produkcione
   `emailVerified = NULL` naloge, napraviti kontrolisani backfill i recovery
   smoke, pa tek zatim uključiti verified-login enforcement.
2. **Shared limiter/trusted proxy.** Trenutni procesni limiter i sirovi
   `x-forwarded-for` nisu bezbedan multi-instance client identitet. Potrebni su
   poznati proxy hopovi, normalizovan client IP, shared Redis/DB limit po IP-u,
   nalogu/email digestu i akciji, kao i lockout politika bez abuse pojačanja.
3. **Durable auth delivery.** Next.js `after()` nije queue. Potrebni su
   transactional outbox, durable worker, retry/dedupe, bounce/delivery
   monitoring, alert i shutdown/redeploy dokaz.
4. **Produkcijske migracije.** Auth-token i cooldown expand zahtevaju duplicate
   audit, backup/restore, staging probe, lock plan, kontrolisanu primenu i
   runtime dokaz. CI na praznoj bazi nije produkcijski dokaz.
5. **Hash-only contract.** Compat upisi još čuvaju raw token. Slede hash-only
   writes, najduži TTL plus grace, nula legacy fallbacka i contract migracija.
6. **Session/role svežina.** Password reset još ne opoziva sve sesije, a role
   promena može ostati u JWT-u.
7. **Širi email/upload audit.** Auth template nalaz je zatvoren, ali ostali
   template-i i MIME/magic-byte prilozi nisu.
8. **Runtime operativa.** Potrebni su stvarni SMTP, resend quota/recovery,
   observability i process-restart smoke u stagingu.
9. **Globalni rollout gate-ovi.** Dependencies, pravni podaci, domen/HTTPS,
   proxy, backup, monitoring, COD/card granice i operativni runbookovi ostaju
   prema §27–§38.
10. **Upstream body/connection zaštita.** Route-level 4096/1024 B streaming
    cap je završen, ali reverse proxy mora imati usklađene body-size, rate,
    timeout i connection granice da Node aplikacija ne bude prva DoS linija.

Nije menjan production Environment, required reviewer, secrets/variables,
server, PM2, nginx, DNS, TLS, produkciona baza ili live aplikacija. Nije
napravljen `prodavnica-v2-*` tag. Presentation `main` nije merge cilj za V2 i
ostao je netaknut. Poseban main-push live workflow ostaje poslednji korak, tek
posle svih prethodnih security, DB i operativnih gate-ova.

### 43.16. Završni Git/CI/deployment dokaz

Ovaj odeljak se ne popunjava procenama. Po stvarnom završetku treba zabeležiti:

| Dokaz | Rezultat |
| --- | --- |
| Feature grana i commit | `PENDING_FINAL_EVIDENCE` |
| PR i V2-only base | `PENDING_FINAL_EVIDENCE` |
| Exact-head run i poslovi | `PENDING_FINAL_EVIDENCE` |
| V2 merge SHA | `PENDING_FINAL_EVIDENCE` |
| Post-merge run i poslovi | `PENDING_FINAL_EVIDENCE` |
| Remote kanonski V2 head | `PENDING_FINAL_EVIDENCE` |
| Release tagovi | `PENDING_FINAL_EVIDENCE` |
| V2/production deployment dokaz | `PENDING_FINAL_EVIDENCE` |

Prihvatljiv završni ishod zahteva SUCCESS na tačnom feature head-u i V2 merge
SHA-u, uz `Potvrdi V2 release` i `Objavi na produkciju` kao `SKIPPED`. Svaki
istorijski `main`/GitHub Pages deployment mora se razlikovati od V2/production
deploymenta. Live i main-push aktivacija nisu deo ovog preseka.
