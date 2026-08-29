import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendNewsletterCampaign } from "@/lib/email/mailer";
import { sanitizeRichHtml } from "@/lib/security/html";

// GET - Lista poslatih newsletter kampanja
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newsletters = await prisma.newsletter.findMany({
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    // Broj pretplatnika
    const [userCount, guestCount] = await Promise.all([
      prisma.user.count({ where: { newsletterOptIn: true } }),
      prisma.newsletterSubscriber.count({ where: { active: true } }),
    ]);

    return NextResponse.json({
      newsletters,
      subscriberCount: userCount + guestCount,
      userSubscribers: userCount,
      guestSubscribers: guestCount,
    });
  } catch (error) {
    console.error("Newsletter fetch error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju" },
      { status: 500 }
    );
  }
}

// POST - Pošalji newsletter kampanju
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, content, confirm } = body;

    // Validacija
    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      return NextResponse.json(
        { error: "Naslov mora imati najmanje 3 karaktera" },
        { status: 400 }
      );
    }

    const safeContent = sanitizeRichHtml(content);
    if (safeContent.trim().length < 10) {
      return NextResponse.json(
        { error: "Sadržaj mora imati najmanje 10 karaktera" },
        { status: 400 }
      );
    }

    // Sigurnosna potvrda
    if (!confirm || confirm.toUpperCase() !== "POTVRDI") {
      return NextResponse.json(
        { error: "Morate uneti POTVRDI za slanje" },
        { status: 400 }
      );
    }

    // Dohvati sve pretplatnike
    const [users, guests] = await Promise.all([
      prisma.user.findMany({
        where: { newsletterOptIn: true },
        select: { email: true },
      }),
      prisma.newsletterSubscriber.findMany({
        where: { active: true },
        select: { email: true },
      }),
    ]);

    // Kombinuj sve email adrese (bez duplikata)
    const allEmails = new Set<string>();
    users.forEach((u) => allEmails.add(u.email.toLowerCase()));
    guests.forEach((g) => allEmails.add(g.email.toLowerCase()));

    if (allEmails.size === 0) {
      return NextResponse.json(
        { error: "Nema pretplatnika za slanje" },
        { status: 400 }
      );
    }

    // Pošalji email svima
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const email of allEmails) {
      try {
        const success = await sendNewsletterCampaign(email, subject.trim(), safeContent);
        if (success) {
          sent++;
        } else {
          failed++;
          errors.push(email);
        }
      } catch (err) {
        failed++;
        errors.push(email);
        console.error(`Failed to send to ${email}:`, err);
      }

      // Pauza između slanja da ne preopteretimo SMTP
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Sačuvaj u istoriju
    await prisma.newsletter.create({
      data: {
        subject: subject.trim(),
        content: safeContent,
        sentBy: session.user.id,
        recipientCount: sent,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Newsletter poslat na ${sent} adresa`,
      sent,
      failed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Prikaži max 10 grešaka
    });
  } catch (error) {
    console.error("Newsletter send error:", error);
    return NextResponse.json(
      { error: "Greška pri slanju newsletter-a" },
      { status: 500 }
    );
  }
}
