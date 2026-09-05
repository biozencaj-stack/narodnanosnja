"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { DOZVOLJENI_FOLDERI } from "@/lib/media/profili";

interface Asset {
  id: string;
  path: string;
  folder: string;
  width: number;
  height: number;
  bytes: number;
  _count?: { usages: number };
}

interface Upotreba {
  sectionId: string;
  pageKey: string;
  kind: string;
  polje: string;
}

function kilobajti(bajtova: number): string {
  return bajtova >= 1_048_576
    ? `${(bajtova / 1_048_576).toFixed(1)} MB`
    : `${Math.round(bajtova / 1024)} KB`;
}

export function EkranMedijateke() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folder, setFolder] = useState<string>("");
  const [ucitavanje, setUcitavanje] = useState(true);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [upotrebe, setUpotrebe] = useState<Upotreba[] | null>(null);

  const ucitaj = useCallback(async () => {
    setUcitavanje(true);
    try {
      const adresa = folder
        ? `/api/admin/medijateka?folder=${encodeURIComponent(folder)}`
        : "/api/admin/medijateka";
      const odgovor = await fetch(adresa);
      if (!odgovor.ok) throw new Error("neuspeh");
      const podaci = (await odgovor.json()) as { assets: Asset[] };
      setAssets(podaci.assets);
      setGreska(null);
    } catch {
      setGreska("Medijateka se ne može učitati.");
    } finally {
      setUcitavanje(false);
    }
  }, [folder]);

  useEffect(() => {
    void ucitaj();
  }, [ucitaj]);

  const obrisi = async (asset: Asset) => {
    if (
      !window.confirm(
        `Obrisati sliku ${asset.path}? Ovo se ne može opozvati.`,
      )
    ) {
      return;
    }

    setPoruka(null);
    setGreska(null);
    setUpotrebe(null);

    const odgovor = await fetch(`/api/admin/medijateka/${asset.id}`, {
      method: "DELETE",
    });
    const podaci = (await odgovor.json().catch(() => null)) as {
      error?: string;
      upotrebe?: Upotreba[];
    } | null;

    if (odgovor.status === 409 && podaci?.upotrebe) {
      // Spisak sekcija, ne golo „ne može“: bez njega administrator ne zna gde
      // da ukloni sliku, pa je jedini put ka brisanju pogađanje po ekranima.
      setUpotrebe(podaci.upotrebe);
      setGreska(podaci.error ?? "Slika je u upotrebi.");
      return;
    }

    if (!odgovor.ok) {
      setGreska(podaci?.error ?? "Brisanje nije uspelo.");
      return;
    }

    setPoruka("Slika je uklonjena iz medijateke.");
    await ucitaj();
  };

  return (
    <div className="space-y-4">
      {(poruka || greska) && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            greska
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <p>{greska ?? poruka}</p>
          {upotrebe && upotrebe.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {upotrebe.map((upotreba) => (
                <li key={`${upotreba.sectionId}-${upotreba.polje}`}>
                  {upotreba.pageKey} → {upotreba.kind} → {upotreba.polje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-stone-600" htmlFor="fascikla">
          Fascikla
        </label>
        <select
          id="fascikla"
          value={folder}
          onChange={(dogadjaj) => setFolder(dogadjaj.target.value)}
          className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="">sve</option>
          {DOZVOLJENI_FOLDERI.map((ime) => (
            <option key={ime} value={ime}>
              {ime}
            </option>
          ))}
        </select>
        {ucitavanje && (
          <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
        )}
      </div>

      {!ucitavanje && assets.length === 0 && (
        <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
          Nema nijedne slike. Slike se dodaju otpremanjem iz obrasca sekcije.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {assets.map((asset) => (
          <li
            key={asset.id}
            className="overflow-hidden rounded-xl border border-stone-200 bg-white"
          >
            <div className="relative aspect-square bg-stone-100">
              <Image
                src={asset.path}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 200px"
                className="object-cover"
                quality={75}
              />
            </div>
            <div className="space-y-1 p-2">
              <p className="truncate text-[11px] text-stone-500" title={asset.path}>
                {asset.path.split("/").pop()}
              </p>
              <p className="text-[11px] text-stone-400">
                {asset.width}×{asset.height} · {kilobajti(asset.bytes)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-500">
                  {asset._count?.usages
                    ? `u ${asset._count.usages} sekcija`
                    : "neupotrebljena"}
                </span>
                <button
                  type="button"
                  aria-label={`Obriši ${asset.path}`}
                  onClick={() => obrisi(asset)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
