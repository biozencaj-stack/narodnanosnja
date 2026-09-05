"use client";

import { LocalizedInput } from "@/components/admin/LocalizedInput";
import { LocalizedTextarea } from "@/components/admin/LocalizedTextarea";
import { BogatiTekst } from "@/components/admin/BogatiTekst";
import { MedijatekaPicker, type VrednostMedija } from "./MedijatekaPicker";
import {
  IZVORI_PROIZVODA,
  TOKENI_POZADINE,
  TOKENI_UKRASA,
  type Lokalizovano,
  type PoljeSekcije,
} from "@/lib/sekcije/polja";

/**
 * Jedno polje admin obrasca, izvedeno iz definicije u registru.
 *
 * Obrazac se NE piše ručno po tipu sekcije. Da se piše, svaki novi tip tražio
 * bi novi ekran, a registar bi prestao da bude jedini izvor istine o tome šta
 * sekcija sadrži — tačno ono što ovaj pristup treba da spreči.
 */

type Vrednost = unknown;

interface PoljeProps {
  polje: PoljeSekcije;
  vrednost: Vrednost;
  onChange: (vrednost: Vrednost) => void;
  greska?: string;
  disabled?: boolean;
}

function prazanLok(): Lokalizovano {
  return { sr: "", en: "" };
}

function kaoLok(vrednost: Vrednost): Lokalizovano {
  if (typeof vrednost === "object" && vrednost !== null) {
    const zapis = vrednost as Record<string, unknown>;
    return {
      sr: typeof zapis.sr === "string" ? zapis.sr : "",
      en: typeof zapis.en === "string" ? zapis.en : "",
    };
  }
  // Zatečeni podaci ponegde imaju go string umesto para; ne gubi se.
  if (typeof vrednost === "string") return { sr: vrednost, en: "" };
  return prazanLok();
}

function Natpis({
  polje,
  children,
}: {
  polje: PoljeSekcije;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-stone-700">
        {polje.natpis}
        {polje.obavezno && <span className="ml-1 text-red-600">*</span>}
      </label>
      {polje.opis && <p className="text-xs text-stone-500">{polje.opis}</p>}
      {children}
    </div>
  );
}

/**
 * Fascikla po nameni polja, ne jedna za sve.
 *
 * Hero slika ide u profil sa 4 MB i 2000×1200, ikona u profil sa 256 KB i
 * 256×256. Da sve ide u istu fasciklu, ikona bi se čuvala kao da je hero i
 * stranica bi vukla desetostruko veći fajl nego što joj treba.
 */
function folderZaPolje(kljuc: string): string {
  if (kljuc === "slike" || kljuc === "slika" || kljuc === "pozadinskaSlika") {
    return "sekcije-hero";
  }
  if (kljuc === "ikona" || kljuc === "motiv" || kljuc === "oznaka") {
    return "sekcije-ikona";
  }
  return "sekcije-kartica";
}

const KLASA_UNOSA =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none disabled:bg-stone-100";

export function PoljeObrasca({
  polje,
  vrednost,
  onChange,
  greska,
  disabled = false,
}: PoljeProps) {
  const greskaIspod = greska ? (
    <p className="text-xs text-red-600">{greska}</p>
  ) : null;

  switch (polje.tip) {
    case "tekst":
      return (
        <Natpis polje={polje}>
          <input
            type="text"
            value={typeof vrednost === "string" ? vrednost : ""}
            maxLength={polje.maxDuzina}
            disabled={disabled}
            onChange={(dogadjaj) => onChange(dogadjaj.target.value)}
            className={KLASA_UNOSA}
          />
          {greskaIspod}
        </Natpis>
      );

    case "tekstLok":
      return (
        <div className="space-y-1">
          <LocalizedInput
            label={polje.natpis}
            value={kaoLok(vrednost)}
            onChange={onChange}
            required={polje.obavezno}
            disabled={disabled}
            error={greska}
          />
          {polje.opis && <p className="text-xs text-stone-500">{polje.opis}</p>}
        </div>
      );

    case "viselinijskiLok":
      return (
        <div className="space-y-1">
          <LocalizedTextarea
            label={polje.natpis}
            name={polje.kljuc}
            value={kaoLok(vrednost)}
            onChange={onChange}
            required={polje.obavezno}
            disabled={disabled}
            error={greska}
          />
          {polje.opis && <p className="text-xs text-stone-500">{polje.opis}</p>}
        </div>
      );

    case "bogatTekstLok": {
      const par = kaoLok(vrednost);
      return (
        <Natpis polje={polje}>
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-xs text-stone-500">Srpski</span>
              <BogatiTekst
                vrednost={par.sr}
                disabled={disabled}
                onChange={(html) => onChange({ ...par, sr: html })}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs text-stone-500">Engleski</span>
              <BogatiTekst
                vrednost={par.en}
                disabled={disabled}
                onChange={(html) => onChange({ ...par, en: html })}
              />
            </div>
          </div>
          {greskaIspod}
        </Natpis>
      );
    }

    case "broj":
      return (
        <Natpis polje={polje}>
          <input
            type="number"
            value={typeof vrednost === "number" ? vrednost : ""}
            min={polje.min}
            max={polje.max}
            step={polje.korak ?? 1}
            disabled={disabled}
            onChange={(dogadjaj) => {
              const tekst = dogadjaj.target.value;
              onChange(tekst === "" ? undefined : Number(tekst));
            }}
            className={KLASA_UNOSA}
          />
          {greskaIspod}
        </Natpis>
      );

    case "prekidac":
      return (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={vrednost === true}
              disabled={disabled}
              onChange={(dogadjaj) => onChange(dogadjaj.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            {polje.natpis}
          </label>
          {polje.opis && <p className="text-xs text-stone-500">{polje.opis}</p>}
          {greskaIspod}
        </div>
      );

    case "izbor":
      return (
        <Natpis polje={polje}>
          <select
            value={typeof vrednost === "string" ? vrednost : ""}
            disabled={disabled}
            onChange={(dogadjaj) => onChange(dogadjaj.target.value)}
            className={KLASA_UNOSA}
          >
            {polje.opcije.map((opcija) => (
              <option key={opcija.vrednost} value={opcija.vrednost}>
                {opcija.natpis}
              </option>
            ))}
          </select>
          {greskaIspod}
        </Natpis>
      );

    case "bojaPozadine":
    case "bojaUkrasa": {
      // Zatvorena lista tokena, ne birač boje. Slobodan HEX bi zaobišao i
      // proveru kontrasta i paletu iz podešavanja.
      const tokeni =
        polje.tip === "bojaPozadine" ? TOKENI_POZADINE : TOKENI_UKRASA;
      return (
        <Natpis polje={polje}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tokeni).map(([kljuc, heks]) => (
              <button
                key={kljuc}
                type="button"
                disabled={disabled}
                aria-pressed={vrednost === kljuc}
                onClick={() => onChange(kljuc)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                  vrednost === kljuc
                    ? "border-stone-800 bg-stone-100 font-medium"
                    : "border-stone-300"
                }`}
              >
                <span
                  className="h-4 w-4 rounded border border-stone-300"
                  style={{ backgroundColor: heks }}
                />
                {kljuc}
              </button>
            ))}
          </div>
          {greskaIspod}
        </Natpis>
      );
    }

    case "veza": {
      const veza =
        typeof vrednost === "object" && vrednost !== null
          ? (vrednost as Record<string, unknown>)
          : {};
      return (
        <Natpis polje={polje}>
          <input
            type="text"
            value={typeof veza.url === "string" ? veza.url : ""}
            placeholder="/nosnje/sumadija, #sadrzaj ili https://…"
            disabled={disabled}
            onChange={(dogadjaj) =>
              onChange({ ...veza, url: dogadjaj.target.value })
            }
            className={KLASA_UNOSA}
          />
          <label className="mt-1 flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={veza.noviTab === true}
              disabled={disabled}
              onChange={(dogadjaj) =>
                onChange({ ...veza, noviTab: dogadjaj.target.checked })
              }
              className="h-3.5 w-3.5 rounded border-stone-300"
            />
            Otvori u novom tabu
          </label>
          {greskaIspod}
        </Natpis>
      );
    }

    case "upitProizvoda": {
      const upit =
        typeof vrednost === "object" && vrednost !== null
          ? (vrednost as Record<string, unknown>)
          : {};
      return (
        <Natpis polje={polje}>
          <div className="flex gap-2">
            <select
              value={typeof upit.izvor === "string" ? upit.izvor : "izdvojeno"}
              disabled={disabled}
              onChange={(dogadjaj) =>
                onChange({ ...upit, izvor: dogadjaj.target.value })
              }
              className={KLASA_UNOSA}
            >
              {IZVORI_PROIZVODA.map((izvor) => (
                <option key={izvor} value={izvor}>
                  {izvor}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={24}
              value={typeof upit.broj === "number" ? upit.broj : 4}
              disabled={disabled}
              onChange={(dogadjaj) =>
                onChange({ ...upit, broj: Number(dogadjaj.target.value) })
              }
              className={`${KLASA_UNOSA} w-24`}
              aria-label="Broj proizvoda"
            />
          </div>
          {greskaIspod}
        </Natpis>
      );
    }

    case "medij":
      return (
        <Natpis polje={polje}>
          <MedijatekaPicker
            vrednost={vrednost}
            folder={folderZaPolje(polje.kljuc)}
            disabled={disabled}
            onChange={(nova) => onChange(nova ?? undefined)}
          />
          {greskaIspod}
        </Natpis>
      );

    case "medijLista": {
      // Lista slika ima svoje prazno mesto na kraju: bez njega se prva slika ne
      // može dodati, jer nema šta da se izmeni.
      const stavke: unknown[] = Array.isArray(vrednost) ? [...vrednost] : [];
      const mestaSlobodno = stavke.length < polje.maxStavki;

      return (
        <Natpis polje={polje}>
          <div className="space-y-3">
            {stavke.map((stavka, indeks) => (
              <MedijatekaPicker
                key={indeks}
                vrednost={stavka}
                folder={folderZaPolje(polje.kljuc)}
                disabled={disabled}
                onChange={(nova) => {
                  const sledece = [...stavke];
                  if (nova === null) sledece.splice(indeks, 1);
                  else sledece[indeks] = nova;
                  onChange(sledece);
                }}
              />
            ))}

            {mestaSlobodno && (
              <MedijatekaPicker
                vrednost={null}
                folder={folderZaPolje(polje.kljuc)}
                disabled={disabled}
                onChange={(nova) => {
                  if (nova) onChange([...stavke, nova]);
                }}
              />
            )}

            <p className="text-xs text-stone-500">
              {stavke.length} / {polje.maxStavki}
            </p>
          </div>
          {greskaIspod}
        </Natpis>
      );
    }

    case "lista":
      // Liste ima `ListaObrasca`, jer traže dodavanje, brisanje i pomeranje
      // stavki; ovde bi se ugnezdile bez kontrola.
      return null;

    default: {
      // Iscrpna provera: novi tip polja u registru obara prevođenje ovde,
      // umesto da tiho nestane iz obrasca.
      const nepokriveno: never = polje;
      void nepokriveno;
      return null;
    }
  }
}
