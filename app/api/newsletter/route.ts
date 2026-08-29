import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendNewsletterConfirmation } from '@/lib/email/mailer';
import { validateEmailAddress } from '@/lib/utils/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validacija
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Unesite email adresu' },
        { status: 400 }
      );
    }

    if (!validateEmailAddress(email)) {
      return NextResponse.json(
        { success: false, error: 'Email adresa nije validna!' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Proveri da li je registrovan korisnik
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Ako je korisnik već registrovan, uključi mu newsletter
      if (existingUser.newsletterOptIn) {
        return NextResponse.json(
          { success: false, error: 'Već ste pretplaćeni na newsletter!' },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: { newsletterOptIn: true },
      });
    } else {
      // Proveri da li je već pretplaćen kao gost
      const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingSubscriber) {
        if (existingSubscriber.active) {
          return NextResponse.json(
            { success: false, error: 'Ovaj email je već pretplaćen!' },
            { status: 400 }
          );
        }

        // Reaktiviraj pretplatu
        await prisma.newsletterSubscriber.update({
          where: { id: existingSubscriber.id },
          data: { active: true },
        });
      } else {
        // Kreiraj novog pretplatnika
        await prisma.newsletterSubscriber.create({
          data: { email: normalizedEmail },
        });
      }
    }

    // Pošalji confirmation email
    await sendNewsletterConfirmation(normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'Uspešno ste se pretplatili!',
    });
  } catch (error) {
    console.error('Newsletter API error:', error);
    return NextResponse.json(
      { success: false, error: 'Došlo je do greške' },
      { status: 500 }
    );
  }
}
