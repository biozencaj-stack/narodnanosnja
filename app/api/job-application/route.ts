import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import JobForm from '@/lib/models/JobForm';
import { getStoreSettings } from '@/lib/config/store-settings';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyRecaptchaToken } from '@/lib/security/recaptcha';
import { validateEmailAddress } from '@/lib/utils/validation';

interface JobApplicationData {
  name: string;
  surname: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  workingCity: string;
  additionalInfo: string;
  processData: boolean;
  files: string[];
  fileNames: string[];
  recaptchaToken?: string;
  honeypot?: string;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`job-application:${ip}`, 4)) {
    return NextResponse.json({ error: 'Previše zahteva. Pokušajte kasnije.' }, { status: 429 });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Prijava je prevelika.' }, { status: 413 });
  }

  try {
    const data: JobApplicationData = await request.json();

    if (typeof data.honeypot === 'string' && data.honeypot.trim()) {
      return NextResponse.json({ error: 'Zahtev nije prihvaćen.' }, { status: 400 });
    }
    const recaptcha = await verifyRecaptchaToken(
      data.recaptchaToken,
      'job_application',
      ip,
    );
    if (!recaptcha.success) {
      return NextResponse.json(
        { error: 'Potvrda da niste robot nije uspela.' },
        { status: recaptcha.reason === 'NOT_CONFIGURED' ? 503 : 403 },
      );
    }

    // Validate required fields
    if (
      !data.name || data.name.length > 100 ||
      !data.surname || data.surname.length > 100 ||
      !validateEmailAddress(data.email) || data.email.length > 320 ||
      !data.phoneNumber || data.phoneNumber.length > 50 ||
      !data.workingCity || data.workingCity.length > 100 ||
      data.additionalInfo?.length > 2_000 ||
      data.processData !== true ||
      !Array.isArray(data.files) || !Array.isArray(data.fileNames) ||
      data.files.length === 0 || data.files.length > 2 ||
      data.files.length !== data.fileNames.length
    ) {
      return NextResponse.json(
        { error: 'Sva obavezna polja moraju biti popunjena.' },
        { status: 400 }
      );
    }

    const allowedExtension = /\.(pdf|doc|docx|txt|odt|rtf|jpe?g|png|webp)$/i;
    let totalAttachmentSize = 0;
    for (let index = 0; index < data.files.length; index += 1) {
      const file = data.files[index];
      const fileName = data.fileNames[index];
      if (typeof file !== 'string' || typeof fileName !== 'string') {
        return NextResponse.json({ error: 'Neispravan prilog.' }, { status: 400 });
      }
      const size = Buffer.byteLength(file, 'base64');
      totalAttachmentSize += size;
      if (size <= 0 || size > 5 * 1024 * 1024 || fileName.length > 180 || !allowedExtension.test(fileName)) {
        return NextResponse.json({ error: 'Neispravan format ili veličina priloga.' }, { status: 400 });
      }
    }
    if (totalAttachmentSize > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Prilozi su preveliki.' }, { status: 413 });
    }

    const settings = await getStoreSettings();
    const storeName = settings['store.name'];
    const storeEmail = settings['contact.email'];

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER_HOST || process.env.SMTP_HOST || '[SMTP_HOST]',
      port: parseInt(process.env.SMTP_SERVER_PORT || process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_SERVER_USERNAME || process.env.SMTP_USER || storeEmail,
        pass: process.env.SMTP_SERVER_PASSWORD || process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
      },
    });

    // Create JobForm instance and format email body
    const jobForm = new JobForm(
      data.name,
      data.surname,
      data.email,
      data.gender,
      data.dateOfBirth,
      data.phoneNumber,
      data.workingCity,
      data.additionalInfo
    );

    // Prepare attachments
    const attachments = data.files.map((file, index) => ({
      filename: data.fileNames[index].replace(/[/\\\0]/g, '_'),
      content: file,
      encoding: 'base64' as const,
    }));

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_SERVER_USERNAME || storeEmail,
      to: storeEmail,
      replyTo: data.email,
      subject: `${storeName} Web Shop: Karijera - Grad: ${data.workingCity}`,
      html: jobForm.formatMailBody(),
      attachments,
    });

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Job application error:', error);
    return NextResponse.json(
      { error: 'Došlo je do greške prilikom slanja prijave.' },
      { status: 500 }
    );
  }
}
