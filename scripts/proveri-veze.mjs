/** Proverava da li svaka interna veza u dist/ vodi do postojećeg fajla. */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const IZLAZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
/** Ista osnovna putanja koju koristi build za 404 stranicu. */
const BAZA = (process.env.BASE_PATH ?? '/narodnanosnja').replace(/\/*$/, '/');

async function sviFajlovi(dir) {
  const stavke = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const s of stavke) {
    const put = join(dir, s.name);
    if (s.isDirectory()) out.push(...await sviFajlovi(put));
    else out.push(put);
  }
  return out;
}

const postoji = async (p) => { try { await stat(p); return true; } catch { return false; } };

const htmls = (await sviFajlovi(IZLAZ)).filter((f) => f.endsWith('.html'));
let ukupno = 0, lose = 0;

for (const f of htmls) {
  const html = await readFile(f, 'utf8');
  const veze = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const v of veze) {
    if (/^(https?:|mailto:|data:|#)/.test(v)) continue;
    ukupno++;
    const cist = v.split('#')[0];
    // Veze koje počinju kosom crtom su apsolutne na serveru; skidamo osnovnu
    // putanju i tražimo ih od korena dist/.
    let cilj = cist.startsWith('/')
      ? join(IZLAZ, cist.startsWith(BAZA) ? cist.slice(BAZA.length) : cist.slice(1))
      : resolve(dirname(f), cist);
    if (cist.endsWith('/') || cist === '') cilj = join(cilj, 'index.html');
    if (!(await postoji(cilj))) {
      lose++;
      console.log(`POLOMLJENO  ${relative(IZLAZ, f)}  ->  ${v}`);
    }
  }
}

console.log(`\nProvereno ${ukupno} internih veza u ${htmls.length} stranica — ${lose ? lose + ' polomljenih' : 'sve ispravne'}.`);
process.exit(lose ? 1 : 0);
