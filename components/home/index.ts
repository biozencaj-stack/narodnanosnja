/**
 * Šablonske komponente koje još nisu prešle u sistem sekcija.
 *
 * Nijedna stranica ih trenutno ne renderuje osim `NewsletterSection`.
 * Svaka odlazi u trenutku kad odgovarajući tip sekcije bude isporučen —
 * vidi `docs/PLAN-SEKCIJE.md`, faze 3 do 6.
 *
 * Faza 4 je odnela `FeaturedCarousel`, `NewArrivals`, `BrandSlider` i
 * `BrandGrid`: sve četiri sada radi tip `proizvodi` odnosno `taksonomija`, sa
 * izvorom koji admin bira. Nisu zadržane „za svaki slučaj“ — komponenta bez
 * pozivaoca ne zastareva vidljivo, nego tiho.
 *
 * Faza 5 je odnela `Testimonials` i `CountdownSale`. Nisu prenesene u sekcije
 * nego OBRISANE: prva je nosila četiri izmišljena kupca sa imenima i gradovima,
 * druga je odbrojavala do trenutka izračunatog u pregledaču, bez ijedne akcije
 * u bazi. Tip `utisci` čita stvarne recenzije, a `odbrojavanje` stvarni
 * `Promotion.endDate`.
 *
 * `NewsletterSection` je od faze 5 sekcija (`kind: "newsletter"`) i renderuje je
 * `components/sekcije/SekcijaNewsletter.tsx`; izvoz ostaje jer ga ta komponenta
 * koristi.
 *
 * Faza 6 je odnela `InstagramFeed` i `ParallaxBanner`. Prvu zamenjuje tip
 * `instagram` sa RUČNO izabranim slikama — Graph API put nije ponuđen jer je
 * `app/api/instagram-feed` `force-dynamic` sa `cache: no-store`, pa bi svaki
 * pogodak početne otišao na Instagram. Drugu zamenjuje prikaz `parallax` u tipu
 * `medij`, i to preko `transform` umesto `background-attachment: fixed`, koji na
 * iOS Safariju ne radi.
 *
 * Ostale su tri: `HeroCarousel` i `CategoryBanners` čekaju odluku o proizvoljnim
 * stranicama i banerima, `NewsletterSection` je živa kroz sekciju.
 */

export { HeroCarousel } from './HeroCarousel';
export { CategoryBanners } from './CategoryBanners';
export { NewsletterSection } from './NewsletterSection';
