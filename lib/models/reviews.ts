import { prisma } from '@/lib/db';

interface ReviewStats {
  count: number;
  average: number;
  distribution: Record<number, number>;
}

// Server-side function to get product review stats
export async function getProductReviewStats(productCode: string): Promise<ReviewStats | null> {
  try {
    const baseCode = productCode.split('-')[0];

    const reviews = await prisma.productReview.findMany({
      where: {
        productCode: {
          startsWith: baseCode,
        },
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) return null;

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / reviews.length;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribution[r.rating]++;
    });

    return {
      count: reviews.length,
      average,
      distribution,
    };
  } catch (error) {
    // Silently return null - table may not exist yet or other DB error
    // Don't log P2021 errors (table doesn't exist) to avoid log spam
    if (!(error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2021')) {
      console.error('getProductReviewStats error:', error);
    }
    return null;
  }
}
