import Link from 'next/link';
import { Znak } from '@/components/ukras';

/**
 * Znak radionice uz ispisano ime.
 *
 * Namerno nije slika: kao SVG unutar <img> ne bi mogao da koristi PT Serif
 * (učitani fontovi ne stižu u zaseban SVG dokument), pa bi ime bilo
 * ispisano sistemskim serifom i odudaralo od ostatka sajta.
 */
export function Logo({
  varijanta = 'svetla',
  className = '',
  ime = 'Prodavnica',
  slogan = 'pažljivo odabrano',
}: {
  /** „svetla“ — tamna slova na lanu; „tamna“ — svetla slova na tamnoj podlozi. */
  varijanta?: 'svetla' | 'tamna';
  className?: string;
  ime?: string;
  slogan?: string;
}) {
  const naTamnom = varijanta === 'tamna';

  return (
    <Link
      href="/"
      aria-label={`${ime} — početna`}
      className={`group flex flex-shrink-0 items-center gap-2.5 ${className}`}
    >
      <Znak
        className="h-8 w-8 transition-transform duration-300 group-hover:rotate-45 lg:h-9 lg:w-9"
        boja={naTamnom ? 'var(--color-zlatna)' : 'var(--color-primary)'}
        srce={naTamnom ? 'var(--color-primary)' : 'var(--color-zlatna)'}
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-[1.05rem] font-bold tracking-tight lg:text-[1.2rem] ${
            naTamnom ? 'text-white' : 'text-text'
          }`}
        >
          {ime}
        </span>
        <span
          className={`mt-0.5 text-[0.6rem] uppercase tracking-[0.2em] ${
            naTamnom ? 'text-white/60' : 'text-text-muted'
          }`}
        >
          {slogan}
        </span>
      </span>
    </Link>
  );
}
