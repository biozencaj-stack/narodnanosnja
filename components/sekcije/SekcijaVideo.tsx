import { citajLok, OBRAZAC_YOUTUBE_ID } from "@/lib/sekcije/polja";
import { OkvirSekcije } from "./OkvirSekcije";
import { VideoOkidac } from "./VideoOkidac";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { citajOkvir, izbor, type Konfiguracija } from "./tipovi";

/**
 * Video — WoodMart „Video“.
 *
 * Konfiguracija nosi samo YouTube identifikator; adresu sastavlja renderer, pa
 * podatak nikad ne bira domen. Neispravan identifikator znači da se sekcija ne
 * prikazuje — bolje ništa nego prazan crni pravougaonik.
 *
 * MP4 iz medijateke NIJE podržan: upload ruta prima četiri image MIME tipa i
 * svaki fajl provlači kroz `sharp`, pa MP4 nikad ne bi ni dobio `MediaAsset`
 * red. Vimeo takođe nije — tražio bi izmenu `frame-src`. Oboje je zabeleženo
 * kao odluka vlasnika u `CLAUDE.md`.
 */
export function SekcijaVideo({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const youtubeId = typeof config.youtubeId === "string" ? config.youtubeId : "";
  if (!OBRAZAC_YOUTUBE_ID.test(youtubeId)) return null;

  const odnos = izbor(config, "odnos", ["16-9", "9-16", "1-1"] as const, "16-9");
  const slika =
    typeof config.slika === "object" && config.slika !== null
      ? ((config.slika as Record<string, unknown>).putanja as string | undefined)
      : undefined;
  const alt =
    typeof config.slika === "object" && config.slika !== null
      ? citajLok((config.slika as Record<string, unknown>).alt, jezik)
      : "";
  const naslov = citajLok(okvir.naslov, jezik) || "video";

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />
      <VideoOkidac
        youtubeId={youtubeId}
        slika={typeof slika === "string" ? slika : null}
        alt={alt}
        odnos={odnos}
        naslov={naslov}
      />
    </OkvirSekcije>
  );
}
