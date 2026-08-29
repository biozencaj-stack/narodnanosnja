import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { formatPriceWithCurrency, clearProductSufix } from "@/lib/utils/format";

/**
 * Create email transporter - consistent with mailer.ts
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_SERVER_HOST || process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_SERVER_PORT || process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_SERVER_USERNAME,
      pass: process.env.SMTP_SERVER_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.3",
      ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384",
    },
  });
}

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'My Store';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const STORE_EMAIL = process.env.SMTP_SERVER_USERNAME || 'info@example.com';
const STORE_PHONE = process.env.NEXT_PUBLIC_STORE_PHONE || '';
const FROM_EMAIL = process.env.EMAIL_FROM || `"${STORE_NAME}" <${STORE_EMAIL}>`;

/**
 * Get product image URL for email
 * Supports both local uploads (/uploads/...) and legacy API names
 */
function getProductImageUrl(picture?: string | null): string {
  if (!picture) return "";
  if (picture.startsWith('/')) return `${SITE_URL}${picture}`;
  return `${SITE_URL}/api/image/${encodeURIComponent(picture)}`;
}

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
          <p style="color: #ffffff; font-size: 14px; margin: 0 0 12px; font-weight: 500;">
            ${STORE_PHONE ? `Tel: ${STORE_PHONE} | ` : ''}Email: ${STORE_EMAIL}
          </p>
          <p style="color: #666666; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} ${STORE_NAME}. Sva prava zadržana.
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
export async function sendOrderConfirmationEmail(
  orderId: string,
): Promise<void> {
  // Fetch order with all details
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      transaction: true,
      user: true,
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const customerEmail = order.user?.email || order.guestEmail;
  const customerName = order.user?.firstName || order.guestFirstName || "Kupac";
  const customerLastName = order.user?.lastName || order.guestLastName || "";
  const customerPhone = order.guestPhone || "";

  if (!customerEmail) {
    throw new Error("No customer email found");
  }

  const isPaid = order.paymentStatus === "PAID";
  const paymentMethodText =
    order.paymentMethod === "CARD" ? "Platna kartica" : "Pouzeće";

  // Generate items HTML
  const itemsHtml = order.items
    .map((item) => {
      const cleanName = clearProductSufix(item.productName);
      const imageUrl = getProductImageUrl(item.picture);
      return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 60px;">
          ${imageUrl ? `<img src="${imageUrl}" alt="${cleanName}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 4px; background: #fff;" />` : ""}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong style="color: #4F46E5;">${cleanName}</strong>
          <div style="color: #888; font-size: 11px; margin-top: 2px;">${item.productCode} | Vel: ${item.size}</div>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: #666;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #4F46E5; font-weight: 500; white-space: nowrap;">${formatPriceWithCurrency(Number(item.price))}</td>
      </tr>
    `;
    })
    .join("");

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
      <h2 style="color: #4F46E5; font-size: 24px; margin: 0;">Hvala na porudžbini!</h2>
    </div>

    <p style="color: #444; margin: 0 0 16px;">Poštovani ${customerName},</p>

    <p style="color: #666; margin: 0 0 16px;">Vaša porudžbina <strong style="color: #4F46E5;">#${order.orderNumber}</strong> je uspešno primljena.</p>

    ${isPaid ? '<div style="background-color: #4F46E5; color: white; padding: 12px 16px; border-radius: 4px; margin: 16px 0; text-align: center; font-weight: 500;">✓ Plaćanje je uspešno izvršeno</div>' : ""}

    <!-- Order Items -->
    <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #4F46E5; margin: 0 0 16px; font-size: 16px; border-bottom: 2px solid #4F46E5; padding-bottom: 8px;">Detalji porudžbine</h3>

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="padding: 10px; width: 60px;"></th>
            <th style="padding: 10px; text-align: left; color: #888; font-size: 11px; text-transform: uppercase;">Artikal</th>
            <th style="padding: 10px; text-align: center; color: #888; font-size: 11px; text-transform: uppercase;">Kol.</th>
            <th style="padding: 10px; text-align: right; color: #888; font-size: 11px; text-transform: uppercase;">Cena</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #4F46E5;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 4px 0; color: #666;"><strong>Međuzbir:</strong></td>
            <td style="text-align: right; color: #4F46E5;">${formatPriceWithCurrency(Number(order.subtotal))}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #666;"><strong>Dostava:</strong></td>
            <td style="text-align: right; color: #4F46E5;">${formatPriceWithCurrency(Number(order.shipping))}</td>
          </tr>
          <tr style="font-size: 18px;">
            <td style="padding: 12px 0 0;"><strong style="color: #4F46E5;">Ukupno:</strong></td>
            <td style="text-align: right; padding: 12px 0 0;"><strong style="color: #4F46E5;">${formatPriceWithCurrency(Number(order.total))}</strong></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Shipping Address -->
    <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #4F46E5; margin: 0 0 12px; font-size: 16px;">📦 Adresa za dostavu</h3>
      <p style="margin: 0; color: #666; line-height: 1.6;">
        ${customerName} ${customerLastName}<br>
        ${order.shippingStreet}<br>
        ${order.shippingPostal} ${order.shippingCity}<br>
        ${order.shippingCountry}<br>
        ${customerPhone ? `Tel: ${customerPhone}` : ""}
      </p>
    </div>

    <!-- Payment Method -->
    <div style="background: #4F46E5; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #ffffff; margin: 0 0 12px; font-size: 16px;">💳 Način plaćanja</h3>
      <p style="margin: 0; color: #ffffff; font-weight: 600;">${paymentMethodText}</p>
      ${
        order.transaction
          ? `
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #888;">
          ID transakcije: ${order.transaction.transId || "N/A"}<br>
          Autorizacioni kod: ${order.transaction.authCode || "N/A"}
        </p>
      `
          : ""
      }
    </div>

    ${
      order.note
        ? `
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 24px 0;">
        <strong style="color: #856404;">📝 Napomena:</strong>
        <p style="margin: 8px 0 0; color: #856404;">${order.note}</p>
      </div>
    `
        : ""
    }

    <p style="color: #666; margin: 24px 0 0; text-align: center;">Obavestićemo vas kada pošiljka bude poslata.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}"
         style="background-color: #4F46E5; color: white; padding: 14px 40px;
                text-decoration: none; border-radius: 4px; display: inline-block;
                font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
        Nastavite kupovinu
      </a>
    </div>
  `;

  const transporter = createTransporter();
  const emailHtml = emailWrapper("Potvrda porudžbine", content);
  const emailSubject = `Potvrda porudžbine #${order.orderNumber} - ${STORE_NAME}`;

  // Send to customer
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: customerEmail,
    subject: emailSubject,
    html: emailHtml,
  });

  // Send copy to store (CRITICAL: both cash and card orders get store notification)
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: STORE_EMAIL,
      subject: `Nova porudžbina #${order.orderNumber} - ${customerName} ${customerLastName}`,
      html: emailHtml,
    });
  } catch (storeCopyError) {
    console.error("[Email] Failed to send store copy:", storeCopyError);
    // Don't fail if store copy fails - customer email was already sent
  }
}

/**
 * Send order status update email
 */
export async function sendOrderStatusEmail(
  orderId: string,
  newStatus: string,
  trackingNumber?: string,
  cancellationNote?: string,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });

  if (!order) return;

  const customerEmail = order.user?.email || order.guestEmail;
  const customerName = order.user?.firstName || order.guestFirstName || "Kupac";

  if (!customerEmail) return;

  const statusMessages: Record<
    string,
    { title: string; message: string; color: string }
  > = {
    CONFIRMED: {
      title: "Porudžbina potvrđena",
      message: "Vaša porudžbina je potvrđena i uskoro će biti poslata.",
      color: "#4F46E5",
    },
    SHIPPED: {
      title: "Porudžbina poslata",
      message:
        "Vaša porudžbina je poslata! Očekujte je u narednih 2-5 radnih dana.",
      color: "#4F46E5",
    },
    DELIVERED: {
      title: "Porudžbina isporučena",
      message: "Vaša porudžbina je uspešno isporučena. Hvala na poverenju!",
      color: "#4F46E5",
    },
    CANCELLED: {
      title: "Porudžbina otkazana",
      message:
        "Vaša porudžbina je otkazana. Ako imate pitanja, kontaktirajte nas.",
      color: "#dc2626",
    },
  };

  const statusInfo = statusMessages[newStatus];
  if (!statusInfo) return;

  // Tracking section za SHIPPED status
  // Configurable tracking URL: set TRACKING_URL_TEMPLATE in .env with {tracking} placeholder
  // Examples:
  //   City Express:  https://www.cityexpress.rs/pracenje-posiljke?broj={tracking}
  //   Post Express:  https://www.postexpress.rs/tracking/?id={tracking}
  //   BEX:           https://tracking.bfrack.com/?broj={tracking}
  //   AKS Express:   https://www.aks.rs/tracking?code={tracking}
  //   DHL:           https://www.dhl.com/rs-sr/home/tracking.html?tracking-id={tracking}
  const trackingUrlTemplate = process.env.TRACKING_URL_TEMPLATE || '';
  const trackingUrl = trackingUrlTemplate.replace('{tracking}', trackingNumber || '');
  const courierName = process.env.TRACKING_COURIER_NAME || 'Kurirski servis';

  const trackingSection =
    newStatus === "SHIPPED" && trackingNumber
      ? `
    <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px; color: #0369a1; font-weight: 600; font-size: 14px;">
        Broj paketa za praćenje:
      </p>
      <p style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: #4F46E5; letter-spacing: 2px;">
        ${trackingNumber}
      </p>
      ${trackingUrl ? `
      <a href="${trackingUrl}"
         target="_blank"
         style="background-color: #4F46E5; color: white; padding: 14px 28px;
                text-decoration: none; border-radius: 4px; display: inline-block;
                font-weight: 600; font-size: 14px;">
        Pratite vašu pošiljku →
      </a>
      <p style="margin: 16px 0 0; color: #64748b; font-size: 12px;">
        ${courierName}
      </p>
      ` : `
      <p style="margin: 0; color: #64748b; font-size: 12px;">
        Koristite broj paketa za praćenje na sajtu ${courierName}
      </p>
      `}
    </div>
  `
      : "";

  // Cancellation note section za CANCELLED status
  const cancellationSection =
    newStatus === "CANCELLED" && cancellationNote
      ? `
    <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <p style="margin: 0 0 12px; color: #dc2626; font-weight: 600; font-size: 14px;">
        Razlog otkazivanja:
      </p>
      <p style="margin: 0; color: #4F46E5; font-size: 15px; line-height: 1.6;">
        ${cancellationNote}
      </p>
    </div>
  `
      : "";

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: ${statusInfo.color}; font-size: 24px; margin: 0;">${statusInfo.title}</h2>
    </div>

    <p style="color: #444; margin: 0 0 16px;">Poštovani ${customerName},</p>

    <p style="color: #666; margin: 0 0 24px;">${statusInfo.message}</p>

    ${trackingSection}
    ${cancellationSection}

    <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${statusInfo.color};">
      <p style="margin: 0; color: #4F46E5;">
        <strong>Broj porudžbine:</strong> #${order.orderNumber}<br>
        <strong>Novi status:</strong> <span style="color: ${statusInfo.color}; font-weight: 600;">${statusInfo.title}</span>
      </p>
    </div>
  `;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: customerEmail,
    subject: `${statusInfo.title} - Porudžbina #${order.orderNumber}`,
    html: emailWrapper("Status porudžbine", content),
  });
}
