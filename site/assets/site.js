/* Srpska narodna nošnja — klijentske skripte.
   1) prebacivanje pisma latinica <-> ćirilica
   2) mobilni meni
   3) pretraga i filtriranje pojmovnika                                    */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Pismo
   * ------------------------------------------------------------------ */

  // Digrafi moraju ići pre pojedinačnih slova.
  var PAROVI = [
    ['DŽ', 'Џ'], ['Dž', 'Џ'], ['dž', 'џ'],
    ['LJ', 'Љ'], ['Lj', 'Љ'], ['lj', 'љ'],
    ['NJ', 'Њ'], ['Nj', 'Њ'], ['nj', 'њ'],
    ['A', 'А'], ['B', 'Б'], ['C', 'Ц'], ['Č', 'Ч'], ['Ć', 'Ћ'], ['D', 'Д'],
    ['Đ', 'Ђ'], ['E', 'Е'], ['F', 'Ф'], ['G', 'Г'], ['H', 'Х'], ['I', 'И'],
    ['J', 'Ј'], ['K', 'К'], ['L', 'Л'], ['M', 'М'], ['N', 'Н'], ['O', 'О'],
    ['P', 'П'], ['R', 'Р'], ['S', 'С'], ['Š', 'Ш'], ['T', 'Т'], ['U', 'У'],
    ['V', 'В'], ['Z', 'З'], ['Ž', 'Ж'],
    ['a', 'а'], ['b', 'б'], ['c', 'ц'], ['č', 'ч'], ['ć', 'ћ'], ['d', 'д'],
    ['đ', 'ђ'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'],
    ['j', 'ј'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'],
    ['p', 'п'], ['r', 'р'], ['s', 'с'], ['š', 'ш'], ['t', 'т'], ['u', 'у'],
    ['v', 'в'], ['z', 'з'], ['ž', 'ж']
  ];

  // Reči u kojima "nj", "lj" ili "dž" nisu jedan glas nego dva.
  var IZUZECI = {
    'injekcija': 'инјекција', 'konjunkcija': 'конјункција',
    'nadživeti': 'надживети', 'nadživi': 'надживи', 'podžanr': 'поджанр'
  };

  var izvorno = new WeakMap();

  function uCirilicu(tekst) {
    var reci = tekst.split(/(\s+)/);
    for (var i = 0; i < reci.length; i++) {
      var mala = reci[i].toLowerCase();
      if (Object.prototype.hasOwnProperty.call(IZUZECI, mala)) { reci[i] = IZUZECI[mala]; continue; }
      var r = reci[i];
      for (var j = 0; j < PAROVI.length; j++) r = r.split(PAROVI[j][0]).join(PAROVI[j][1]);
      reci[i] = r;
    }
    return reci.join('');
  }

  function tekstualniCvorovi(koren) {
    var hodac = document.createTreeWalker(koren, NodeFilter.SHOW_TEXT, {
      acceptNode: function (cvor) {
        if (!cvor.nodeValue || !cvor.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var e = cvor.parentElement;
        while (e) {
          var t = e.tagName;
          if (t === 'SCRIPT' || t === 'STYLE' || t === 'CODE' || e.hasAttribute('data-pismo-skip')) {
            return NodeFilter.FILTER_REJECT;
          }
          e = e.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var lista = [], c;
    while ((c = hodac.nextNode())) lista.push(c);
    return lista;
  }

  function primeniPismo(pismo) {
    var cvorovi = tekstualniCvorovi(document.body);
    for (var i = 0; i < cvorovi.length; i++) {
      var cvor = cvorovi[i];
      if (!izvorno.has(cvor)) izvorno.set(cvor, cvor.nodeValue);
      cvor.nodeValue = pismo === 'cir' ? uCirilicu(izvorno.get(cvor)) : izvorno.get(cvor);
    }
    document.documentElement.setAttribute('data-pismo', pismo);
    var dugme = document.querySelector('.pismo-dugme');
    if (dugme) {
      dugme.textContent = pismo === 'cir' ? 'Latinica' : 'Ћирилица';
      dugme.setAttribute('aria-label', pismo === 'cir'
        ? 'Prebaci sadržaj na latinicu'
        : 'Prebaci sadržaj na ćirilicu');
    }
  }

  function sacuvanoPismo() {
    try { return localStorage.getItem('pismo') || 'lat'; } catch (e) { return 'lat'; }
  }

  function postaviPismo() {
    var dugme = document.querySelector('.pismo-dugme');
    primeniPismo(sacuvanoPismo());
    if (!dugme) return;
    dugme.addEventListener('click', function () {
      var novo = document.documentElement.getAttribute('data-pismo') === 'cir' ? 'lat' : 'cir';
      primeniPismo(novo);
      try { localStorage.setItem('pismo', novo); } catch (e) { /* privatni režim */ }
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Mobilni meni
   * ------------------------------------------------------------------ */

  function postaviMeni() {
    var dugme = document.querySelector('.meni-dugme');
    var nav = document.querySelector('.navigacija');
    if (!dugme || !nav) return;
    dugme.addEventListener('click', function () {
      var otvoren = nav.classList.toggle('otvoren');
      dugme.setAttribute('aria-expanded', otvoren ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('otvoren');
        dugme.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 3. Pojmovnik
   * ------------------------------------------------------------------ */

  function bezKvacica(s) {
    return s.toLowerCase()
      .replace(/[čć]/g, 'c').replace(/đ/g, 'dj').replace(/š/g, 's').replace(/ž/g, 'z')
      .replace(/[чћ]/g, 'c').replace(/ђ/g, 'dj').replace(/ш/g, 's').replace(/ж/g, 'z');
  }

  function postaviPojmovnik() {
    var spisak = document.querySelector('[data-pojmovnik]');
    if (!spisak) return;
    var polje = document.querySelector('.pretraga');
    var filteri = Array.prototype.slice.call(document.querySelectorAll('.filter'));
    var stavke = Array.prototype.slice.call(spisak.querySelectorAll('.pojam'));
    var prazno = document.querySelector('.prazno');
    var aktivnaGrupa = 'sve';

    function osvezi() {
      var upit = bezKvacica(polje ? polje.value.trim() : '');
      var vidljivih = 0;
      stavke.forEach(function (s) {
        var grupaOk = aktivnaGrupa === 'sve' || s.getAttribute('data-grupa') === aktivnaGrupa;
        var tekstOk = !upit || bezKvacica(s.getAttribute('data-trazi') || '').indexOf(upit) !== -1;
        var vidi = grupaOk && tekstOk;
        s.hidden = !vidi;
        if (vidi) vidljivih++;
      });
      if (prazno) prazno.hidden = vidljivih !== 0;
    }

    if (polje) polje.addEventListener('input', osvezi);
    filteri.forEach(function (f) {
      f.addEventListener('click', function () {
        aktivnaGrupa = f.getAttribute('data-grupa');
        filteri.forEach(function (d) { d.setAttribute('aria-pressed', d === f ? 'true' : 'false'); });
        osvezi();
      });
    });
    osvezi();
  }

  /* ------------------------------------------------------------------ */

  function start() { postaviPismo(); postaviMeni(); postaviPojmovnik(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
