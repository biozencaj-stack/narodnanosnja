import type { Metadata } from "next";
import Link from "next/link";
import { getStoreIdentity } from "@/lib/config/store-settings";
import { getStorefrontUrl } from "@/lib/config/storefront-url";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreIdentity();
  return {
    title: 'Uslovi korišćenja i prodaje',
    description: `Opšti uslovi korišćenja sajta i internet prodavnice ${name}.`,
  };
}

export default async function UsloviKoriscenjaPage() {
  const {
    name: storeName,
    city: storeCity,
    address: storeAddress,
    email: storeEmail,
  } = await getStoreIdentity();
  const siteUrl = getStorefrontUrl().toString().replace(/\/$/, '');

  return (
    <div className="max-w-none">
      <h1>Opšti uslovi korišćenja i prodaje</h1>

      <p>
        Na osnovu Zakona o privrednim društvima, ovim dokumentom se definišu OPŠTI USLOVI KORIŠĆENJA
        USLUGA {storeName} sa odredbama o zaštiti podataka o ličnosti. Detaljni uslovi mogu biti
        dostupni u posebnom dokumentu na zahtev.
      </p>

      <h2>Podaci o trgovcu</h2>
      <p>
        <strong>{storeName}</strong><br />
        {storeAddress && <>Adresa: {storeAddress}<br /></>}
        {storeCity && <>{storeCity}, Srbija<br /></>}
        Web adresa: <a href={siteUrl} target="_blank" rel="noopener noreferrer">{siteUrl}</a><br />
        {storeEmail && <>Email: {storeEmail}<br /></>}
        (Popunite ostale podatke u podešavanjima – PIB, matični broj, telefon)
      </p>
      <p>
        Poštovani kupci, molimo Vas da ove uslove pažljivo pročitate, jer se pri korišćenju
        Internet prodavnice <a href={siteUrl}>{siteUrl}</a> smatra
        da prihvatate navedene uslove i pravila i obavezujete se da ćete ih poštovati. Uslovima
        korišćenja naših usluga definisana su pravila koja korisnicima ovih usluga omogućavaju
        kupovinu proizvoda i usluga iz naše ponude.
      </p>
      <p>
        Zadržavamo pravo promene Uslova korišćenja naših usluga, u skladu sa novim elementima
        ponude i/ili zakonske regulative, zbog čega bi korisnik (potrošač) posebno pre svake
        kupovine trebalo da proveri informacije u vezi sa Uslovima korišćenja.
      </p>
      <p>
        Ukoliko su Vam navedeni uslovi korišćenja naših usluga neprihvatljivi, molimo Vas da ne
        koristite naš web sajt i naše usluge.         Prodaja robe putem našeg sajta obavlja se u okviru
        naše firme {storeName}{storeCity ? `, ${storeCity}` : ''}{storeAddress ? `, ${storeAddress}` : ''}. Opis robe i njen izgled na
        fotografiji proizvoda koji se prodaje je veran prikaz proizvoda/robe koji se prodaje i isti
        odgovaraju stvarnom izgledu robe. Odgovornost za eventualne tekstualne greške, kao i greške
        u opisu artikla snosi Prodavac.
      </p>

      <h2>Opšte odredbe</h2>
      <ul>
        <li>Online prodaja preko naše internet stranice - {siteUrl} smatra se prodajom na daljinu.</li>
        <li>Uslovi korišćenja naših usluga, smatraju se Ugovorom na daljinu.</li>
        <li>Sve cene na ovom sajtu iskazane su u dinarima. PDV je uračunat u cenu.</li>
        <li>Koristimo sve svoje resurse kako bi svi artikli na sajtu bili prikazani sa ispravnim nazivima, opisima, fotografijama, cenama, ali nažalost ne možemo da garantujemo da su svi podaci na sajtu potpuno ispravni.</li>
        <li>Ne garantujemo fizičku dostupnost artikala prikazanih na sajtu.</li>
        <li>Zadržavamo pravo promene cene svih proizvoda i usluga bez prethodne najave na sajtu.</li>
      </ul>

      <h2>Poručivanje robe</h2>
      <p>
        Nakon uspešnog poručivanja robe biće Vam poslata automatska e-mail poruka, na osnovu
        koje Vas obaveštavamo da je Vaša porudžbina uspešno prosleđena službi internet prodaje
        na dalju obradu. Služba internet prodaje nastojaće da u najkraćem roku proveri da li
        smo u mogućnosti da vam obezbedimo poručeni artikal (artikle).
      </p>
      <p>
        Kompletiranjem porudžbine, klikom na dugme <strong>POTVRDI PORUDŽBINU</strong>,
        potvrđujete da ste pročitali i da ste u potpunosti saglasni sa Uslovima korišćenja
        naših usluga, i da ste izvršili poručivanje sa obavezom plaćanja.
      </p>

      <h2>Cena</h2>
      <p>
        Prodavac samostalno utvrđuje cene robe u skladu sa svojom poslovnom politikom i
        zadržava pravo izmene istaknutih cena. U skladu sa zakonom, sve navedene cene su
        sa uračunatim pripadajućim PDV-om, ali ne uključuju troškove dostave robe kupcu
        koji trošak se dodatno naplaćuje.
      </p>

      <h2>Izjava o PDV-u</h2>
      <p>
        {storeName} je u sistemu PDV-a. PDV uračunat u cenu i nema skrivenih troškova.
      </p>

      <h2>Načini plaćanja</h2>

      <h3>Plaćanje pouzećem</h3>
      <p>
        Plaćanje pouzećem podrazumeva plaćanje iznosa sa računa prilikom preuzimanja pošiljke.
        Plaćanje se može izvršiti samo u gotovom novcu, u dinarima (RSD), na ruke kuriru koji
        Vam je doneo Vašu porudžbinu. Povraćaj novca, kada je proizvod plaćen pouzećem, može
        se izvršiti samo uplatom na tekući račun.
      </p>

      <h3>Plaćanje platnim karticama</h3>
      <p>
        Plaćanje proizvoda na našoj internet prodavnici je moguće izvršiti platnim karticama
        Visa, MasterCard, Maestro, Dina i American Express. Prilikom unošenja podataka o platnoj
        kartici, poverljive informacije se prenose putem javne mreže u zaštićenoj (kriptovanoj)
        formi upotrebom SSL protokola i PKI sistema, kao trenutno najsavremenije kriptografske
        tehnologije. Sigurnost podataka prilikom kupovine, garantuje procesor platnih kartica,
        pa se tako kompletni proces naplate obavlja na stranicama banke.
        Niti jednog trenutka podaci o platnoj kartici nisu dostupni našem sistemu.
      </p>
      <p>Plaćanje je moguće platnim karticama domaćih i inostranih banaka.</p>

      <h3>Povraćaj sredstava</h3>
      <p>
        U slučaju vraćanja robe i povraćaja sredstava kupcu koji je prethodno platio nekom od
        platnih kartica, delimično ili u celosti, a bez obzira na razlog vraćanja, {storeName}
        je u obavezi da povraćaj vrši isključivo preko VISA, EC/MC, Maestro, Amex i Dina metoda
        plaćanja, što znači da će banka na zahtev prodavca obaviti povraćaj sredstava na račun
        korisnika kartice.
      </p>

      <h3>Izjava o konverziji</h3>
      <p>
        Sva plaćanja biće izvršena u lokalnoj valuti Republike Srbije – dinar (RSD). Iznos za
        koji će biti zadužena vaša platna kartica biće izražen u vašoj lokalnoj valuti kroz
        konverziju u istu, po kursu koji koriste kartičarske organizacije, a koji nama u trenutku
        transakcije ne može biti poznat. Kao rezultat ove konverzije postoji mogućnost neznatne
        razlike od originalne cene, navedene na našem sajtu.
      </p>

      <h2>Isporuka robe</h2>
      <p>
        Mesto isporuke poručene robe mora se nalaziti na teritoriji Republike Srbije. Isporuku
        proizvoda poručenih na sajtu {siteUrl} vrši kurirska služba City-express,
        na teritoriji Republike Srbije, radnim danima u periodu od 8 do 16h, na adresu primaoca pošiljke.
      </p>

      <h3>Rok isporuke</h3>
      <p>
        Nakon uspešno kreirane porudžbine, na tvoju e-mail adresu će stići potvrda. Uobičajeno
        vreme za isporuku je do 5 radnih dana. U slučaju da je ovaj rok duži bili biste obavešteni
        putem mail-a. Nakon slanja porudžbine dobićete obaveštenje da je paket poslat na Vašu adresu.
      </p>
      <p>
        Po Zakonu o zaštiti potrošača, član 32 – Trgovac je dužan da u roku od 30 dana od dana
        zaključenja ugovora na daljinu i ugovora koji se zaključuje izvan poslovnih prostorija
        izvrši isporuku robe. Rok isporuke može biti i duži od navedenog (5 radnih dana), u vanrednim
        slučajevima poput velikih gužvi, pandemija, neprohodnosti puteva u slučaju vremenskih nepogoda
        i sl. Kurirska služba je u obavezi da isporuku vrši što efikasnije u skladu sa svojim mogućnostima
        i poslovnim kapacitetima.
      </p>

      <h3>Preuzimanje pošiljke od strane kupca</h3>
      <p>
        Kuriri pošiljke uglavnom dostavljaju u periodu od 8 do 16 časova. Potrebno je da u tom
        periodu budete dostupni na broju telefona navedenom prilikom kreiranja porudžbine i da
        na adresi bude osoba koja može preuzeti pošiljku. Kurir svaku pošiljku pokušava da uruči
        u dva navrata. Ukoliko niste na adresi prilikom prvog pokušaja dostave, kurir će Vas pozvati
        kako biste dogovorili novi termin isporuke. Ukoliko Vas ni drugog puta ne pronađe na adresi,
        pošiljka nam se vraća. Po prijemu pošiljke, kontaktiraćemo vas kako bi ustanovili razlog
        neuručenja i dogovoriti se o ponovnom slanju.
      </p>
      <p>
        Prilikom preuzimanja pošiljke, potrebno je da se vizuelno pregleda, kako bi se utvrdilo
        da li ima spoljna oštećenja. Ukoliko su primetna oštećenja na pakovanju i postoji bilo
        kakva sumnja da je sam artikal oštećen, preporučujemo da se prijem pošiljke odbije i da
        se obavesti {storeName} korisnička podrška.
      </p>

      <h3>Cena isporuke</h3>
      <p>Cena dostave za sve pošiljke je 350 rsd (sa uračunatim PDV-om).</p>

      <h2>Zaštita privatnosti korisnika</h2>
      <p>
        U ime {storeName} obavezujemo se da ćemo čuvati privatnost svih naših kupaca.
        Prikupljamo samo neophodne, osnovne podatke o kupcima/korisnicima i podatke neophodne za
        poslovanje i informisanje korisnika u skladu sa dobrim poslovnim običajima i u cilju
        pružanja kvalitetne usluge. Dajemo kupcima mogućnost izbora uključujući mogućnost odluke
        da li žele ili ne da se izbrišu sa mailing lista koje se koriste za marketinške kampanje.
        Svi podaci o korisnicima/kupcima se strogo čuvaju i dostupni su samo zaposlenima kojima su
        ti podaci nužni za obavljanje posla. Svi zaposleni {storeName} (i poslovni partneri)
        odgovorni su za poštovanje načela zaštite privatnosti.
      </p>

      <h2>Zamena i odustanak od kupovine</h2>
      <p>
        Prema Zakonu o zaštiti potrošača, potrošač ima pravo da odustane od ugovora zaključenog
        na daljinu ili izvan poslovnih prostorija (odustajanje od kupovine), u roku od 14 dana,
        bez navođenja razloga. U tom slučaju, prodavac je u obavezi da potrošaču vrati plaćeni iznos.
      </p>
      <p>
        Potrošač je saglasan sa prethodno navedenom cenom i uslovima isporuke, i prihvata da snosi
        troškove isporuke u slučaju povraćaja robe, što znači da će potrošaču, u slučaju povraćaja
        robe, biti vraćen plaćeni iznos za kupljenu robu, bez troškova isporuke robe.
      </p>

      <h3>Izuzeci od prava na odustanak od ugovora</h3>
      <p>
        Na osnovu Zakona o zaštiti potrošača, a u delu: Obaveze potrošača u slučaju odustanka od
        ugovora, Član 34. Potrošač je isključivo odgovoran za umanjenu vrednost robe koja nastane
        kao posledica rukovanja robom na način koji nije adekvatan.
      </p>
      <p>
        Dakle, ako ste sa artikla isekli ušivne etikete/deklaracije, ili na drugi način oštetili
        artikal, za takav artikal nemate prava na odustanak od ugovora. Eventualno možete tražiti
        povraćaj novca uz umanjenu vrednost robe.
      </p>
      <p>
        Zamena proizvoda može se izvršiti u roku od 14 dana po prijemu poručene robe. Da biste
        bili u mogućnosti da ostvarite svoja prava kao kupac, prilikom vraćanja kupljenog proizvoda
        isti ne sme biti upotrebom oštećen ili pohaban, i treba biti vraćen u originalnoj ambalaži,
        i uz priložen račun. Troškove zamene, u ovom slučaju, snosi kupac. Dostava zamenskog artikla
        takođe ide o trošku kupca.
      </p>

      <h2>Reklamacija</h2>
      <p>
        {storeName} garantuje kvalitet i originalnost robe koju isporučuje. Zbog nesaobraznosti
        robe i usluge ugovoru postoji zakonska odgovornost. Potrošač ima pravo reklamacije na
        kupljeni proizvod u roku od dve godine od dana kupovine.
      </p>
      <p>
        Ukoliko ste primili pošiljku i nakon otvaranja kutije ustanovili da isporučena roba ne
        odgovara naručenoj ili podaci na računu nisu odgovarajući, molimo Vas da, najkasnije u
        roku od 24h od trenutka prijema pošiljke, nas kontaktirate putem e-mail adrese: {storeEmail}
      </p>
      <p>
        Ukoliko se na kupljenom proizvodu pojave neusaglašenosti u smislu odredbi Zakona o zaštiti
        potrošača, molimo Vas da nas kontaktirate putem e-mail adrese {storeEmail}
      </p>

      <h3>Za korisnike koji su se registrovali prilikom kupovine:</h3>
      <p>
        Ulogujte se na sajt i klikinte na: Moj nalog {'>'} Istorija porudžbine {'>'} Pregled.
        Kada Vam se otvori porudžbina kliknite na strelicu Povrati. Popunite podatke, u komentaru
        možete upišite razlog reklamacije.
      </p>

      <h3>Za korisnike koji se nisu registrovali nego su kupovinu obavili kao GOST:</h3>
      <p>
        Neophodno je da se javite na mail adresu {storeEmail} i dostavite broj Vaše porudžbine,
        i opis problema koji imate. Dobićete potvrdu od nas da je Vaš mail primljen. Za slanje paketa
        nazad nije neophodno da sačekate potvrdu od nas.
      </p>

      <p>
        <strong>Kontakt za reklamacije:</strong><br />
        {storeName}<br />
        {storeAddress && <>{storeAddress}<br /></>}
        {storeCity && <>{storeCity}<br /></>}
      </p>

      <p>
        Tražene podatke možete dostaviti popunjavanjem reklamacionog lista. Reklamacioni list i kopiju
        račun-otpremnice, kontakt telefon i imenom i prezimenom možete nam poslati putem elektronske
        pošte na {storeEmail}, najkasnije u roku od 24h od trenutka prijema pošiljke.
      </p>
      <p>
        U najkraćem mogućem roku, a najkasnije u roku od 8 dana od dana prijema reklamacije pisanim
        putem ili elektronskim, odgovorićemo Vam na izjavljenu reklamaciju i obavestićemo Vas o daljem
        postupanju. Rok za rešavanje reklamacije je 15 dana od prijema iste.
      </p>
      <p>
        Ako potrošač nije zadovoljan kako je rešena reklamacija ili prigovor, potrošač ima mogućnost
        vansudskog rešavanja sporova, a trgovac je po zakonu obavezan da učestvuje u postupku vansudskog
        rešavanja potrošačkih sporova. (čl.151. Zakona o zaštiti potrošača)
      </p>
      <p>
        Ministarstvo trgovine, turizma i telekomunikacija RS može povremeno da ažurira listu, te shodno
        tome upućujemo potrošače i na odgovarajuću internet stranicu pomenutog ministarstva, a kako bi
        isti imali dodatnu mogućnost provere{' '}
        <a
          href="https://mtt.gov.rs/tekst/sr/376/zastita-potrosaca.php"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://mtt.gov.rs/tekst/sr/376/zastita-potrosaca.php
        </a>
      </p>
      <p>
        Reklamacioni list možete preuzeti{' '}
        <a href="/docs/obrazac_reklamacija.pdf" target="_blank" rel="noopener noreferrer">OVDE</a>.
      </p>
      <p>
        Osnovni uslov za pokretanje vansudskog postupka od strane potrošača jeste prethodno izjavljivanje
        reklamacije trgovcu.
      </p>
    </div>
  );
}
