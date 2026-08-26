// Podaci o regionalnim tipovima srpske narodne nošnje.
// Svaki unos generiše zasebnu stranicu: /nosnje/<slug>/

export const nosnje = [
  {
    slug: 'sumadija',
    naziv: 'Šumadija',
    tip: 'Centralnobalkanski tip',
    podrucje: 'Kragujevac, Topola, Aranđelovac, Rudnik, Gruža',
    boje: ['#8c1c13', '#c9a227', '#f3ead8'],
    uvod:
      'Šumadijska nošnja je onaj sklop odeće koji se u Srbiji najčešće doživljava kao ' +
      '„nacionalna nošnja“. Formirala se tokom XIX veka, u vreme obnovljene srpske ' +
      'države, kada su se na staru seosku osnovu od domaćeg platna i sukna nakalemili ' +
      'gradski i vojnički uticaji iz Beograda i Kragujevca.',
    opis: [
      'Osnovu čini domaće belo platno od lana i konoplje, preko koga se nose delovi od ' +
      'valjanog vunenog sukna — obično tamnomodrog, mrkog ili crnog. Sukno je bilo skupo ' +
      'i radno zahtevno, pa je količina sukna na čoveku govorila o imovnom stanju kuće.',
      'Krajem XIX i početkom XX veka šumadijska nošnja postaje sve raskošnija: javljaju se ' +
      'gajtani od crnog i modrog sviloka, zlatovez na jelecima i sve više kupovnog materijala ' +
      'sa pijace. Upravo taj kasni, „bogati“ oblik danas nose folklorni ansambli.',
    ],
    zenska: [
      ['Košulja', 'Duga, od belog domaćeg platna, sa vezom oko vrata, na rukavima i po skutovima.'],
      ['Jelek', 'Prsluk bez rukava od sukna ili kadife, opšiven gajtanima i zlatovezom.'],
      ['Zubun', 'Duga bela suknena haljina bez rukava, sa crvenim i modrim vezom po ivicama.'],
      ['Pregača', 'Tkana na razboju, sa geometrijskim šarama u crvenoj, crnoj i zelenoj.'],
      ['Tkanica', 'Široki tkani pojas, često sa metalnim paftama.'],
      ['Oglavlje', 'Devojke gologlave sa pletenicom, udate žene sa maramom ili konđom.'],
      ['Opanci', 'Kožni, šiljkani („sa kljunom“), preko vunenih čarapa sa šarama.'],
    ],
    muska: [
      ['Košulja', 'Od belog platna, kratka do pojasa, sa vezom na okovratniku.'],
      ['Čakšire', 'Uske pantalone od sukna, sa gajtanima po bedrima i džepovima.'],
      ['Gunj / gunjac', 'Kratki sukneni kaput sa rukavima, tamnomodar ili mrk.'],
      ['Jelek', 'Prsluk od sukna sa gajtanima, često sa dugmadima u nizu.'],
      ['Šajkača', 'Suknena kapa sa karakterističnim „V“ prelomom na temenu.'],
      ['Tkanica ili silav', 'Pojas; silav je kožni, sa pregradama za oružje i duvan.'],
      ['Opanci', 'Šiljkani opanci preko belih ili šarenih vunenih čarapa.'],
    ],
    materijali: ['lan', 'konoplja', 'vuna', 'valjano sukno', 'kadifa', 'srma', 'koža'],
    tehnike: ['tkanje na razboju', 'zlatovez', 'gajtaniranje', 'vez u krstićima'],
    zanimljivost:
      'Šajkača je ime dobila po šajkašima — rečnim vojnicima na Dunavu i Savi. Iz vojničke ' +
      'kape prešla je u seosku svakodnevicu i postala jedan od najprepoznatljivijih srpskih ' +
      'odevnih znakova.',
  },
  {
    slug: 'vojvodina',
    naziv: 'Vojvodina',
    tip: 'Panonski tip',
    podrucje: 'Bačka, Banat, Srem',
    boje: ['#1d3f6e', '#c9a227', '#f5f0e6'],
    uvod:
      'Panonska ravnica je vekovima bila raskrsnica, pa je vojvođanska nošnja najranije ' +
      'primila gradske i zanatske uticaje. Umesto domaćeg sukna, ovde rano ulaze kupovne ' +
      'tkanine: svila, damast, brokat, fabrička čipka.',
    opis: [
      'Ženska nošnja je krojena, a ne obavijena: široka nabrana suknja, uska bluza i prsluk ' +
      'stvaraju siluetu bližu srednjoevropskoj modi XIX veka nego balkanskoj tradiciji.',
      'Vojvođanski „šlingeraj“ — bela vezena čipka na belom platnu — postao je zaštitni znak ' +
      'kraja. Radio se na tanušnom platnu, s motivima ruža, grozdova i vinove loze.',
      'Bogatstvo se pokazivalo dukatima: niz zlatnika oko vrata bio je i nakit i miraz i ' +
      'porodična štednja u isto vreme.',
    ],
    zenska: [
      ['Rekla', 'Uska bluza sa dugim rukavima, od svile ili tankog platna.'],
      ['Suknja', 'Široka, gusto nabrana, često od svile na cvetove.'],
      ['Kecelja', 'Svilena ili od šlingovanog platna, uža od suknje, vezana napred.'],
      ['Prsluk', 'Kratak, pripijen, od kadife ili brokata, sa svilenim gajtanima.'],
      ['Đerdan od dukata', 'Niz zlatnika ili srebrnjaka oko vrata — nakit i imovina.'],
      ['Marama', 'Svilena, sa resama; devojke je vezuju drugačije nego udate žene.'],
      ['Cipele ili čizme', 'Kožne, kupovne — ne opanci, za razliku od brdskih krajeva.'],
    ],
    muska: [
      ['Košulja', 'Bela, sa širokim rukavima, ponekad sa šlingovanim manžetnama.'],
      ['Gaće', 'Široke platnene nogavice, letnji radni deo nošnje.'],
      ['Prsluk', 'Od tamnog sukna ili kadife, sa dva reda dugmadi.'],
      ['Lajbek / kaput', 'Kratak gornji deo, gradskog kroja.'],
      ['Šešir', 'Crni filcani šešir sa uskim obodom — umesto šajkače.'],
      ['Čizme', 'Visoke kožne čizme sa tvrdim sarama.'],
    ],
    materijali: ['svila', 'damast', 'brokat', 'fino platno', 'kadifa', 'zlatnici'],
    tehnike: ['šlingeraj', 'čipkarstvo', 'svileni vez', 'nabiranje i plisiranje'],
    zanimljivost:
      'U bogatijim bačkim kućama devojačka sprema je znala da ima i preko dvadeset kompletnih ' +
      'nošnji — za svaki crkveni praznik, za svadbu, za žalost i za nedeljno kolo posebno.',
  },
  {
    slug: 'zapadna-srbija',
    naziv: 'Zapadna Srbija',
    tip: 'Dinarski tip',
    podrucje: 'Zlatibor, Užice, Dragačevo, Valjevo',
    boje: ['#4a5d3a', '#8c1c13', '#efe6d4'],
    uvod:
      'Planinski, dinarski tip nošnje — ozbiljan, težak i topao. Ovde je vuna kralj: sukno, ' +
      'čarape, struke i ćebad izlazili su iz iste kuće u kojoj se ovca i šišala.',
    opis: [
      'Karakterističan je beli zubun od valjanog sukna, opšiven crvenim i crnim vezom po ' +
      'rubovima, ramenima i džepovima. Nosi se preko košulje, i zimi i leti.',
      'Vunene čarape zapadne Srbije su zaseban zanat: geometrijske šare u crvenoj, crnoj i ' +
      'beloj čitale su se kao potpis — po šari se znalo iz kog je sela pletilja.',
      'Muška nošnja je tamnija i strožija nego u Šumadiji, sa naglašenim gajtanima i ' +
      'tvrdo krojenim čakširama.',
    ],
    zenska: [
      ['Košulja od lana', 'Duga, sa vezom po skutovima i rukavima.'],
      ['Zubun', 'Beli sukneni ogrtač bez rukava, sa crvenim vezom — glavni deo.'],
      ['Pregača', 'Tkana od vune, sa krupnim geometrijskim šarama.'],
      ['Tkanica', 'Vuneni tkani pojas, obavija se nekoliko puta.'],
      ['Vunene čarape', 'Do kolena, sa romboidnim i zvezdastim šarama.'],
      ['Marama', 'Bela ili crvena, vezana ispod brade.'],
    ],
    muska: [
      ['Košulja', 'Od domaćeg platna, kratkog kroja.'],
      ['Čakšire', 'Od mrkog ili modrog sukna, uske u nogavici.'],
      ['Jelek i gunj', 'Sukneni, sa crnim gajtanima.'],
      ['Struka', 'Vuneni ogrtač-ćebe, prebacuje se preko ramena.'],
      ['Šubara', 'Zimska kapa od jagnjeće kože.'],
      ['Opanci sa priglavcima', 'Kožni opanci preko debelih vunenih priglavaka.'],
    ],
    materijali: ['vuna', 'valjano sukno', 'lan', 'ovčija i jagnjeća koža'],
    tehnike: ['valjanje sukna', 'pletenje čarapa', 'tkanje pregača', 'vez vunicom'],
    zanimljivost:
      'Struka je bila i ogrtač i ćebe i torba: čobanin bi u nju uvio hleb i sir, prebacio je ' +
      'preko ramena i time rešio i kišu i ručak istim komadom vune.',
  },
  {
    slug: 'istocna-srbija',
    naziv: 'Istočna Srbija',
    tip: 'Timočko-homoljski tip',
    podrucje: 'Timočka krajina, Homolje, Negotinska krajina, Zaječar',
    boje: ['#5c2a3d', '#c9a227', '#efe3d2'],
    uvod:
      'Nošnja istočne Srbije se izdvaja tamnijom paletom i dvema keceljama — jednom napred i ' +
      'jednom pozadi. Vekovni dodir srpskog, vlaškog i bugarskog stanovništva ostavio je ' +
      'jasan trag u kroju i u vezu.',
    opis: [
      'Ženska nošnja se gradi oko duge košulje preko koje se vezuju dve tkane kecelje — ' +
      '„futa“ napred i „zaprega“ pozadi, tako da se platno vidi samo sa strane.',
      'Boje su dublje nego u Šumadiji: bordo, tamnocrvena, crna, tamnozelena, sa gustim ' +
      'vezom u kome se ponavljaju motivi sunca, kruga i kukastog krsta kao starih znakova ' +
      'zaštite.',
      'Nakit je izraženiji — nizovi novčića, srebrne kopče i teške minđuše.',
    ],
    zenska: [
      ['Košulja', 'Duga, od konoplje ili lana, sa gustim vezom oko vrata.'],
      ['Futa', 'Prednja tkana kecelja, često crvena ili bordo.'],
      ['Zaprega', 'Zadnja kecelja, tamnija, tkana od vune.'],
      ['Pojas', 'Tkani ili kožni, sa metalnim paftama.'],
      ['Jelek', 'Kratak prsluk od sukna ili kadife.'],
      ['Šamija / marama', 'Pokrivalo za glavu; kod udatih žena obavezno.'],
    ],
    muska: [
      ['Košulja', 'Duga bela košulja preko čakšira, opasana pojasom.'],
      ['Čakšire / benevreke', 'Od belog ili mrkog sukna.'],
      ['Pojas', 'Dugačak vuneni pojas, obavijen više puta oko struka.'],
      ['Jelek', 'Sukneni prsluk sa gajtanima.'],
      ['Kapa', 'Šubara ili niska crna kapa.'],
      ['Opanci', 'Kožni, sa priglavcima.'],
    ],
    materijali: ['konoplja', 'vuna', 'sukno', 'kadifa', 'srebro'],
    tehnike: ['tkanje kecelja', 'gust vuneni vez', 'izrada pafti', 'nizanje novca'],
    zanimljivost:
      'U Homolju su se šare na kecelji čitale kao lična karta: po kombinaciji boja moglo se ' +
      'zaključiti iz kog je sela žena i da li je udata, udovica ili u žalosti.',
  },
  {
    slug: 'juzna-srbija',
    naziv: 'Južna Srbija',
    tip: 'Vardarsko-moravski tip',
    podrucje: 'Vranje, Pčinja, Leskovac, Vlasotince',
    boje: ['#7a1f3d', '#c9a227', '#f2e8d5'],
    uvod:
      'Jug Srbije je pod najdužim osmanskim uticajem, i to se vidi na prvi pogled: dimije, ' +
      'libade, srma i zlatovez daju vranjskoj nošnji orijentalni sjaj kakav ne postoji ' +
      'severnije.',
    opis: [
      'Vranjska gradska nošnja je vrhunac srpskog zlatoveza. Srma — tanka zlatna ili srebrna ' +
      'žica — vezla se po kadifi u motivima cveta, lozice i polumeseca, danima i nedeljama za ' +
      'jedan jedini prsluk.',
      'Seoska nošnja Pčinje i Vlasine je znatno strožija: vuna, tamne boje i gust vez, bez ' +
      'gradskog raskoša ali sa istom logikom slojevitog oblačenja.',
      'Muzika, kolo i nošnja ovde su nerazdvojni — vranjska nošnja je za većinu ljudi ' +
      'neodvojiva od zvuka trube i pesme „Šano dušo“.',
    ],
    zenska: [
      ['Dimije', 'Široke nabrane pantalone, od svile ili pamuka, skupljene ispod kolena.'],
      ['Libade', 'Kratki gornji deo sa raširenim rukavima, od kadife sa zlatovezom.'],
      ['Mintan', 'Pripijeni prsluk-jaknica, bogato vezena srmom.'],
      ['Košulja', 'Tanka, od svile ili finog pamuka.'],
      ['Pojas sa paftama', 'Široke srebrne ili pozlaćene kopče.'],
      ['Šamija', 'Marama sa resama, često sa nizovima novčića.'],
    ],
    muska: [
      ['Košulja', 'Bela, sa vezom na okovratniku i manžetnama.'],
      ['Čakšire', 'Široke u gornjem delu, uske u nogavici, od tamnog sukna.'],
      ['Đemadan / mintan', 'Prsluk sa gajtanima, često crn ili tamnomodar.'],
      ['Pojas', 'Široki svileni ili vuneni pojas u više obavoja.'],
      ['Fes ili kapa', 'Kod starije gradske nošnje.'],
      ['Opanci ili plitke cipele', 'Zavisno od sela i grada.'],
    ],
    materijali: ['svila', 'kadifa', 'srma', 'pamuk', 'srebro'],
    tehnike: ['zlatovez srmom', 'terzijski zanat', 'izrada pafti', 'gajtaniranje'],
    zanimljivost:
      'Zlatovez su radili terzije — muški zanatlije, a ne žene u kući. Bio je to ceh sa ' +
      'šegrtima i majstorima, i jedan vezeni komplet koštao je koliko i pristojno grlo stoke.',
  },
  {
    slug: 'kosovo-i-metohija',
    naziv: 'Kosovo i Metohija',
    tip: 'Kosovsko-metohijski tip',
    podrucje: 'Kosovo polje, Metohija, Sirinićka župa, Prizren, Gora',
    boje: ['#8c1c13', '#1d3f6e', '#f5efe3'],
    uvod:
      'Nošnja Kosova i Metohije čuva najstarije slojeve srpskog narodnog odevanja. Ovde je ' +
      'sačuvana srednjovekovna osnova — duga bela košulja i beli sukneni zubun — sa vezom ' +
      'čiji se motivi prepoznaju na freskama.',
    opis: [
      'Kosovski zubun je jedan od najlepših komada srpske narodne nošnje: belo sukno gusto ' +
      'opšiveno crvenim, modrim i crnim vezom po ivicama, ramenima i skutovima.',
      'Prizrenska gradska nošnja je posebna priča — svilene tkanine, zlatovez i filigranski ' +
      'nakit, plod stolećima razvijanog čaršijskog zanatstva.',
      'U Sirinićkoj župi pod Šar-planinom sačuvani su arhaični oblici oglavlja i veza koje ' +
      'etnolozi vezuju za predtursko razdoblje.',
    ],
    zenska: [
      ['Košulja', 'Duga, do članaka, od belog platna, sa vezom po skutovima i rukavima.'],
      ['Zubun', 'Beli sukneni ogrtač bez rukava sa gustim crveno-modrim vezom.'],
      ['Pregača', 'Tkana vunena, sa krupnim geometrijskim poljima.'],
      ['Pojas i pafte', 'Tkani pojas sa krupnim srebrnim kopčama.'],
      ['Oglavlje', 'Složeno pokrivalo od marama; kod udatih žena obavezno.'],
      ['Vunene čarape', 'Šarene, do kolena, sa priglavcima.'],
    ],
    muska: [
      ['Košulja', 'Bela, duga, sa vezom oko vrata.'],
      ['Bele čakšire', 'Od belog valjanog sukna, sa crnim gajtanima.'],
      ['Džamadan', 'Prsluk od sukna, opšiven gajtanima.'],
      ['Pojas', 'Dugi vuneni pojas u više obavoja.'],
      ['Kapa', 'Bela ili crna plitka kapa.'],
      ['Opanci', 'Kožni, sa uzdignutim vrhom.'],
    ],
    materijali: ['belo sukno', 'lan', 'vuna', 'svila', 'srebro', 'filigran'],
    tehnike: ['vez po suknu', 'filigran', 'tkanje pregača', 'zlatovez (Prizren)'],
    zanimljivost:
      'Motivi na kosovskom zubunu — rozeta, krst, lozica i „grančica“ — gotovo se ' +
      'doslovno poklapaju sa ornamentima na odeždama sa fresaka Dečana i Gračanice, što je ' +
      'redak primer neprekinutog trajanja jednog likovnog jezika kroz vekove.',
  },
  {
    slug: 'stari-vlah-i-raska',
    naziv: 'Stari Vlah i Raška',
    tip: 'Dinarski tip',
    podrucje: 'Nova Varoš, Prijepolje, Sjenica, Ivanjica, Novi Pazar',
    boje: ['#3f4a5c', '#a4161a', '#ede4d3'],
    uvod:
      'Visoravni Starog Vlaha i raške oblasti dale su nošnju prilagođenu oštroj klimi: ' +
      'više vune, deblje sukno, više slojeva. Utilitarnost ovde nadvladava ukras, ali ' +
      'ukras nikad ne izostaje.',
    opis: [
      'Ženska nošnja se sastoji od duge košulje, suknenog zubuna i tkane pregače, sa ' +
      'obaveznim gustim vunenim čarapama i priglavcima.',
      'Muška nošnja podrazumeva bele ili mrke suknene čakšire, jelek, gunj i struku — ' +
      'komplet koji je čoveka držao suvim i toplim na sjeničkoj visoravni.',
      'Sjenički kraj poznat je i po debelim vunenim ćilimima i ponjavama, tkanim istom ' +
      'tehnikom i istim šarama kao i delovi nošnje.',
    ],
    zenska: [
      ['Košulja', 'Duga, od lana ili konoplje.'],
      ['Zubun', 'Sukneni, sa vezom po ivicama.'],
      ['Pregača', 'Vunena, tkana, sa prugama i rombovima.'],
      ['Tkanica', 'Vuneni pojas.'],
      ['Čarape i priglavci', 'Debele, vunene, sa geometrijskim šarama.'],
      ['Marama', 'Vunena ili platnena, zavisno od godišnjeg doba.'],
    ],
    muska: [
      ['Košulja', 'Od domaćeg platna.'],
      ['Čakšire', 'Bele ili mrke, od debelog sukna.'],
      ['Jelek i gunj', 'Sukneni, sa gajtanima.'],
      ['Struka', 'Vuneni ogrtač.'],
      ['Šubara', 'Od jagnjeće kože.'],
      ['Opanci', 'Kožni, sa debelim priglavcima.'],
    ],
    materijali: ['vuna', 'debelo sukno', 'lan', 'koža'],
    tehnike: ['valjanje sukna', 'ćilimarstvo', 'pletenje', 'tkanje ponjava'],
    zanimljivost:
      'Sukno se „valjalo“ u valjaricama na potocima — voda je danima tukla tkaninu dok se ne ' +
      'zbije toliko da postane skoro nepropusna za kišu. Bila je to najstarija seoska ' +
      '„fabrika“ u ovim krajevima.',
  },
  {
    slug: 'macva-i-podrinje',
    naziv: 'Mačva i Podrinje',
    tip: 'Prelazni panonsko-dinarski tip',
    podrucje: 'Šabac, Loznica, Bogatić, Krupanj',
    boje: ['#2f5d50', '#c9a227', '#f3ebda'],
    uvod:
      'Mačva leži tamo gde se ravnica sudara sa planinom, i njena nošnja to pokazuje: ' +
      'panonska belina i finoća platna spojene sa dinarskim suknom i vunom.',
    opis: [
      'Mačvanska ženska nošnja poznata je po beloj košulji sa bogatim belim vezom i po ' +
      'tkanim keceljama sa krupnim cvetnim poljima.',
      'Za razliku od vojvođanske, ovde se zadržava tkana kecelja i vuneni pojas, dok se od ' +
      'susedne Vojvodine preuzima finije platno i pokoji kupovni materijal.',
      'Podrinje, uz Drinu, ima nešto tamniju i strožiju varijantu, blisku bosanskoj strani reke.',
    ],
    zenska: [
      ['Košulja', 'Belo platno sa belim vezom po skutovima i rukavima.'],
      ['Kecelja', 'Tkana, sa cvetnim i geometrijskim poljima.'],
      ['Jelek', 'Kratak, od sukna ili kadife.'],
      ['Tkanica', 'Tkani pojas u crvenim tonovima.'],
      ['Marama', 'Bela ili svilena.'],
      ['Opanci', 'Kožni, preko belih čarapa.'],
    ],
    muska: [
      ['Košulja i gaće', 'Od belog platna, letnja radna kombinacija.'],
      ['Čakšire', 'Suknene, tamne.'],
      ['Jelek', 'Sa gajtanima i dugmadima.'],
      ['Šajkača', 'Suknena kapa.'],
      ['Pojas', 'Vuneni ili kožni silav.'],
      ['Opanci', 'Šiljkani.'],
    ],
    materijali: ['lan', 'konoplja', 'vuna', 'sukno', 'kadifa'],
    tehnike: ['beli vez na belom', 'tkanje kecelja', 'gajtaniranje'],
    zanimljivost:
      'Beli vez na belom platnu tražio je dnevnu svetlost i dobre oči — radio se zimi kraj ' +
      'prozora, a devojka koja bi ga savladala važila je za vrednu prilikom prosidbe.',
  },
];
