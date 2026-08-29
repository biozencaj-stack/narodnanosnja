import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildCheckoutQuote, CheckoutQuoteError } from "@/lib/checkout/quote";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/promotions
 * Calculate cart discounts and validate coupon codes
 *
 * Body: { items: [{ productId, size, quantity }], couponCode?: string }
 * Cene poslate iz browsera se namerno ignorišu.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`cart-quote:${ip}`, 60)) {
      return NextResponse.json(
        { error: "Previše zahteva. Pokušajte ponovo za minut." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { items, couponCode } = body;

    // Calculate cart discounts
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Items required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const quote = await buildCheckoutQuote(
      items.map((item: { productId?: string; size?: string; quantity?: number }) => ({
        productId: item.productId || "",
        size: item.size,
        quantity: Number(item.quantity),
      })),
      { couponCode, userId: session?.user?.id },
    );
    return NextResponse.json(
      {
        lines: quote.lines.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          size: line.size,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        })),
        promotions: quote.promotions,
        totalDiscount: quote.discount,
        freeShipping: quote.shipping === 0,
        subtotal: quote.subtotal,
        shipping: quote.shipping,
        total: quote.total,
        currency: quote.currency,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof CheckoutQuoteError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("Promotions API error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
