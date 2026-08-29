import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema - text can be string (legacy) or { sr, en }
const tickerMessageSchema = z.object({
  text: z.union([
    z.string().min(1, 'Tekst je obavezan').max(200, 'Maksimalno 200 karaktera'),
    z.object({ sr: z.string(), en: z.string().optional() }).refine((o) => o.sr?.trim() || o.en?.trim(), 'Tekst je obavezan'),
  ]),
  isActive: z.boolean().optional().default(true),
  order: z.number().optional(),
});

// GET /api/admin/ticker - Get all ticker messages (including inactive)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const messages = await prisma.tickerMessage.findMany({
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get ticker messages error:', error);
    return NextResponse.json(
      { error: 'Greška pri učitavanju poruka' },
      { status: 500 }
    );
  }
}

// POST /api/admin/ticker - Create new ticker message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const body = await request.json();
    const validation = tickerMessageSchema.safeParse(body);

    if (!validation.success) {
      const first = validation.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? 'Neispravan unos' },
        { status: 400 }
      );
    }

    // Get the highest order value
    const lastMessage = await prisma.tickerMessage.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const newOrder = (lastMessage?.order ?? -1) + 1;

    const textValue = typeof validation.data.text === 'string'
      ? { sr: validation.data.text, en: '' }
      : { sr: validation.data.text.sr || '', en: validation.data.text.en || '' };

    const message = await prisma.tickerMessage.create({
      data: {
        text: textValue,
        isActive: validation.data.isActive ?? true,
        order: validation.data.order ?? newOrder,
      },
    });

    // Invalidate ticker cache so changes appear immediately
    revalidateTag('ticker', 'default');

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Create ticker message error:', error);
    return NextResponse.json(
      { error: 'Greška pri kreiranju poruke' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/ticker - Reorder messages
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemate pristup' }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'Niz ID-eva je obavezan' },
        { status: 400 }
      );
    }

    // Update order for each message
    await Promise.all(
      ids.map((id, index) =>
        prisma.tickerMessage.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    // Invalidate ticker cache so changes appear immediately
    revalidateTag('ticker', 'default');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder ticker messages error:', error);
    return NextResponse.json(
      { error: 'Greška pri promeni redosleda' },
      { status: 500 }
    );
  }
}
