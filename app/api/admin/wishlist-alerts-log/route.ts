import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET - Get last wishlist alerts send info
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get last stats from Settings
    const statsSetting = await prisma.setting.findUnique({
      where: { key: 'wishlist_alerts_last_stats' },
    });

    if (!statsSetting) {
      return NextResponse.json({
        success: true,
        lastSent: null,
      });
    }

    const stats = JSON.parse(statsSetting.value);

    return NextResponse.json({
      success: true,
      lastSent: {
        sentAt: stats.sentAt,
        processed: stats.processed,
        notified: stats.notified,
        errors: stats.errors,
      },
    });
  } catch (error) {
    console.error('Get wishlist alerts log error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
