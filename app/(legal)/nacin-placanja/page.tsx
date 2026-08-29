import Image from 'next/image';
import type { Metadata } from 'next';
import { getStoreIdentity } from '@/lib/config/store-settings';
import { storeCapabilities } from '@/lib/config/capabilities';

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: 'Način plaćanja',
    description: `Informacije o dostupnim načinima plaćanja u ${name} online prodavnici.`,
  };
}

export default async function PaymentMethodsPage() {
  const { name: storeName } = await getStoreIdentity();

  return (
    <article className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        NAČIN PLAĆANJA
      </h1>

      {storeCapabilities.cashOnDelivery && <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Pouzećem
        </h2>
        <p className="text-sm leading-6 text-gray-600">
          Prilikom isporuke, robu je moguće platiti kuriru isključivo gotovinom.
        </p>
      </section>}

      {storeCapabilities.cardPayments && <>
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Platne kartice
        </h2>

        <p className="text-sm leading-6 text-gray-600 mb-4">
          Kartice koje su prihvaćene u našoj online prodavnici su Visa,
          MasterCard, Maestro, Dina i American Express.
        </p>

        {/* Payment Method Logos */}
        <div className="flex flex-wrap gap-4 items-center mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <Image
            src="/images/payment-logos/visa-logo.png"
            alt="Visa"
            width={80}
            height={50}
            className="object-contain h-10"
          />
          <Image
            src="/images/payment-logos/mastercard-logo.png"
            alt="MasterCard"
            width={80}
            height={50}
            className="object-contain h-10"
          />
          <Image
            src="/images/payment-logos/maestro-logo.png"
            alt="Maestro"
            width={80}
            height={50}
            className="object-contain h-10"
          />
          <Image
            src="/images/payment-logos/dinacard.png"
            alt="DinaCard"
            width={100}
            height={50}
            className="object-contain h-10"
          />
          <Image
            src="/images/payment-logos/american-express.png"
            alt="American Express"
            width={80}
            height={50}
            className="object-contain h-10"
          />
        </div>

        <div className="space-y-4 text-sm leading-6 text-gray-600">
          <p>
            Prilikom unošenja podataka o platnoj kartici, poverljive informacije
            se prenose putem javne mreže u zaštićenoj (kriptovanoj) formi
            upotrebom SSL protokola i PKI sistema, kao trenutno najsavremenije
            kriptografske tehnologije. Sigurnost podataka prilikom kupovine,
            garantuje procesor platnih kartica, pa se
            tako kompletni proces naplate obavlja na stranicama banke. Niti jednog
            trenutka podaci o platnoj kartici nisu dostupni našem sistemu.
          </p>

          <p>
            Plaćanje je moguće platnim karticama domaćih i inostranih banaka.
          </p>

          <p>
            U slučaju vraćanja robe i povraćaja sredstava kupcu koji
            je prethodno platio nekom od platnih kartica, delimično ili u celosti,
            a bez obzira na razlog vraćanja, {storeName} je u obavezi da
            povraćaj vrši isključivo preko VISA, EC/MC, Maestro, Amex i Dina metoda plaćanja.
          </p>

          <div className="bg-blue-50 p-4 rounded-lg mt-4">
            <p className="font-semibold mb-2">Izjava o konverziji:</p>
            <p>
              Sva plaćanja biće izvršena u lokalnoj valuti
              Republike Srbije – dinar (RSD). Iznos za koji će biti zadužena vaša
              platna kartica biće izražen u vašoj lokalnoj valuti kroz konverziju u
              istu, po kursu koji koriste kartičarske organizacije, a koji nama u
              trenutku transakcije ne može biti poznat. Kao rezultat ove konverzije
              postoji mogućnost neznatne razlike od originalne cene, navedene na
              našem sajtu.
            </p>
            <p className="mt-2">Hvala Vam na razumevanju.</p>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="mt-8 pt-8 border-t border-gray-300">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Sigurnost plaćanja
        </h2>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex flex-wrap gap-6 items-center justify-center mb-4">
            <a
              href="https://www.mastercard.com/rs/consumer/credit-cards.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <Image
                src="/images/payment-logos/mastercard-secure.png"
                alt="MasterCard Secure"
                width={150}
                height={60}
                className="object-contain h-12"
              />
            </a>

            <a
              href="https://rs.visa.com/pay-with-visa/security-and-assistance/protected-everywhere.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <Image
                src="/images/payment-logos/visa-secure.png"
                alt="Visa Secure"
                width={80}
                height={60}
                className="object-contain h-12"
              />
            </a>

          </div>

          <p className="text-xs text-center text-gray-500">
            Kliknite na logo za više informacija o bezbednosti
          </p>
        </div>
      </section>
      </>}

      {!storeCapabilities.cashOnDelivery && !storeCapabilities.cardPayments && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Načini plaćanja trenutno nisu dostupni
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Kontaktirajte nas za informacije o poručivanju i plaćanju.
          </p>
        </section>
      )}
    </article>
  );
}
