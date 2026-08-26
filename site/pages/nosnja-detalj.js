/** Stranica jednog kraja: /nosnje/<slug>/ */

export function telo({ p, esc, traka, n, prethodna, sledeca }) {
  const spisak = (stavke) => stavke.map(([ime, opis]) => `
        <li><strong>${esc(ime)}</strong><span>${esc(opis)}</span></li>`).join('');

  const cipovi = (lista) => lista.map((x) => `<li>${esc(x)}</li>`).join('');

  const opisParagrafi = n.opis.map((t) => `<p>${esc(t)}</p>`).join('\n        ');

  const veza = (cilj, smer, oznaka) => cilj
    ? `<a href="${p}nosnje/${cilj.slug}/"><small>${oznaka}</small>${smer === 'nazad' ? '← ' : ''}${esc(cilj.naziv)}${smer === 'napred' ? ' →' : ''}</a>`
    : '<span></span>';

  return `
<section class="detalj-hero">
  <div class="omot">
    <div class="mrvice">
      <a href="${p}">Početna</a><span>›</span>
      <a href="${p}nosnje/">Nošnje</a><span>›</span>${esc(n.naziv)}
    </div>
    <h1>${esc(n.naziv)}</h1>
    <p class="uvod">${esc(n.uvod)}</p>
    <div class="meta-red">
      <span class="znacka">${esc(n.tip)}</span>
      <span class="znacka">${esc(n.podrucje)}</span>
    </div>
  </div>
</section>
${traka()}

<section class="sekcija">
  <div class="omot">
    <div class="dve-kolone">
      <div class="clanak">
        <h2>Osobenosti</h2>
        ${opisParagrafi}
      </div>
      <blockquote class="izdvojeno">
        <span class="izdvojeno-oznaka">Zanimljivost</span>
        <p>${esc(n.zanimljivost)}</p>
      </blockquote>
    </div>
  </div>
</section>

<section class="sekcija sekcija-alt">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Delovi nošnje</h2>
      <p>Kompletan sklop, od košulje do obuće — onako kako se oblačio za svečane prilike.</p>
    </div>
    <div class="dve-kolone">
      <div class="panel">
        <div class="panel-naslov"><h3>Ženska nošnja</h3></div>
        <ul class="spisak">${spisak(n.zenska)}
        </ul>
      </div>
      <div class="panel">
        <div class="panel-naslov"><h3>Muška nošnja</h3></div>
        <ul class="spisak">${spisak(n.muska)}
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="sekcija">
  <div class="omot">
    <div class="dve-kolone">
      <div>
        <h3>Materijali</h3>
        <ul class="cipovi">${cipovi(n.materijali)}</ul>
      </div>
      <div>
        <h3>Tehnike izrade</h3>
        <ul class="cipovi">${cipovi(n.tehnike)}</ul>
        <p style="margin-top:1.2em;font-size:.93rem">
          <a href="${p}tehnike/">Kako se radi svaka od ovih tehnika →</a>
        </p>
      </div>
    </div>

    <div class="dno-navigacija mt-veliko">
      ${veza(prethodna, 'nazad', 'Prethodni kraj')}
      ${veza(sledeca, 'napred', 'Sledeći kraj')}
    </div>
  </div>
</section>
`;
}
