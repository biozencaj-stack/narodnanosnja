import { prisma } from '@/lib/db';

const SALE_CODE_KEY = 'sale_code';
const DEFAULT_SALE_CODE = '1829317';

/**
 * Get the current sale code from database
 * Falls back to default value if not set
 */
export async function getSaleCode(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: SALE_CODE_KEY },
    });
    return setting?.value || DEFAULT_SALE_CODE;
  } catch (error) {
    console.error('Error fetching sale code:', error);
    return DEFAULT_SALE_CODE;
  }
}

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key },
    });
    return setting?.value || null;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return null;
  }
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: string): Promise<boolean> {
  try {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return true;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    return false;
  }
}
