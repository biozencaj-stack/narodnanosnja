import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/ticker - Get active ticker messages (public)
export async function GET() {
  try {
    const messages = await prisma.tickerMessage.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        order: 'asc',
      },
      select: {
        id: true,
        text: true,
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch ticker messages:', error);
    return NextResponse.json([], { status: 200 });
  }
}
