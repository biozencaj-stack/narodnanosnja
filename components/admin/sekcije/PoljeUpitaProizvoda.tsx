"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IZVORI_PROIZVODA,
  MAX_PROIZVODA_U_BLOKU,
  NATPISI_IZVORA,
  NATPISI_SORTIRANJA,
  SORTIRANJA_PROIZVODA,
  citajLok,
  type IzvorProizvoda,
} from "@/lib/sekcije/polja";

/**
 * Uređivač vrednosti polja `upitProizvoda`.
 *
 * Izvor određuje koja dopuna se traži, pa se polje za kategoriju, brend ili
 * ručni izbor prikazuje samo uz svoj izvor. Vrednosti se ipak ČUVAJU i kad se
 * ne vide: admin koji privremeno prebaci izvor ne gubi izbor koji je napravio.
 * Renderer ih pri čitanju ignoriše, pa nekorišćeno polje ne utiče na to šta
 * posetilac vidi ni na ključ keša.
 *
 * Spiskovi se čitaju sa javnih ruta `/api/categories`, `/api/brands` i
 * `/api/products`, koje ionako služe izlogu. Nova admin ruta se ne otvara samo
 * zbog padajuće liste.
 */

const KLASA_UNOSA =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none disabled:bg-stone-100";

interface Stavka {
  slug: string;
  naziv: string;
}

type Upit = Record<string, unknown>;

function tekst(vrednost: unknown): string {
  return typeof vrednost === "string" ? vrednost : "";
}

function lista(vrednost: unknown): string[] {
  return Array.isArray(vrednost) ? vrednost.filter((s) => typeof s === "string") : [];
}

/** Jednom učitan spisak po adresi; drugi blok na istom ekranu ga ne traži opet. */
const KES_SPISKOVA = new Map<string, Stavka[]>();

/**
 * Spisak za padajuću listu.
 *
 * Keš se čita pri iscrtavanju, a ne kroz `setState` u efektu: kad admin
 * prebaci izvor sa brenda na kategoriju, već učitan spisak se vidi odmah, bez
 * praznog kadra i bez dodatnog kruga iscrtavanja.
 */
function useSpisak(adresa: string | null): Stavka[] {
  const [, osveziPrikaz] = useState(0);

  useEffect(() => {
    if (!adresa || KES_SPISKOVA.has(adresa)) return;
    let otkazano = false;
    (async () => {
      try {
        const odgovor = await fetch(adresa);
        if (!odgovor.ok) return;
        const telo: unknown = await odgovor.json();
        if (!Array.isArray(telo)) return;
        const mapirano = telo
          .map((red): Stavka | null => {
            if (typeof red !== "object" || red === null) return null;
            const zapis = red as Record<string, unknown>;
            const slug = tekst(zapis.slug);
            if (slug.length === 0) return null;
            const naziv =
              typeof zapis.name === "string" ? zapis.name : citajLok(zapis.name, "sr");
            return { slug, naziv: naziv.length > 0 ? naziv : slug };
          })
          .filter((stavka): stavka is Stavka => stavka !== null);
        KES_SPISKOVA.set(adresa, mapirano);
        if (!otkazano) osveziPrikaz((broj) => broj + 1);
      } catch {
        // Spisak je pomoć pri izboru, ne uslov: obrazac radi i bez njega.
      }
    })();
    return () => {
      otkazano = true;
    };
  }, [adresa]);

  return (adresa ? KES_SPISKOVA.get(adresa) : undefined) ?? [];
}

function BiracSluga({
  vrednost,
  stavke,
  disabled,
  praznoNatpis,
  onChange,
}: {
  vrednost: string;
  stavke: Stavka[];
  disabled?: boolean;
  praznoNatpis: string;
  onChange: (slug: string) => void;
}) {
  // Zapisani slug može pokazivati na obrisanu kategoriju; tada se i dalje vidi,
  // umesto da select tiho skoči na prvu stavku i promeni šta blok prikazuje.
  const nedostaje = vrednost.length > 0 && !stavke.some((s) => s.slug === vrednost);
  return (
    <select
      value={vrednost}
      disabled={disabled}
      onChange={(dogadjaj) => onChange(dogadjaj.target.value)}
      className={KLASA_UNOSA}
    >
      <option value="">{praznoNatpis}</option>
      {nedostaje && (
        <option value={vrednost}>{vrednost} — više ne postoji</option>
      )}
      {stavke.map((stavka) => (
        <option key={stavka.slug} value={stavka.slug}>
          {stavka.naziv}
        </option>
      ))}
    </select>
  );
}

function RucniIzbor({
  izabrani,
  disabled,
  onChange,
}: {
  izabrani: string[];
  disabled?: boolean;
  onChange: (slugovi: string[]) => void;
}) {
  const [pojam, setPojam] = useState("");
  const [pogodci, setPogodci] = useState<Stavka[]>([]);
  const [trazi, setTrazi] = useState(false);

  const pretrazi = useCallback(async () => {
    const ociscen = pojam.trim();
    if (ociscen.length === 0) {
      setPogodci([]);
      return;
    }
    setTrazi(true);
    try {
      const odgovor = await fetch(
        `/api/products?search=${encodeURIComponent(ociscen)}&limit=10`,
      );
      if (!odgovor.ok) return;
      const telo: unknown = await odgovor.json();
      const redovi =
        typeof telo === "object" && telo !== null && Array.isArray((telo as Record<string, unknown>).products)
          ? ((telo as Record<string, unknown>).products as unknown[])
          : [];
      setPogodci(
        redovi
          .map((red): Stavka | null => {
            if (typeof red !== "object" || red === null) return null;
            const zapis = red as Record<string, unknown>;
            const slug = tekst(zapis.slug);
            if (slug.length === 0) return null;
            const naziv = citajLok(zapis.name, "sr");
            return { slug, naziv: naziv.length > 0 ? naziv : slug };
          })
          .filter((stavka): stavka is Stavka => stavka !== null),
      );
    } catch {
      setPogodci([]);
    } finally {
      setTrazi(false);
    }
  }, [pojam]);

  function dodaj(slug: string) {
    if (izabrani.includes(slug) || izabrani.length >= MAX_PROIZVODA_U_BLOKU) return;
    onChange([...izabrani, slug]);
  }

  function pomeri(indeks: number, smer: -1 | 1) {
    const cilj = indeks + smer;
    if (cilj < 0 || cilj >= izabrani.length) return;
    const kopija = [...izabrani];
    [kopija[indeks], kopija[cilj]] = [kopija[cilj], kopija[indeks]];
    onChange(kopija);
  }

  return (
    <div className="space-y-2 rounded-md border border-stone-200 p-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={pojam}
          disabled={disabled}
          placeholder="Traži proizvod po nazivu"
          onChange={(dogadjaj) => setPojam(dogadjaj.target.value)}
          onKeyDown={(dogadjaj) => {
            if (dogadjaj.key !== "Enter") return;
            // Polje je unutar admin obrasca; Enter bi inače poslao ceo obrazac.
            dogadjaj.preventDefault();
            void pretrazi();
          }}
          className={KLASA_UNOSA}
          aria-label="Pretraga proizvoda"
        />
        <button
          type="button"
          onClick={() => void pretrazi()}
          disabled={disabled || trazi}
          className="shrink-0 rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50 disabled:opacity-50"
        >
          {trazi ? "Tražim…" : "Traži"}
        </button>
      </div>

      {pogodci.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {pogodci.map((pogodak) => (
            <li key={pogodak.slug}>
              <button
                type="button"
                onClick={() => dodaj(pogodak.slug)}
                disabled={disabled || izabrani.includes(pogodak.slug)}
                className="w-full rounded px-2 py-1 text-left text-sm hover:bg-stone-100 disabled:text-stone-400"
              >
                {pogodak.naziv}
                {izabrani.includes(pogodak.slug) && " — već dodat"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {izabrani.length === 0 ? (
        <p className="text-xs text-stone-500">Još nijedan proizvod nije izabran.</p>
      ) : (
        <ol className="space-y-1">
          {izabrani.map((slug, indeks) => (
            <li
              key={slug}
              className="flex items-center gap-2 rounded bg-stone-50 px-2 py-1 text-sm"
            >
              <span className="w-5 shrink-0 text-xs text-stone-500">{indeks + 1}.</span>
              <span className="flex-1 truncate">{slug}</span>
              <button
                type="button"
                onClick={() => pomeri(indeks, -1)}
                disabled={disabled || indeks === 0}
                className="px-1 text-stone-500 disabled:opacity-30"
                aria-label={`Pomeri ${slug} naviše`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => pomeri(indeks, 1)}
                disabled={disabled || indeks === izabrani.length - 1}
                className="px-1 text-stone-500 disabled:opacity-30"
                aria-label={`Pomeri ${slug} naniže`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(izabrani.filter((s) => s !== slug))}
                disabled={disabled}
                className="px-1 text-red-600 disabled:opacity-30"
                aria-label={`Ukloni ${slug}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function PoljeUpitaProizvoda({
  vrednost,
  disabled,
  onChange,
}: {
  vrednost: unknown;
  disabled?: boolean;
  onChange: (vrednost: Upit) => void;
}) {
  const upit: Upit =
    typeof vrednost === "object" && vrednost !== null && !Array.isArray(vrednost)
      ? (vrednost as Upit)
      : {};

  const izvor = (IZVORI_PROIZVODA as readonly string[]).includes(tekst(upit.izvor))
    ? (upit.izvor as IzvorProizvoda)
    : "izdvojeno";

  const kategorije = useSpisak(izvor === "kategorija" ? "/api/categories" : null);
  const brendovi = useSpisak(izvor === "brend" ? "/api/brands" : null);

  function izmeni(delta: Upit) {
    onChange({ ...upit, ...delta });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={izvor}
          disabled={disabled}
          onChange={(dogadjaj) => izmeni({ izvor: dogadjaj.target.value })}
          className={`${KLASA_UNOSA} flex-1 min-w-[12rem]`}
          aria-label="Izvor proizvoda"
        >
          {IZVORI_PROIZVODA.map((vrednostIzvora) => (
            <option key={vrednostIzvora} value={vrednostIzvora}>
              {NATPISI_IZVORA[vrednostIzvora]}
            </option>
          ))}
        </select>

        <select
          value={
            (SORTIRANJA_PROIZVODA as readonly string[]).includes(tekst(upit.sort))
              ? (upit.sort as string)
              : SORTIRANJA_PROIZVODA[0]
          }
          disabled={disabled || izvor === "izabrani"}
          onChange={(dogadjaj) => izmeni({ sort: dogadjaj.target.value })}
          className={`${KLASA_UNOSA} flex-1 min-w-[10rem]`}
          aria-label="Redosled"
        >
          {SORTIRANJA_PROIZVODA.map((sort) => (
            <option key={sort} value={sort}>
              {NATPISI_SORTIRANJA[sort]}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          max={MAX_PROIZVODA_U_BLOKU}
          value={typeof upit.broj === "number" ? upit.broj : 8}
          disabled={disabled || izvor === "izabrani"}
          onChange={(dogadjaj) => izmeni({ broj: Number(dogadjaj.target.value) })}
          className={`${KLASA_UNOSA} w-24 shrink-0`}
          aria-label="Broj proizvoda"
        />
      </div>

      {izvor === "izabrani" && (
        <p className="text-xs text-stone-500">
          Ručni izbor sam određuje i broj i redosled, pa se dva polja iznad ne
          koriste.
        </p>
      )}

      {izvor === "kategorija" && (
        <BiracSluga
          vrednost={tekst(upit.kategorija)}
          stavke={kategorije}
          disabled={disabled}
          praznoNatpis="— izaberi kategoriju —"
          onChange={(slug) => izmeni({ kategorija: slug })}
        />
      )}

      {izvor === "brend" && (
        <BiracSluga
          vrednost={tekst(upit.brend)}
          stavke={brendovi}
          disabled={disabled}
          praznoNatpis="— izaberi brend —"
          onChange={(slug) => izmeni({ brend: slug })}
        />
      )}

      {izvor === "izabrani" && (
        <RucniIzbor
          izabrani={lista(upit.izabrani)}
          disabled={disabled}
          onChange={(slugovi) => izmeni({ izabrani: slugovi })}
        />
      )}
    </div>
  );
}
