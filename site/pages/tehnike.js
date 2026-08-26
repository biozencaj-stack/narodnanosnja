export const naslov = 'Tehnike izrade';
export const aktivno = 'tehnike';
export const opis =
  'Kako je nastajala srpska narodna nošnja: obrada lana i konoplje, tkanje na ' +
  'razboju, valjanje sukna, zlatovez srmom, šlingeraj i pletenje vunenih čarapa.';

export const sara = ({ saraZa }) => saraZa(2, ['#d9b04a', '#a4161a']);

export function telo({ p, esc, traka }) {
  const tehnike = [
    {
      ime: 'Od njive do platna',
      pod: 'Lan i konoplja',
      opis: 'Najduži put u celoj nošnji. Lan i konoplja su se sejali u proleće, brali ' +
        'u leto, potapali u vodu da vlakno omekša, sušili, trli na trlici i grebenali ' +
        'dok se ne dobije čisto vlakno spremno za predenje.',
      koraci: [
        ['Močenje', 'Snopovi stoje u potoku ili jami dve do tri nedelje dok drvenasti deo ne istrune.'],
        ['Trlica i grebeni', 'Stabljika se lomi i češlja dok ne ostane samo mekano vlakno.'],
        ['Predenje', 'Vretenom ili na kolovratu, najčešće zimi, uz sedeljke.'],
        ['Tkanje', 'Na razboju se dobija belo platno za košulje, gaće i peškire.'],
      ],
    },
    {
      ime: 'Tkanje na razboju',
      pod: 'Pregače, tkanice, ćilimi',
      opis: 'Razboj je bio u svakoj kući. Osnova se razapinjala unapred i mogla je da ' +
        'traje mesecima; potka se provlačila čunkom, a šara se pamtila napamet — ' +
        'nije bilo crteža ni predloška.',
      koraci: [
        ['Snovanje', 'Postavljanje osnove — najduži i najosetljiviji deo posla.'],
        ['Klečanje', 'Tehnika kojom se šara tka u polju, a ne po celoj širini.'],
        ['Šara kao potpis', 'Kombinacija boja i rombova razlikovala je selo od sela.'],
      ],
    },
    {
      ime: 'Valjanje sukna',
      pod: 'Vuna koja ne propušta kišu',
      opis: 'Vuneno platno se posle tkanja nosilo u valjaricu — drveni mehanizam na ' +
        'potoku u kome su čekići danima tukli tkaninu u vodi. Vlakna se od toga ' +
        'zbiju i preplet nestane, pa sukno postane gotovo nepromočivo.',
      koraci: [
        ['Striža i pranje', 'Ovčija vuna se pere, suši i grebena.'],
        ['Predenje i tkanje', 'Dobija se rastresito vuneno platno.'],
        ['Valjanje', 'U vodi, nekoliko dana, dok se tkanina ne skupi za trećinu.'],
        ['Krojenje', 'Od gotovog sukna se seku čakšire, zubuni, gunjevi i kape.'],
      ],
    },
    {
      ime: 'Zlatovez',
      pod: 'Vez srmom po kadifi',
      opis: 'Najskuplji ukras srpske nošnje. Srma — tanka srebrna ili pozlaćena žica — ' +
        'polagala se po kadifi i pričvršćivala svilenim koncem. Radili su ga terzije, ' +
        'muški zanatlije u cehovima, a ne žene u kući.',
      koraci: [
        ['Predložak', 'Motiv se crta na kartonu i prenosi na tkaninu.'],
        ['Podlaganje', 'Ispod srme se stavlja karton ili pamuk da vez bude reljefan.'],
        ['Polaganje srme', 'Žica se ne provlači kroz tkaninu nego se pričvršćuje odozgo.'],
        ['Vranje i Prizren', 'Dva najveća centra ovog zanata u srpskim krajevima.'],
      ],
    },
    {
      ime: 'Šlingeraj',
      pod: 'Beli vez na belom platnu',
      opis: 'Vojvođanska specijalnost: motiv se izveze belim koncem po belom platnu, ' +
        'a onda se delovi tkanine unutar veza pažljivo iseku, tako da nastane čipkasta ' +
        'mreža. Traži dnevnu svetlost, mirnu ruku i dobre oči.',
      koraci: [
        ['Crtanje motiva', 'Najčešće ruža, grozd i vinova loza.'],
        ['Vez rubova', 'Gust prekrivni bod po ivici svakog polja.'],
        ['Isecanje', 'Tkanina se seče unutar izvezenog ruba — nazad se ne može.'],
      ],
    },
    {
      ime: 'Pletenje čarapa',
      pod: 'Geometrija u vuni',
      opis: 'Vunene čarape i priglavci pleteni su na pet igala, sa šarama koje se ' +
        'prenose s kolena na koleno. Rombovi, zvezde i cik-cak nisu ukras nego sistem — ' +
        'po njima se prepoznavao kraj, pa i kuća iz koje pletilja dolazi.',
      koraci: [
        ['Bojenje vune', 'Nekada isključivo biljnim bojama — orahova ljuska, broć, kora.'],
        ['Pet igala', 'Plete se ukrug, bez šava, od vrha stopala naviše.'],
        ['Šara', 'Dve do četiri boje, u strogo geometrijskim poljima.'],
      ],
    },
  ];

  const sekcije = tehnike.map((t, i) => `
    <section class="sekcija${i % 2 ? ' sekcija-alt' : ''}">
      <div class="omot">
        <div class="dve-kolone">
          <div class="clanak">
            <span class="nadnaslov" style="color:var(--zlatna)">${esc(t.pod)}</span>
            <h2 style="margin-top:0">${esc(t.ime)}</h2>
            <p>${esc(t.opis)}</p>
          </div>
          <div class="panel">
            <ol class="koraci">
              ${t.koraci.map(([ime, o]) => `<li><strong>${esc(ime)}</strong>${esc(o)}</li>`).join('\n              ')}
            </ol>
          </div>
        </div>
      </div>
    </section>`).join('\n');

  return `
<section class="detalj-hero">
  <div class="omot">
    <div class="mrvice"><a href="${p}">Početna</a><span>›</span>Tehnike</div>
    <h1>Tehnike izrade</h1>
    <p class="uvod">
      Iza svake nošnje stoji šest zanata i po nekoliko meseci rada. Ovako je
      izgledao put od ovce i njive do gotove, izvezene odeće.
    </p>
    <div class="meta-red"><span class="znacka">${tehnike.length} tehnika</span></div>
  </div>
</section>
${traka()}
${sekcije}

<section class="sekcija">
  <div class="omot usko tekst-sredina">
    <h2>Gde se ovo još radi</h2>
    <p>Deo ovih zanata živi i danas — u etno-udruženjima, zadrugama i radionicama
       pri muzejima. Neke od njih štiti i Uneskova lista nematerijalnog nasleđa.</p>
    <p class="mt-veliko"><a class="dugme dugme-puno" href="${p}gde-videti/">Muzeji i manifestacije →</a></p>
  </div>
</section>
`;
}
