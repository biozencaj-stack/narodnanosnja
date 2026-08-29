import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const locations = await prisma.storeLocation.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Get public store locations error:', error);
    return NextResponse.json({ error: 'Greška pri učitavanju lokacija' }, { status: 500 });
  }
}
