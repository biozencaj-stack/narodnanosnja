/**
 * Ukrasi — tkane šare, ornamentne trake i znak radionice.
 *
 * Sve je crtano kao SVG, bez ijedne slike: šare se ponavljaju kao pozadina,
 * pa rade u svakoj veličini i ne troše propusni opseg.
 *
 * Motivi su isti oni koji se sreću na tkanicama, pregačama i zubunima —
 * romb sa krstom, osmokraka rozeta, cik-cak, stepenasti krst, grančica i kuka.
 */

import type { CSSProperties } from 'react';

/* ------------------------------------------------------------------ *
 * Šare — pločice 40×40 koje se besprekidno ponavljaju
 * ------------------------------------------------------------------ */

export type VrstaSare = 'romb' | 'rozeta' | 'cikcak' | 'krst' | 'grana' | 'kuka';

const SARE: Record<VrstaSare, (a: string, b: string) => string> = {
  // Romb sa krstom u sredini — najčešći motiv na tkanicama i čarapama.
  romb: (a, b) => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <path d="M20 3 37 20 20 37 3 20Z" fill="none" stroke="${a}" stroke-width="2"/>
      <path d="M20 11 29 20 20 29 11 20Z" fill="${b}"/>
      <path d="M0 0 8 0 0 8Z M40 0 32 0 40 8Z M0 40 8 40 0 32Z M40 40 32 40 40 32Z" fill="${a}"/>
    </svg>`,
  // Osmokraka rozeta — motiv sa zubuna i pregača.
  rozeta: (a, b) => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <path d="M20 2 23 15 36 12 26 20 36 28 23 25 20 38 17 25 4 28 14 20 4 12 17 15Z" fill="${a}"/>
      <circle cx="20" cy="20" r="3.4" fill="${b}"/>
      <circle cx="0" cy="0" r="2.4" fill="${b}"/><circle cx="40" cy="0" r="2.4" fill="${b}"/>
      <circle cx="0" cy="40" r="2.4" fill="${b}"/><circle cx="40" cy="40" r="2.4" fill="${b}"/>
    </svg>`,
  // Cik-cak trake — tkanje na razboju.
  cikcak: (a, b) => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <path d="M0 10 10 0 20 10 30 0 40 10" fill="none" stroke="${a}" stroke-width="2.6"/>
      <path d="M0 22 10 12 20 22 30 12 40 22" fill="none" stroke="${b}" stroke-width="2.6"/>
      <path d="M0 34 10 24 20 34 30 24 40 34" fill="none" stroke="${a}" stroke-width="2.6"/>
    </svg>`,
  // Stepenasti krst — stari znak zaštite, čest u istočnoj Srbiji.
  krst: (a, b) => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <path d="M16 4h8v12h12v8H24v12h-8V24H4v-8h12Z" fill="${a}"/>
      <path d="M18 12h4v4h4v4h-4v4h-4v-4h-4v-4h4Z" fill="${b}"/>
    </svg>`,
  // Grančica sa listovima — vezeni motiv sa košulja.
  grana: (a, b) => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <path d="M20 0v40" stroke="${a}" stroke-width="1.8" fill="none"/>
      <path d="M20 8c-6 0-9-3-9-6 4 0 9 2 9 6Zm0 0c6 0 9-3 9-6-4 0-9 2-9 6Z" fill="${b}"/>
      <path d="M20 22c-6 0-9-3-9-6 4 0 9 2 9 6Zm0 0c6 0 9-3 9-6-4 0-9 2-9 6Z" fill="${a}"/>
      <path d="M20 36c-6 0-9-3-9-6 4 0 9 2 9 6Zm0 0c6 0 9-3 9-6-4 0-9 2-9 6Z" fill="${b}"/>
    </svg>`,
  // Kuka — meandar, motiv sa ćilima i pojaseva.
  kuka: (a, b) => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <path d="M4 4h20v6h-8v8h14v6H10v8H4Z" fill="none" stroke="${a}" stroke-width="2.4"/>
      <rect x="28" y="4" width="8" height="8" fill="${b}"/>
      <rect x="4" y="28" width="8" height="8" fill="${b}"/>
    </svg>`,
};

const VRSTE = Object.keys(SARE) as VrstaSare[];

/** Jednostruki navodnici: ova vrednost završava i u style atributu. */
const uUri = (svg: string) =>
  `url('data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}')`;

/** Šara za dati redni broj — uvek ista za isti broj, pa se prikaz ne „mrda“. */
export function saraZa(
  redni: number,
  a = '#b98f21',
  b = '#a4161a',
): string {
  return uUri(SARE[VRSTE[Math.abs(redni) % VRSTE.length]](a, b));
}

/** Imenovana šara, kad se traži baš određeni motiv. */
export function sara(vrsta: VrstaSare, a = '#b98f21', b = '#a4161a'): string {
  return uUri(SARE[vrsta](a, b));
}

/* ------------------------------------------------------------------ *
 * Podloga sa šarom
 * ------------------------------------------------------------------ */

type PodlogaProps = {
  vrsta?: VrstaSare;
  redni?: number;
  boja?: string;
  bojaDruga?: string;
  /** Veličina pločice u pikselima. Manje = gušće tkanje. */
  velicina?: number;
  prozirnost?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Tkana šara kao pozadina. Postavlja se apsolutno preko roditelja,
 * pa roditelj mora imati `relative`.
 */
export function Podloga({
  vrsta,
  redni = 0,
  boja = '#b98f21',
  bojaDruga = '#a4161a',
  velicina = 44,
  prozirnost = 0.12,
  className = '',
  style,
}: PodlogaProps) {
  const slika = vrsta ? sara(vrsta, boja, bojaDruga) : saraZa(redni, boja, bojaDruga);
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: slika,
        backgroundSize: `${velicina}px auto`,
        opacity: prozirnost,
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Ornamentna traka — razdvaja sekcije
 * ------------------------------------------------------------------ */

const trakaSvg = (a: string, b: string) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 26" width="60" height="26">
    <path d="M0 13 15 2 30 13 45 2 60 13" fill="none" stroke="${a}" stroke-width="1.6"/>
    <path d="M0 24 15 13 30 24 45 13 60 24" fill="none" stroke="${b}" stroke-width="1.6"/>
    <circle cx="30" cy="13" r="2.6" fill="${a}"/>
    <circle cx="0" cy="13" r="2.6" fill="${b}"/><circle cx="60" cy="13" r="2.6" fill="${b}"/>
  </svg>`;

export function Traka({
  boja = '#b98f21',
  bojaDruga = '#a4161a',
  visina = 22,
  className = '',
}: {
  boja?: string;
  bojaDruga?: string;
  visina?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        height: visina,
        backgroundImage: uUri(trakaSvg(boja, bojaDruga)),
        backgroundRepeat: 'repeat-x',
        backgroundSize: `auto ${visina}px`,
        backgroundPosition: 'center',
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Znak radionice — stilizovana osmokraka rozeta
 * ------------------------------------------------------------------ */

export function Znak({
  className = 'h-8 w-8',
  boja = '#a4161a',
  srce = '#b98f21',
}: {
  className?: string;
  boja?: string;
  srce?: string;
}) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <path
        d="M20 1 24 15 38 11 27 20 38 29 24 25 20 39 16 25 2 29 13 20 2 11 16 15Z"
        fill={boja}
      />
      <circle cx="20" cy="20" r="4" fill={srce} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Mestodržač za proizvod bez fotografije
 * ------------------------------------------------------------------ */

/**
 * Dok fotografija ne postoji, umesto prazne sive kutije stoji tkana šara
 * u bojama koje se menjaju po rednom broju — mreža proizvoda tako nikad
 * ne izgleda nedovršeno.
 */
export function MestodrzacProizvoda({
  redni = 0,
  className = '',
}: {
  redni?: number;
  className?: string;
}) {
  const parovi: [string, string, string][] = [
    ['#8c1c13', '#c9a227', '#f3ead8'],
    ['#1d3f6e', '#c9a227', '#f5f0e6'],
    ['#4a5d3a', '#8c1c13', '#efe6d4'],
    ['#5c2a3d', '#c9a227', '#efe3d2'],
    ['#7a1f3d', '#c9a227', '#f2e8d5'],
    ['#2f5d50', '#c9a227', '#f3ebda'],
  ];
  const [a, b, podloga] = parovi[Math.abs(redni) % parovi.length];

  return (
    <div
      aria-hidden="true"
      className={`h-full w-full ${className}`}
      style={{
        backgroundColor: podloga,
        backgroundImage: saraZa(redni, a, b),
        backgroundSize: '48px auto',
      }}
    />
  );
}
