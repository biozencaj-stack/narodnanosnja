"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { PoljeObrasca } from "./PoljeObrasca";
import { ListaObrasca } from "./ListaObrasca";
import {
  poljaTipa,
  tipDozvoljenNaStranici,
  tipJeDostupan,
  TIPOVI_SEKCIJA,
  tipSekcije,
} from "@/lib/sekcije/registar";
import { storeCapabilities } from "@/lib/config/capabilities";
import type { PoljeSekcije } from "@/lib/sekcije/polja";

/**
 * Ekran za slaganje sekcija jedne stranice.
 *
 * Levo spisak sa redosledom i vidljivošću, desno obrazac **generisan iz
 * registra**. Obrazac se ne piše po tipu sekcije: da se piše, svaki novi tip
 * tražio bi novi ekran i registar bi prestao da bude jedini izvor istine.
 */

interface Sekcija {
  id: string;
  kind: string;
  order: number;
  isActive: boolean;
  version: number;
  config: Record<string, unknown>;
  draftConfig: Record<string, unknown> | null;
  draftOrder: number | null;
  draftIsActive: boolean | null;
  publishedAt: string | null;
}

const PORUKA_MREZE = "Veza sa serverom nije uspela. Pokušaj ponovo.";

function tekuciConfig(sekcija: Sekcija): Record<string, unknown> {
  return sekcija.draftConfig ?? sekcija.config;
}

function tekucaVidljivost(sekcija: Sekcija): boolean {
  return sekcija.draftIsActive ?? sekcija.isActive;
}

function imaNacrt(sekcija: Sekcija): boolean {
  return (
    sekcija.draftConfig !== null ||
    sekcija.draftOrder !== null ||
    sekcija.draftIsActive !== null
  );
}

/** Prekidači prodavnice su isti u celom paketu; čitaju se jednom. */
function jeDostupan(kind: string): boolean {
  return tipJeDostupan(kind, storeCapabilities as unknown as Record<string, boolean>);
}

export function EkranSekcija({ pageKey }: { pageKey: string }) {
  const [sekcije, setSekcije] = useState<Sekcija[]>([]);
  const [izabrana, setIzabrana] = useState<string | null>(null);
  const [nacrtPolja, setNacrtPolja] = useState<Record<string, unknown>>({});
  const [greske, setGreske] = useState<Record<string, string>>({});
  const [ucitavanje, setUcitavanje] = useState(true);
  const [zauzeto, setZauzeto] = useState(false);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = useCallback(async () => {
    setUcitavanje(true);
    try {
      const odgovor = await fetch(
        `/api/admin/sekcije?pageKey=${encodeURIComponent(pageKey)}`,
      );
      if (!odgovor.ok) throw new Error("neuspeh");
      const podaci = (await odgovor.json()) as { sekcije: Sekcija[] };
      setSekcije(podaci.sekcije);
      setGreska(null);
    } catch {
      setGreska(PORUKA_MREZE);
    } finally {
      setUcitavanje(false);
    }
  }, [pageKey]);

  useEffect(() => {
    void ucitaj();
  }, [ucitaj]);

  const tekuca = useMemo(
    () => sekcije.find((sekcija) => sekcija.id === izabrana) ?? null,
    [sekcije, izabrana],
  );

  // Kad se promeni izbor, obrazac kreće od nacrta te sekcije.
  useEffect(() => {
    setNacrtPolja(tekuca ? { ...tekuciConfig(tekuca) } : {});
    setGreske({});
  }, [tekuca]);

  const posalji = useCallback(
    async (
      putanja: string,
      telo: unknown,
      metod: "POST" | "PUT" | "DELETE" = "POST",
    ): Promise<Record<string, unknown> | null> => {
      setZauzeto(true);
      setPoruka(null);
      setGreska(null);
      try {
        const odgovor = await fetch(putanja, {
          method: metod,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(telo),
        });
        const podaci = (await odgovor.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;

        if (!odgovor.ok) {
          // 409 i 428 nisu obične greške: znače da je stanje na ekranu
          // zastarelo, pa se spisak mora ponovo učitati, inače bi svaki
          // sledeći potez pao isto.
          if (odgovor.status === 409 || odgovor.status === 428) {
            await ucitaj();
          }
          if (podaci.greske && typeof podaci.greske === "object") {
            setGreske(podaci.greske as Record<string, string>);
          }
          setGreska(
            typeof podaci.error === "string"
              ? podaci.error
              : `Zahtev nije uspeo (${odgovor.status}).`,
          );
          return null;
        }

        setGreske({});
        return podaci;
      } catch {
        setGreska(PORUKA_MREZE);
        return null;
      } finally {
        setZauzeto(false);
      }
    },
    [ucitaj],
  );

  const sacuvajNacrt = async () => {
    if (!tekuca) return;
    const podaci = await posalji(
      `/api/admin/sekcije/${tekuca.id}`,
      { version: tekuca.version, config: nacrtPolja, nacrt: true },
      "PUT",
    );
    if (podaci) {
      setPoruka("Nacrt je sačuvan. Javni sajt još ne prikazuje izmenu.");
      await ucitaj();
    }
  };

  const objavi = async () => {
    const podaci = await posalji("/api/admin/sekcije/objavi", { pageKey });
    if (podaci) {
      setPoruka("Objavljeno. Izmena je vidljiva na sajtu.");
      await ucitaj();
    }
  };

  const dodaj = async (kind: string) => {
    const podaci = await posalji("/api/admin/sekcije", { pageKey, kind });
    if (podaci) {
      setPoruka("Sekcija je dodata kao nacrt. Objavi je kad bude spremna.");
      await ucitaj();
    }
  };

  const dupliraj = async (sekcija: Sekcija) => {
    const podaci = await posalji("/api/admin/sekcije", {
      pageKey,
      kind: sekcija.kind,
      config: tekuciConfig(sekcija),
    });
    if (podaci) {
      setPoruka("Kopija je dodata kao nacrt.");
      await ucitaj();
    }
  };

  const obrisi = async (sekcija: Sekcija) => {
    if (
      !window.confirm(
        `Obrisati sekciju „${tipSekcije(sekcija.kind)?.naziv ?? sekcija.kind}”? Ovo se ne može opozvati.`,
      )
    ) {
      return;
    }
    const podaci = await posalji(
      `/api/admin/sekcije/${sekcija.id}`,
      { version: sekcija.version },
      "DELETE",
    );
    if (podaci) {
      if (izabrana === sekcija.id) setIzabrana(null);
      setPoruka("Sekcija je obrisana.");
      await ucitaj();
    }
  };

  const promeniVidljivost = async (sekcija: Sekcija) => {
    const podaci = await posalji(
      `/api/admin/sekcije/${sekcija.id}`,
      {
        version: sekcija.version,
        config: tekuciConfig(sekcija),
        isActive: !tekucaVidljivost(sekcija),
        nacrt: true,
      },
      "PUT",
    );
    if (podaci) {
      setPoruka("Promena vidljivosti je u nacrtu, još nije objavljena.");
      await ucitaj();
    }
  };

  const pomeri = async (indeks: number, pomak: number) => {
    const cilj = indeks + pomak;
    if (cilj < 0 || cilj >= sekcije.length) return;

    const sledece = [...sekcije];
    [sledece[indeks], sledece[cilj]] = [sledece[cilj], sledece[indeks]];

    // Parovi `{ id, version }`, ne go niz identifikatora: bez verzija bi se dva
    // otvorena taba tiho pregazila.
    const podaci = await posalji("/api/admin/sekcije/redosled", {
      pageKey,
      nacrt: true,
      stavke: sledece.map((sekcija) => ({
        id: sekcija.id,
        version: sekcija.version,
      })),
    });
    if (podaci) {
      setPoruka("Redosled je promenjen u nacrtu.");
      await ucitaj();
    }
  };

  const nacrtoviPostoje = sekcije.some(imaNacrt);

  if (ucitavanje) {
    return (
      <div className="flex items-center gap-2 p-8 text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Učitavanje sekcija…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(poruka || greska) && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            greska
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {greska ?? poruka}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/admin/sekcije/pregled/${encodeURIComponent(pageKey)}`}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700"
        >
          Pogledaj nacrt
        </a>
        <button
          type="button"
          onClick={objavi}
          disabled={zauzeto || !nacrtoviPostoje}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Objavi stranicu
        </button>
        {!nacrtoviPostoje && (
          <span className="text-xs text-stone-500">
            Nema nijedne neobjavljene izmene.
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SpisakSekcija
          sekcije={sekcije}
          izabrana={izabrana}
          zauzeto={zauzeto}
          onIzaberi={setIzabrana}
          onPomeri={pomeri}
          onVidljivost={promeniVidljivost}
          onDupliraj={dupliraj}
          onObrisi={obrisi}
          pageKey={pageKey}
          onDodaj={dodaj}
        />

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          {!tekuca ? (
            <p className="p-6 text-sm text-stone-500">
              Izaberi sekciju sa spiska da bi joj menjao sadržaj.
            </p>
          ) : (
            <ObrazacSekcije
              kind={tekuca.kind}
              vrednosti={nacrtPolja}
              greske={greske}
              zauzeto={zauzeto}
              onPromena={(kljuc, vrednost) =>
                setNacrtPolja((prethodno) => ({
                  ...prethodno,
                  [kljuc]: vrednost,
                }))
              }
              onSacuvaj={sacuvajNacrt}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SpisakSekcija({
  pageKey,
  sekcije,
  izabrana,
  zauzeto,
  onIzaberi,
  onPomeri,
  onVidljivost,
  onDupliraj,
  onObrisi,
  onDodaj,
}: {
  pageKey: string;
  sekcije: Sekcija[];
  izabrana: string | null;
  zauzeto: boolean;
  onIzaberi: (id: string) => void;
  onPomeri: (indeks: number, pomak: number) => void;
  onVidljivost: (sekcija: Sekcija) => void;
  onDupliraj: (sekcija: Sekcija) => void;
  onObrisi: (sekcija: Sekcija) => void;
  onDodaj: (kind: string) => void;
}) {
  // Tip mora biti i uključen prekidačem i dozvoljen u OVOJ zoni: blok proizvoda
  // ne ide iznad podnožja, jer ta zona stoji na svakoj stranici.
  const ponuda = TIPOVI_SEKCIJA.map((tip) => ({
    tip,
    razlog: !tipDozvoljenNaStranici(tip.kind, pageKey)
      ? " — nije za ovu zonu"
      : !jeDostupan(tip.kind)
        ? " — isključeno u podešavanjima"
        : "",
  }));

  // Prvi PONUĐEN tip, ne prosto prvi: inače bi dugme „dodaj” podrazumevano
  // nudilo tip koji ruta odbija.
  const prviDostupan = ponuda.find((stavka) => stavka.razlog === "")?.tip.kind ?? "";
  const [noviTip, setNoviTip] = useState(prviDostupan);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <label className="mb-1 block text-xs font-medium text-stone-600">
          Dodaj sekciju
        </label>
        <div className="flex gap-2">
          <select
            value={noviTip}
            onChange={(dogadjaj) => setNoviTip(dogadjaj.target.value)}
            className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
          >
            {ponuda.map(({ tip, razlog }) => (
              // Nedostupan tip se PRIKAZUJE kao onemogućen izbor sa razlogom.
              // Ranije je takva sekcija prosto nestajala sa sajta bez poruke, pa
              // je izgledalo kao kvar.
              <option key={tip.kind} value={tip.kind} disabled={razlog !== ""}>
                {tip.naziv}
                {razlog}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={zauzeto || noviTip === ""}
            onClick={() => onDodaj(noviTip)}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-stone-700 disabled:opacity-40"
            aria-label="Dodaj sekciju"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {sekcije.map((sekcija, indeks) => {
          const tip = tipSekcije(sekcija.kind);
          const vidljiva = tekucaVidljivost(sekcija);
          return (
            <li
              key={sekcija.id}
              className={`rounded-xl border bg-white p-3 ${
                izabrana === sekcija.id
                  ? "border-stone-800 ring-1 ring-stone-800"
                  : "border-stone-200"
              }`}
            >
              <button
                type="button"
                onClick={() => onIzaberi(sekcija.id)}
                className="block w-full text-left"
              >
                <span className="block text-sm font-medium text-stone-800">
                  {tip?.naziv ?? sekcija.kind}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                  {!vidljiva && (
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-600">
                      ugašena
                    </span>
                  )}
                  {imaNacrt(sekcija) && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                      ima nacrt
                    </span>
                  )}
                  {sekcija.publishedAt === null && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                      nikad objavljena
                    </span>
                  )}
                  {!tip && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">
                      nepoznat tip
                    </span>
                  )}
                </span>
              </button>

              <div className="mt-2 flex items-center gap-1 border-t border-stone-100 pt-2">
                <button
                  type="button"
                  aria-label="Pomeri gore"
                  disabled={zauzeto || indeks === 0}
                  onClick={() => onPomeri(indeks, -1)}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Pomeri dole"
                  disabled={zauzeto || indeks === sekcije.length - 1}
                  onClick={() => onPomeri(indeks, 1)}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={vidljiva ? "Ugasi sekciju" : "Upali sekciju"}
                  disabled={zauzeto}
                  onClick={() => onVidljivost(sekcija)}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                >
                  {vidljiva ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Dupliraj sekciju"
                  disabled={zauzeto}
                  onClick={() => onDupliraj(sekcija)}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Obriši sekciju"
                  disabled={zauzeto}
                  onClick={() => onObrisi(sekcija)}
                  className="ml-auto rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ObrazacSekcije({
  kind,
  vrednosti,
  greske,
  zauzeto,
  onPromena,
  onSacuvaj,
}: {
  kind: string;
  vrednosti: Record<string, unknown>;
  greske: Record<string, string>;
  zauzeto: boolean;
  onPromena: (kljuc: string, vrednost: unknown) => void;
  onSacuvaj: () => void;
}) {
  const tip = tipSekcije(kind);

  if (!tip) {
    // Normalno stanje posle vraćanja koda unazad: podaci znaju za tip koji kod
    // još nema. Sekcija se ne sme uređivati naslepo.
    return (
      <p className="p-6 text-sm text-red-700">
        Tip „{kind}” ne postoji u ovoj verziji koda. Sekcija se ne prikazuje na
        sajtu i ne može se uređivati dok se kod ne vrati na verziju koja je
        poznaje.
      </p>
    );
  }

  // `poljaTipa` već dodaje polja okvira; ne dodaju se drugi put.
  const svaPolja: PoljeSekcije[] = poljaTipa(tip);

  return (
    <form
      onSubmit={(dogadjaj) => {
        dogadjaj.preventDefault();
        onSacuvaj();
      }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-stone-900">{tip.naziv}</h2>
        {tip.opis && <p className="text-sm text-stone-500">{tip.opis}</p>}
      </div>

      {svaPolja.map((polje) =>
        polje.tip === "lista" ? (
          <ListaObrasca
            key={polje.kljuc}
            polje={polje}
            vrednost={vrednosti[polje.kljuc]}
            greske={greske}
            disabled={zauzeto}
            onChange={(vrednost) => onPromena(polje.kljuc, vrednost)}
          />
        ) : (
          <PoljeObrasca
            key={polje.kljuc}
            polje={polje}
            vrednost={vrednosti[polje.kljuc]}
            greska={greske[polje.kljuc]}
            disabled={zauzeto}
            onChange={(vrednost) => onPromena(polje.kljuc, vrednost)}
          />
        ),
      )}

      <div className="flex items-center gap-3 border-t border-stone-200 pt-4">
        <button
          type="submit"
          disabled={zauzeto}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Sačuvaj nacrt
        </button>
        <span className="text-xs text-stone-500">
          Čuvanje nacrta ne menja javni sajt.
        </span>
      </div>
    </form>
  );
}
