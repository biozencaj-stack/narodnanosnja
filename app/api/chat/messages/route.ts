import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message, honeypot } = body;

    if (honeypot) {
      return NextResponse.json({ success: true });
    }

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Sva polja su obavezna" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Poruka je predugačka (max 2000 karaktera)" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Nevalidna email adresa" }, { status: 400 });
    }

    // Simple rate limit: max 5 messages per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.chatMessage.count({
      where: { email, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= 5) {
      return NextResponse.json(
        { error: "Previše poruka. Pokušajte ponovo za sat vremena." },
        { status: 429 },
      );
    }

    await prisma.chatMessage.create({
      data: { name, email, message: message.slice(0, 2000) },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Chat message error:", error);
    return NextResponse.json({ error: "Greška pri slanju poruke" }, { status: 500 });
  }
}
