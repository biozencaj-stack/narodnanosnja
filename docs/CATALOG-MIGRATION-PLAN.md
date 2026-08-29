# Plan migracije generičkog kataloga

## Svrha

Nova kataloška osnova je namerno **expand-only**. Postojeći `ProductSize`,
polja proizvoda (`gender`, `color`, `material`, dimenzije...) i postojeći način
čitanja ostaju netaknuti dok novi model ne bude popunjen, proveren i uključen u
storefront. Pregledani expand migracioni lanac je sačuvan u repozitorijumu i
kontrolisano je primenjen nad produkcijom 29. avgusta 2026, bez korišćenja
`db push`.

Nova osnova razdvaja tri pojma:

1. `ProductType` + `AttributeDefinition` opisuju administrativnu šemu proizvoda.
2. `ProductAttributeValue` čuva informativna svojstva proizvoda u tipizovanim
   kolonama.
3. `ProductOption` + `ProductOptionValue` stvaraju prodajne varijante (npr.
   veličina, boja, pakovanje ili ukus) i povezuju se sa postojećim
   `ProductVariant` zapisom.

## Preduslov: uskladiti istoriju migracija

Repo sada ima current-state baseline
`20260829000000_baseline_production_before_v2`, napravljen iz schema-only
snimka produkcione baze koja već sadrži localized JSONB kolone. Stara parcijalna
localized migracija je arhivirana van aktivnog Prisma lanca. Za produkcionu
expand migraciju sprovedeni su sledeći koraci:

1. napravljen je proverljiv backup i klon produkcione baze;
2. potvrđeno je da produkciona šema odgovara baseline-u i baseline je evidentiran sa
   `prisma migrate resolve --applied` prema `docs/PRISMA-BASELINE.md`;
3. kompletan restore + migrate proveren je na praznoj i na kopiji produkcione baze;
4. expand migracije su zatim primenjene i završen je završni drift/status test.

Ne koristiti `prisma db push` nad produkcijom.

## Faza 1: expand migracija

Migracija samo dodaje:

- `ProductSize.active` za povlačenje veličine bez promene njenog stabilnog ID-a;
- unique ograničenje nad `ProductSize(productId, size)`, indeks nad
  `(productId, active)` i `CHECK (stock >= 0)`;
- opcioni `Product.productTypeId`;
- `ProductType`, `AttributeDefinition`, `ProductTypeAttribute`;
- `AttributeChoice`, `ProductAttributeValue` i
  `ProductAttributeSelectedChoice`;
- `ProductOption`, `ProductOptionValue` i `ProductVariantOptionValue`.

Redundantne kolone u novim tabelama su namerne, jer omogućavaju DB integritet
koji Prisma ne može da izrazi preko posrednih relacija:

- `AttributeChoice.dataType` i `ProductAttributeValue.dataType` kompozitnim FK
  vezama moraju biti jednaki tipu njihove `AttributeDefinition`;
- `ProductAttributeSelectedChoice.attributeDefinitionId` mora istovremeno da
  odgovara definiciji vrednosti i definiciji izbora;
- `ProductVariantOptionValue.productId` mora istovremeno da odgovara proizvodu
  varijante i proizvodu opcije, dok `(optionValueId, optionId)` garantuje da
  vrednost pripada toj opciji.

Ništa se ne briše, ne preimenuje i nijedno postojeće polje ne postaje obavezno.
Pre primene proveriti kolizije budućih stabilnih `code` vrednosti.

## Faza 2: početni tipovi i atributi

Seed treba da bude idempotentan i da koristi stabilne ASCII kodove. Minimalni
tipovi za proveru modela:

- `generic` — proizvod bez posebne branše;
- `clothing` — odeća i narodna nošnja;
- `footwear` — obuća;
- `food` — hrana.

Primeri definicija: `material`, `gender`, `country_of_origin`, `care`,
`net_quantity`, `net_quantity_unit`, `expiry_days`. Tip i jedinica se nikada ne
izvode iz prevedenog naziva.

## Faza 3: backfill bez brisanja legacy podataka

Backfill skripta mora da bude ponovljiva i transakcijska po proizvodu:

1. dodeliti svakom proizvodu odgovarajući `ProductType` (nepoznati idu u
   `generic`);
2. mapirati postojeća informativna polja u `ProductAttributeValue`, ali ih još
   ne prazniti;
3. za svaki `ProductSize` napraviti/pronaći opciju `size` i njenu vrednost;
4. postojeće `ProductVariant` zapise povezati sa odgovarajućim option values;
5. kada proizvod nema varijantu, napraviti jednu podrazumevanu varijantu; za
   proizvode sa `ProductSize` zapisima napraviti determinističko mapiranje bez
   dupliranja SKU-a;
6. napraviti izveštaj za nejasne slučajeve: duple veličine, dupli SKU, varijanta
   čija boja/veličina nema odgovor i proizvod bez prodajne varijante.

Pri pisanju novih generičkih redova backfill uvek eksplicitno popunjava
`ProductAttributeValue.dataType`, `AttributeChoice.dataType`,
`ProductAttributeSelectedChoice.attributeDefinitionId` i
`ProductVariantOptionValue.productId`; te vrednosti ne smeju da se izvode iz
korisničkog zahteva već iz već učitanih povezanih redova. Ako je neka razvojna
baza već dobila eksperimentalnu verziju ovih tabela, migracija mora prvo dodati
kolone kao nullable, popuniti ih JOIN upitima, prijaviti nesaglasnosti, pa tek
onda uključiti `NOT NULL`, unique i foreign-key ograničenja.

`ProductSize` ostaje izvor koji stari kod čita tokom cele faze.

## Invarijante koje servis mora da proverava

- Vrednost atributa pripada aktivnoj definiciji dodeljenoj tipu proizvoda.
- Za skalarne tipove tačno jedna `value*` kolona odgovara
  `AttributeDefinition.dataType`; za `SELECT` i `MULTI_SELECT` sve scalar
  kolone su prazne.
- `SELECT` ima tačno jedan, a `MULTI_SELECT` nula ili više izbora iz iste
  definicije; ostali tipovi nemaju izbore.
- Opcija i varijanta pripadaju istom proizvodu.
- Varijanta bira najviše jednu vrednost svake opcije. Kompozitni primarni ključ
  ovo već delimično garantuje.
- Kodovi su stabilni, malim slovima i ne menjaju se zbog prevoda naziva.

Kompozitni FK-ovi u Prisma šemi već sprovode jednakost definicije/tipa i
jednakost proizvoda. Prisma schema, međutim, ne izražava sledeća `CHECK`
ograničenja, pa moraju ostati u ručno pregledanom SQL-u expand migracije (ne u
`db push` postupku):

```sql
ALTER TABLE "ProductSize"
  ADD CONSTRAINT "ProductSize_stock_nonnegative_check"
  CHECK ("stock" >= 0);

ALTER TABLE "AttributeChoice"
  ADD CONSTRAINT "AttributeChoice_select_data_type_check"
  CHECK ("dataType" IN ('SELECT', 'MULTI_SELECT'));

ALTER TABLE "ProductAttributeValue"
  ADD CONSTRAINT "ProductAttributeValue_typed_scalar_check"
  CHECK (
    ("dataType" IN ('TEXT', 'RICH_TEXT')
      AND "valueText" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'INTEGER'
      AND "valueInteger" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'DECIMAL'
      AND "valueDecimal" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'BOOLEAN'
      AND "valueBoolean" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" IN ('DATE', 'DATETIME')
      AND "valueDate" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'JSON'
      AND "valueJson" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" IN ('SELECT', 'MULTI_SELECT')
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 0)
  );
```

`CHECK` ne može da broji redove u `ProductAttributeSelectedChoice`. Za punu
garanciju tipa migracija zato mora da doda `DEFERRABLE INITIALLY DEFERRED`
constraint trigger na obe tabele (`ProductAttributeValue` i
`ProductAttributeSelectedChoice`). Na kraju transakcije trigger proverava:

- `SELECT`: tačno jedan povezani izbor;
- `MULTI_SELECT`: nula ili više povezanih izbora;
- svaki drugi `dataType`: nula povezanih izbora.

Trigger mora da proveri i stari i novi `productAttributeValueId` pri UPDATE ili
DELETE operaciji. Servisna validacija ostaje radi razumljive 4xx poruke, ali ne
sme biti jedina zaštita. Poseban integracioni test migracije mora da pokuša svih
deset tipova, svaku pogrešnu scalar kolonu, više scalar kolona, izbor iz druge
definicije i pogrešan broj SELECT izbora.

## Faza 4: dual-read i prelazak

1. Admin prvo upisuje i legacy i novi model.
2. Pozadinska provera poredi cenu, dostupnost i izabrane opcije oba modela.
3. Storefront dobija feature flag za čitanje generičkih opcija/atributa.
4. Tek kada nema razlika, korpa se prebacuje na `variantId` kao identitet reda.
5. Posle najmanje jednog stabilnog izdanja prestaje dual-write.

## Faza 5: contract (poseban budući PR)

Tek nakon stabilnog rada mogu da se uklone `ProductSize`, `size`/`color` legacy
polja varijante i specifična polja na `Product`. Contract migracija ne pripada
ovoj verziji i mora imati sopstveni backup, proveru i rollback proceduru.

## Admin API u prelaznoj fazi

- `GET/POST /api/admin/product-types`
- `GET/PUT/DELETE /api/admin/product-types/:id`
- `GET/POST /api/admin/attributes`
- `GET/PUT/DELETE /api/admin/attributes/:id`

`DELETE` samo arhivira (`active=false`). Lista izbora atributa je upsert-only;
izostavljanje izbora ga ne briše, a uklanjanje se radi sa `active=false`.
Stabilni `ProductType.code` i `AttributeDefinition.code` se ne menjaju kroz
`PUT`. Dodela tipu prihvata samo aktivne definicije atributa, a arhiviranje
vraća `409` dok postoje aktivni tipovi/proizvodi koji referenciraju zapis.

`PUT /api/admin/product-types/:id` zahteva `expectedUpdatedAt` iz poslednjeg
GET odgovora. Zastareo timestamp vraća `409`; nedostajući uslov vraća `428`.
Lista `attributes`, kada je poslata, predstavlja željeno stanje, ali se
primenjuje diff/upsert postupkom: zadržani redovi se ažuriraju, novi dodaju, a
izostavljeni brišu tek kada nijedan proizvod tog tipa nema njihovu vrednost.
Pretvaranje veze u obaveznu takođe vraća `409` dok svi proizvodi nisu
backfillovani. Izostavljena lista uopšte ne menja veze.

Rute neće raditi nad bazom dok expand migracija ne bude eksplicitno primenjena.
Postojeći UI ih još ne poziva.
