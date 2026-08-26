export const naslov = 'O projektu';
export const aktivno = 'o-projektu';
export const opis =
  'O sajtu posvećenom srpskoj narodnoj nošnji — cilj, izvori, način izrade ' +
  'i kako doprineti sadržaju.';

export const sara = ({ saraZa }) => saraZa(5, ['#d9b04a', '#a4161a']);

export function telo({ p, esc, traka, nosnje, pojmovnik }) {
  return `
<section class="detalj-hero">
  <div class="omot">
    <div class="mrvice"><a href="${p}">Početna</a><span>›</span>O projektu</div>
    <h1>O projektu</h1>
    <p class="uvod">
      Otvoren, besplatan i pregledan izvor o srpskoj narodnoj nošnji — napravljen
      zato što je ovakvo gradivo do sada bilo razbacano po katalozima, zbornicima
      i muzejskim legendama.
    </p>
    <div class="meta-red">
      <span class="znacka">${nosnje.length} krajeva</span>
      <span class="znacka">${pojmovnik.length} pojmova</span>
      <span class="znacka">Otvoren kod</span>
    </div>
  </div>
</section>
${traka()}

<section class="sekcija">
  <div class="omot">
    <div class="dve-kolone">
      <div class="clanak">
        <h2>Šta ovaj sajt jeste</h2>
        <p>Pregledan uvod u srpsku narodnu nošnju, organizovan na tri načina: po
           krajevima, po delovima odeće i po tehnikama izrade. Pisan je da bude
           razumljiv čoveku koji o temi ne zna ništa, a dovoljno tačan da bude
           koristan onome ko se njome bavi.</p>

        <h2>Šta nije</h2>
        <p>Nije naučni rad ni zamena za muzejski katalog. Etnografska literatura je
           opsežna i mestimično protivrečna — regionalne granice su meke, nazivi se
           razlikuju od sela do sela, a i sama nošnja se menjala kroz vreme. Ovde je
           dat opšti, uprošćen presek.</p>

        <h2>Izvori</h2>
        <p>Sadržaj je zasnovan na opštepoznatoj etnografskoj literaturi o srpskoj
           narodnoj nošnji i na muzejskim postavkama. Za ozbiljniji rad na temi
           preporučujemo publikacije Etnografskog muzeja u Beogradu i zavičajnih
           muzeja pojedinih krajeva.</p>

        <h2>Doprinos</h2>
        <p>Ispravke, dopune i lokalna znanja su dobrodošli. Sav sadržaj i kod se nalaze
           u javnom repozitorijumu — nova građa se dodaje kao izmena podataka, bez
           diranja u izgled sajta.</p>
      </div>

      <div>
        <div class="panel">
          <div class="panel-naslov"><h3>Kako je sajt napravljen</h3></div>
          <ul class="spisak">
            <li><strong>Bez zavisnosti</strong><span>Statički generator u čistom Node.js-u, nijedan npm paket.</span></li>
            <li><strong>Podaci odvojeno</strong><span>Sadržaj živi u <code>site/data/</code>, izgled u <code>site/pages/</code>.</span></li>
            <li><strong>Automatsko objavljivanje</strong><span>Svaki push na <code>main</code> gradi i objavljuje novu verziju.</span></li>
            <li><strong>Dva pisma</strong><span>Latinica i ćirilica, prebacivanje jednim klikom.</span></li>
            <li><strong>Bez praćenja</strong><span>Nema analitike, kolačića ni reklama.</span></li>
          </ul>
        </div>

        <blockquote class="izdvojeno" style="margin-top:24px">
          <span class="izdvojeno-oznaka">Licenca</span>
          <p>Tekst je dostupan pod licencom <strong>CC BY-SA 4.0</strong> — slobodno ga
             koristite i prerađujte uz navođenje izvora i pod istom licencom.</p>
        </blockquote>
      </div>
    </div>
  </div>
</section>
`;
}
