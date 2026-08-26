/**
 * Provera objavljenog sajta — obilazi sve stranice sa sitemap-a, proverava
 * statuse, naslove, i da li svaka veza i svaki resurs stvarno postoje.
 *
 *   node scripts/proveri-uzivo.mjs [adresa]
 */

const ADRESA = (process.argv[2] || 'https://biozencaj-stack.github.io/narodnanosnja')
  .replace(/\/+$/, '');

const dohvati = async (url, metod = 'GET') => {
  try {
    const o = await fetch(url, { method: metod, redirect: 'follow' });
    return { ok: o.ok, status: o.status, telo: metod === 'GET' ? await o.text() : '' };
  } catch (e) {
    return { ok: false, status: 0, telo: '', greska: e.message };
  }
};

console.log(`Provera: ${ADRESA}\n`);
let greske = 0;

// 1. Sitemap daje spisak svih stranica.
const sm = await dohvati(`${ADRESA}/sitemap.xml`);
if (!sm.ok) { console.log(`GRESKA  sitemap.xml -> ${sm.status}`); process.exit(1); }
const strane = [...sm.telo.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`sitemap.xml: ${strane.length} stranica\n`);

// 2. Svaka stranica mora da se otvori i da ima naslov i sadržaj.
const resursi = new Set();
for (const u of strane) {
  const o = await dohvati(u);
  const naslov = (o.telo.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
  const ima = {
    zaglavlje: o.telo.includes('class="zaglavlje"'),
    podnozje: o.telo.includes('class="podnozje"'),
    sara: o.telo.includes("url('data:image/svg+xml"),
  };
  const dobro = o.ok && naslov && ima.zaglavlje && ima.podnozje;
  if (!dobro) greske++;
  console.log(`${dobro ? 'ok  ' : 'PAO '} ${o.status}  ${u.replace(ADRESA, '') || '/'}  — ${naslov}`);

  for (const m of o.telo.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const v = m[1];
    if (/^(mailto:|data:|#)/.test(v)) continue;
    if (v.startsWith('http') && !v.startsWith(ADRESA)) continue; // spoljne veze preskačemo
    resursi.add(new URL(v, u).href);
  }
}

// 3. Svaki resurs i svaka interna veza moraju da postoje.
console.log(`\nProvera ${resursi.size} jedinstvenih veza i resursa…`);
for (const u of resursi) {
  const o = await dohvati(u, 'HEAD');
  if (!o.ok) { greske++; console.log(`PAO  ${o.status}  ${u}`); }
}

// 4. 404 stranica mora da vraća 404 i da ima svoju poruku.
const nema = await dohvati(`${ADRESA}/ovo-ne-postoji-xyz/`);
const dobar404 = nema.status === 404 && nema.telo.includes('Ove stranice nema');
if (!dobar404) greske++;
console.log(`\n${dobar404 ? 'ok  ' : 'PAO '} 404 stranica (status ${nema.status})`);

console.log(`\n${greske ? greske + ' GRESAKA' : 'Sve ispravno.'}`);
process.exit(greske ? 1 : 0);
