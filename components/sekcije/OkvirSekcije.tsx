import type { ReactNode } from "react";
import { Podloga, Traka } from "@/components/ukras";
import type { VrstaSare } from "@/components/ukras";
import { UOkviru } from "./UOkviru";
import {
  KLASE_ANIMACIJE,
  KLASE_POZADINE,
  KLASE_RAZMAKA,
  bojaUkrasa,
  spoji,
} from "./stilovi";
import type { KonfiguracijaOkvira } from "./tipovi";

/**
 * Zajednički okvir svake sekcije: pozadina, tkana šara, razdelnici, razmak i
 * ulazna animacija.
 *
 * Ovaj omotač namerno ne uvodi dodatni DOM sloj oko sadržaja kad animacija
 * nije uključena — svaki suvišan `div` unutar `container-wide` lomi zatečene
 * razmake i mreže.
 */
export function OkvirSekcije({
  config,
  children,
}: {
  config: KonfiguracijaOkvira;
  children: ReactNode;
}) {
  const imaSaru = config.sara !== "bez";
  const klasaAnimacije = KLASE_ANIMACIJE[config.animacija] ?? "";

  const razdelnik = (mesto: "gore" | "dole") => {
    const vrsta = mesto === "gore" ? config.razdelnikGore : config.razdelnikDole;
    if (vrsta !== "traka") return null;
    return (
      <Traka
        boja={bojaUkrasa(config.razdelnikBoja)}
        bojaDruga={bojaUkrasa(config.razdelnikBojaDruga)}
        visina={config.razdelnikVisina}
      />
    );
  };

  const sadrzaj =
    klasaAnimacije && config.animacija !== "bez" ? (
      <UOkviru klasa={klasaAnimacije}>{children}</UOkviru>
    ) : (
      children
    );

  return (
    <section
      id={config.sidro || undefined}
      className={spoji(
        imaSaru && "relative overflow-hidden",
        KLASE_POZADINE[config.pozadina],
        config.razdelnikGore === "linija" && "border-t border-border",
        config.razdelnikDole === "linija" && "border-b border-border",
      )}
    >
      {razdelnik("gore")}

      {imaSaru && (
        <Podloga
          vrsta={config.sara as VrstaSare}
          velicina={config.saraVelicina}
          prozirnost={config.saraProzirnost}
          boja={bojaUkrasa(config.saraBoja)}
          bojaDruga={bojaUkrasa(config.saraBojaDruga)}
        />
      )}

      <div
        className={spoji(
          "container-wide",
          imaSaru && "relative",
          KLASE_RAZMAKA[config.razmak],
        )}
      >
        {sadrzaj}
      </div>

      {razdelnik("dole")}
    </section>
  );
}
