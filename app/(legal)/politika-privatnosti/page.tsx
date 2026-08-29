import { getStoreIdentity } from '@/lib/config/store-settings';

export const metadata = {
  title: 'Politika privatnosti',
  description: 'Politika privatnosti i zaštita podataka o ličnosti.',
};

export default async function PolitikaPrivatnostiPage() {
  const { name: storeName, email: storeEmail } = await getStoreIdentity();

  return (
    <div className="max-w-none">
      <h1>Politika privatnosti</h1>
      <p>
        {storeName} se obavezuje da će čuvati privatnost svih korisnika sajta.
        Prikupljamo samo neophodne podatke za obradu porudžbina i pružanje usluga.
      </p>

      <h2>Koji podaci se prikupljaju</h2>
      <ul>
        <li>Ime i prezime</li>
        <li>Email adresa</li>
        <li>Broj telefona</li>
        <li>Adresa za dostavu</li>
      </ul>

      <h2>Svrha prikupljanja</h2>
      <p>
        Vaši podaci se koriste isključivo za obradu porudžbina, dostavu proizvoda,
        komunikaciju vezanu za porudžbinu i slanje newsletter-a (ukoliko ste se pretplatili).
      </p>

      <h2>Zaštita podataka</h2>
      <p>
        Svi podaci se čuvaju na sigurnim serverima i štite u skladu sa
        Zakonom o zaštiti podataka o ličnosti.
      </p>

      <h2>Kontakt</h2>
      <p>
        Za sva pitanja vezana za privatnost, kontaktirajte nas na{' '}
        <a href={`mailto:${storeEmail}`} className="text-primary hover:underline">{storeEmail}</a>.
      </p>
    </div>
  );
}
