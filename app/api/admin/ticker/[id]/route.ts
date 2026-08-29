import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema - text can be string or { sr, en }
const updateTickerMessageSchema = z.object({
  text: z.union([
    z.string().min(1).max(200).optional(),
    z.object({ sr: z.string(), en: z.string().optional() }).optional(),
  ]),
  isActive: z.boolean().optional(),
  order: z.number().optional(),
});

// GET /api/admin/ticker/[id] - Get single ticker message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const { id } = await params;

    const message = await prisma.tickerMessage.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Poruka nije pronađena' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Get ticker message error:', error);
    return NextResponse.json(
      { error: 'Greška pri učitavanju poruke' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/ticker/[id] - Update ticker message
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
    const validation = updateTickerMessageSchema.safeParse(body);

    if (!validation.success) {
      const first = validation.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? 'Neispravan unos' },
        { status: 400 }
      );
    }

    const data = validation.data as { text?: string | { sr: string; en?: string }; isActive?: boolean; order?: number };
    const updateData: { text?: { sr: string; en: string }; isActive?: boolean; order?: number } = {};
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.text !== undefined) {
      updateData.text = typeof data.text === 'string'
        ? { sr: data.text, en: '' }
        : { sr: data.text?.sr || '', en: data.text?.en || '' };
    }

    const message = await prisma.tickerMessage.update({
      where: { id },
      data: updateData,
    });

    // Invalidate ticker cache so changes appear immediately
    revalidateTag('ticker', 'default');

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Update ticker message error:', error);
    return NextResponse.json(
      { error: 'Greška pri ažuriranju poruke' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ticker/[id] - Delete ticker message
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

    await prisma.tickerMessage.delete({
      where: { id },
    });

    // Invalidate ticker cache so changes appear immediately
    revalidateTag('ticker', 'default');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete ticker message error:', error);
    return NextResponse.json(
      { error: 'Greška pri brisanju poruke' },
      { status: 500 }
    );
  }
}
