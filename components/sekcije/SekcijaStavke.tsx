import { citajLok } from "@/lib/sekcije/polja";
import { tekstIzHtmla } from "@/lib/sekcije/prikaz";
import { serializeJsonLd } from "@/lib/security/json-ld";
import { ucitajPitanja, type PitanjeIOdgovor } from "@/lib/db/jeftini-tipovi";
import { MestodrzacProizvoda } from "@/components/ukras";
import { Brojac } from "./Brojac";
import { Harmonika } from "./Harmonika";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import {
  KLASE_NASLOVA,
  KLASE_PRIGUSENOG,
  klaseMreze,
  shemaZa,
  spoji,
} from "./stilovi";
import { citajOkvir, izbor, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Ponavljajuće stavke — jedan repeater umesto šest zasebnih WoodMart elemenata.
 *
 * `traka` je pojas vrednosti, `koraci` numerisani postupak, `kartice` opšti
 * infobox, `harmonika` pitanja i odgovori, `linija` vremenska linija, `brojaci`
 * istaknuti brojevi. Sve dele istu šemu stavke; tabela i cenovnik namerno NISU
 * ovde nego su zasebni tipovi, jer stavka repeatera ne može da nosi ni redove
 * sa zaglavljem ni cenu sa listom osobina.
 *
 * Izvor `faq` čita `ChatFAQ` — isti model koji puni chat widžet — i zato ima
 * OBAVEZAN filter po kategoriji. Bez njega bi pitanje napisano za chat odmah
 * osvanulo i na stranici. Validator to isto pravilo drži i pri upisu.
 */

const PRIKAZI = ["traka", "kartice", "koraci", "harmonika", "linija", "brojaci"] as const;

/** Najviše pitanja iz jedne kategorije; spisak duži od toga niko ne čita. */
const MAX_PITANJA = 20;

export async function SekcijaStavke({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const prikaz = izbor(config, "prikaz", PRIKAZI, "kartice");
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "4");
  const shema = shemaZa(okvir.pozadina);
  const zaglavlje = <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />;

  /* ---------------- harmonika, po potrebi iz baze ---------------- */

  if (prikaz === "harmonika") {
    const izvor = izbor(config, "izvor", ["rucno", "faq"] as const, "rucno");
    const kategorija = typeof config.faqKategorija === "string" ? config.faqKategorija : "";

    let pitanja: PitanjeIOdgovor[];
    if (izvor === "faq") {
      // Prazna kategorija ne sme da postane „sva pitanja“: validator je ne
      // dozvoljava, ali red je mogao ući u bazu i mimo njega.
      if (kategorija.trim().length === 0) return null;
      try {
        pitanja = await ucitajPitanja(kategorija, MAX_PITANJA);
      } catch (greska) {
        console.error("Ne mogu da učitam pitanja za sekciju:", greska);
        return null;
      }
    } else {
      pitanja = stavkeListe(config, "stavke").map((stavka, i) => ({
        id: `rucno-${i}`,
        pitanje: citajLok(stavka.naslov, jezik),
        // Ručno upisan odgovor je običan tekst iz `tekstLok`, ne HTML.
        odgovor: `<p>${citajLok(stavka.tekst, jezik)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</p>`,
      }));
    }

    const upotrebljiva = pitanja.filter((p) => p.pitanje.trim().length > 0);
    if (upotrebljiva.length === 0) return null;

    const strukturirano = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: upotrebljiva.map((p) => ({
        "@type": "Question",
        name: p.pitanje,
        acceptedAnswer: { "@type": "Answer", text: tekstIzHtmla(p.odgovor) },
      })),
    };

    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <Harmonika
          stavke={upotrebljiva}
          klasaNaslova={KLASE_NASLOVA[shema]}
          klasaTeksta={KLASE_PRIGUSENOG[shema]}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(strukturirano) }}
        />
      </OkvirSekcije>
    );
  }

  /* ---------------- ostali prikazi, uvek ručne stavke ---------------- */

  const stavke = stavkeListe(config, "stavke");
  if (stavke.length === 0) return null;

  if (prikaz === "traka") {
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <ul className={klaseMreze("traka", kolone)}>
          {stavke.map((stavka, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span className="mt-0.5 h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border">
                <MestodrzacProizvoda
                  redni={typeof stavka.motiv === "number" ? stavka.motiv : i}
                />
              </span>
              <span>
                <span
                  className={spoji(
                    "block font-display text-[1.02rem] font-bold",
                    KLASE_NASLOVA[shema],
                  )}
                >
                  {citajLok(stavka.naslov, jezik)}
                </span>
                <span
                  className={spoji(
                    "mt-0.5 block text-[0.86rem] leading-snug",
                    KLASE_PRIGUSENOG[shema],
                  )}
                >
                  {citajLok(stavka.tekst, jezik)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </OkvirSekcije>
    );
  }

  if (prikaz === "koraci") {
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <ol className={klaseMreze("koraci", kolone)}>
          {stavke.map((stavka, i) => (
            <li key={i}>
              {typeof stavka.oznaka === "string" && stavka.oznaka && (
                <span className="font-display text-[2.1rem] font-bold leading-none text-zlatna/45">
                  {stavka.oznaka}
                </span>
              )}
              <h3
                className={spoji(
                  "mt-3 font-display text-[1.15rem] font-bold",
                  KLASE_NASLOVA[shema],
                )}
              >
                {citajLok(stavka.naslov, jezik)}
              </h3>
              <p
                className={spoji(
                  "mt-2 text-[0.92rem] leading-relaxed",
                  KLASE_PRIGUSENOG[shema],
                )}
              >
                {citajLok(stavka.tekst, jezik)}
              </p>
            </li>
          ))}
        </ol>
      </OkvirSekcije>
    );
  }

  if (prikaz === "linija") {
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        {/* Linija je `::before` na listi, a tačke su na stavkama: tako
            dekoracija ne ulazi u stablo pristupačnosti kao prazan element. */}
        <ol className="relative mx-auto max-w-3xl space-y-8 border-l-2 border-zlatna/35 pl-8">
          {stavke.map((stavka, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[2.3rem] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-zlatna bg-podloga"
              />
              {typeof stavka.oznaka === "string" && stavka.oznaka && (
                <span
                  className={spoji(
                    "block text-[0.8rem] font-semibold uppercase tracking-wider",
                    KLASE_PRIGUSENOG[shema],
                  )}
                >
                  {stavka.oznaka}
                </span>
              )}
              <h3
                className={spoji(
                  "mt-1 font-display text-[1.12rem] font-bold",
                  KLASE_NASLOVA[shema],
                )}
              >
                {citajLok(stavka.naslov, jezik)}
              </h3>
              <p
                className={spoji(
                  "mt-1.5 text-[0.92rem] leading-relaxed",
                  KLASE_PRIGUSENOG[shema],
                )}
              >
                {citajLok(stavka.tekst, jezik)}
              </p>
            </li>
          ))}
        </ol>
      </OkvirSekcije>
    );
  }

  if (prikaz === "brojaci") {
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <ul className={klaseMreze("koraci", kolone)}>
          {stavke.map((stavka, i) => (
            <li key={i} className="text-center">
              <Brojac
                vrednost={typeof stavka.oznaka === "string" ? stavka.oznaka : ""}
                className="block font-display text-[2.6rem] font-bold leading-none text-zlatna"
              />
              <h3
                className={spoji(
                  "mt-3 font-display text-[1.05rem] font-bold",
                  KLASE_NASLOVA[shema],
                )}
              >
                {citajLok(stavka.naslov, jezik)}
              </h3>
              <p
                className={spoji("mt-1 text-[0.88rem] leading-snug", KLASE_PRIGUSENOG[shema])}
              >
                {citajLok(stavka.tekst, jezik)}
              </p>
            </li>
          ))}
        </ul>
      </OkvirSekcije>
    );
  }

  return (
    <OkvirSekcije config={okvir}>
      {zaglavlje}
      <ul className={klaseMreze("kartice", kolone)}>
        {stavke.map((stavka, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-2xl border border-border bg-povrsina p-5 shadow-sm"
          >
            <span className="mb-4 block h-12 w-12 overflow-hidden rounded-lg border border-border">
              <MestodrzacProizvoda
                redni={typeof stavka.motiv === "number" ? stavka.motiv : i}
              />
            </span>
            <h3
              className={spoji(
                "font-display text-[1.08rem] font-bold leading-snug",
                KLASE_NASLOVA[shema],
              )}
            >
              {citajLok(stavka.naslov, jezik)}
            </h3>
            <p className={spoji("mt-2 text-[0.9rem] leading-relaxed", KLASE_PRIGUSENOG[shema])}>
              {citajLok(stavka.tekst, jezik)}
            </p>
          </li>
        ))}
      </ul>
    </OkvirSekcije>
  );
}
