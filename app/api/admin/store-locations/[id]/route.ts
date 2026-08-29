import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, address, city, phone, email, hours, mapUrl, isActive, sortOrder } = body;

    const location = await prisma.storeLocation.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(hours !== undefined && { hours }),
        ...(mapUrl !== undefined && { mapUrl: mapUrl || null }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({ location });
  } catch (error) {
    console.error('Update store location error:', error);
    return NextResponse.json({ error: 'Greška pri ažuriranju lokacije' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.storeLocation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete store location error:', error);
    return NextResponse.json({ error: 'Greška pri brisanju lokacije' }, { status: 500 });
  }
}
