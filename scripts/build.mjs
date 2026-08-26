/**
 * Generator statičkog sajta — bez ijedne npm zavisnosti.
 *
 *   node scripts/build.mjs
 *
 * Čita podatke iz site/data/, stranice iz site/pages/, i piše gotov
 * HTML u dist/. Sve veze između stranica su relativne, pa sajt radi
 * i na korenu domena i u pod-fascikli (GitHub Pages projekat).
 */

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nosnje } from '../site/data/nosnje.js';
import { pojmovnik } from '../site/data/pojmovnik.js';

const KOREN = join(dirname(fileURLToPath(import.meta.url)), '..');
const IZLAZ = join(KOREN, 'dist');

/** Puna adresa sajta — koristi se samo za sitemap i og:url. */
const ADRESA = (process.env.SITE_URL || 'https://biozencaj-stack.github.io/narodnanosnja')
  .replace(/\/+$/, '');
/** Osnovna putanja za 404 stranicu, koja se servira sa proizvoljne dubine. */
const BAZA = (process.env.BASE_PATH ?? '/narodnanosnja').replace(/\/*$/, '/');

/* ---------------------------------------------------------------- *
 * Pomoćne funkcije
 * ---------------------------------------------------------------- */

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Relativni prefiks do korena sajta za stranicu date dubine. */
const prefiks = (dubina) => (dubina === 0 ? './' : '../'.repeat(dubina));

// Jednostruki navodnici su obavezni: ove vrednosti idu i u HTML style atribut,
// pa bi dvostruki navodnik prekinuo atribut i šara se ne bi videla.
const dataUri = (svg) =>
  `url('data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}')`;

/* ---------------------------------------------------------------- *
 * Ornamenti — tkane šare, generisane kao SVG pločice koje se ponavljaju
 * ---------------------------------------------------------------- */

const SARE = {
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

const VRSTE = Object.keys(SARE);

/** Šara za dati region — deterministički izbor po rednom broju. */
export const saraZa = (i, boje) => SARE[VRSTE[i % VRSTE.length]](boje[0], boje[1]);

/** Vodoravna ornamentna traka koja razdvaja sekcije. */
const trakaSvg = (a, b) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 26" width="60" height="26">
    <path d="M0 13 15 2 30 13 45 2 60 13" fill="none" stroke="${a}" stroke-width="1.6"/>
    <path d="M0 24 15 13 30 24 45 13 60 24" fill="none" stroke="${b}" stroke-width="1.6"/>
    <circle cx="30" cy="13" r="2.6" fill="${a}"/>
    <circle cx="0" cy="13" r="2.6" fill="${b}"/><circle cx="60" cy="13" r="2.6" fill="${b}"/>
  </svg>`;

export const traka = () =>
  `<div class="traka" aria-hidden="true" style="background-image:${dataUri(trakaSvg('#b98f21', '#8c1c13'))}"></div>`;

/** Znak sajta — stilizovana rozeta. */
const znakSvg = (boja = '#8c1c13', srce = '#b98f21') => `
  <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <path d="M20 1 24 15 38 11 27 20 38 29 24 25 20 39 16 25 2 29 13 20 2 11 16 15Z" fill="${boja}"/>
    <circle cx="20" cy="20" r="4" fill="${srce}"/>
  </svg>`;

/* ---------------------------------------------------------------- *
 * Navigacija i okvir stranice
 * ---------------------------------------------------------------- */

const MENI = [
  { put: '', naziv: 'Početna', kljuc: 'pocetna' },
  { put: 'nosnje/', naziv: 'Nošnje', kljuc: 'nosnje' },
  { put: 'pojmovnik/', naziv: 'Pojmovnik', kljuc: 'pojmovnik' },
  { put: 'tehnike/', naziv: 'Tehnike', kljuc: 'tehnike' },
  { put: 'gde-videti/', naziv: 'Gde videti', kljuc: 'gde-videti' },
  { put: 'o-projektu/', naziv: 'O projektu', kljuc: 'o-projektu' },
];

function zaglavlje(p, aktivno) {
  const veze = MENI.map((s) => {
    const tekuca = s.kljuc === aktivno ? ' aria-current="page"' : '';
    return `<a href="${p}${s.put}"${tekuca}>${esc(s.naziv)}</a>`;
  }).join('\n        ');

  return `<header class="zaglavlje">
    <div class="omot zaglavlje-red">
      <a class="znak" href="${p}">
        ${znakSvg()}
        <span class="znak-tekst">
          <span class="znak-ime">Народна ношња</span>
          <span class="znak-pod">Srpsko nasleđe</span>
        </span>
      </a>
      <button class="meni-dugme" type="button" aria-expanded="false" aria-controls="glavni-meni"
              aria-label="Otvori meni" data-pismo-skip>☰</button>
      <nav class="navigacija" id="glavni-meni" aria-label="Glavna navigacija">
        ${veze}
        <button class="pismo-dugme" type="button" data-pismo-skip>Ћирилица</button>
      </nav>
    </div>
  </header>`;
}

function podnozje(p) {
  const regioni = nosnje.slice(0, 5)
    .map((n) => `<li><a href="${p}nosnje/${n.slug}/">${esc(n.naziv)}</a></li>`).join('\n            ');
  const stranice = MENI.slice(1)
    .map((s) => `<li><a href="${p}${s.put}">${esc(s.naziv)}</a></li>`).join('\n            ');

  return `<footer class="podnozje">
    <div class="omot">
      <div class="podnozje-mreza">
        <div>
          <div class="podnozje-znak">${znakSvg('#d9b04a', '#a4161a')}<strong>Народна ношња</strong></div>
          <p>Otvoreni pregled srpske narodne nošnje — po krajevima, po delovima
             odeće i po tehnikama kojima je nastajala. Napravljeno da nasleđe
             bude lako dostupno svakome ko ga traži.</p>
        </div>
        <div>
          <h4>Krajevi</h4>
          <ul>
            ${regioni}
            <li><a href="${p}nosnje/">Svi krajevi →</a></li>
          </ul>
        </div>
        <div>
          <h4>Stranice</h4>
          <ul>
            ${stranice}
          </ul>
        </div>
      </div>
      <div class="podnozje-dno">
        <span>Sadržaj je dostupan pod licencom CC BY-SA 4.0.</span>
        <span>Građeno kao otvoren projekat · GitHub Pages</span>
      </div>
    </div>
  </footer>`;
}

/**
 * Sastavlja kompletnu HTML stranicu.
 * @param {{naslov:string, opis:string, dubina:number, aktivno:string,
 *          telo:string, putanja:string, sara?:string}} o
 */
export function stranica(o) {
  const p = prefiks(o.dubina);
  const pun = o.naslov === 'Početna'
    ? 'Srpska narodna nošnja'
    : `${o.naslov} · Srpska narodna nošnja`;
  const url = `${ADRESA}/${o.putanja === 'index.html' ? '' : o.putanja.replace(/index\.html$/, '')}`;
  const saraStil = o.sara ? ` style="--sara:${dataUri(o.sara)}"` : '';

  return `<!doctype html>
<html lang="sr" data-pismo="lat">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pun)}</title>
<meta name="description" content="${esc(o.opis)}">
<meta name="theme-color" content="#8c1c13">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sr_RS">
<meta property="og:site_name" content="Srpska narodna nošnja">
<meta property="og:title" content="${esc(pun)}">
<meta property="og:description" content="${esc(o.opis)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${p}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap">
<link rel="stylesheet" href="${p}assets/site.css">
<script defer src="${p}assets/site.js"></script>
</head>
<body${saraStil}>
<a class="preskoci" href="#sadrzaj">Preskoči na sadržaj</a>
${zaglavlje(p, o.aktivno)}
<main id="sadrzaj">
${o.telo}
</main>
${podnozje(p)}
</body>
</html>
`;
}

/* ---------------------------------------------------------------- *
 * Upis
 * ---------------------------------------------------------------- */

async function upisi(putanja, sadrzaj) {
  const cilj = join(IZLAZ, putanja);
  await mkdir(dirname(cilj), { recursive: true });
  await writeFile(cilj, sadrzaj, 'utf8');
  return putanja;
}

/* ---------------------------------------------------------------- *
 * Glavni tok
 * ---------------------------------------------------------------- */

async function gradi() {
  await rm(IZLAZ, { recursive: true, force: true });
  await mkdir(IZLAZ, { recursive: true });

  const ctx = { esc, traka, saraZa, nosnje, pojmovnik, znakSvg, dataUri };
  const napravljene = [];

  // Stranice se učitavaju dinamički da bi svaka ostala u svom modulu.
  const moduli = [
    ['pocetna', ''],
    ['nosnje-lista', 'nosnje/'],
    ['pojmovnik', 'pojmovnik/'],
    ['tehnike', 'tehnike/'],
    ['gde-videti', 'gde-videti/'],
    ['o-projektu', 'o-projektu/'],
  ];

  for (const [ime, put] of moduli) {
    const mod = await import(`../site/pages/${ime}.js`);
    const dubina = put === '' ? 0 : put.split('/').filter(Boolean).length;
    const p = prefiks(dubina);
    const putanja = `${put}index.html`;
    napravljene.push(await upisi(putanja, stranica({
      naslov: mod.naslov,
      opis: mod.opis,
      dubina,
      aktivno: mod.aktivno,
      putanja,
      sara: mod.sara ? mod.sara(ctx) : undefined,
      telo: mod.telo({ ...ctx, p }),
    })));
  }

  // Po jedna stranica za svaki region.
  const detalj = await import('../site/pages/nosnja-detalj.js');
  for (let i = 0; i < nosnje.length; i++) {
    const n = nosnje[i];
    const putanja = `nosnje/${n.slug}/index.html`;
    const p = prefiks(2);
    napravljene.push(await upisi(putanja, stranica({
      naslov: `Nošnja — ${n.naziv}`,
      opis: n.uvod.slice(0, 155).replace(/\s+\S*$/, '') + '…',
      dubina: 2,
      aktivno: 'nosnje',
      putanja,
      sara: saraZa(i, n.boje),
      telo: detalj.telo({ ...ctx, p, n, i, prethodna: nosnje[i - 1], sledeca: nosnje[i + 1] }),
    })));
  }

  // Statički fajlovi.
  for (const f of ['site.css', 'site.js']) {
    await upisi(`assets/${f}`, await readFile(join(KOREN, 'site/assets', f), 'utf8'));
  }
  await upisi('favicon.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect width="40" height="40" rx="8" fill="#f7f2e7"/>
  ${znakSvg().replace(/<svg[^>]*>|<\/svg>/g, '')}
</svg>`);

  // 404 — servira se sa proizvoljne dubine, pa koristi apsolutne putanje.
  await upisi('404.html', `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stranica nije pronađena · Srpska narodna nošnja</title>
<link rel="icon" href="${BAZA}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${BAZA}assets/site.css">
</head>
<body>
<main id="sadrzaj" class="sekcija">
  <div class="omot usko tekst-sredina">
    <span class="nadnaslov" style="color:#b98f21">Greška 404</span>
    <h1>Ove stranice nema</h1>
    <p>Možda je premeštena ili adresa nije tačno prepisana.</p>
    <p class="mt-veliko"><a class="dugme dugme-puno" href="${BAZA}">Nazad na početnu</a></p>
  </div>
</main>
</body>
</html>
`);

  // Sitemap i robots.
  const adrese = napravljene
    .filter((f) => f.endsWith('index.html'))
    .map((f) => `${ADRESA}/${f.replace(/index\.html$/, '')}`);
  await upisi('sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    adrese.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') +
    `\n</urlset>\n`);
  await upisi('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ADRESA}/sitemap.xml\n`);

  // .nojekyll — da GitHub Pages ne pokreće Jekyll obradu.
  await upisi('.nojekyll', '');

  console.log(`Napravljeno ${napravljene.length} stranica u dist/`);
  for (const f of napravljene) console.log('  ·', f);
}

gradi().catch((e) => { console.error(e); process.exit(1); });
