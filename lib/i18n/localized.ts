/**
 * Helper for localized JSON fields in database.
 * Format: { sr: string, en?: string }
 */

export type LocalizedField = { sr: string; en?: string } | string | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLocalized(field: any, locale: string): string {
  if (field == null || field === '') return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    const obj = field as Record<string, string>;
    return obj[locale] ?? obj.sr ?? '';
  }
  return String(field);
}

export function createLocalized(sr: string, en?: string): { sr: string; en: string } {
  return { sr, en: en ?? sr };
}

export function parseLocalized(value: unknown): { sr: string; en: string } {
  if (value == null) return { sr: '', en: '' };
  if (typeof value === 'string') return { sr: value, en: value };
  const obj = value as Record<string, string>;
  return {
    sr: obj.sr ?? '',
    en: obj.en ?? obj.sr ?? '',
  };
}

/** Get primary string for slug generation (uses sr) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSlugSource(field: any): string {
  const { sr, en } = parseLocalized(field);
  return sr || en || '';
}
