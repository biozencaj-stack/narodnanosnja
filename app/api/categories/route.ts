import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        image: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Get public categories error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
