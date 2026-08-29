import type { Metadata } from 'next';
import { getStoreIdentity } from '@/lib/config/store-settings';

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: 'O nama',
    description: `Saznajte više o ${name} - online prodavnici kvalitetnih proizvoda.`,
  };
}

export default async function AboutPage() {
  const {
    name: storeName,
    address: storeAddress,
    city: storeCity,
    email: storeEmail,
    phone: storePhone,
  } = await getStoreIdentity();

  return (
    <article className="prose prose-lg max-w-none">
      <h1 className="font-display">O nama</h1>

      <p className="lead text-xl text-text-muted">
        {storeName} je online prodavnica posvećena kvalitetnim proizvodima i zadovoljstvu kupaca.
      </p>

      <h2>Naša priča</h2>
      <p>
        {storeName} je nastala iz želje da kupcima ponudimo pažljivo odabrane proizvode
        po fer cenama. Verujemo da kvalitet ne mora da bude luksuz i trudimo se da to
        dokažemo svakim našim proizvodom.
      </p>

      <h2>Šta nas izdvaja</h2>
      <ul>
        <li><strong>Kvalitet</strong> - Biramo samo proverene brendove i materijale</li>
        <li><strong>Podrška</strong> - Tu smo za vas pre, tokom i posle kupovine</li>
        <li><strong>Brza dostava</strong> - Isporuka na vašu adresu u najkraćem roku</li>
        <li><strong>Sigurna kupovina</strong> - Bezbedno online plaćanje i zaštita podataka</li>
      </ul>

      <h2>Kontakt informacije</h2>
      <p>
        <strong>{storeName}</strong><br />
        {storeAddress && <>{storeAddress}<br /></>}
        {storeCity ? `${storeCity}, Srbija` : 'Srbija'}<br /><br />
        {storePhone && <>Tel: {storePhone}<br /></>}
        Email: {storeEmail}
      </p>
    </article>
  );
}
