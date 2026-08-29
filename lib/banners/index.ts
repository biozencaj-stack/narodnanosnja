import { prisma } from "@/lib/db";

/**
 * Get active banners by position
 */
export async function getBannersByPosition(position: string) {
  return prisma.banner.findMany({
    where: {
      position,
      isActive: true,
    },
    orderBy: { order: "asc" },
  });
}

/**
 * Get all active banners
 */
export async function getAllActiveBanners() {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { order: "asc" }],
  });
}

/**
 * Format banner for frontend use
 */
export function formatBannerForDisplay(banner: {
  imageData: string;
  contentType: string;
  title: string;
  subtitle?: string | null;
  linkUrl?: string | null;
  buttonText?: string | null;
}) {
  return {
    ...banner,
    imageUrl: `data:${banner.contentType};base64,${banner.imageData}`,
  };
}
