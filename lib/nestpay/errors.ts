/**
 * NestPay Error Code Mapping
 *
 * Mapiranje NestPay/Banka error kodova na razumljive poruke za korisnike.
 * Ove poruke su EPM-compliant i ne otkrivaju tehničke detalje.
 */

// ProcReturnCode -> Razumljiva poruka
export const NESTPAY_ERROR_CODES: Record<string, string> = {
  '00': 'Transakcija uspešna',
  '01': 'Kontaktirajte vašu banku za više informacija.',
  '02': 'Kontaktirajte vašu banku za više informacija.',
  '03': 'Trgovac nije validan. Kontaktirajte podršku.',
  '04': 'Transakcija odbijena. Pokušajte sa drugom karticom.',
  '05': 'Transakcija nije dozvoljena za ovu karticu.',
  '06': 'Greška u komunikaciji. Pokušajte ponovo.',
  '07': 'Kartica je blokirana. Kontaktirajte vašu banku.',
  '12': 'Neispravna transakcija. Pokušajte ponovo.',
  '13': 'Neispravan iznos. Proverite podatke.',
  '14': 'Neispravan broj kartice. Proverite unete podatke.',
  '15': 'Banka izdavaoca kartice nije pronađena.',
  '19': 'Pokušajte ponovo za nekoliko minuta.',
  '25': 'Transakcija nije pronađena.',
  '28': 'Fajl nije dostupan. Pokušajte ponovo.',
  '30': 'Greška u formatu. Proverite podatke.',
  '33': 'Kartica je istekla. Koristite karticu sa važećim datumom.',
  '34': 'Sumnja na prevaru. Kontaktirajte vašu banku.',
  '36': 'Kartica je ograničena. Kontaktirajte vašu banku.',
  '37': 'Kontaktirajte vašu banku.',
  '38': 'Prekoračen broj pokušaja unosa PIN-a.',
  '41': 'Kartica je prijavljena kao izgubljena. Kontaktirajte banku.',
  '43': 'Kartica je prijavljena kao ukradena. Kontaktirajte banku.',
  '51': 'Nedovoljno sredstava na računu.',
  '52': 'Tekući račun nije pronađen.',
  '53': 'Štedni račun nije pronađen.',
  '54': 'Datum isteka kartice je prošao.',
  '55': 'Neispravan PIN.',
  '56': 'Kartica nije pronađena u sistemu.',
  '57': 'Transakcija nije dozvoljena za ovu vrstu kartice.',
  '58': 'Transakcija nije dozvoljena za ovaj terminal.',
  '59': 'Sumnja na prevaru.',
  '61': 'Prekoračen dnevni limit za karticu.',
  '62': 'Kartica ima ograničenja. Kontaktirajte banku.',
  '63': 'Sigurnosna zabrana.',
  '65': 'Prekoračen broj dozvoljenih transakcija.',
  '75': 'Prekoračen broj pokušaja unosa PIN-a.',
  '76': 'Ključ nije sinhronizovan. Pokušajte ponovo.',
  '77': 'Nekonzistentni podaci. Pokušajte ponovo.',
  '80': 'Neispravan datum transakcije.',
  '81': 'Greška u šifrovanju.',
  '82': 'Greška CVV-a. Proverite sigurnosni kod.',
  '83': 'PIN verifikacija nije moguća.',
  '84': 'Neispravan autorizacioni kod.',
  '85': 'Odbijeno bez razloga.',
  '86': 'PIN verifikacija nije moguća.',
  '91': 'Banka izdavaoca kartice trenutno nije dostupna. Pokušajte kasnije.',
  '92': 'Institucija nije pronađena.',
  '93': 'Transakcija ne može biti završena.',
  '94': 'Duplikat transakcije.',
  '96': 'Sistemska greška. Pokušajte ponovo kasnije.',
  '99': 'Opšta greška.',
};

// mdStatus (3D Secure) -> Objašnjenje
export const MD_STATUS_MESSAGES: Record<string, string> = {
  '0': '3D Secure verifikacija neuspešna.',
  '1': '3D Secure verifikacija uspešna.',
  '2': 'Kartica ili banka ne podržava 3D Secure.',
  '3': 'Banka ne podržava 3D Secure.',
  '4': 'Korisnik izabrao da se registruje kasnije.',
  '5': 'Autentifikacija neuspešna.',
  '6': 'Greška u 3D Secure verifikaciji.',
  '7': 'Sistemska greška.',
  '8': 'Nepoznat mdStatus.',
  '9': 'Hash verifikacija neuspešna.',
};

// Response vrednosti
export const RESPONSE_MESSAGES: Record<string, string> = {
  'approved': 'Transakcija odobrena.',
  'declined': 'Transakcija odbijena.',
  'error': 'Greška u obradi transakcije.',
};

/**
 * Generisanje korisničke poruke na osnovu NestPay response-a
 */
export function getUserFriendlyError(params: Record<string, string>): string {
  const procReturnCode = params['ProcReturnCode'] || '';
  const response = (params['Response'] || '').toLowerCase();
  const errMsg = params['ErrMsg'] || params['mdErrorMsg'] || '';
  const mdStatus = params['mdStatus'] || '';

  // Ako imamo specifičan error code, koristi ga
  if (procReturnCode && NESTPAY_ERROR_CODES[procReturnCode]) {
    return NESTPAY_ERROR_CODES[procReturnCode];
  }

  // Proveri mdStatus za 3D Secure greške
  if (mdStatus && !['1', '2', '3', '4'].includes(mdStatus)) {
    return '3D Secure verifikacija nije uspela. Pokušajte ponovo ili koristite drugu karticu.';
  }

  // Generička poruka ako nemamo specifičan kod
  if (response === 'declined') {
    return 'Transakcija je odbijena od strane banke. Proverite podatke na kartici ili pokušajte sa drugom karticom.';
  }

  if (response === 'error') {
    return 'Došlo je do greške u obradi. Pokušajte ponovo za nekoliko minuta.';
  }

  // Default EPM-compliant poruka
  return 'Plaćanje nije uspešno. Proverite podatke na kartici (broj, datum isteka, CVV) i pokušajte ponovo. U slučaju ponovljenih problema, kontaktirajte vašu banku.';
}

/**
 * Kategorija greške za analitiku
 */
export type ErrorCategory =
  | 'card_error'      // Problem sa karticom (istekla, nevažeća)
  | 'funds_error'     // Nedovoljno sredstava
  | 'security_error'  // 3D Secure, PIN, CVV
  | 'bank_error'      // Banka nedostupna
  | 'system_error'    // Naša greška
  | 'unknown';

export function getErrorCategory(procReturnCode: string): ErrorCategory {
  const cardErrors = ['14', '33', '54', '56'];
  const fundsErrors = ['51', '61', '65'];
  const securityErrors = ['55', '82', '83', '34', '59'];
  const bankErrors = ['91', '92', '01', '02'];
  const systemErrors = ['96', '06', '19'];

  if (cardErrors.includes(procReturnCode)) return 'card_error';
  if (fundsErrors.includes(procReturnCode)) return 'funds_error';
  if (securityErrors.includes(procReturnCode)) return 'security_error';
  if (bankErrors.includes(procReturnCode)) return 'bank_error';
  if (systemErrors.includes(procReturnCode)) return 'system_error';

  return 'unknown';
}

/**
 * Preporuka za korisnika na osnovu tipa greške
 */
export function getErrorRecommendation(category: ErrorCategory): string {
  switch (category) {
    case 'card_error':
      return 'Proverite podatke na kartici ili koristite drugu karticu.';
    case 'funds_error':
      return 'Proverite stanje na računu ili koristite drugu karticu.';
    case 'security_error':
      return 'Proverite CVV kod i pokušajte ponovo. Ako se problem nastavi, kontaktirajte banku.';
    case 'bank_error':
      return 'Pokušajte ponovo za nekoliko minuta. Banka je možda privremeno nedostupna.';
    case 'system_error':
      return 'Pokušajte ponovo za nekoliko minuta.';
    default:
      return 'Pokušajte ponovo ili koristite plaćanje pouzećem.';
  }
}
