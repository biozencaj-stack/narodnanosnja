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
 */

export { HeroCarousel } from './HeroCarousel';
export { CategoryBanners } from './CategoryBanners';
export { NewsletterSection } from './NewsletterSection';
export { InstagramFeed } from './InstagramFeed';
export { Testimonials } from './Testimonials';
export { CountdownSale } from './CountdownSale';
export { ParallaxBanner } from './ParallaxBanner';
