"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";

/**
 * Harmonika sa pitanjima i odgovorima.
 *
 * Radix nosi tastaturu i `aria-expanded`, pa se to ne piše ponovo. `type`
 * ostaje „single“ sa `collapsible`: dva otvorena odgovora jedan pored drugog
 * gube smisao spiska pitanja.
 *
 * Odgovor stiže kao HTML koji je već prošao kroz allow-listu na granici
 * čitanja iz baze; komponenta ga ne čisti ponovo i ne sme sama da odlučuje šta
 * je bezbedno.
 */
export function Harmonika({
  stavke,
  klasaNaslova,
  klasaTeksta,
}: {
  stavke: { id: string; pitanje: string; odgovor: string }[];
  klasaNaslova: string;
  klasaTeksta: string;
}) {
  return (
    <Accordion type="single" collapsible className="mx-auto max-w-3xl">
      {stavke.map((stavka) => (
        <AccordionItem key={stavka.id} value={stavka.id}>
          <AccordionTrigger className={`text-left font-display ${klasaNaslova}`}>
            {stavka.pitanje}
          </AccordionTrigger>
          <AccordionContent>
            <div
              className={`space-y-3 text-[0.95rem] leading-relaxed ${klasaTeksta} [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
              dangerouslySetInnerHTML={{ __html: stavka.odgovor }}
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
