import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendOrderConfirmation } from "@/lib/email/mailer";
import {
  validateEmailAddress,
  validatePhoneFormat,
  validateSerbianPostal,
} from "@/lib/utils/validation";
import {
  buildCheckoutQuote,
  CheckoutQuoteError,
} from "@/lib/checkout/quote";
import {
  createSecureOrder,
  OrderInventoryError,
} from "@/lib/orders";
import {
  createOrderAccessCookieValue,
  createOrderAccessToken,
  orderAccessCookieName,
  orderAccessCookieOptions,
} from "@/lib/orders/access";
import { DEFAULT_COUNTRY } from "@/lib/config/checkout";
import { checkRateLimit } from "@/lib/rate-limit";
import type { CartItem } from "@/types/cart";
import { storeCapabilities } from "@/lib/config/capabilities";
import { verifyRecaptchaToken } from "@/lib/security/recaptcha";
import { prisma } from "@/lib/db";
import { ORDER_PENDING_RECOVERY_WINDOW_MS } from "@/lib/config/order-reservations";

interface OrderForm {
  email: string;
  firstName: string;
  lastName: string;
  tel: string;
  address: string;
  addressOptional?: string;
  city: string;
  postalCode: string;
  country?: string;
  useDifferentAddress?: boolean;
  addressAdd?: string;
  cityAdd?: string;
  postalCodeAdd?: string;
  countryAdd?: string;
  note?: string;
}

interface OrderItemRequest {
  id: string;
  size?: string;
  quantity: number;
}

interface OrderRequest {
  form: OrderForm;
  items: OrderItemRequest[];
  paymentMethod: "cash" | "card";
  couponCode?: string;
  recaptchaToken?: string;
  honeypot?: string;
}

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validateOrderForm(form: OrderForm | undefined): string | null {
  if (!form) return "Nedostaju podaci kupca";
  if (!validateEmailAddress(clean(form.email))) return "Unesite validnu email adresu";
  if (clean(form.firstName).length < 2) return "Ime mora imati najmanje 2 karaktera";
  if (clean(form.lastName).length < 2) return "Prezime mora imati najmanje 2 karaktera";
  if (!validatePhoneFormat(clean(form.tel))) return "Unesite validan broj telefona";
  if (clean(form.address).length < 5) return "Unesite validnu adresu";
  if (clean(form.city).length < 2) return "Unesite grad";
  if (!validateSerbianPostal(clean(form.postalCode))) return "Unesite validan poštanski broj";
  if (form.useDifferentAddress) {
    if (clean(form.addressAdd).length < 5) return "Unesite adresu za isporuku";
    if (clean(form.cityAdd).length < 2) return "Unesite grad za isporuku";
    if (!validateSerbianPostal(clean(form.postalCodeAdd))) {
      return "Unesite validan poštanski broj za isporuku";
    }
  }
  return null;
}

interface CheckoutOrderResponse {
  id: string;
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  total: unknown;
  currency: string;
  createdAt: Date;
  userId: string | null;
  guestEmail: string | null;
  items: Array<{
    productId: string | null;
    size: string;
    quantity: number;
  }>;
}

function sameCheckoutOwner(
  order: Pick<CheckoutOrderResponse, "userId" | "guestEmail">,
  userId: string | undefined,
  email: string,
): boolean {
  return order.userId
    ? order.userId === userId
    : order.guestEmail?.toLowerCase() === email.toLowerCase();
}

function checkoutOrderResponse(
  order: CheckoutOrderResponse,
  replayed: boolean,
  status = replayed ? 200 : 201,
) {
  const response = NextResponse.json(
    {
      success: true,
      replayed,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      total: Number(order.total),
      currency: order.currency,
      cartItems: order.items
        .filter((item) => Boolean(item.productId))
        .map((item) => ({
          id: item.productId!,
          size: item.size,
          quantity: item.quantity,
        })),
    },
    { status },
  );
  if (!order.userId) {
    const accessToken = createOrderAccessToken(order.id);
    response.cookies.set(
      orderAccessCookieName(order.id),
      createOrderAccessCookieValue(order.id, accessToken),
      orderAccessCookieOptions(),
    );
  }
  return response;
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
  );
}

function isWithinIdempotencyReplayWindow(createdAt: Date): boolean {
  const age = Date.now() - createdAt.getTime();
  return age >= 0 && age <= ORDER_PENDING_RECOVERY_WINDOW_MS;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`create-order:${ip}`, 8)) {
    return NextResponse.json(
      { success: false, error: "Previše zahteva. Pokušajte ponovo za minut." },
      { status: 429 },
    );
  }

  try {
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(idempotencyKey)) {
      return NextResponse.json(
        {
          success: false,
          error: "Nedostaje validan checkout idempotency ključ",
          code: "INVALID_IDEMPOTENCY_KEY",
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as OrderRequest;
    if (clean(body.honeypot, 200)) {
      return NextResponse.json(
        { success: false, error: "Zahtev nije prihvaćen" },
        { status: 400 },
      );
    }
    const formError = validateOrderForm(body.form);
    if (formError) {
      return NextResponse.json({ success: false, error: formError }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Korpa ne sme biti prazna" },
        { status: 400 },
      );
    }
    if (!body.paymentMethod || !["cash", "card"].includes(body.paymentMethod)) {
      return NextResponse.json(
        { success: false, error: "Izaberite način plaćanja" },
        { status: 400 },
      );
    }
    if (
      (body.paymentMethod === "card" && !storeCapabilities.cardPayments) ||
      (body.paymentMethod === "cash" && !storeCapabilities.cashOnDelivery)
    ) {
      return NextResponse.json(
        { success: false, error: "Izabrani način plaćanja trenutno nije dostupan" },
        { status: 409 },
      );
    }

    const recaptcha = await verifyRecaptchaToken(
      body.recaptchaToken,
      "checkout",
      ip,
    );
    if (!recaptcha.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            recaptcha.reason === "NOT_CONFIGURED"
              ? "Checkout zaštita trenutno nije konfigurisana"
              : "Potvrda da niste robot nije uspela. Pokušajte ponovo.",
          code: "HUMAN_VERIFICATION_FAILED",
        },
        { status: recaptcha.reason === "NOT_CONFIGURED" ? 503 : 403 },
      );
    }

    const session = await getServerSession(authOptions);
    const email = clean(body.form.email, 320);
    const existingOrder = await prisma.order.findUnique({
      where: { checkoutIdempotencyKey: idempotencyKey },
      include: { items: true },
    });
    if (existingOrder) {
      if (!sameCheckoutOwner(existingOrder, session?.user?.id, email)) {
        return NextResponse.json(
          { success: false, error: "Checkout pokušaj pripada drugoj porudžbini" },
          { status: 409 },
        );
      }
      if (!isWithinIdempotencyReplayWindow(existingOrder.createdAt)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Prethodni checkout pokušaj je istekao. Kontaktirajte podršku pre nove porudžbine.",
            code: "IDEMPOTENCY_REPLAY_EXPIRED",
          },
          { status: 409 },
        );
      }
      return checkoutOrderResponse(existingOrder, true);
    }

    const quote = await buildCheckoutQuote(
      body.items.map((item) => ({
        productId: item.id,
        size: item.size,
        quantity: item.quantity,
      })),
      { couponCode: body.couponCode, userId: session?.user?.id },
    );

    const form = body.form;
    const shippingStreet = form.useDifferentAddress
      ? clean(form.addressAdd)
      : [clean(form.address), clean(form.addressOptional)].filter(Boolean).join(" ");
    const shippingCity = form.useDifferentAddress
      ? clean(form.cityAdd)
      : clean(form.city);
    const shippingPostal = form.useDifferentAddress
      ? clean(form.postalCodeAdd, 20)
      : clean(form.postalCode, 20);
    const shippingCountry = form.useDifferentAddress
      ? clean(form.countryAdd, 100) || DEFAULT_COUNTRY || "Srbija"
      : clean(form.country, 100) || DEFAULT_COUNTRY || "Srbija";

    let order;
    try {
      order = await createSecureOrder({
        checkoutIdempotencyKey: idempotencyKey,
        userId: session?.user?.id,
        guestEmail: email,
        guestFirstName: clean(form.firstName, 100),
        guestLastName: clean(form.lastName, 100),
        guestPhone: clean(form.tel, 50),
        shippingStreet,
        shippingCity,
        shippingPostal,
        shippingCountry,
        paymentMethod: body.paymentMethod === "card" ? "CARD" : "CASH",
        note: clean(form.note, 2000) || undefined,
        quote,
      });
    } catch (createError) {
      if (isUniqueConstraintError(createError)) {
        const replayedOrder = await prisma.order.findUnique({
          where: { checkoutIdempotencyKey: idempotencyKey },
          include: { items: true },
        });
        if (
          replayedOrder &&
          sameCheckoutOwner(replayedOrder, session?.user?.id, email) &&
          isWithinIdempotencyReplayWindow(replayedOrder.createdAt)
        ) {
          return checkoutOrderResponse(replayedOrder, true);
        }
      }
      throw createError;
    }

    if (body.paymentMethod === "cash") {
      const emailItems: CartItem[] = quote.lines.map((line) => ({
        id: line.productId,
        code: line.productCode,
        name: line.productName,
        size: line.size,
        quantity: line.quantity,
        price: line.unitPrice,
        picture: line.picture,
      }));

      try {
        await sendOrderConfirmation(
          {
            contactEmail: email,
            contactFirstName: clean(form.firstName, 100),
            contactLastName: clean(form.lastName, 100),
            contactTelephone: clean(form.tel, 50),
            contactAddress: shippingStreet,
            contactCity: shippingCity,
            contactPostalCode: shippingPostal,
            contactCountry: shippingCountry,
            contactNote: clean(form.note, 2000) || undefined,
            orderLines: [],
          },
          emailItems,
          quote.total,
          quote.subtotal,
          quote.shipping,
          "cash",
        );
      } catch (emailError) {
        console.error("[Order API] Confirmation email failed:", emailError);
      }
    }

    return checkoutOrderResponse(order, false);
  } catch (error) {
    if (error instanceof CheckoutQuoteError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof OrderInventoryError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 409 },
      );
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Korpa je upravo promenjena. Pokušajte ponovo.",
          code: "CHECKOUT_CONFLICT",
        },
        { status: 409 },
      );
    }

    console.error("[Order API] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: "Došlo je do greške pri kreiranju porudžbine" },
      { status: 500 },
    );
  }
}
