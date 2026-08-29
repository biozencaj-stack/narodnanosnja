import { unstable_cache } from 'next/cache';
import { prisma } from './index';

/**
 * Cached database queries using Next.js unstable_cache
 * These are automatically invalidated via revalidateTag() when admin makes changes
 */

// ===========================================
// BANNERS
// ===========================================

/**
 * Get banners by position (no caching - images are too large for unstable_cache 2MB limit)
 * Consider moving images to external storage (S3/Cloudinary) for better performance
 */
export async function getCachedBanners(position: string) {
  return prisma.banner.findMany({
    where: {
      isActive: true,
      position,
    },
    orderBy: { order: 'asc' },
  });
}

/**
 * Get all banners (no caching - images are too large)
 */
export async function getCachedAllBanners() {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { order: 'asc' }],
  });
}

// ===========================================
// TICKER MESSAGES
// ===========================================

/**
 * Get cached active ticker messages
 * Revalidates every 5 minutes OR when admin updates ticker (via revalidateTag)
 */
export const getCachedTickerMessages = unstable_cache(
  async () => {
    return prisma.tickerMessage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, text: true },
    });
  },
  ['ticker-messages'],
  {
    revalidate: 300, // 5 minutes
    tags: ['ticker'],
  }
);

// ===========================================
// SETTINGS
// ===========================================

/**
 * Get cached settings
 * Revalidates every 10 minutes OR when admin updates settings
 */
export const getCachedSettings = unstable_cache(
  async () => {
    const settings = await prisma.setting.findMany();
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);
  },
  ['settings'],
  {
    revalidate: 600, // 10 minutes
    tags: ['settings'],
  }
);

/**
 * Get a single cached setting by key
 */
export const getCachedSetting = unstable_cache(
  async (key: string) => {
    const setting = await prisma.setting.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  },
  ['setting'],
  {
    revalidate: 600,
    tags: ['settings'],
  }
);
