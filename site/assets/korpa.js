/* Korpa — čuva se u localStorage-u pregledača.
 *
 * U korpi se pamte SAMO slug i količina. Cena, naziv i stanje se svaki put
 * čitaju iz kataloga ugrađenog u stranicu, pa korpa ne može da zadrži staru
 * cenu ako se cena u međuvremenu promeni.                                   */

(function () {
  'use strict';

  var KLJUC = 'korpa-v1';

  /* ---------------------------------------------------------------- *
   * Skladište
   * ---------------------------------------------------------------- */

  function ucitaj() {
    try {
      var sirovo = localStorage.getItem(KLJUC);
      if (!sirovo) return [];
      var lista = JSON.parse(sirovo);
      if (!Array.isArray(lista)) return [];
      return lista.filter(function (s) {
        return s && typeof s.slug === 'string' && s.kolicina > 0;
      });
    } catch (e) {
      return [];
    }
  }

  function sacuvaj(lista) {
    try {
      localStorage.setItem(KLJUC, JSON.stringify(lista));
    } catch (e) { /* privatni režim — korpa radi do osvežavanja */ }
    osveziBroj();
    document.dispatchEvent(new CustomEvent('korpa:promena'));
  }

  function dodaj(slug, kolicina) {
    var lista = ucitaj();
    var post = lista.filter(function (s) { return s.slug === slug; })[0];
    if (post) post.kolicina += (kolicina || 1);
    else lista.push({ slug: slug, kolicina: kolicina || 1 });
    sacuvaj(lista);
  }

  function postavi(slug, kolicina) {
    var lista = ucitaj().filter(function (s) {
      return s.slug !== slug || kolicina > 0;
    });
    lista.forEach(function (s) { if (s.slug === slug) s.kolicina = kolicina; });
    sacuvaj(lista);
  }

  function isprazni() { sacuvaj([]); }

  function ukupnoKomada() {
    return ucitaj().reduce(function (z, s) { return z + s.kolicina; }, 0);
  }

  /* ---------------------------------------------------------------- *
   * Prikaz broja u zaglavlju
   * ---------------------------------------------------------------- */

  function osveziBroj() {
    var n = ukupnoKomada();
    [].slice.call(document.querySelectorAll('[data-korpa-broj]')).forEach(function (e) {
      e.textContent = String(n);
      e.hidden = n === 0;
    });
  }

  /* ---------------------------------------------------------------- *
   * Katalog ugrađen u stranicu
   * ---------------------------------------------------------------- */

  function katalog() {
    var el = document.getElementById('katalog-podaci');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  function dinar(n) {
    return new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(n) + ' RSD';
  }

  /* ---------------------------------------------------------------- *
   * Dugme „Dodaj u korpu“
   * ---------------------------------------------------------------- */

  function postaviDugmad() {
    [].slice.call(document.querySelectorAll('[data-dodaj]')).forEach(function (d) {
      d.addEventListener('click', function () {
        var slug = d.getAttribute('data-dodaj');
        var polje = document.querySelector('[data-kolicina]');
        var kol = polje ? Math.max(1, parseInt(polje.value, 10) || 1) : 1;
        dodaj(slug, kol);

        var stari = d.textContent;
        d.textContent = 'Dodato u korpu ✓';
        d.classList.add('dodato');
        setTimeout(function () {
          d.textContent = stari;
          d.classList.remove('dodato');
        }, 1800);
      });
    });
  }

  /* ---------------------------------------------------------------- *
   * Stranica korpe
   * ---------------------------------------------------------------- */

  function postaviStranicuKorpe() {
    var koren = document.querySelector('[data-korpa-stranica]');
    if (!koren) return;

    var podaci = katalog();
    var spisak = koren.querySelector('[data-korpa-spisak]');
    var prazna = koren.querySelector('[data-korpa-prazna]');
    var puna = koren.querySelector('[data-korpa-puna]');
    var forma = koren.querySelector('[data-porudzbina-forma]');

    function stavke() {
      if (!podaci) return [];
      return ucitaj().map(function (s) {
        var pr = podaci.proizvodi.filter(function (x) { return x.slug === s.slug; })[0];
        return pr ? { pr: pr, kolicina: s.kolicina } : null;
      }).filter(Boolean);
    }

    function iscrtaj() {
      var lista = stavke();
      var imaIh = lista.length > 0;
      if (prazna) prazna.hidden = imaIh;
      if (puna) puna.hidden = !imaIh;
      if (!imaIh) { if (spisak) spisak.innerHTML = ''; return; }

      spisak.innerHTML = lista.map(function (s) {
        return '<li class="korpa-red">' +
          '<img class="korpa-slika" src="' + s.pr.slika + '" alt="" width="84" height="84">' +
          '<div class="korpa-opis">' +
            '<a href="' + s.pr.veza + '">' + s.pr.naziv + '</a>' +
            '<span class="korpa-sifra">' + s.pr.sifra + '</span>' +
          '</div>' +
          '<div class="korpa-kolicina">' +
            '<button type="button" data-manje="' + s.pr.slug + '" aria-label="Smanji količinu">−</button>' +
            '<span>' + s.kolicina + '</span>' +
            '<button type="button" data-vise="' + s.pr.slug + '" aria-label="Povećaj količinu">+</button>' +
          '</div>' +
          '<div class="korpa-cena">' + dinar(s.pr.cena * s.kolicina) + '</div>' +
          '<button class="korpa-izbaci" type="button" data-izbaci="' + s.pr.slug + '" ' +
            'aria-label="Izbaci ' + s.pr.naziv + ' iz korpe">×</button>' +
        '</li>';
      }).join('');

      var roba = lista.reduce(function (z, s) { return z + s.pr.cena * s.kolicina; }, 0);
      var isp = podaci.isporuka;
      var postarina = roba >= isp.besplatnoPreko ? 0 : isp.cena;

      postavi_(koren, '[data-zbir-roba]', dinar(roba));
      postavi_(koren, '[data-zbir-postarina]', postarina === 0 ? 'Besplatno' : dinar(postarina));
      postavi_(koren, '[data-zbir-ukupno]', dinar(roba + postarina));

      var doBesplatne = koren.querySelector('[data-do-besplatne]');
      if (doBesplatne) {
        var fali = isp.besplatnoPreko - roba;
        doBesplatne.hidden = fali <= 0;
        var iznos = doBesplatne.querySelector('[data-fali]');
        if (iznos) iznos.textContent = dinar(Math.max(0, fali));
      }
    }

    function postavi_(k, sel, tekst) {
      var e = k.querySelector(sel);
      if (e) e.textContent = tekst;
    }

    koren.addEventListener('click', function (e) {
      var t = e.target;
      var slug;
      if ((slug = t.getAttribute && t.getAttribute('data-vise'))) {
        var a = ucitaj().filter(function (s) { return s.slug === slug; })[0];
        postavi(slug, (a ? a.kolicina : 0) + 1);
      } else if ((slug = t.getAttribute && t.getAttribute('data-manje'))) {
        var b = ucitaj().filter(function (s) { return s.slug === slug; })[0];
        postavi(slug, Math.max(0, (b ? b.kolicina : 0) - 1));
      } else if ((slug = t.getAttribute && t.getAttribute('data-izbaci'))) {
        postavi(slug, 0);
      } else return;
      iscrtaj();
    });

    document.addEventListener('korpa:promena', iscrtaj);
    iscrtaj();

    /* --- Slanje porudžbine --- */
    if (forma) {
      forma.addEventListener('submit', function (e) {
        e.preventDefault();
        var poruka = koren.querySelector('[data-porudzbina-poruka]');
        var dugme = forma.querySelector('button[type="submit"]');
        var lista = stavke();
        if (!lista.length) return;

        var podatak = {
          kupac: Object.fromEntries(new FormData(forma).entries()),
          stavke: lista.map(function (s) {
            return { sifra: s.pr.sifra, naziv: s.pr.naziv, kolicina: s.kolicina, cena: s.pr.cena };
          }),
          nacinPlacanja: 'pouzecem',
        };

        dugme.disabled = true;
        var stari = dugme.textContent;
        dugme.textContent = 'Šaljem…';

        fetch(podaci.krajnjaTacka, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(podatak),
        }).then(function (o) {
          if (!o.ok) throw new Error('status ' + o.status);
          return o.json().catch(function () { return {}; });
        }).then(function () {
          isprazni();
          poruka.className = 'poruka poruka-uspeh';
          poruka.textContent = podaci.porukaUspeh;
          poruka.hidden = false;
          forma.hidden = true;
          iscrtaj();
        }).catch(function () {
          poruka.className = 'poruka poruka-greska';
          poruka.textContent = podaci.porukaGreska;
          poruka.hidden = false;
          dugme.disabled = false;
          dugme.textContent = stari;
        });
      });
    }
  }

  /* ---------------------------------------------------------------- */

  function start() {
    osveziBroj();
    postaviDugmad();
    postaviStranicuKorpe();
  }

  // Korpa otvorena u drugom jezičku mora da se odrazi i ovde.
  window.addEventListener('storage', function (e) {
    if (e.key === KLJUC) { osveziBroj(); document.dispatchEvent(new CustomEvent('korpa:promena')); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Korpa = { dodaj: dodaj, postavi: postavi, isprazni: isprazni, ucitaj: ucitaj };
})();
