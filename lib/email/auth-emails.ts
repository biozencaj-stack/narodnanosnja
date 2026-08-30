import { createSmtpTransport } from "@/lib/email/smtp";
import {
  storeName,
  storePhone,
  storeEmail,
  siteUrl,
} from "@/lib/config/store";
import { getStorefrontUrl } from "@/lib/config/storefront-url";

const FROM_EMAIL = process.env.EMAIL_FROM || `${storeName} <${storeEmail}>`;

/**
 * Email template wrapper - Black/White theme (no green)
 */
function emailWrapper(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'DM Sans', Arial, sans-serif; background-color: #4F46E5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">

        <!-- Header - Black -->
        <div style="background-color: #4F46E5; padding: 32px 24px; text-align: center;">
          <img src="${siteUrl}/logo.png" alt="${storeName}" style="height: 40px; width: auto;" />
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
          <p style="color: #ffffff; font-size: 14px; margin: 0 0 12px; font-weight: 500;">
            Tel: ${storePhone} | Email: ${storeEmail}
          </p>
          <p style="color: #666666; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} ${storeName}. Sva prava zadržana.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string
): Promise<void> {
  const resetUrl = `${siteUrl}/reset-password/${token}`;

  const content = `
    <h2 style="color: #4F46E5; font-size: 22px; margin: 0 0 20px;">Resetovanje lozinke</h2>

    <p style="color: #444; margin: 0 0 16px;">Poštovani ${firstName},</p>

    <p style="color: #666; margin: 0 0 16px;">Primili smo zahtev za resetovanje lozinke vašeg ${storeName} naloga.</p>

    <p style="color: #666; margin: 0 0 24px;">Kliknite na dugme ispod da biste postavili novu lozinku:</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}"
         style="background-color: #4F46E5; color: white; padding: 14px 40px;
                text-decoration: none; border-radius: 4px; display: inline-block;
                font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
        Resetuj lozinku
      </a>
    </div>

    <div style="background-color: #4F46E5; padding: 16px; border-radius: 8px; margin: 24px 0;">
      <p style="color: #ffc107; margin: 0; font-weight: 500;">
        ⏰ Link važi samo 1 sat!
      </p>
    </div>

    <p style="color: #999; font-size: 14px; margin: 0;">
      Ako niste zatražili reset lozinke, ignorišite ovaj email.
    </p>
  `;

  const transporter = createSmtpTransport();
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `Resetovanje lozinke - ${storeName}`,
    html: emailWrapper("Reset lozinke", content),
    text: `
Poštovani ${firstName},

Primili smo zahtev za resetovanje lozinke vašeg ${storeName} naloga.

Kliknite na link ispod da biste postavili novu lozinku:
${resetUrl}

Link važi 1 sat. Ako niste zatražili reset lozinke, ignorišite ovaj email.

© ${new Date().getFullYear()} ${storeName}
    `,
  });
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<void> {
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 16px;">👋</div>
      <h2 style="color: #4F46E5; font-size: 24px; margin: 0;">Dobrodošli u ${storeName}!</h2>
    </div>

    <p style="color: #444; margin: 0 0 16px;">Poštovani ${firstName},</p>

    <p style="color: #666; margin: 0 0 24px;">Hvala vam što ste kreirali nalog na ${storeName} webshopu.</p>

    <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <p style="color: #4F46E5; margin: 0 0 12px; font-weight: 600;">Sa vašim nalogom možete:</p>
      <ul style="color: #666; margin: 0; padding-left: 20px;">
        <li style="margin: 8px 0;">Pratiti status vaših porudžbina</li>
        <li style="margin: 8px 0;">Sačuvati adrese za bržu kupovinu</li>
        <li style="margin: 8px 0;">Pogledati istoriju kupovina</li>
        <li style="margin: 8px 0;">Dodavati artikle na listu želja</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${siteUrl}"
         style="background-color: #4F46E5; color: white; padding: 14px 40px;
                text-decoration: none; border-radius: 4px; display: inline-block;
                font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
        Započnite kupovinu
      </a>
    </div>
  `;

  const transporter = createSmtpTransport();
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `Dobrodošli u ${storeName} - Vaš nalog je kreiran`,
    html: emailWrapper("Dobrodošlica", content),
    text: `
Poštovani ${firstName},

Hvala vam što ste kreirali nalog na ${storeName} webshopu.

Sa vašim nalogom možete:
- Pratiti status vaših porudžbina
- Sačuvati adrese za bržu kupovinu
- Pogledati istoriju kupovina

Započnite kupovinu: ${siteUrl}

© ${new Date().getFullYear()} ${storeName}
    `,
  });
}

/**
 * Send an email verification link that opens an explicit confirmation page.
 */
export async function sendVerificationEmail(
  email: string,
  firstName: string,
  token: string
): Promise<void> {
  const verifyUrl = new URL(
    `/verify-email/${encodeURIComponent(token)}`,
    getStorefrontUrl(),
  ).toString();

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 16px;">✉️</div>
      <h2 style="color: #4F46E5; font-size: 24px; margin: 0;">Potvrdite vaš email</h2>
    </div>

    <p style="color: #444; margin: 0 0 16px;">Poštovani ${firstName},</p>

    <p style="color: #666; margin: 0 0 24px;">Hvala vam što ste se registrovali na ${storeName} webshopu.</p>

    <p style="color: #666; margin: 0 0 16px;">Dugme ispod otvara sigurnu stranicu za potvrdu emaila.</p>

    <p style="color: #666; margin: 0 0 24px;">Samo otvaranje linka neće promeniti vaš nalog. Na otvorenoj stranici izaberite „Potvrdi email“ da biste završili potvrdu i prijavu.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyUrl}" rel="noreferrer"
         style="background-color: #4F46E5; color: white; padding: 16px 48px;
                text-decoration: none; border-radius: 4px; display: inline-block;
                font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
        Otvori stranicu za potvrdu
      </a>
    </div>

    <div style="background-color: #4F46E5; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="color: #ffc107; margin: 0; font-weight: 600;">
        ⏰ Link važi samo 1 sat!
      </p>
    </div>

    <p style="color: #999; font-size: 14px; margin: 0; text-align: center;">
      Ako niste vi kreirali ovaj nalog, možete ignorisati ovaj email.
    </p>
  `;

  const transporter = createSmtpTransport();
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `Potvrdite vaš email - ${storeName}`,
    html: emailWrapper("Verifikacija", content),
    text: `
Poštovani ${firstName},

Hvala vam što ste se registrovali na ${storeName} webshopu.

Link ispod otvara sigurnu stranicu za potvrdu emaila. Samo otvaranje linka neće promeniti vaš nalog. Na otvorenoj stranici izaberite „Potvrdi email“ da završite potvrdu i prijavu:
${verifyUrl}

VAŽNO: Link važi samo 1 sat!

Ako niste vi kreirali ovaj nalog, možete ignorisati ovaj email.

© ${new Date().getFullYear()} ${storeName}
    `,
  });
}
