import { getStoreIdentity } from '@/lib/config/store-settings';

export const metadata = {
  title: 'Zamena proizvoda',
  description: 'Informacije o zameni veličine i zameni artikala za drugi artikal.',
};

export default async function ZamenaProizvodaPage() {
  const {
    name: storeName,
    address: storeAddress,
    city: storeCity,
    email: storeEmail,
  } = await getStoreIdentity();

  return (
    <div className="bg-background-alt rounded-xl p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-text mb-4">
          ZAMENA VELIČINE I ZAMENA ARTIKALA ZA DRUGI ARTIKAL
        </h2>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Prilikom preuzimanja pošiljke molimo Vas da u prisustvu kurira proverite
          svoj paket. Ukoliko na njemu ima vidljivih oštećenja, paket ne bi trebalo
          da preuzmete. U ovom slučaju, molimo Vas da nas kontaktirate putem e-mail
          adrese{' '}
          <a href={`mailto:${storeEmail}`} className="text-primary font-semibold hover:underline">
            {storeEmail}
          </a>
          . U najkraćem mogućem roku obavestićemo Vas o daljem postupanju.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-6">
          Ukoliko ste primili pošiljku i nakon otvaranja kutije ustanovili da
          isporučena roba ne odgovara naručenoj ili podaci na računu nisu
          odgovarajući, molimo Vas da nas, najkasnije u roku od{' '}
          <span className="font-semibold text-red-600">24h</span> od trenutka
          prijema pošiljke, kontaktirate putem e-mail adrese{' '}
          <a href={`mailto:${storeEmail}`} className="text-primary font-semibold hover:underline">
            {storeEmail}
          </a>
          .
        </p>

        <h3 className="text-base font-semibold text-text mb-4">
          Potrebni podaci:
        </h3>
        <ul className="list-disc pl-6 text-sm leading-6 text-text-muted mb-6">
          <li className="pb-2">Broj Vašeg računa-otpremnice ili broj porudžbine</li>
          <li className="pb-2">Šifru artikla i veličinu koju želite da reklamirate</li>
          <li className="pb-2">Opis problema koji imate</li>
        </ul>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Tražene podatke možete dostaviti popunjavanjem reklamacionog lista.
          Reklamacioni list i kopiju račun-otpremnice možete nam poslati putem
          elektronske pošte na{' '}
          <a href={`mailto:${storeEmail}`} className="text-primary font-semibold hover:underline">
            {storeEmail}
          </a>{' '}
          ili na adresu:
        </p>
        <p className="text-sm leading-6 text-text-muted font-semibold mb-6">
          {storeName} <br />
          {storeAddress}, {storeCity}
        </p>

        <p className="text-sm leading-6 text-text-muted mb-6">
          U najkraćem mogućem roku, a najkasnije u roku od{' '}
          <span className="font-semibold text-red-600">8 dana</span> od dana prijema
          reklamacije pisanim putem ili elektronski, odgovorićemo Vam na izjavljenu
          reklamaciju i obavestićemo Vas o daljem postupanju. Rok za rešavanje
          reklamacije je <span className="font-semibold">15 dana</span> od prijema
          iste. Troškove zamene robe snosi kupac, osim u slučajevima kada kupac
          dobije neispravan ili pogrešan artikal.
        </p>

        <h2 className="text-lg font-semibold text-text mb-4">
          ZAMENA VELIČINE I ZAMENA ARTIKLA ZA DRUGI PUTEM ONLINE PRODAVNICE
        </h2>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Ukoliko ste nakon prijema porudžbine probali artikal i utvrdili da Vam
          veličina ne odgovara ili želite da zamenite artikal za drugi, molimo Vas
          da uradite sledeće:
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Javite se na e-mail adresu{' '}
          <a href={`mailto:${storeEmail}`} className="text-primary font-semibold hover:underline">
            {storeEmail}
          </a>{' '}
          i dostavite broj Vaše porudžbine, kao i informaciju da želite zamenu
          artikla. Dobićete potvrdu od nas da je Vaš mail primljen.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Artikle koje vraćate morate poslati na našu adresu (pošiljaocu) o Vašem
          trošku kada dobijete informaciju od operatera. Za slanje paketa je
          neophodno da sačekate potvrdu od našeg operatera.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-6">
          <span className="font-semibold">Radno vreme call centra:</span> <br />
          Radnim danima: 08.00 - 16.00h <br />
          Subotom: 09.00 - 15.00h
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          <span className="font-semibold">ROK ZAMENE</span> veličine artikla ili
          zamene za drugi je{' '}
          <span className="font-semibold text-red-600">14 dana</span> od dana kada
          Vam je isporučen paket.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-6">
          <span className="font-semibold">TROŠKOVI ZAMENE</span> robe snosi
          potrošač, izuzev u slučajevima kada potrošač od trgovca dobije neispravan
          ili pogrešan proizvod.
        </p>

        <p className="text-sm leading-6 text-text-muted italic">
          *Napomena: Potvrdom porudžbine, klikom na dugme POTVRDI PORUDŽBINU,
          saglasni ste sa uslovima zamene veličine artikla i zamene artikla za drugi.
          Ukoliko samoinicijativno odete u prodavnicu bez prethodne provere,
          kolege u prodavnici neće biti u mogućnosti da Vam izvrše zamenu artikla.
        </p>
      </div>
    </div>
  );
}
