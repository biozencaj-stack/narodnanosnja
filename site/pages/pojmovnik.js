export const naslov = 'Pojmovnik';
export const aktivno = 'pojmovnik';
export const opis =
  'Objašnjenja delova srpske narodne nošnje: zubun, jelek, tkanica, opanci, ' +
  'šajkača, pafte, srma, zlatovez, šlingeraj i drugi pojmovi.';

export const sara = ({ saraZa }) => saraZa(0, ['#d9b04a', '#a4161a']);

export function telo({ p, esc, traka, pojmovnik }) {
  const grupe = [...new Set(pojmovnik.map((x) => x.grupa))].sort((a, b) => a.localeCompare(b, 'sr'));

  const filteri = ['sve', ...grupe].map((g, i) => `
        <button class="filter" type="button" data-grupa="${esc(g)}"
                aria-pressed="${i === 0 ? 'true' : 'false'}">${g === 'sve' ? 'Sve' : esc(g)}</button>`).join('');

  const stavke = [...pojmovnik]
    .sort((a, b) => a.pojam.localeCompare(b.pojam, 'sr'))
    .map((x) => `
      <li class="pojam" data-grupa="${esc(x.grupa)}" data-trazi="${esc(x.pojam + ' ' + x.grupa + ' ' + x.opis)}">
        <span class="grupa">${esc(x.grupa)}</span>
        <h3>${esc(x.pojam)}</h3>
        <p>${esc(x.opis)}</p>
      </li>`).join('');

  return `
<section class="detalj-hero">
  <div class="omot">
    <div class="mrvice"><a href="${p}">Početna</a><span>›</span>Pojmovnik</div>
    <h1>Pojmovnik nošnje</h1>
    <p class="uvod">
      Zubun, gunj, tkanica, silav, pafte, srma — reči koje se u opisima nošnje
      stalno ponavljaju, objašnjene na jednom mestu.
    </p>
    <div class="meta-red">
      <span class="znacka">${pojmovnik.length} pojmova</span>
      <span class="znacka">${grupe.length} grupa</span>
    </div>
  </div>
</section>
${traka()}

<section class="sekcija">
  <div class="omot">
    <div class="alatke">
      <label class="samo-citac" for="pretraga-pojmova">Pretraži pojmove</label>
      <input class="pretraga" id="pretraga-pojmova" type="search"
             placeholder="Pretraži pojmove — npr. zubun, srma, opanci…" autocomplete="off">
      <div class="filteri" role="group" aria-label="Filtriranje po grupi">${filteri}
      </div>
    </div>

    <ul class="stavke" data-pojmovnik>${stavke}
    </ul>
    <p class="prazno" hidden>Nema pojma koji odgovara pretrazi. Pokušajte drugu reč.</p>
  </div>
</section>
`;
}
