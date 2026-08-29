'use server';

import type { SendMailOptions } from 'nodemailer';
import type { Order, TransactionDetails } from '@/types/order';
import type { CartItem } from '@/types/cart';
import { formatPriceWithCurrency, clearProductSufix } from '@/lib/utils/format';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyRecaptchaToken } from '@/lib/security/recaptcha';
import { escapeHtmlText, sanitizeRichHtml } from '@/lib/security/html';
import { createSmtpTransport } from '@/lib/email/smtp';
import { getStorefrontUrl } from '@/lib/config/storefront-url';
import { createNewsletterUnsubscribeUrl } from '@/lib/newsletter/unsubscribe';

// Configurable store constants (read from environment)
const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'My Store';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const STORE_EMAIL = process.env.SMTP_SERVER_USERNAME || 'info@example.com';
const STORE_PHONE = process.env.NEXT_PUBLIC_STORE_PHONE || '';

interface PublicFormProof {
  recaptchaToken?: string | null;
  honeypot?: string;
}

async function verifyPublicFormProof(
  action: 'contact' | 'reclamation',
  proof: PublicFormProof,
): Promise<boolean> {
  if (typeof proof?.honeypot === 'string' && proof.honeypot.trim()) return false;

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip') ||
    'unknown';
  if (!checkRateLimit(`public-form:${action}:${ip}`, action === 'contact' ? 8 : 4)) {
    return false;
  }

  const verification = await verifyRecaptchaToken(
    proof?.recaptchaToken,
    action,
    ip,
  );
  return verification.success;
}

/**
 * Send a generic email
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const transporter = createSmtpTransport();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"${STORE_NAME}" <${STORE_EMAIL}>`,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Email template wrapper - Black/White theme (no green)
 */
function emailWrapper(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'DM Sans', Arial, sans-serif; background-color: #4F46E5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">

        <!-- Header - Black -->
        <div style="background-color: #4F46E5; padding: 32px 24px; text-align: center;">
          <img src="${SITE_URL}/logo.png" alt="${STORE_NAME}" style="height: 40px; width: auto;" />
          <p style="color: #888888; margin: 12px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">${title}</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
          ${content}
        </div>

        <!-- Footer - Dark -->
        <div style="background-color: #4F46E5; padding: 24px; text-align: center;">
          <p style="color: #888888; font-size: 14px; margin: 0 0 8px;">
            Za sva pitanja možete nas kontaktirati:
          </p>
          <p style="color: #ffffff; font-size: 14px; margin: 0; font-weight: 500;">
            ${STORE_PHONE ? `Tel: ${STORE_PHONE} | ` : ''}Email: ${STORE_EMAIL}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send order confirmation email
 */

/**
 * Get product image URL for email
 * Supports both local uploads (/uploads/...) and legacy Balans API names
 */
function getProductImageUrl(pictureName?: string): string {
  if (!pictureName) return '';
  // If it's already a path (starts with /), use it directly
  if (pictureName.startsWith('/')) {
    return `${SITE_URL}${pictureName}`;
  }
  // Legacy: Balans API image name
  return `${SITE_URL}/api/image/${encodeURIComponent(pictureName)}`;
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmation(
  order: Order,
  items: CartItem[],
  total: number,
  subtotal: number,
  shipping: number,
  paymentMethod: 'cash' | 'card'
): Promise<boolean> {
  const itemsHtml = items
    .map(
      item => {
        const cleanName = clearProductSufix(item.name);
        const imageUrl = getProductImageUrl(item.pictureName);
        return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; width: 60px;">
            ${imageUrl ? `<img src="${imageUrl}" alt="${cleanName}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 4px; background: #f8f8f8;" />` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5;">
            <strong>${cleanName}</strong>
            <div style="color: #666; font-size: 11px; margin-top: 2px;">${item.code} | Vel: ${item.size}</div>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right; white-space: nowrap;">
            ${formatPriceWithCurrency(item.price2 || item.price1 || item.price)}
          </td>
        </tr>
      `;
      }
    )
    .join('');

  const paymentText = paymentMethod === 'card'
    ? 'Plaćeno karticom'
    : 'Plaćanje pouzećem';

  const content = `
    <p style="color: #4F46E5; font-size: 16px; margin: 0 0 24px;">
      Poštovani/a ${order.contactFirstName},
    </p>
    <p style="color: #666; font-size: 16px; margin: 0 0 24px;">
      Hvala Vam na porudžbini! Vaša porudžbina je uspešno primljena i biće obrađena u najkraćem roku.
    </p>

    <!-- Order Details -->
    <h2 style="color: #4F46E5; font-size: 18px; margin: 24px 0 16px; border-bottom: 2px solid #4F46E5; padding-bottom: 8px;">
      Detalji porudžbine
    </h2>

    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8f8f8;">
          <th style="padding: 10px; width: 60px;"></th>
          <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Artikal</th>
          <th style="padding: 10px; text-align: center; color: #666; font-size: 11px; text-transform: uppercase;">Kol.</th>
          <th style="padding: 10px; text-align: right; color: #666; font-size: 11px; text-transform: uppercase;">Cena</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding: 8px 10px; text-align: right; color: #666;">
            Međuzbir:
          </td>
          <td style="padding: 8px 10px; text-align: right; color: #666; white-space: nowrap;">
            ${formatPriceWithCurrency(subtotal)}
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 8px 10px; text-align: right; color: #666;">
            Dostava:
          </td>
          <td style="padding: 8px 10px; text-align: right; color: #666; white-space: nowrap;">
            ${formatPriceWithCurrency(shipping)}
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 16px; border-top: 2px solid #4F46E5;">
            Ukupno:
          </td>
          <td style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 16px; color: #4F46E5; white-space: nowrap; border-top: 2px solid #4F46E5;">
            ${formatPriceWithCurrency(total)}
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- Shipping Info -->
    <h2 style="color: #4F46E5; font-size: 18px; margin: 32px 0 16px; border-bottom: 2px solid #4F46E5; padding-bottom: 8px;">
      Adresa dostave
    </h2>
    <p style="color: #666; margin: 0; line-height: 1.6;">
      ${order.contactFirstName} ${order.contactLastName}<br>
      ${order.contactAddress}<br>
      ${order.contactPostalCode} ${order.contactCity}<br>
      ${order.contactCountry}<br>
      Tel: ${order.contactTelephone}
    </p>

    <!-- Payment -->
    <div style="background-color: #4F46E5; padding: 16px; border-radius: 8px; margin-top: 24px;">
      <p style="color: #ffffff; margin: 0; font-weight: 600;">
        ✓ ${paymentText}
      </p>
    </div>
  `;

  const html = emailWrapper('Potvrda porudžbine', content);

  // Send to customer
  const customerResult = await sendEmail(
    order.contactEmail,
    `Potvrda porudžbine - ${STORE_NAME}`,
    html
  );

  // Send copy to store
  await sendEmail(
    STORE_EMAIL,
    `Nova porudžbina - ${order.contactFirstName} ${order.contactLastName}`,
    html
  );

  return customerResult;
}

/**
 * Send newsletter subscription confirmation
 */
export async function sendNewsletterConfirmation(email: string): Promise<boolean> {
  const content = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
      <h2 style="color: #4F46E5; font-size: 24px; margin: 0 0 16px;">Pretplaćeni ste!</h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
        Hvala vam što ste se pretplatili na naš newsletter. Radujemo se što ćemo vas obaveštavati o najnovijim vestima i ponudama.
      </p>
      <a href="${SITE_URL}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
        Posetite naš sajt
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        Ako se niste pretplatili ili želite da se odjavite, kontaktirajte nas na ${STORE_EMAIL}
      </p>
    </div>
  `;

  const html = emailWrapper('Newsletter', content);
  return sendEmail(email, `Prijava na Newsletter - ${STORE_NAME}`, html);
}

/**
 * Send newsletter campaign email
 */
export async function sendNewsletterCampaign(
  email: string,
  subject: string,
  content: string
): Promise<boolean> {
  const safeSubject = escapeHtmlText(subject);
  const safeContent = sanitizeRichHtml(content);
  const unsubscribeUrl = createNewsletterUnsubscribeUrl(
    getStorefrontUrl(),
    email,
  );

  const html = `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeSubject}</title>
</head>
<body style="font-family: 'DM Sans', Arial, sans-serif; background-color: #4F46E5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">

    <!-- Header - Black -->
    <div style="background-color: #4F46E5; padding: 32px 24px; text-align: center;">
      <img src="${SITE_URL}/logo.png" alt="${STORE_NAME}" style="height: 40px; width: auto;" />
      <p style="color: #888888; margin: 12px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Newsletter</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <h2 style="color: #4F46E5; font-size: 22px; margin: 0 0 24px; font-weight: 600;">${safeSubject}</h2>
      <div style="color: #444; font-size: 16px; line-height: 1.7;">
        <style>
          .newsletter-content p { margin: 0 0 16px; }
          .newsletter-content h1 { font-size: 28px; margin: 24px 0 16px; color: #4F46E5; }
          .newsletter-content h2 { font-size: 22px; margin: 20px 0 12px; color: #4F46E5; }
          .newsletter-content h3 { font-size: 18px; margin: 16px 0 10px; color: #4F46E5; }
          .newsletter-content ul, .newsletter-content ol { margin: 0 0 16px; padding-left: 24px; }
          .newsletter-content li { margin: 4px 0; }
          .newsletter-content a { color: #4F46E5; text-decoration: underline; }
          .newsletter-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
        </style>
        <div class="newsletter-content">${safeContent}</div>
      </div>

      <div style="margin-top: 32px; text-align: center;">
        <a href="${SITE_URL}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
          Posetite naš sajt
        </a>
      </div>
    </div>

    <!-- Footer - Dark -->
    <div style="background-color: #4F46E5; padding: 24px; text-align: center;">
      <p style="color: #888888; font-size: 14px; margin: 0 0 8px;">
        Za sva pitanja možete nas kontaktirati:
      </p>
      <p style="color: #ffffff; font-size: 14px; margin: 0 0 16px; font-weight: 500;">
        ${STORE_PHONE ? `Tel: ${STORE_PHONE} | ` : ''}Email: ${STORE_EMAIL}
      </p>
      <p style="color: #666666; font-size: 12px; margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #666666; text-decoration: underline;">Odjavi se sa newsletter-a</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html);
}

/**
 * Send reclamation email
 */
export async function sendReclamationEmail(
  html: string,
  proof: PublicFormProof,
  attachment?: { content: string; filename: string }
): Promise<boolean> {
  try {
    if (!(await verifyPublicFormProof('reclamation', proof))) return false;
    if (typeof html !== 'string' || html.length === 0 || html.length > 100_000) {
      return false;
    }
    if (
      attachment &&
      (Buffer.byteLength(attachment.content, 'base64') > 2 * 1024 * 1024 ||
        attachment.filename.length > 180)
    ) {
      return false;
    }

    const transporter = createSmtpTransport();

    const mailOptions: SendMailOptions = {
      from: process.env.EMAIL_FROM || `"${STORE_NAME}" <${STORE_EMAIL}>`,
      to: STORE_EMAIL,
      subject: `${STORE_NAME}: Reklamacija`,
      html,
    };

    if (attachment) {
      mailOptions.attachments = [
        {
          filename: attachment.filename.replace(/[/\\\0]/g, '_'),
          content: attachment.content,
          encoding: 'base64',
        },
      ];
    }

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Failed to send reclamation email:', error);
    return false;
  }
}

/**
 * Send contact form email
 */
export async function sendContactEmail(
  html: string,
  proof: PublicFormProof,
): Promise<boolean> {
  try {
    if (!(await verifyPublicFormProof('contact', proof))) return false;
    if (typeof html !== 'string' || html.length === 0 || html.length > 50_000) {
      return false;
    }

    const transporter = createSmtpTransport();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"${STORE_NAME}" <${STORE_EMAIL}>`,
      to: STORE_EMAIL,
      subject: `${STORE_NAME}: Kontakt forma`,
      html,
    });

    return true;
  } catch (error) {
    console.error('Failed to send contact email:', error);
    return false;
  }
}

/**
 * Send order confirmation email with transaction details
 * Used after successful card payment
 */
export async function sendOrderConfirmationWithTransaction(
  order: Order,
  items: CartItem[],
  total: number,
  paymentMethod: 'cash' | 'card',
  transactionDetails?: TransactionDetails,
  subtotal?: number,
  shipping?: number
): Promise<boolean> {
  // Calculate subtotal if not provided
  const calculatedSubtotal = subtotal ?? items.reduce((sum, item) => {
    const price = item.price2 || item.price1 || item.price;
    return sum + price * item.quantity;
  }, 0);
  // Default shipping cost
  const shippingCost = shipping ?? 600;
  const itemsHtml = items
    .map(
      item => {
        const cleanName = clearProductSufix(item.name);
        const imageUrl = getProductImageUrl(item.pictureName);
        return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; width: 60px;">
            ${imageUrl ? `<img src="${imageUrl}" alt="${cleanName}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 4px; background: #f8f8f8;" />` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5;">
            <strong>${cleanName}</strong>
            <div style="color: #666; font-size: 11px; margin-top: 2px;">${item.code} | Vel: ${item.size}</div>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right; white-space: nowrap;">
            ${formatPriceWithCurrency(item.price2 || item.price1 || item.price)}
          </td>
        </tr>
      `;
      }
    )
    .join('');

  const paymentText = paymentMethod === 'card'
    ? 'Plaćeno karticom'
    : 'Plaćanje pouzećem';

  // Transaction details section (only for card payments)
  const transactionHtml = transactionDetails && paymentMethod === 'card' ? `
    <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e5e5;">
      <h3 style="color: #4F46E5; margin: 0 0 12px; font-size: 16px;">✓ Detalji transakcije</h3>
      <table style="width: 100%; font-size: 14px; color: #333;">
        ${transactionDetails.authCode ? `<tr><td style="padding: 4px 0;"><strong>Autorizacioni kod:</strong></td><td style="padding: 4px 0;">${transactionDetails.authCode}</td></tr>` : ''}
        ${transactionDetails.transDate ? `<tr><td style="padding: 4px 0;"><strong>Datum transakcije:</strong></td><td style="padding: 4px 0;">${transactionDetails.transDate}</td></tr>` : ''}
        ${transactionDetails.transId ? `<tr><td style="padding: 4px 0;"><strong>ID transakcije:</strong></td><td style="padding: 4px 0;">${transactionDetails.transId}</td></tr>` : ''}
        ${transactionDetails.amount ? `<tr><td style="padding: 4px 0;"><strong>Iznos:</strong></td><td style="padding: 4px 0;">${formatPriceWithCurrency(transactionDetails.amount)}</td></tr>` : ''}
      </table>
    </div>
  ` : '';

  const content = `
    <p style="color: #4F46E5; font-size: 16px; margin: 0 0 24px;">
      Poštovani/a ${order.contactFirstName},
    </p>
    <p style="color: #666; font-size: 16px; margin: 0 0 24px;">
      Hvala Vam na porudžbini! Vaša porudžbina je uspešno primljena i biće obrađena u najkraćem roku.
    </p>

    ${transactionHtml}

    <!-- Order Details -->
    <h2 style="color: #4F46E5; font-size: 18px; margin: 24px 0 16px; border-bottom: 2px solid #4F46E5; padding-bottom: 8px;">
      Detalji porudžbine
    </h2>

    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8f8f8;">
          <th style="padding: 10px; width: 60px;"></th>
          <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Artikal</th>
          <th style="padding: 10px; text-align: center; color: #666; font-size: 11px; text-transform: uppercase;">Kol.</th>
          <th style="padding: 10px; text-align: right; color: #666; font-size: 11px; text-transform: uppercase;">Cena</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding: 8px 10px; text-align: right; color: #666;">
            Međuzbir:
          </td>
          <td style="padding: 8px 10px; text-align: right; color: #666; white-space: nowrap;">
            ${formatPriceWithCurrency(calculatedSubtotal)}
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 8px 10px; text-align: right; color: #666;">
            Dostava:
          </td>
          <td style="padding: 8px 10px; text-align: right; color: #666; white-space: nowrap;">
            ${formatPriceWithCurrency(shippingCost)}
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 16px; border-top: 2px solid #4F46E5;">
            Ukupno:
          </td>
          <td style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 16px; color: #4F46E5; white-space: nowrap; border-top: 2px solid #4F46E5;">
            ${formatPriceWithCurrency(total)}
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- Shipping Info -->
    <h2 style="color: #4F46E5; font-size: 18px; margin: 32px 0 16px; border-bottom: 2px solid #4F46E5; padding-bottom: 8px;">
      Adresa dostave
    </h2>
    <p style="color: #666; margin: 0; line-height: 1.6;">
      ${order.contactFirstName} ${order.contactLastName}<br>
      ${order.contactAddress}<br>
      ${order.contactPostalCode} ${order.contactCity}<br>
      ${order.contactCountry}<br>
      Tel: ${order.contactTelephone}
    </p>

    <!-- Payment -->
    <div style="background-color: #4F46E5; padding: 16px; border-radius: 8px; margin-top: 24px;">
      <p style="color: #ffffff; margin: 0; font-weight: 600;">
        ✓ ${paymentText}
      </p>
    </div>
  `;

  const html = emailWrapper('Potvrda porudžbine', content);

  // Send to customer
  const customerResult = await sendEmail(
    order.contactEmail,
    `Potvrda porudžbine - ${STORE_NAME}`,
    html
  );

  // Send copy to store
  await sendEmail(
    STORE_EMAIL,
    `Nova porudžbina - ${order.contactFirstName} ${order.contactLastName}`,
    html
  );

  return customerResult;
}
