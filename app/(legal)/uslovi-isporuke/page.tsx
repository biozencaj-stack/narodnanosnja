export const metadata = {
  title: 'Uslovi isporuke',
  description: 'Informacije o teritoriji isporuke, roku isporuke i preuzimanju pošiljke.',
};

export default function UsloviIsporukePage() {
  return (
    <div className="bg-background-alt rounded-xl p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-text mb-4">
          TERITORIJA ISPORUKE
        </h2>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Naručene artikle isporučujemo na teritoriji Republike Srbije, u svim
          mestima u kojima je moguća isporuka i naplata od strane kurirske
          službe{' '}
          <a
            href="https://www.dexpress.rs/rs"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            City Express
          </a>
        </p>

        <h2 className="text-lg font-semibold text-text mb-4">
          ROK ISPORUKE
        </h2>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Nakon što ste završili proces poručivanja klikom na dugme „Potvrdi”,
          na svoju e-mail adresu, koju ste prijavili prilikom popunjavanja
          podataka, automatski ćete dobiti potvrdni mail o uspešnoj kupovini.
          Time je Vaša porudžbina ušla u proces obrade i slanja.
        </p>

        <h2 className="text-lg font-semibold text-text mb-4">
          Regularna Isporuka
        </h2>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Ukoliko ste selektovali uslugu regularne isporuke, isporuku možete
          očekivati u roku od 5 radnih dana (dani vikenda (subota i nedelja) se
          ne računaju).
        </p>

        <h2 className="text-lg font-semibold text-text mb-4">
          PREUZIMANJE POŠILJKE
        </h2>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Kuriri pošiljke donose na adresu za isporuku u periodu od 8-16 h.
          Molimo Vas da u tom periodu obezbedite da na adresi bude osoba koja
          može preuzeti pošiljku. Prilikom preuzimanja pošiljke potrebno je da
          vizuelno pregledate paket da slučajno ne postoje neka vidna oštećenja.
          Ukoliko primetite da je transportna kutija značajno oštećena i
          posumnjate da je proizvod možda oštećen, odbijte prijem pošiljke i
          odmah nas obavestite.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Ukoliko je pošiljka naizgled bez oštećenja slobodno preuzmite pošiljku
          i potpišite kuriru adresnicu.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Kurir pokušava svaku pošiljku da uruči u dva navrata. Uobičajena
          praksa je da ukoliko Vas kurir ne pronađe na adresi, da Vas pozove na
          telefon koji ste ostavili prilikom kreiranja narudžbenice i ugovori
          novi termin isporuke. Ukoliko Vas i tada ne pronađe na adresi,
          pošiljka će se vratiti nama. Po prijemu pošiljke, kontaktiraćemo Vas
          kako bi ustanovili razlog neuručenja i dogovoriti se o ponovnom
          slanju.
        </p>

        <h2 className="text-lg font-semibold text-text mb-4">
          CENA ISPORUKE
        </h2>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Za sve porudžbine čiji je račun manji od tog iznosa cena isporuke
          iznosi 350,00 din sa PDV-om.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Isporuka se plaća prilikom preuzimanja pošiljke, direktno kuriru
          gotovinom.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Obaveštenje o ceni isporuke možete videti u korpi prilikom pregleda
          same korpe.
        </p>
        <p className="text-sm leading-6 text-text-muted">
          <span className="font-semibold">NAPOMENA</span>: Potvrdom porudžbine,
          klikom na dugme POTVRDI, saglasni ste sa uslovima isporuke.
        </p>
      </div>
    </div>
  );
}
