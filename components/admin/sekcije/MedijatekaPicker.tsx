"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ImageOff, Loader2, Upload, X } from "lucide-react";
import { LocalizedInput } from "@/components/admin/LocalizedInput";
import { DOZVOLJENI_MIME, profilZaFolder } from "@/lib/media/profili";

/**
 * Birač slike iz medijateke, sa otpremanjem.
 *
 * `alt` je deo vrednosti, ne zasebno polje koje se zaboravi. Validator odbija
 * sliku bez opisa osim kad je izričito označena kao dekorativna — zato prekidač
 * „dekorativna“ stoji odmah uz polje za opis, a ne negde drugde.
 */

export interface VrednostMedija {
  putanja: string;
  alt: { sr: string; en: string };
  dekorativna: boolean;
}

interface Asset {
  id: string;
  path: string;
  width: number;
  height: number;
}

const PRAZNA: VrednostMedija = {
  putanja: "",
  alt: { sr: "", en: "" },
  dekorativna: false,
};

export function MedijatekaPicker({
  vrednost,
  onChange,
  folder,
  disabled = false,
}: {
  vrednost: unknown;
  onChange: (vrednost: VrednostMedija | null) => void;
  folder: string;
  disabled?: boolean;
}) {
  const tekuca: VrednostMedija =
    typeof vrednost === "object" && vrednost !== null
      ? { ...PRAZNA, ...(vrednost as Partial<VrednostMedija>) }
      : PRAZNA;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [otvorena, setOtvorena] = useState(false);
  const [ucitavanje, setUcitavanje] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = useCallback(async () => {
    setUcitavanje(true);
    setGreska(null);
    try {
      const odgovor = await fetch(
        `/api/admin/medijateka?folder=${encodeURIComponent(folder)}`,
      );
      if (!odgovor.ok) throw new Error("neuspeh");
      const podaci = (await odgovor.json()) as { assets: Asset[] };
      setAssets(podaci.assets);
    } catch {
      setGreska("Medijateka se ne može učitati.");
    } finally {
      setUcitavanje(false);
    }
  }, [folder]);

  useEffect(() => {
    if (otvorena) void ucitaj();
  }, [otvorena, ucitaj]);

  const otpremi = async (fajl: File) => {
    const profil = profilZaFolder(folder);
    if (!profil) {
      setGreska("Nepoznata fascikla za otpremanje.");
      return;
    }
    if (!DOZVOLJENI_MIME.includes(fajl.type)) {
      setGreska("Dozvoljene su samo slike: JPEG, PNG, WebP, GIF ili AVIF.");
      return;
    }
    if (fajl.size > profil.maxBajtova) {
      setGreska(
        `Slika je prevelika. Za „${folder}” granica je ${Math.round(profil.maxBajtova / 1_048_576)} MB.`,
      );
      return;
    }

    setUcitavanje(true);
    setGreska(null);
    try {
      const telo = new FormData();
      telo.append("file", fajl);
      telo.append("folder", folder);
      const odgovor = await fetch("/api/admin/upload", {
        method: "POST",
        body: telo,
      });
      const podaci = (await odgovor.json().catch(() => null)) as {
        path?: string;
        error?: string;
      } | null;

      if (!odgovor.ok || typeof podaci?.path !== "string") {
        setGreska(podaci?.error ?? "Otpremanje nije uspelo.");
        return;
      }

      // Odabir odmah posle otpremanja: alt ostaje prazan i namerno se traži od
      // korisnika, jer je jedini koji zna šta je na slici.
      onChange({ ...tekuca, putanja: podaci.path });
      await ucitaj();
    } catch {
      setGreska("Otpremanje nije uspelo.");
    } finally {
      setUcitavanje(false);
    }
  };

  return (
    <div className="space-y-2">
      {tekuca.putanja ? (
        <div className="flex items-start gap-3 rounded-lg border border-stone-200 p-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-stone-100">
            <Image
              src={tekuca.putanja}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              quality={75}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-xs text-stone-500">{tekuca.putanja}</p>

            <LocalizedInput
              label="Opis slike (alt)"
              value={tekuca.alt}
              disabled={disabled || tekuca.dekorativna}
              onChange={(alt) => onChange({ ...tekuca, alt })}
            />

            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={tekuca.dekorativna}
                disabled={disabled}
                onChange={(dogadjaj) =>
                  onChange({ ...tekuca, dekorativna: dogadjaj.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-stone-300"
              />
              Slika je čisto ukrasna — čitač ekrana je preskače
            </label>
          </div>
          <button
            type="button"
            aria-label="Ukloni sliku"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="rounded p-1 text-stone-500 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500">
          <ImageOff className="h-4 w-4" aria-hidden="true" />
          Nema slike. Sekcija do tada koristi tkanu šaru.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOtvorena((prethodno) => !prethodno)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-700"
        >
          {otvorena ? "Zatvori medijateku" : "Izaberi iz medijateke"}
        </button>

        <label className="cursor-pointer rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-700">
          <span className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Otpremi novu
          </span>
          <input
            type="file"
            accept={DOZVOLJENI_MIME.join(",")}
            disabled={disabled || ucitavanje}
            className="hidden"
            onChange={(dogadjaj) => {
              const fajl = dogadjaj.target.files?.[0];
              dogadjaj.target.value = "";
              if (fajl) void otpremi(fajl);
            }}
          />
        </label>

        {ucitavanje && (
          <Loader2 className="h-4 w-4 animate-spin text-stone-400" aria-label="Radi se" />
        )}
      </div>

      {greska && <p className="text-xs text-red-600">{greska}</p>}

      {otvorena && (
        <div className="grid grid-cols-4 gap-2 rounded-lg border border-stone-200 p-2 sm:grid-cols-6">
          {assets.length === 0 && !ucitavanje && (
            <p className="col-span-full px-1 py-3 text-xs text-stone-500">
              U ovoj fascikli još nema nijedne slike.
            </p>
          )}
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange({ ...tekuca, putanja: asset.path });
                setOtvorena(false);
              }}
              className={`relative aspect-square overflow-hidden rounded border ${
                tekuca.putanja === asset.path
                  ? "border-stone-800 ring-1 ring-stone-800"
                  : "border-stone-200"
              }`}
              title={asset.path}
            >
              <Image
                src={asset.path}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
                quality={75}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
