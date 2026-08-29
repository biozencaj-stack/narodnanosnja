import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const locations = await prisma.storeLocation.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Get store locations error:', error);
    return NextResponse.json({ error: 'Greška pri učitavanju lokacija' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, city, phone, email, hours, mapUrl, isActive } = body;

    if (!name || !address || !city || !hours) {
      return NextResponse.json({ error: 'Naziv, adresa, grad i radno vreme su obavezni' }, { status: 400 });
    }

    const lastLocation = await prisma.storeLocation.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const location = await prisma.storeLocation.create({
      data: {
        name,
        address,
        city,
        phone: phone || null,
        email: email || null,
        hours,
        mapUrl: mapUrl || null,
        isActive: isActive ?? true,
        sortOrder: (lastLocation?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    console.error('Create store location error:', error);
    return NextResponse.json({ error: 'Greška pri kreiranju lokacije' }, { status: 500 });
  }
}
