import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateEmailAddress } from '@/lib/utils/validation';
import crypto from 'crypto';

// Generisanje tokena za odjavu
export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'cms-unsubscribe-secret';
  return crypto.createHmac('sha256', secret).update(email).digest('hex').slice(0, 32);
}

// Validacija tokena
export function validateUnsubscribeToken(email: string, token: string): boolean {
  const expectedToken = generateUnsubscribeToken(email);
  return token === expectedToken;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email je obavezan' },
        { status: 400 }
      );
    }

    if (!validateEmailAddress(email)) {
      return NextResponse.json(
        { success: false, error: 'Email adresa nije validna' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validiraj token ako je prosleđen
    if (token && !validateUnsubscribeToken(normalizedEmail, token)) {
      return NextResponse.json(
        { success: false, error: 'Nevažeći link za odjavu' },
        { status: 400 }
      );
    }

    // Proveri da li je registrovan korisnik
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { newsletterOptIn: false },
      });
    }

    // Proveri da li je gost pretplatnik
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (subscriber) {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { active: false },
      });
    }

    if (!user && !subscriber) {
      return NextResponse.json(
        { success: false, error: 'Email nije pronađen u listi pretplatnika' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Uspešno ste se odjavili sa newsletter-a',
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    return NextResponse.json(
      { success: false, error: 'Došlo je do greške' },
      { status: 500 }
    );
  }
}

// GET za direktne linkove iz email-a
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  if (!email || !token) {
    return NextResponse.redirect(new URL('/?error=invalid-unsubscribe', request.url));
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!validateUnsubscribeToken(normalizedEmail, token)) {
    return NextResponse.redirect(new URL('/?error=invalid-token', request.url));
  }

  // Odjavi korisnika
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { newsletterOptIn: false },
    });
  }

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { email: normalizedEmail },
  });

  if (subscriber) {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { active: false },
    });
  }

  // Redirect na potvrdu
  return NextResponse.redirect(new URL('/?newsletter=unsubscribed', request.url));
}
