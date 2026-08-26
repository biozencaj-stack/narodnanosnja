export const naslov = 'Gde videti';
export const aktivno = 'gde-videti';
export const opis =
  'Muzeji, etno-parkovi i manifestacije u Srbiji gde se srpska narodna nošnja ' +
  'može videti uživo — od Etnografskog muzeja u Beogradu do sabora i smotri folklora.';

export const sara = ({ saraZa }) => saraZa(4, ['#d9b04a', '#a4161a']);

export function telo({ p, esc, traka }) {
  const muzeji = [
    ['Etnografski muzej', 'Beograd',
      'Centralna ustanova za narodnu kulturu u Srbiji, osnovana 1901. Njegova zbirka ' +
      'narodne nošnje je najobimnija u zemlji i pokriva sve etnografske celine.'],
    ['Muzej Vojvodine', 'Novi Sad',
      'Panonska nošnja u svim varijantama — srpskoj, bunjevačkoj, šokačkoj, rusinskoj, ' +
      'slovačkoj i mađarskoj, uz bogatu zbirku šlingeraja i svilenih marama.'],
    ['Muzej „Staro selo“', 'Sirogojno, Zlatibor',
      'Muzej na otvorenom sa prenetim brvnarama zlatiborskog kraja. Uz zgrade se prikazuje ' +
      'i tekstilno umeće — pletenje, tkanje i obrada vune.'],
    ['Narodni muzej', 'Kragujevac',
      'Šumadijska nošnja u kraju u kome se i uobličila, uz predmete iz vremena obnovljene ' +
      'srpske države.'],
    ['Narodni muzej', 'Užice',
      'Dinarski tip zapadne Srbije — zubuni, suknene čakšire, vunene čarape i struke.'],
    ['Narodni muzej', 'Vranje',
      'Vranjska gradska nošnja i zlatovez, u ambijentu očuvane gradske kuće iz osmanskog perioda.'],
    ['Muzej Ponišavlja', 'Pirot',
      'Pirotski ćilim i tekstilno nasleđe jugoistočne Srbije — isti razboj i iste šare ' +
      'koje se sreću i na delovima nošnje.'],
    ['Narodni muzej', 'Zaječar',
      'Timočka krajina i homoljski kraj — dve kecelje, tamna paleta i gust vuneni vez.'],
  ];

  const dogadjaji = [
    ['Dragačevski sabor trubača', 'Guča',
      'Najpoznatija srpska narodna manifestacija, tradicionalno u avgustu. Nošnja se ' +
      'ovde ne izlaže nego nosi — na saborskim povorkama i u kolu.'],
    ['Vukov sabor', 'Tršić',
      'Najstarija kulturna manifestacija u Srbiji, posvećena Vuku Karadžiću. Smotre ' +
      'folklora i izložbe rukotvorina, tradicionalno u septembru.'],
    ['Smotre folklora KUD-ova', 'širom Srbije',
      'Kulturno-umetnička društva su danas glavni čuvar nošnje u pokretu. Skoro svaki ' +
      'grad ima svoju godišnju smotru.'],
    ['Etno sajmovi i sabori rukotvorina', 'širom Srbije',
      'Prilika da se vidi kako se tka, plete i veze — i da se razgovara sa ljudima ' +
      'koji te zanate još drže živim.'],
  ];

  const kartice = (lista) => lista.map(([ime, mesto, o]) => `
        <li class="stavka">
          <span class="mesto">${esc(mesto)}</span>
          <h3>${esc(ime)}</h3>
          <p>${esc(o)}</p>
        </li>`).join('');

  return `
<section class="detalj-hero">
  <div class="omot">
    <div class="mrvice"><a href="${p}">Početna</a><span>›</span>Gde videti</div>
    <h1>Gde je videti uživo</h1>
    <p class="uvod">
      Fotografija ne prenosi težinu sukna ni sjaj srme. Evo mesta na kojima se
      srpska narodna nošnja može videti izbliza — u vitrini ili na ramenima.
    </p>
    <div class="meta-red">
      <span class="znacka">${muzeji.length} muzeja</span>
      <span class="znacka">${dogadjaji.length} vrste manifestacija</span>
    </div>
  </div>
</section>
${traka()}

<section class="sekcija">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Muzeji i zbirke</h2>
      <p>Ustanove sa stalnim ili povremenim postavkama narodne nošnje.</p>
    </div>
    <ul class="stavke">${kartice(muzeji)}
    </ul>
  </div>
</section>

<section class="sekcija sekcija-alt">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Manifestacije</h2>
      <p>Nošnja je nastala da se nosi, a ne da stoji. Na saborima i smotrama još uvek se nosi.</p>
    </div>
    <ul class="stavke">${kartice(dogadjaji)}
    </ul>
    <blockquote class="izdvojeno mt-veliko">
      <span class="izdvojeno-oznaka">Napomena</span>
      <p>Termini, radno vreme i postavke se menjaju. Pre puta proverite aktuelne
         informacije na sajtu same ustanove ili organizatora.</p>
    </blockquote>
  </div>
</section>

<section class="sekcija">
  <div class="omot usko">
    <h2>Nasleđe pod zaštitom</h2>
    <p>Srpsko kolo upisano je 2017. godine na Uneskovu Reprezentativnu listu nematerijalnog
       kulturnog nasleđa čovečanstva. Kolo se ne igra samo — igra se u nošnji, uz muziku,
       na tačno određenim prilikama, pa je zaštita kola posredno i zaštita svega što uz njega ide.</p>
    <p>U Srbiji nacionalni registar nematerijalnog kulturnog nasleđa vodi Etnografski muzej
       u Beogradu, i u njemu se nalazi i niz tekstilnih zanata vezanih za izradu nošnje.</p>
    <p class="mt-veliko"><a class="dugme dugme-puno" href="${p}nosnje/">Pogledaj nošnje po krajevima →</a></p>
  </div>
</section>
`;
}
