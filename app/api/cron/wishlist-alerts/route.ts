import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkAndNotifyWishlistSales } from '@/lib/email/wishlist-notifications';
import { prisma } from '@/lib/db';

// Secret key to protect the cron endpoint
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron endpoint to check wishlist items on sale and send notifications
 * Can be called by:
 * 1. Cron job with CRON_SECRET (e.g., Vercel Cron, GitHub Actions)
 * 2. Admin user from the admin panel
 *
 * Example cron schedule: 0 9 * * * (every day at 9:00 AM)
 */
export async function GET(request: NextRequest) {
  // Check for cron secret OR admin session
  const authHeader = request.headers.get('authorization');
  const hasCronSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  // Check admin session if no cron secret
  let isAdmin = false;
  if (!hasCronSecret) {
    const session = await getServerSession(authOptions);
    isAdmin = session?.user?.role === 'ADMIN';
  }

  if (!hasCronSecret && !isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[Cron] Starting wishlist sale alerts check...');

    const results = await checkAndNotifyWishlistSales();

    console.log('[Cron] Wishlist alerts completed:', results);

    // Save last sent timestamp to Settings
    const now = new Date().toISOString();
    await prisma.setting.upsert({
      where: { key: 'wishlist_alerts_last_sent' },
      update: { value: now },
      create: { key: 'wishlist_alerts_last_sent', value: now },
    });

    // Save stats as JSON
    const stats = JSON.stringify({
      processed: results.processed,
      notified: results.notified,
      errors: results.errors,
      sentAt: now,
    });
    await prisma.setting.upsert({
      where: { key: 'wishlist_alerts_last_stats' },
      update: { value: stats },
      create: { key: 'wishlist_alerts_last_stats', value: stats },
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} users, notified ${results.notified}, errors: ${results.errors}`,
      ...results,
    });
  } catch (error) {
    console.error('[Cron] Wishlist alerts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers from admin
export async function POST(request: NextRequest) {
  return GET(request);
}
