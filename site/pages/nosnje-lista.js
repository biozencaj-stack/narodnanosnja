export const naslov = 'Nošnje po krajevima';
export const aktivno = 'nosnje';
export const opis =
  'Pregled regionalnih tipova srpske narodne nošnje — Šumadija, Vojvodina, ' +
  'zapadna, istočna i južna Srbija, Kosovo i Metohija, Stari Vlah i Mačva.';

export const sara = ({ saraZa }) => saraZa(3, ['#d9b04a', '#a4161a']);

export function telo({ p, esc, traka, saraZa, nosnje, dataUri }) {
  const tipovi = [...new Set(nosnje.map((n) => n.tip))];

  const kartice = nosnje.map((n, i) => `
      <a class="kartica" href="${p}nosnje/${n.slug}/">
        <div class="kartica-slika" style="background-color:${n.boje[2]};background-image:${dataUri(saraZa(i, n.boje))}"></div>
        <div class="kartica-telo">
          <h3>${esc(n.naziv)}</h3>
          <div class="kartica-tip">${esc(n.tip)}</div>
          <p>${esc(n.uvod.slice(0, 150).replace(/\s+\S*$/, ''))}…</p>
          <ul class="cipovi" style="margin-bottom:14px">
            ${n.tehnike.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}
          </ul>
          <div class="kartica-dno">Pogledaj nošnju →</div>
        </div>
      </a>`).join('');

  return `
<section class="detalj-hero">
  <div class="omot">
    <div class="mrvice"><a href="${p}">Početna</a><span>›</span>Nošnje</div>
    <h1>Nošnje po krajevima</h1>
    <p class="uvod">
      Srbija je mala, a njena narodna nošnja iznenađujuće raznolika. Reljef, klima,
      granice carstava i putevi trgovine ostavili su trag na svakom šavu.
    </p>
    <div class="meta-red">
      <span class="znacka">${nosnje.length} krajeva</span>
      ${tipovi.map((t) => `<span class="znacka">${esc(t)}</span>`).join('\n      ')}
    </div>
  </div>
</section>
${traka()}

<section class="sekcija">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Kako se nošnje dele</h2>
      <p>Podela na tipove nije administrativna nego kulturna: prati pravce kretanja
         stanovništva, oblik reljefa i dužinu stranih uticaja. Zato Mačva liči i na
         Vojvodinu i na Šumadiju, a Vranje ni na jedno od njih.</p>
    </div>
    <div class="mreza">${kartice}
    </div>
  </div>
</section>
`;
}
