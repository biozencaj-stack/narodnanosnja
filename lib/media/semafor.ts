/**
 * Ograničenje broja istovremenih `sharp` obrada.
 *
 * `sharp` za svaku sliku drži dekodovani bitmap u memoriji. Slika 2000×1200 u
 * RGBA je oko 9,6 MB pre ijedne transformacije, a hero profil dozvoljava ulaz
 * do 4 MB koji se posle dekodovanja višestruko uveća. Nekoliko istovremenih
 * otpremanja tako obori Node proces, a ne samo jedan zahtev.
 *
 * ⚠️ Ovo NIJE zaštita od namernog DoS-a. Semafor i `checkRateLimit` žive u
 * memoriji **jednog procesa**: pod PM2 cluster režimom svaka instanca ima svoj
 * brojač, a posle restarta se brojanje gubi. Prava zaštita bila bi na reverse
 * proxy-ju ili u deljenom skladištu. Ovo štiti od nenamerne preopterećenosti —
 * administrator koji izabere trideset slika odjednom — i to je sve što tvrdi.
 */

const MAX_ISTOVREMENO = 2;

let uToku = 0;
const red: (() => void)[] = [];

function oslobodi(): void {
  const sledeci = red.shift();
  if (sledeci) {
    sledeci();
    return;
  }
  uToku -= 1;
}

async function zauzmi(): Promise<void> {
  if (uToku < MAX_ISTOVREMENO) {
    uToku += 1;
    return;
  }
  await new Promise<void>((resolve) => red.push(resolve));
}

/**
 * Pokreće posao tek kad se oslobodi mesto, i mesto vraća i kad posao pukne.
 * Bez `finally` bi jedan izuzetak trajno smanjio broj dostupnih mesta, pa bi se
 * otpremanje posle nekoliko grešaka zaglavilo zauvek.
 */
export async function saOgranicenjemObrade<T>(
  posao: () => Promise<T>,
): Promise<T> {
  await zauzmi();
  try {
    return await posao();
  } finally {
    oslobodi();
  }
}

/** Za testove: koliko poslova trenutno drži mesto. */
export function zauzetihMesta(): number {
  return uToku;
}

export { MAX_ISTOVREMENO };
