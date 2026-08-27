export const naslov = 'Prodavnica';
export const aktivno = 'prodavnica';
export const opis =
  'Ručno tkani šalovi, tkanice, torbe, ćilimi i delovi narodne nošnje. ' +
  'Svaki komad rađen na razboju, plaćanje pouzećem, isporuka širom Srbije.';

export const sara = ({ saraZa }) => saraZa(0, ['#d9b04a', '#a4161a']);

/** Kartica proizvoda — koristi se i ovde i na stranici kategorije. */
export function karticaProizvoda({ p, esc, cena, stanje, slikaProizvoda, kategorije }, pr) {
  const k = kategorije.find((x) => x.slug === pr.kategorija);
  const sl = slikaProizvoda(pr, k, p);
  const st = stanje(pr.stanje);
  const nizaCena = pr.staraCena && pr.staraCena > pr.cena;

  return `
      <li class="proizvod">
        <a class="proizvod-veza" href="${p}proizvod/${pr.slug}/">
          <div class="proizvod-slika${sl.mestodrzac ? ' mestodrzac' : ''}"
               style="${sl.mestodrzac
                 ? `background-color:${k.boje[2]};background-image:${sl.src}`
                 : `background-image:url('${esc(sl.src)}')`}"
               role="img" aria-label="${esc(sl.opis)}">
            ${nizaCena ? '<span class="oznaka oznaka-akcija">Sniženo</span>' : ''}
            ${pr.stanje !== 'na-stanju' ? `<span class="oznaka oznaka-${st.klasa}">${esc(st.tekst)}</span>` : ''}
          </div>
          <div class="proizvod-telo">
            <span class="proizvod-kat">${esc(k.naziv)}</span>
            <h3>${esc(pr.naziv)}</h3>
            <div class="proizvod-cena">
              ${nizaCena ? `<s>${esc(cena(pr.staraCena))}</s> ` : ''}
              <strong>${esc(cena(pr.cena))}</strong>
            </div>
          </div>
        </a>
        ${pr.stanje === 'rasprodato'
          ? '<button class="dugme dugme-puno proizvod-dugme" type="button" disabled>Rasprodato</button>'
          : `<button class="dugme dugme-puno proizvod-dugme" type="button" data-dodaj="${esc(pr.slug)}">Dodaj u korpu</button>`}
      </li>`;
}

export function telo(ctx) {
  const { p, esc, traka, kategorije, proizvodi, dataUri, saraZa } = ctx;

  const istaknuti = proizvodi.filter((x) => x.istaknut).slice(0, 4);

  const katKartice = kategorije.map((k, i) => {
    const broj = proizvodi.filter((x) => x.kategorija === k.slug).length;
    return `
      <a class="kartica" href="${p}prodavnica/${k.slug}/">
        <div class="kartica-slika" style="background-color:${k.boje[2]};background-image:${dataUri(saraZa(i, k.boje))}"></div>
        <div class="kartica-telo">
          <h3>${esc(k.naziv)}</h3>
          <div class="kartica-tip">${broj} ${broj === 1 ? 'proizvod' : broj < 5 ? 'proizvoda' : 'proizvoda'}</div>
          <p>${esc(k.kratko)}</p>
          <div class="kartica-dno">Pogledaj →</div>
        </div>
      </a>`;
  }).join('');

  const sviProizvodi = proizvodi.map((pr) => karticaProizvoda(ctx, pr)).join('');
  const istaknutiHtml = istaknuti.map((pr) => karticaProizvoda(ctx, pr)).join('');

  return `
<section class="detalj-hero">
  <div class="omot">
    <div class="mrvice"><a href="${p}">Početna</a><span>›</span>Prodavnica</div>
    <h1>Prodavnica</h1>
    <p class="uvod">
      Ručno tkani komadi — šalovi, tkanice, torbe i delovi nošnje. Svaki je rađen
      na razboju, po šarama koje se u ovim krajevima tkaju vekovima.
    </p>
    <div class="meta-red">
      <span class="znacka">${proizvodi.length} proizvoda</span>
      <span class="znacka">Plaćanje pouzećem</span>
      <span class="znacka">Isporuka u Srbiji</span>
    </div>
  </div>
</section>
${traka()}

<section class="sekcija">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Izdvojeno</h2>
      <p>Komadi koje najčešće preporučujemo — i za sebe i za poklon.</p>
    </div>
    <ul class="proizvodi">${istaknutiHtml}
    </ul>
  </div>
</section>

<section class="sekcija sekcija-alt">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Kategorije</h2>
      <p>Isti razboj, različita namena.</p>
    </div>
    <div class="mreza">${katKartice}
    </div>
  </div>
</section>

<section class="sekcija">
  <div class="omot">
    <div class="sekcija-zaglavlje">
      <h2>Svi proizvodi</h2>
      <p>Ceo asortiman na jednom mestu.</p>
    </div>
    <ul class="proizvodi">${sviProizvodi}
    </ul>
  </div>
</section>
${traka()}

<section class="sekcija sekcija-alt">
  <div class="omot usko tekst-sredina">
    <h2>Kako naručivanje ide</h2>
    <p>Dodate u korpu, ostavite podatke i porudžbina stiže nama. Plaćate kuriru
       prilikom preuzimanja — bez uplata unapred i bez kartice na sajtu.</p>
    <p class="mt-veliko"><a class="dugme dugme-obris" href="${p}isporuka-i-placanje/">Isporuka i plaćanje →</a></p>
  </div>
</section>
`;
}
