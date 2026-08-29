import { getStoreIdentity } from '@/lib/config/store-settings';
import { getStorefrontUrl } from '@/lib/config/storefront-url';

export const metadata = {
  title: 'Pravo na odustanak od kupovine',
  description: 'Informacije o pravu na odustanak od ugovora zaključenog na daljinu.',
};

export default async function PravoNaOdustanakPage() {
  const { name: storeName } = await getStoreIdentity();
  const siteUrl = getStorefrontUrl().toString().replace(/\/$/, '');

  return (
    <div className="bg-background-alt rounded-xl p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-text mb-4">
          PRAVO NA ODUSTANAK OD KUPOVINE
        </h2>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Obaveštavamo Vas da se prema Zakonu o zaštiti potrošača (dalje: Zakon)
          kupovina preko naše internet stranice{' '}
          <span className="text-primary font-semibold">{siteUrl}</span>{' '}
          smatra prodajom na daljinu.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Zakon za slučaj prodaje na daljinu ustanovljava pravo kupca, koji se
          smatra potrošačem (fizičko lice koje proizvod kupuje radi namirenja
          svojih individualnih potreba, a ne radi obavljanja profesionalne
          delatnosti), da odustane od ugovora u roku od{' '}
          <span className="font-semibold text-red-600">14 dana</span> od dana kada
          mu je proizvod predat, odnosno od dana kada roba dospe u državinu
          potrošača ili trećeg lica koje je odredio potrošač, a koje nije
          prevoznik. Prilikom odustanka kupac može, ali ne mora da navede razloge
          zbog kojih odustaje.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Obrazac/Izjava o odustanku od ugovora proizvodi pravno dejstvo od dana
          kada je poslata trgovcu.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          U slučaju odustaka od ugovora, potrošač ima pravo na povraćaj novca ili
          na zamenu za drugi proizvod. Cena se kupcu vraća po prijemu proizvoda, a
          u roku od <span className="font-semibold text-red-600">14 dana</span> od
          dana prijema izjave o odustanku.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Potrošač je isključivo odgovoran za umanjenu vrednost robe koja nastane
          kao posledica rukovanja robom na način koji nije adekvatan, odnosno
          prevazilazi ono što je neophodno da bi se ustanovili priroda,
          karakteristike i funkcionalnost robe. Trgovac ima pravo da uskrati
          vraćanje cene ukoliko utvrdi da roba nije vraćena u stanju u kome je
          isporučena, a usled potrošačevog neadekvatnog rukovanja istom.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Kao kupac ne snosite troškove koji nastaju odustankom od ugovora, osim
          troškova poštarine koji proisteknu slanjem robe na našu adresu. Sa naše
          strane se obavezujemo da ćemo, odmah po prijemu robe koja se vraća po
          osnovu odustanka od ugovora, izvršiti povraćaj sredstava koja su
          uplaćena za vraćenu robu ili poslati artikal koji želite za zamenu.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Kupac je dužan da proizvod vrati bez odlaganja, a najkasnije u roku od{' '}
          <span className="font-semibold">14 dana</span> od dana kada je poslao
          obrazac za odustanak. Po isteku roka od 14 dana od dana kada je poslao
          odustanak, proizvod se više ne može vratiti.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-4">
          Prilikom povraćaja robe kupac je u obavezi da priloži račun/otpremnicu.
        </p>

        <p className="text-sm leading-6 text-text-muted mb-6">
          Trgovac je dužan da potrošaču bez odlaganja vrati iznos koji je
          potrošač platio po osnovu ugovora, a najkasnije u roku od{' '}
          <span className="font-semibold">14 dana</span> od dana prijema izjave o
          odustanku, a nakon prijema proizvoda.
        </p>

        <p className="text-sm leading-6 text-text-muted font-semibold mb-2">
          Dokumenta koja možete preuzeti:
        </p>
        <ul className="list-disc pl-6 text-sm leading-6 text-text-muted mb-6">
          <li className="pb-2">Obrazac o odustanku od ugovora</li>
          <li className="pb-2">Ugovor na daljinu</li>
        </ul>

        <p className="text-sm leading-6 text-text-muted">
          U slučaju vraćanja robe ili povraćaja sredstava kupcu koji je prethodno
          izvršio plaćanje nekom od platnih kartica, delimično ili u celosti, a
          bez obzira na razlog vraćanja, {storeName} Online Shop je u obavezi da
          povraćaj izvrši isključivo putem VISA, EC/MC, Maestro, Amex i Dina metoda plaćanja.
          To znači da će banka na zahtev prodavca obaviti povraćaj sredstava na
          račun korisnika kartice.
        </p>
      </div>
    </div>
  );
}
