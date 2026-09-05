"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

/**
 * YouTube okvir koji se učitava tek na klik.
 *
 * Do klika stranica ne pravi nijedan zahtev ka YouTube-u i ne prima nijedan
 * njihov kolačić — vidi se samo slika. To nije samo privatnost: `iframe` na
 * početnoj vuče nekoliko stotina kilobajta i pomera LCP, a većina posetilaca ga
 * nikad ne pusti.
 *
 * `frame-src` u `next.config.ts` već dozvoljava `https://www.youtube.com`, pa
 * ova komponenta NE traži izmenu CSP-a. Zato se koristi baš taj domen, a ne
 * `youtube-nocookie.com`, koji bi je tražio.
 */

const ODNOSI: Record<string, string> = {
  "16-9": "aspect-video",
  "9-16": "aspect-[9/16]",
  "1-1": "aspect-square",
};

export function VideoOkidac({
  youtubeId,
  slika,
  alt,
  odnos,
  naslov,
}: {
  youtubeId: string;
  /** Sopstvena slika iz medijateke; kad je nema, uzima se YouTube-ov poster. */
  slika: string | null;
  alt: string;
  odnos: string;
  naslov: string;
}) {
  const [pusten, setPusten] = useState(false);
  const klasaOdnosa = ODNOSI[odnos] ?? ODNOSI["16-9"];
  const poster = slika ?? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

  return (
    <div
      className={`relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-black ${klasaOdnosa}`}
    >
      {pusten ? (
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={naslov}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPusten(true)}
          className="group absolute inset-0 h-full w-full"
          aria-label={`Pusti video: ${naslov}`}
        >
          <Image
            src={poster}
            alt={alt}
            fill
            sizes="(max-width: 1023px) 100vw, 896px"
            className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
          />
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/90 shadow-lg transition-transform group-hover:scale-105"
          >
            <Play className="ml-1 h-7 w-7 text-white" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
