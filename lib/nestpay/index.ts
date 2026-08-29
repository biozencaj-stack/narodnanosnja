import crypto from 'crypto';

export interface NestPayConfig {
  clientId: string;
  storeKey: string;
  hppUrl: string;
  okUrl: string;
  failUrl: string;
  lang: string;
  currency: string;
  trantype: string;
  installment: string;
}

export interface HppParams {
  amount: number | string;
  oid: string;
  email?: string;
  lang?: string;
}

export interface HppFields {
  clientid: string;
  storetype: string;
  hashAlgorithm: string;
  trantype: string;
  amount: string;
  currency: string;
  oid: string;
  okUrl: string;
  failUrl: string;
  rnd: string;
  hash: string;
  lang: string;
  encoding: string;
  email?: string;
}

function requireHttpsUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} mora biti validan apsolutni URL.`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${label} mora koristiti HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} ne sme sadržati pristupne podatke.`);
  }
  return url;
}

function requireCallbackUrl(
  value: string,
  label: string,
  canonicalOrigin: string,
  expectedPath: string,
): string {
  const url = requireHttpsUrl(value, label);
  if (
    url.origin !== canonicalOrigin ||
    url.pathname !== expectedPath ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${label} mora biti ${canonicalOrigin}${expectedPath} bez query/hash dela.`,
    );
  }
  return url.toString();
}

export function base64Sha512(input: string): string {
  return Buffer.from(
    crypto.createHash('sha512').update(input, 'utf8').digest()
  ).toString('base64');
}

export function getConfig(): NestPayConfig {
  const get = (k: string): string | undefined => {
    let val = process.env[k];
    // Remove quotes from values if present
    if (val && typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    return val;
  };

  const required = [
    'NESTPAY_CLIENT_ID',
    'NESTPAY_STORE_KEY',
    'NESTPAY_OK_URL',
    'NESTPAY_FAIL_URL',
    'NEXT_PUBLIC_SITE_URL',
  ];
  const missing = required.filter((k) => !get(k) || get(k) === 'undefined');
  if (missing.length) throw new Error(`NestPay env missing: ${missing.join(', ')}`);

  const isProd = process.env.NODE_ENV === 'production';
  const rawHppUrl = isProd ? get('NESTPAY_HPP_URL_PROD') : get('NESTPAY_HPP_URL_TEST');
  if (!rawHppUrl) throw new Error('NestPay HPP URL not configured.');

  const canonicalUrl = requireHttpsUrl(
    get('NEXT_PUBLIC_SITE_URL')!,
    'NEXT_PUBLIC_SITE_URL',
  );
  const hppUrl = requireHttpsUrl(rawHppUrl, 'NestPay HPP URL').toString();
  const okUrl = requireCallbackUrl(
    get('NESTPAY_OK_URL')!,
    'NESTPAY_OK_URL',
    canonicalUrl.origin,
    '/api/payments/nestpay/callback/success',
  );
  const failUrl = requireCallbackUrl(
    get('NESTPAY_FAIL_URL')!,
    'NESTPAY_FAIL_URL',
    canonicalUrl.origin,
    '/api/payments/nestpay/callback/fail',
  );
  const currency = get('NESTPAY_CURRENCY') || '941';
  if (currency !== '941') {
    throw new Error('NESTPAY_CURRENCY mora biti 941 za RSD checkout tok.');
  }
  const trantype = get('NESTPAY_TRANTYPE') || 'Auth';
  if (trantype !== 'Auth') {
    throw new Error('NESTPAY_TRANTYPE mora biti Auth za podržani checkout tok.');
  }

  return {
    clientId: get('NESTPAY_CLIENT_ID')!,
    storeKey: get('NESTPAY_STORE_KEY')!,
    hppUrl,
    okUrl,
    failUrl,
    lang: get('NESTPAY_LANG') || 'sr',
    currency,
    trantype,
    installment: get('NESTPAY_INSTALLMENT') || '',
  };
}

export function buildHppFields(params: HppParams): { fields: HppFields; hashString: string } {
  const cfg = getConfig();
  const rnd = String(Date.now());
  const lang = params.lang || cfg.lang;

  // Format amount with 2 decimal places as required by bank (dinars.para format)
  const formattedAmount = parseFloat(String(params.amount)).toFixed(2);

  // INTESA VER2 HASH: clientid|oid|amount|okurl|failurl|trantype||rnd||||currency|StoreKey
  const hashString = [
    cfg.clientId, // clientid
    params.oid, // oid
    formattedAmount, // amount (with 2 decimals)
    cfg.okUrl, // okurl
    cfg.failUrl, // failurl
    cfg.trantype, // trantype
    '', // rezervisano (prazan)
    rnd, // rnd
    '', // rezervisano (prazan)
    '', // rezervisano (prazan)
    '', // rezervisano (prazan)
    cfg.currency, // currency (941)
    cfg.storeKey, // StoreKey (poslednji!)
  ].join('|'); // Spajanje SA | separatorom za ver2!

  const hash = base64Sha512(hashString);

  const fields: HppFields = {
    clientid: cfg.clientId,
    storetype: '3d_pay_hosting',
    hashAlgorithm: 'ver2', // OBAVEZNO za Intesu!
    trantype: cfg.trantype,
    amount: formattedAmount,
    currency: cfg.currency,
    oid: params.oid,
    okUrl: cfg.okUrl,
    failUrl: cfg.failUrl,
    rnd,
    hash,
    lang,
    encoding: 'utf-8',
  };
  if (params.email) fields.email = params.email;

  return { fields, hashString };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderAutoPostHtml(
  actionUrl: string,
  fields: Record<string, string>,
  nonce: string,
): string {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(String(v))}" />`)
    .join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Redirecting…</title></head>
<body>
  <p>Preusmeravanje na bezbednu stranicu za plaćanje…</p>
  <form method="post" action="${escapeHtml(actionUrl)}">
    ${inputs}
    <noscript><button type="submit">Nastavi na plaćanje</button></noscript>
  </form>
  <script nonce="${escapeHtml(nonce)}">document.forms[0].submit();</script>
</body></html>`;
}

const SAFE_CALLBACK_AUDIT_FIELDS = [
  'oid',
  'ProcReturnCode',
  'Response',
  'mdStatus',
  'TransId',
  'HostRefNum',
  'AuthCode',
  'amount',
  'currency',
  'Currency',
] as const;

export type NestPayCallbackOutcome = 'APPROVED' | 'DECLINED' | 'REVIEW';

export interface NestPayCallbackClassification {
  outcome: NestPayCallbackOutcome;
  reason?: string;
  orderIdSigned: boolean;
  transactionId?: string;
  authCode?: string;
  amount: number | null;
  currency: string | null;
}

function getSignedCallbackFields(params: Record<string, string>): Set<string> {
  return new Set(
    (params.HASHPARAMS || '')
      .split('|')
      .map((field) => field.trim())
      .filter(Boolean),
  );
}

function firstSignedValue(
  params: Record<string, string>,
  signedFields: Set<string>,
  candidates: readonly string[],
): string | undefined {
  const field = candidates.find(
    (candidate) => signedFields.has(candidate) && params[candidate],
  );
  return field ? params[field] : undefined;
}

/**
 * Sam hash nije dovoljan ako providerov HASHPARAMS ne pokriva polja koja
 * menjaju stanje. Nepotpun ili kontradiktoran rezultat zato ide u REVIEW,
 * nikada implicitno u DECLINED.
 */
export function classifyNestPayCallback(
  params: Record<string, string>,
): NestPayCallbackClassification {
  const signedFields = getSignedCallbackFields(params);
  const orderIdSigned = signedFields.has('oid');
  const procReturnCode = firstSignedValue(params, signedFields, [
    'ProcReturnCode',
  ]);
  const response = firstSignedValue(params, signedFields, ['Response']);
  const mdStatus = firstSignedValue(params, signedFields, ['mdStatus']);
  const amountValue = firstSignedValue(params, signedFields, ['amount']);
  const currency = firstSignedValue(params, signedFields, [
    'currency',
    'Currency',
  ]);
  const transactionId = firstSignedValue(params, signedFields, [
    'TransId',
    'HostRefNum',
  ]);
  const authCode = firstSignedValue(params, signedFields, ['AuthCode']);
  const amount = amountValue
    ? Number(amountValue.replace(',', '.'))
    : null;

  const common = {
    orderIdSigned,
    transactionId,
    authCode,
    amount,
    currency: currency || null,
  };

  if (!orderIdSigned) {
    return {
      ...common,
      outcome: 'REVIEW',
      reason: 'UNSIGNED_ORDER_ID',
    };
  }

  const approved =
    procReturnCode === '00' &&
    response?.trim().toLowerCase() === 'approved' &&
    ['1', '2', '3', '4'].includes(mdStatus || '');
  if (approved) {
    if (!amountValue || !currency || !transactionId) {
      return {
        ...common,
        outcome: 'REVIEW',
        reason: 'UNSIGNED_APPROVAL_FIELDS',
      };
    }
    return { ...common, outcome: 'APPROVED' };
  }

  const normalizedResponse = response?.trim().toLowerCase() || '';
  if (
    procReturnCode &&
    procReturnCode !== '00' &&
    ['declined', 'not approved', 'notapproved'].includes(normalizedResponse)
  ) {
    return { ...common, outcome: 'DECLINED' };
  }

  return {
    ...common,
    outcome: 'REVIEW',
    reason: 'AMBIGUOUS_PROVIDER_RESULT',
  };
}

/**
 * Audit zapis namerno ne čuva HASH/HASHPARAMSVAL, email, PAN niti proizvoljna
 * provider polja. Maskirani PAN se takođe izostavlja dok banka ne potvrdi
 * precizan naziv i format polja u sertifikacionom ugovoru.
 */
export function sanitizeNestPayCallback(
  params: Record<string, string>,
): Record<string, string> {
  const signedFields = getSignedCallbackFields(params);
  const safe: Record<string, string> = {};
  for (const field of SAFE_CALLBACK_AUDIT_FIELDS) {
    const value = params[field];
    if (signedFields.has(field) && typeof value === 'string' && value) {
      safe[field] = value.slice(0, 200);
    }
  }
  return safe;
}

export function createNestPayEventKey(
  params: Record<string, string>,
): string {
  // Providerov potpis identifikuje upravo potpisani sadržaj. Proizvoljna
  // nepotpisana polja ne smeju kreirati nove audit događaje za isti callback.
  const signature = params.HASH || 'missing-signature';
  return `nestpay:${crypto
    .createHash('sha256')
    .update(signature)
    .digest('hex')}`;
}

export function verifyCallbackHash(params: Record<string, string>): boolean {
  try {
    const HASH = params['HASH'];
    const HASHPARAMS = params['HASHPARAMS'] || '';
    const HASHPARAMSVAL = params['HASHPARAMSVAL'] || '';
    let storeKey = process.env.NESTPAY_STORE_KEY;

    console.log('[NestPay] Callback fields:', Object.keys(params));

    if (!HASH) {
      console.warn('[NestPay] No HASH parameter in callback');
      return false;
    }

    if (!storeKey) {
      console.error('[NestPay] STORE_KEY missing in env');
      return false;
    }

    // Remove quotes if present
    if (storeKey.startsWith('"') && storeKey.endsWith('"')) {
      storeKey = storeKey.slice(1, -1);
    }

    // Try to build hash string from HASHPARAMS if available
    let hashInput = HASHPARAMSVAL;
    if (HASHPARAMS) {
      const fieldNames = HASHPARAMS.split('|');
      console.log('[NestPay] HASHPARAMS fields:', fieldNames);

      // Build the string by concatenating field values with pipes
      const fieldValues = fieldNames.map((name) => params[name] || '');
      hashInput = fieldValues.join('|');
    }

    // Calculate hash: hashInput + "|" + StoreKey
    const local = base64Sha512(hashInput + '|' + storeKey);

    const received = Buffer.from(HASH, 'utf8');
    const calculated = Buffer.from(local, 'utf8');
    const matches =
      received.length === calculated.length &&
      crypto.timingSafeEqual(received, calculated);

    console.log('[NestPay] Callback hash:', matches ? 'valid' : 'invalid');
    return matches;
  } catch (error) {
    console.error('[NestPay] Hash verification error:', error);
    return false;
  }
}
