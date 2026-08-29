import type { Metadata } from "next";
import React from "react";
import { getStoreIdentity } from "@/lib/config/store-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: "Kako kupiti?",
    description: `Uputstvo za kupovinu na ${name} web shopu - izbor artikala, korpa, naručivanje i plaćanje.`,
  };
}

export default function UputstvoPage() {
  return (
    <div className="max-w-none">
      <h1>Kako kupiti?</h1>

      <h2>Izbor artikala</h2>
      <p>
        Na vrhu svake stranice nalazi se meni sa kategorijama artikala, klikom na željenu kategoriju
        otvoriće Vam se nova stranica sa artiklima iz odabrane kategorije. Sa leve strane ove stranice
        nalaze se svi filteri, klikom na jedan ili više filtera dobićete željeni rezultat filtracije.
      </p>
      <p>
        Ukoliko ne znate kojoj kategoriji pripada artikal koji Vas interesuje, možete iskoristiti polje
        za pretragu koje se nalazi u vrhu svake stranice sa desne strane. U polje možete ukucati šifru
        artikla, naziv artikla, boju artikla i sl.
      </p>
      <p>
        Ukoliko ste izlistali grupu artikala koja Vas interesuje, dodatne informacije o konkretnom
        artiklu možete videti klikom na fotografiju artikla. Izborom željene veličine artikal možete
        staviti u korpu klikom na dugme <strong>Dodaj u korpu</strong>.
      </p>

      <h2>Sadržaj korpe</h2>
      <p>
        Sadržaj vaše korpe možete pogledati u svakom trenutku klikom na sličicu korpe sa desne strane
        svake stranice. Artikle možete unositi u korpu sve dok ne naručite sve što želite. Artikle koje
        ste uneli u korpu možete izbaciti pojedinačno klikom na – (pored količine u kvadratiću).
      </p>

      <h2>Poručivanje artikala iz korpe</h2>
      <p>
        Da biste poručili artikle unete u korpu potrebno je da kliknete na dugme{" "}
        <strong>NASTAVI NA PLAĆANJE</strong>. Nakon ove operacije stići će Vam potvrdni mejl, na
        e-mail adresu koju ste ostavili prilikom registracije na sajt.
      </p>
      <p>
        Ukoliko niste registrovani neophodno je da se registrujete, ili obavite kupovinu bez
        registracije, popunjavanjem svih neophodnih podataka:
      </p>
      <ul>
        <li>Ime i prezime</li>
        <li>Mejl adresa i kontakt telefon</li>
        <li>Mesto i poštanski broj i zemlju</li>
        <li>Ulicu i kućni broj</li>
      </ul>

      <h2>Odabir načina plaćanja</h2>
      <p>U mogućnosti ste da odaberete:</p>
      <ul>
        <li>Plaćanje pouzećem gotovinski u trenutku isporuke</li>
        <li>Platnim karticama tokom procesa kupovine na sajtu</li>
      </ul>

      <h2>Završetak poručivanja</h2>
      <p>
        Klikom na dugme <strong>POTVRDI PORUDŽBINU</strong>, prikazaće Vam se obaveštenje o uspešno
        poslatoj porudžbini. Na mejl adresu koju ste ostavili prilikom popunjavanja formulara uskoro
        ćemo Vam poslati potvrdu za poručene artikle, a nakon obrade porudžbine dobićete sve naknadne
        informacije na mejl adresu.
      </p>
      <p>
        Porudžbina može biti dostavljena na kućnu adresu ili neku drugu navedenu adresu.
      </p>
      <p>
        Za sva dodatna pitanja možete nas kontaktirati putem e-mail adrese ili telefona navedenog
        na sajtu.
      </p>
    </div>
  );
}
