'use server';

import { prisma } from '@/lib/db';
import { createSmtpTransport } from '@/lib/email/smtp';
import { fetchProducts } from '@/lib/products';
import { formatPriceWithCurrency } from '@/lib/utils/format';

const FROM_EMAIL = process.env.EMAIL_FROM || 'My Store <info@example.com>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '[SITE_URL]';

interface WishlistSaleItem {
  productId: string;
  productName: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  productUrl: string;
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
          <img src="${SITE_URL}/logo.png" alt="Store" style="height: 40px; width: auto;" />
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
            Tel: [STORE_PHONE] | Email: [STORE_EMAIL]
          </p>
          <p style="color: #666666; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} My Store. Sva prava zadržana.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send wishlist sale notification email
 */
export async function sendWishlistSaleEmail(
  userEmail: string,
  userName: string,
  items: WishlistSaleItem[]
): Promise<boolean> {
  if (items.length === 0) return true;

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 16px; border-bottom: 1px solid #eee;">
        <a href="${item.productUrl}" style="color: #4F46E5; text-decoration: none; font-weight: 500;">
          ${item.productName}
        </a>
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #eee; text-align: center;">
        <span style="text-decoration: line-through; color: #999;">${formatPriceWithCurrency(item.originalPrice)}</span>
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #eee; text-align: center; color: #dc2626; font-weight: bold;">
        ${formatPriceWithCurrency(item.salePrice)}
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #eee; text-align: center;">
        <span style="background: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
          -${item.discountPercent}%
        </span>
      </td>
    </tr>
  `).join('');

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🔥</div>
      <h2 style="color: #dc2626; font-size: 24px; margin: 0;">Artikli sa vaše liste želja su na akciji!</h2>
    </div>

    <p style="color: #444; margin: 0 0 16px;">Poštovani/a ${userName},</p>

    <p style="color: #666; margin: 0 0 24px;">Sjajna vest! Neki proizvodi sa vaše liste želja su trenutno na sniženju. Ne propustite priliku da uštedite!</p>

    <div style="background: #f8f8f8; border-radius: 8px; overflow: hidden; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #4F46E5;">
            <th style="padding: 12px; text-align: left; color: #ffffff; font-size: 12px; text-transform: uppercase;">Proizvod</th>
            <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 12px; text-transform: uppercase;">Redovna</th>
            <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 12px; text-transform: uppercase;">Akcija</th>
            <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 12px; text-transform: uppercase;">Popust</th>
          </tr>
        </thead>
        <tbody style="background: white;">
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}/lista-zelja"
         style="background-color: #4F46E5; color: white; padding: 14px 40px;
                text-decoration: none; border-radius: 4px; display: inline-block;
                font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
        Pogledaj listu želja
      </a>
    </div>

    <div style="background-color: #4F46E5; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="color: #ffc107; margin: 0; font-weight: 600;">
        ⏰ Požurite - akcije traju ograničeno vreme!
      </p>
    </div>

    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      Primili ste ovaj email jer ste dodali proizvode na listu želja.
    </p>
  `;

  try {
    const transporter = createSmtpTransport();
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: userEmail,
      subject: 'Proizvodi sa vaše liste želja su na akciji!',
      html: emailWrapper('Lista želja', content),
    });
    return true;
  } catch (error) {
    console.error('Failed to send wishlist sale email:', error);
    return false;
  }
}

/**
 * Check all users' wishlists for sale items and send notifications
 * This should be called by a cron job (e.g., daily)
 */
export async function checkAndNotifyWishlistSales(): Promise<{
  processed: number;
  notified: number;
  errors: number;
}> {
  const results = { processed: 0, notified: 0, errors: 0 };

  try {
    // Get all wishlist items grouped by user
    const wishlistItems = await prisma.wishlist.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    // Group by user
    const userWishlists = new Map<string, {
      email: string;
      firstName: string;
      productIds: string[];
    }>();

    for (const item of wishlistItems) {
      if (item.productId == null) continue;
      const existing = userWishlists.get(item.userId);
      if (existing) {
        existing.productIds.push(item.productId);
      } else {
        userWishlists.set(item.userId, {
          email: item.user.email,
          firstName: item.user.firstName,
          productIds: [item.productId],
        });
      }
    }

    // Fetch products on sale from local DB
    const { products: saleProducts } = await fetchProducts({
      onSale: true,
      limit: 500,
    });

    const saleProductMap = new Map(
      saleProducts.map(p => [p.id, p])
    );

    // Check each user's wishlist
    for (const [, userData] of userWishlists) {
      results.processed++;

      const saleItems: WishlistSaleItem[] = [];

      for (const productId of userData.productIds) {
        // Check if wishlist product is on sale
        const saleProduct = saleProductMap.get(productId);

        if (saleProduct && saleProduct.salePrice && saleProduct.salePrice < saleProduct.price) {
          const originalPrice = saleProduct.price;
          const salePrice = saleProduct.salePrice;
          const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

          saleItems.push({
            productId,
            productName: typeof saleProduct.name === 'object' && saleProduct.name ? (saleProduct.name as Record<string, string>).sr || '' : String(saleProduct.name || ''),
            originalPrice,
            salePrice,
            discountPercent,
            productUrl: `${SITE_URL}/product/${productId}`,
          });
        }
      }

      // Send email if there are sale items
      if (saleItems.length > 0) {
        const success = await sendWishlistSaleEmail(
          userData.email,
          userData.firstName,
          saleItems
        );

        if (success) {
          results.notified++;
        } else {
          results.errors++;
        }
      }
    }
  } catch (error) {
    console.error('Error checking wishlist sales:', error);
    results.errors++;
  }

  return results;
}
