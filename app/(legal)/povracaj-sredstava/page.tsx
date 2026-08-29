import { getStoreIdentity } from '@/lib/config/store-settings';
import { getStorefrontUrl } from '@/lib/config/storefront-url';

export const metadata = {
  title: 'Povraćaj sredstava',
  description: 'Informacije o proceduri povraćaja sredstava.',
};

export default async function PovracajSredstavaPage() {
  const { name: storeName, email: storeEmail } = await getStoreIdentity();
  const siteUrl = getStorefrontUrl().toString().replace(/\/$/, '');

  return (
    <div className="bg-background-alt rounded-xl p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-text mb-4">POVRAĆAJ SREDSTAVA</h2>

        <p className="text-sm leading-6 text-text-muted mb-6">
          U slučaju odustanka od ugovora, potrošač ima pravo na povraćaj novca ili na zamenu za drugi proizvod.
          Cena proizvoda se kupcu vraća po prijemu proizvoda.
          <br /><br />
          Trgovac je dužan da potrošaču bez odlaganja vrati iznos koji je potrošač platio po osnovu ugovora,
          a najkasnije u roku od 14 dana od dana prijema izjave o odustanku, a nakon prijema proizvoda.
          <br /><br />
          Troškove vraćanja robe i novca snosi kupac, sem u slučajevima kada kupac dobije neispravan ili pogrešan artikal.
        </p>

        <h3 className="text-base font-semibold text-text mb-4">
          I PROCEDURA ZA POVRAĆAJ SREDSTAVA PUTEM ONLINE PRODAVNICE
        </h3>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Molimo Vas da pripremite sledeće podatke:
        </p>

        <ul className="list-disc ml-10 text-sm leading-6 text-text-muted mb-6">
          <li className="pb-2">Broj porudžbine</li>
          <li className="pb-2">Broj lične karte</li>
          <li className="pb-2">Broj dinarskog tekućeg računa na koji će biti uplaćena sredstva</li>
        </ul>

        <p className="text-sm leading-6 text-text-muted mb-6">
          Tražene podatke možete dostaviti putem e-mail adrese{' '}
          <a href={`mailto:${storeEmail}`} className="text-primary hover:underline">{storeEmail}</a>.
          <br /><br />
          Kada dostavite potrebne podatke, biće kreirana dokumentacija koja će Vam sa procedurom za povraćaj sredstava
          biti prosleđena na email adresu koju ste ostavili prilikom kreiranja porudžbine.
          <br /><br />
          Povraćaj sredstava se vrši isključivo na gore navedeni način, uplatom na dinarski tekući račun domaćih državljana
          i nije moguće izvršiti uplatu na račun nerezidenta ili slati novac po kuriru u gotovini.
        </p>

        <h3 className="text-base font-semibold text-text mb-4">
          II POVRAĆAJ SREDSTAVA U MALOPRODAJNOM OBJEKTU
        </h3>

        <p className="text-sm leading-6 text-text-muted mb-4">
          {storeName} svim kupcima omogućava da izvrše povrat artikla kupljenog u{' '}
          <a href={siteUrl} className="text-primary hover:underline">online prodavnici</a>{' '}
          u {storeName} prodavnici iz koje je paket stigao.
          <br /><br />
          Proizvod možete vratiti u roku od 14 dana od primanja porudžbine uz priložen račun/otpremnicu.
          Artikli moraju biti vraćeni neoštećeni, nekorišćeni i u originalnoj ambalaži.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Prilikom povrata artikala u prodavnicu, u mogućnosti ste da odaberete jednu od dve opcije:
        </p>

        <ul className="list-disc ml-10 text-sm leading-6 text-text-muted mb-6">
          <li className="pb-2">Povrat novca uplatom na dinarski tekući račun domaćih državljana</li>
        </ul>

        <p className="text-sm leading-6 text-text-muted">
          Za sve dodatne informacije možete kontaktirati putem e-mail adrese{' '}
          <a href={`mailto:${storeEmail}`} className="text-primary hover:underline">{storeEmail}</a>.
        </p>
      </div>
    </div>
  );
}
