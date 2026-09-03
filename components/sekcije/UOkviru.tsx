"use client";

import type { ReactNode } from "react";
import { useUOkviru } from "@/hooks/useUOkviru";

/**
 * Omotač za ulaznu animaciju sekcije. Sva logika je u `useUOkviru`; ovde je
 * samo prevod stanja u klasu, da se pravilo „sadržaj nikad nije nevidljiv“
 * nalazi na jednom mestu.
 */
export function UOkviru({
  klasa,
  children,
}: {
  klasa: string;
  children: ReactNode;
}) {
  const { ref, stanje } = useUOkviru<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={
        stanje === "pripremljeno" ? "opacity-0" : stanje === "prikazano" ? klasa : undefined
      }
    >
      {children}
    </div>
  );
}
