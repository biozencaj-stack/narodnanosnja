"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Slika koja se pomera sporije od stranice.
 *
 * Preko `transform`, NIKAD preko `background-attachment: fixed`: taj svojstvo
 * iOS Safari ignoriše i slika ostane zaglavljena, što je gore od nepomične.
 *
 * Isključeno je ispod 1024 px i uz `prefers-reduced-motion`. Na telefonu efekat
 * troši bateriju i pravi trzanje pri skrolovanju, a dobija se par piksela
 * pomeraja koje niko ne primeti.
 *
 * Pomeraj se računa u `requestAnimationFrame`, a slušalac je `passive`, da
 * skrolovanje ostane glatko.
 */
export function Parallax({
  slika,
  alt,
  visina,
  children,
}: {
  slika: string;
  alt: string;
  visina: number;
  children?: React.ReactNode;
}) {
  const okvir = useRef<HTMLDivElement>(null);
  const [pomeraj, setPomeraj] = useState(0);

  useEffect(() => {
    const usko = window.matchMedia("(max-width: 1023px)");
    const manjeKretanja = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (usko.matches || manjeKretanja.matches) return;

    let zakazano = 0;
    const izracunaj = () => {
      zakazano = 0;
      const element = okvir.current;
      if (!element) return;
      const mere = element.getBoundingClientRect();
      const sredina = mere.top + mere.height / 2 - window.innerHeight / 2;
      // Petina razdaljine od sredine ekrana; preko toga se vidi ivica slike.
      setPomeraj(Math.max(-60, Math.min(60, sredina * -0.2)));
    };

    const naSkrol = () => {
      if (zakazano) return;
      zakazano = requestAnimationFrame(izracunaj);
    };

    izracunaj();
    window.addEventListener("scroll", naSkrol, { passive: true });
    window.addEventListener("resize", naSkrol, { passive: true });
    return () => {
      if (zakazano) cancelAnimationFrame(zakazano);
      window.removeEventListener("scroll", naSkrol);
      window.removeEventListener("resize", naSkrol);
    };
  }, []);

  return (
    <div
      ref={okvir}
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ height: `${visina}px` }}
    >
      <div
        className="absolute inset-x-0 -inset-y-[70px]"
        style={{ transform: `translate3d(0, ${pomeraj}px, 0)` }}
      >
        <Image src={slika} alt={alt} fill sizes="100vw" className="object-cover" priority={false} />
      </div>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 p-6 text-center">
          {children}
        </div>
      )}
    </div>
  );
}
