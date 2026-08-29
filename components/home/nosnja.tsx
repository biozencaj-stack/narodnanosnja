/**
 * Sekcije početne strane — radionički karakter.
 *
 * Zamenjuju generičke delove iz template-a (odbrojavanje rasprodaje,
 * Instagram, brendovi, statistika) koji za ručno tkane komade nemaju smisla.
 */

import Link from 'next/link';
import { Podloga, Traka, MestodrzacProizvoda } from '@/components/ukras';
import { getNavCategories } from '@/lib/db/nav-categories';

/** Iz Json polja { sr, en } vadi srpski naziv. */
function naziv(vrednost: unknown): string {
  if (typeof vrednost === 'string') return vrednost;
  if (vrednost && typeof vrednost === 'object') {
    const o = vrednost as Record<string, unknown>;
    if (typeof o.sr === 'string') return o.sr;
    if (typeof o.en === 'string') return o.en;
  }
  return '';
}

/* ================================================================== *
 * Hero
 * ================================================================== */

export function HeroRadionica() {
  return (
    <section className="relative overflow-hidden bg-background-alt">
      {/* Šara mora da ostane u pozadini — na 0.1 se takmičila sa naslovom. */}
      <Podloga vrsta="romb" velicina={64} prozirnost={0.055} boja="#8c1c13" bojaDruga="#b98f21" />

      <div className="container-wide relative">
        <div className="grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          {/* Reč */}
          <div>
            <span className="mb-5 inline-block text-[0.7rem] font-bold uppercase tracking-[0.22em] text-zlatna">
              Ručni rad · tkano na razboju
            </span>

            <h1 className="font-display text-[2.4rem] font-bold leading-[1.1] text-text sm:text-5xl lg:text-[3.4rem]">
              Svaki komad
              <br />
              je <span className="text-primary">jedinstven</span>
            </h1>

            <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-text-muted">
              Šalovi, tkanice i torbe tkane na razboju, po šarama koje se u ovim
              krajevima pamte s kolena na koleno. Šara se ne prepisuje — pamti se.
              Zato ne postoje dva ista komada.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="rounded-full bg-primary px-7 py-3.5 text-[0.95rem] font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Pogledaj ponudu
              </Link>
              <Link
                href="#kako-nastaje"
                className="rounded-full border border-primary px-7 py-3.5 text-[0.95rem] font-bold text-primary transition-colors hover:bg-primary/8"
              >
                Kako nastaje
              </Link>
            </div>
          </div>

          {/* Tkanje — dok nema fotografija, stoji šara, ne prazna kutija */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-border shadow-sm">
                <MestodrzacProizvoda redni={0} />
              </div>
              <div className="mt-8 grid gap-3 sm:gap-4">
                <div className="aspect-square overflow-hidden rounded-2xl border border-border shadow-sm">
                  <MestodrzacProizvoda redni={3} />
                </div>
                <div className="aspect-square overflow-hidden rounded-2xl border border-border shadow-sm">
                  <MestodrzacProizvoda redni={1} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Traka boja="#b98f21" bojaDruga="#a4161a" visina={20} />
    </section>
  );
}

/* ================================================================== *
 * Traka vrednosti
 * ================================================================== */

const VREDNOSTI: { naslov: string; opis: string; motiv: 0 | 1 | 2 | 3 }[] = [
  {
    naslov: 'Rađeno rukom',
    opis: 'Na razboju, bez mašinskog tkanja',
    motiv: 0,
  },
  {
    naslov: 'Nema dva ista',
    opis: 'Svaki komad se malo razlikuje',
    motiv: 1,
  },
  {
    naslov: 'Plaćanje pouzećem',
    opis: 'Platite kuriru pri preuzimanju',
    motiv: 2,
  },
  {
    naslov: 'Isporuka u Srbiji',
    opis: 'Za 2–4 radna dana',
    motiv: 3,
  },
];

export function TrakaVrednosti() {
  return (
    <section className="border-b border-border bg-background">
      <div className="container-wide">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4 lg:py-12">
          {VREDNOSTI.map((v) => (
            <li key={v.naslov} className="flex items-start gap-3.5">
              <span className="mt-0.5 h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border">
                <MestodrzacProizvoda redni={v.motiv} />
              </span>
              <span>
                <span className="block font-display text-[1.02rem] font-bold text-text">
                  {v.naslov}
                </span>
                <span className="mt-0.5 block text-[0.86rem] leading-snug text-text-muted">
                  {v.opis}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Kategorije
 * ================================================================== */

export async function KategorijeTkanja() {
  let kategorije: Awaited<ReturnType<typeof getNavCategories>> = [];
  try {
    kategorije = await getNavCategories();
  } catch {
    return null;
  }
  if (kategorije.length === 0) return null;

  return (
    <section className="bg-background py-14 lg:py-20">
      <div className="container-wide">
        <div className="mb-10 max-w-xl">
          <h2 className="font-display text-3xl font-bold text-text lg:text-4xl">
            Šta se tka
          </h2>
          <p className="mt-3 text-text-muted">
            Isti razboj, ista vuna — različita namena.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
          {kategorije.map((k, i) => (
            <Link
              key={k.id}
              href={`/category/${k.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-povrsina shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zlatna hover:shadow-md"
            >
              <div className="h-28 overflow-hidden lg:h-32">
                <MestodrzacProizvoda redni={i} />
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <h3 className="font-display text-[1.08rem] font-bold leading-snug text-text">
                  {naziv(k.name)}
                </h3>
                <span
                  aria-hidden="true"
                  className="text-lg text-primary transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Kako nastaje — duša radionice
 * ================================================================== */

const KORACI = [
  {
    broj: '01',
    naslov: 'Vuna i lan',
    opis:
      'Vuna se pere, suši i grebena; lan se moči, trli i češlja dok ne ostane samo mekano vlakno. Od njive do pređe prođe i po godinu dana.',
  },
  {
    broj: '02',
    naslov: 'Bojenje',
    opis:
      'Prirodne boje — orahova ljuska, broć, kora divlje jabuke. Zato dve serije iste šare nikad nisu potpuno isti ton.',
  },
  {
    broj: '03',
    naslov: 'Razboj',
    opis:
      'Osnova se snuje danima, a šara se ne crta ni ne prepisuje — pamti se napamet i provlači čunkom, red po red.',
  },
  {
    broj: '04',
    naslov: 'Rese i dorada',
    opis:
      'Rese se uvrću rukom, rubovi se opšivaju. Tek tada komad dobija ime i ide iz radionice.',
  },
];

export function KakoNastaje() {
  return (
    <section id="kako-nastaje" className="relative overflow-hidden bg-background-alt py-14 lg:py-20">
      <Podloga vrsta="grana" velicina={40} prozirnost={0.07} boja="#8c1c13" bojaDruga="#b98f21" />

      <div className="container-wide relative">
        <div className="mb-12 max-w-xl">
          <span className="mb-3 inline-block text-[0.7rem] font-bold uppercase tracking-[0.22em] text-zlatna">
            Iz radionice
          </span>
          <h2 className="font-display text-3xl font-bold text-text lg:text-4xl">
            Kako nastaje jedan komad
          </h2>
          <p className="mt-3 text-text-muted">
            Četiri koraka i nekoliko nedelja rada — zato cena nije kao u
            prodavnici gotove robe.
          </p>
        </div>

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {KORACI.map((k) => (
            <li key={k.broj}>
              <span className="font-display text-[2.1rem] font-bold leading-none text-zlatna/45">
                {k.broj}
              </span>
              <h3 className="mt-3 font-display text-[1.15rem] font-bold text-text">
                {k.naslov}
              </h3>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-text-muted">
                {k.opis}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Priča o krajevima — veza sa prezentacionim delom
 * ================================================================== */

export function PricaOKrajevima() {
  return (
    <section className="relative overflow-hidden bg-text py-16 text-white lg:py-20">
      <Podloga vrsta="rozeta" velicina={56} prozirnost={0.13} boja="#d9b04a" bojaDruga="#a4161a" />

      <div className="container-wide relative">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mb-4 inline-block text-[0.7rem] font-bold uppercase tracking-[0.22em] text-zlatna-jaka">
            Odakle šare dolaze
          </span>
          <h2 className="font-display text-3xl font-bold text-[#fdf6e8] lg:text-4xl">
            Nošnja nije kostim
          </h2>
          <p className="mt-5 text-[1.02rem] leading-relaxed text-[#ddcdb4]">
            Po kroju se znalo iz kog je sela čovek, po boji marame da li je žena
            udata, po broju dukata koliko kuća stoji. Šare koje tkamo nisu ukras —
            one su bile pismo.
          </p>
          <Link
            href="/blog"
            className="mt-8 inline-block rounded-full border border-zlatna-jaka/50 px-7 py-3.5 text-[0.95rem] font-bold text-zlatna-jaka transition-colors hover:bg-zlatna-jaka/12"
          >
            Pročitaj o krajevima
          </Link>
        </div>
      </div>
    </section>
  );
}
