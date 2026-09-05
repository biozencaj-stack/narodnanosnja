import { Fragment } from "react";
import { citajLok } from "@/lib/sekcije/polja";
import {
  KLASE_NADNASLOVA,
  KLASE_NASLOVA,
  KLASE_PRIGUSENOG,
  shemaZa,
  spoji,
} from "./stilovi";
import type { KonfiguracijaOkvira } from "./tipovi";

/**
 * Zaglavlje sekcije: nadnaslov, naslov sa istaknutom rečju i tekst ispod.
 *
 * Tri varijante odgovaraju trima ritmovima koje zatečena početna već koristi.
 * One se NE biraju u admin panelu — izvedene su iz tipa sekcije i prikaza, da
 * vlasnik ne mora da bira između „mb-10“ i „mb-12“.
 *
 * Usput se uklanja zatečena nedoslednost: uvodni blok, koraci izrade i priča o
 * krajevima imali su nadnaslov, a kategorije i izdvojeni proizvodi nisu.
 * Sada je to jedno polje koje sekcija ima ili nema.
 */

export type VarijantaZaglavlja = "uvodna" | "sekcijska" | "istaknuta";

const KLASE_NADNASLOVA_PO_VARIJANTI: Record<VarijantaZaglavlja, string> = {
  uvodna: "mb-5",
  sekcijska: "mb-3",
  istaknuta: "mb-4",
};

const KLASE_NASLOVA_PO_VARIJANTI: Record<VarijantaZaglavlja, string> = {
  uvodna: "font-display text-[2.4rem] font-bold leading-[1.1] sm:text-5xl lg:text-[3.4rem]",
  sekcijska: "font-display text-3xl font-bold lg:text-4xl",
  istaknuta: "font-display text-3xl font-bold lg:text-4xl",
};

const KLASE_TEKSTA_PO_VARIJANTI: Record<VarijantaZaglavlja, string> = {
  uvodna: "mt-6 max-w-md text-[1.05rem] leading-relaxed",
  sekcijska: "mt-3",
  istaknuta: "mt-5 text-[1.02rem] leading-relaxed",
};

/**
 * Prelom reda u naslovu ostaje prelom, a istaknuta reč dobija boju. Reč se
 * boji samo u prvom pojavljivanju, da se naslov sa ponovljenom rečju ne
 * „ušara“ celom dužinom.
 */
function naslovSaIstaknutim(
  tekst: string,
  rec: string,
  klasaIsticanja: string,
) {
  const redovi = tekst.split("\n");
  let iskorisceno = false;

  return redovi.map((red, i) => {
    let sadrzaj: React.ReactNode = red;

    if (rec && !iskorisceno) {
      const mesto = red.indexOf(rec);
      if (mesto !== -1) {
        iskorisceno = true;
        sadrzaj = (
          <>
            {red.slice(0, mesto)}
            <span className={klasaIsticanja}>{rec}</span>
            {red.slice(mesto + rec.length)}
          </>
        );
      }
    }

    return (
      <Fragment key={i}>
        {i > 0 && <br />}
        {sadrzaj}
      </Fragment>
    );
  });
}

export function ZaglavljeSekcije({
  okvir,
  jezik,
  varijanta,
}: {
  okvir: KonfiguracijaOkvira;
  jezik: string;
  varijanta: VarijantaZaglavlja;
}) {
  const shema = shemaZa(okvir.pozadina);
  const nadnaslov = citajLok(okvir.nadnaslov, jezik);
  const naslov = citajLok(okvir.naslov, jezik);
  const tekst = citajLok(okvir.tekst, jezik);

  if (!nadnaslov && !naslov && !tekst) return null;

  const Naslov = okvir.nivoNaslova;
  const klasaIsticanja = shema === "svetla" ? "text-zlatna-jaka" : "text-primary";

  const sadrzaj = (
    <>
      {nadnaslov && (
        <span
          className={spoji(
            KLASE_NADNASLOVA_PO_VARIJANTI[varijanta],
            "inline-block text-[0.7rem] font-bold uppercase tracking-[0.22em]",
            KLASE_NADNASLOVA[shema],
          )}
        >
          {nadnaslov}
        </span>
      )}

      {naslov && (
        <Naslov
          className={spoji(KLASE_NASLOVA_PO_VARIJANTI[varijanta], KLASE_NASLOVA[shema])}
        >
          {naslovSaIstaknutim(naslov, okvir.istaknutaRec, klasaIsticanja)}
        </Naslov>
      )}

      {tekst && (
        <p className={spoji(KLASE_TEKSTA_PO_VARIJANTI[varijanta], KLASE_PRIGUSENOG[shema])}>
          {tekst}
        </p>
      )}
    </>
  );

  // Uvodna i istaknuta varijanta žive unutar rasporeda koji postavlja sama
  // sekcija; samo sekcijsko zaglavlje nosi sopstveni razmak do sadržaja.
  if (varijanta !== "sekcijska") return sadrzaj;

  return (
    <div className={spoji(nadnaslov ? "mb-12" : "mb-10", "max-w-xl")}>{sadrzaj}</div>
  );
}
