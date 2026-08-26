export const naslov = 'Početna';
export const aktivno = 'pocetna';
export const opis =
  'Srpska narodna nošnja po krajevima: Šumadija, Vojvodina, Kosovo i Metohija, ' +
  'jug i istok Srbije. Delovi odeće, tkanine, vez i tehnike izrade.';

export const sara = ({ saraZa }) => saraZa(1, ['#d9b04a', '#a4161a']);

export function telo({ p, esc, traka, saraZa, nosnje, pojmovnik, dataUri }) {
  const kartice = nosnje.map((n, i) => `
      <a class="kartica" href="${p}nosnje/${n.slug}/">
        <div class="kartica-slika" style="background-color:${n.boje[2]};background-image:${dataUri(saraZa(i, n.boje))}"></div>
        <div class="kartica-telo">
          <h3>${esc(n.naziv)}</h3>
          <div class="kartica-tip">${esc(n.tip)}</div>
          <p>${esc(n.uvod.slice(0, 132).replace(/\s+\S*$/, ''))}…</p>
          <div class="kartica-dno">Pogledaj nošnju →</div>
        </div>
      </a>`).join('');

  const delovi = ['Zubun', 'Šajkača', 'Tkanica', 'Opanci', 'Pregača / kecelja', 'Zlatovez']
    .map((ime) => pojmovnik.find((x) => x.pojam === ime))
    .filter(Boolean)
    .map((x) => `
        <li class="stavka">
          <span class="mesto">${esc(x.grupa)}</span>
          <h3>${esc(x.pojam)}</h3>
          <p>${esc(x.opis.slice(0, 128).replace(/\s+\S*$/, ''))}…</p>
        </li>`).join('');

  return `
<section class="hero">
  <div class="omot hero-sadrzaj">
    <span class="nadnaslov">Odeća koja pamti</span>
    <h1>Srpska <em>narodna nošnja</em></h1>
    <p class="hero-uvod">
      Osam krajeva, osam načina da se čovek obuče — od belog kosovskog zubuna i
      šumadijskog sukna do vranjske srme i vojvođanske svile. Pregled onoga što
      se vekovima tkalo, vezlo i nasleđivalo.
    </p>
    <div class="dugmad">
      <a class="dugme dugme-puno" href="${p}nosnje/">Istraži krajeve</a>
      <a class="dugme dugme-prazno" href="${p}pojmovnik/">Pojmovnik delova</a>
    </div>
  </div>
</section>
${traka()}

<section class="sekcija">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Nošnja nije kostim</h2>
      <p>Bila je to radna, svečana i obredna odeća u isto vreme — i najtačniji zapis
         o tome ko je čovek bio.</p>
    </div>
    <div class="dve-kolone">
      <div class="clanak">
        <p>Sve što se nosilo nastajalo je u kući: lan i konoplja su se sejali, brali,
           potapali i tkali; vuna se strigla, prela i valjala u sukno. Od setve do
           gotove košulje prolazilo je i po godinu dana rada.</p>
        <p>Zato je nošnja govorila glasno. Po kroju se znalo iz kog je sela čovek, po
           boji marame da li je žena udata, devojka ili u žalosti, po količini sukna i
           po broju dukata koliko kuća stoji. Ništa na njoj nije bilo slučajno.</p>
      </div>
      <blockquote class="izdvojeno">
        <span class="izdvojeno-oznaka">Tri sloja svake nošnje</span>
        <p><strong>Osnova</strong> — košulja od domaćeg platna, ista logika kroja od
           Vojvodine do Vranja.</p>
        <p><strong>Sloj toplote</strong> — sukno, vuna, zubun i gunj, srazmerno oštrini
           podneblja.</p>
        <p><strong>Sloj znaka</strong> — vez, gajtan, pojas i nakit, koji nose sve
           poruke o statusu, kraju i uzrastu.</p>
      </blockquote>
    </div>
  </div>
</section>

<section class="sekcija sekcija-alt">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Krajevi i tipovi</h2>
      <p>Etnolozi srpsku nošnju dele na nekoliko velikih tipova — panonski, dinarski,
         centralnobalkanski i vardarsko-moravski. Evo kako izgledaju u praksi.</p>
    </div>
    <div class="mreza">${kartice}
    </div>
  </div>
</section>

<section class="sekcija">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Delovi nošnje</h2>
      <p>Nazivi koji se stalno vraćaju, objašnjeni jednom i za svagda.</p>
    </div>
    <ul class="stavke">${delovi}
    </ul>
    <p class="mt-veliko"><a class="dugme dugme-puno" href="${p}pojmovnik/">Ceo pojmovnik →</a></p>
  </div>
</section>
${traka()}

<section class="sekcija sekcija-alt">
  <div class="omot usko tekst-sredina">
    <h2>Kako je nastajala</h2>
    <p>Tkanje na razboju, valjanje sukna, vez srmom, šlingeraj i pletenje čarapa —
       šest zanata bez kojih nijedne nošnje ne bi bilo.</p>
    <p class="mt-veliko">
      <a class="dugme dugme-puno" href="${p}tehnike/">Tehnike izrade</a>
      <a class="dugme dugme-obris" href="${p}gde-videti/" style="margin-left:8px">Gde je videti uživo</a>
    </p>
  </div>
</section>
`;
}
