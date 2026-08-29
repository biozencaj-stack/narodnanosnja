import Image from 'next/image';
import type { Metadata } from 'next';
import { getStoreIdentity } from '@/lib/config/store-settings';
import { notFound } from 'next/navigation';
import { storeCapabilities } from '@/lib/config/capabilities';

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: 'Plaćanje karticama',
    description: `Informacije o plaćanju platnim karticama u ${name} online prodavnici.`,
  };
}

export default async function PlacanjeKarticamaPage() {
  if (!storeCapabilities.cardPayments) notFound();
  const { name: storeName } = await getStoreIdentity();

  return (
    <div className="bg-background-alt rounded-xl p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-text mb-4">
          PLAĆANJE KARTICAMA
        </h2>

        <p className="text-sm leading-6 text-text-muted mb-6">
          Svoju narudžbinu možete platiti koristeći Visa, Visa Electron, Dina,
          MasterCard ili Maestro platnu karticu. Kartica mora biti odobrena od
          strane banke izdavaoca za online (Internet) plaćanje.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Prilikom online naručivanja, odabirom odgovarajućeg načina plaćanja
          bićete preusmereni na zaštićenu stranicu banke koja obrađuje
          plaćanje. Niti jednog trenutka podaci o Vašoj platnoj
          kartici nisu dostupni našem sistemu.
        </p>

        <h2 className="text-lg font-semibold text-text mb-4">
          Platna kartica
        </h2>

        <p className="text-sm leading-6 text-text-muted mb-6">
          Kartice koje su prihvaćene u našoj online prodavnici su Visa,
          MasterCard, Maestro i Dina.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Prilikom unošenja podataka o platnoj kartici, poverljive informacija
          se prenose putem javne mreže u zaštićenoj (kriptovanoj) formi
          upotrebom SSL protokola i PKI sistema, kao trenutno najsavremenije
          kriptografske tehnologije. Sigurnost podataka prilikom kupovine,
          garantuje procesor platnih kartica, pa se
          tako kompletni proces naplate obavlja na stranicama banke. Niti jednog
          trenutka podaci o platnoj kartici nisu dostupni našem sistemu.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Plaćanje je moguće platnim karticama domaćih i inostranih banaka.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          U slučaju vraćanja robe i povraćaja sredstava kupcu koji
          je prethodno platio nekom od platnih kartica, delimično ili u celosti,
          a bez obzira na razlog vraćanja, {storeName} je u obavezi da
          povraćaj vrši isključivo preko VISA, EC/MC, Maestro, Amex i Dina metoda plaćanja.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Izjava o konverziji: Sva plaćanja biće izvršena u lokalnoj valuti
          Republike Srbije – dinar (RSD). Iznos za koji će biti zadužena vaša
          platna kartica biće izražen u vašoj lokalnoj valuti kroz konverziju u
          istu, po kursu koji koriste kartičarske organizacije, a koji nama u
          trenutku transakcije ne može biti poznat. Kao rezultat ove konverzije
          postoji mogućnost neznatne razlike od originalne cene, navedene na
          našem sajtu. Hvala Vam na razumevanju.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-6">
          Na ovoj stranici je potrebno da unesete sledeće podatke: Broj kartice,
          Datum isteka i CVC2/CVV2 kod, koje možete pročitati sa Vaše kartice.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Prilikom online naručivanja, odabirom odgovarajućeg načina plaćanja
          bićete preusmereni na zaštićenu stranicu banke koja obrađuje
          plaćanje. Niti jednog trenutka podaci o Vašoj platnoj
          kartici nisu dostupni našem sistemu.
        </p>

        <Image
          alt="Uputstvo za plaćanje karticom"
          src="/images/payment-help.jpg"
          width={800}
          height={200}
          className="my-6 rounded-lg"
        />

        <p className="text-sm leading-6 text-text-muted italic mb-6">
          *Unos i provera podataka isključivo se obavljaju između korisnika
          kartice i banke/procesora, a Internet trgovac nema uvid u podatke koji se
          razmenjuju.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-6">
          Sigurnost podataka prilikom kupovine, garantuje procesor platnih
          kartica i banka koja obrađuje plaćanje.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-6">
          Niti jednog trenutka podaci o platnoj kartici nisu dostupni našem
          sistemu.
          <br />
          Plaćanje nije moguće u stranoj valuti, već isključivo u valuti RSD.
          Plaćanje je moguće platnim karticama domaćih i inostranih banaka.
        </p>
        <p className="text-sm leading-6 text-text-muted mb-4">
          Kupac koji koristi uslugu online plaćanja karticama preko naše
          prodavnice mora ispunjavati sledeće uslove:
        </p>

        <ul className="list-disc ml-10 text-sm leading-6 text-text-muted mb-6">
          <li className="pb-2">
            Isporuka robe je moguća samo na teritoriji Republike Srbije, na
            adresi navedenoj u porudžbini.
          </li>
          <li className="pb-2">
            Samo vlasnik platne kartice može izvršiti plaćanje.
          </li>
        </ul>

        <h3 className="text-lg font-semibold text-text">
          Želimo Vam uspešnu kupovinu
        </h3>
      </div>
    </div>
  );
}
