import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ORDER_PENDING_RECOVERY_WINDOW_MS } from "@/lib/config/order-reservations";
import { getOrderById } from "@/lib/orders";
import {
  getOrderAccessTokenFromCookie,
  orderAccessCookieName,
  ORDER_ACCESS_COOKIE,
  verifyCheckoutIdempotencyKey,
  verifyOrderAccessToken,
} from "@/lib/orders/access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get order
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json(
        { error: "Porudžbina nije pronađena" },
        { status: 404 }
      );
    }

    // Check authorization
    const session = await getServerSession(authOptions);

    // Allow access if:
    // 1. User is admin
    // 2. User owns the order
    // 3. Guest email matches (would need to implement token-based access)
    const isPrivileged = ["ADMIN", "OPERATOR"].includes(session?.user?.role || "");
    const isOwner = session?.user?.id && order.userId === session.user.id;
    const explicitToken =
      request.headers.get("x-order-access-token") ||
      request.nextUrl.searchParams.get("token");
    const cookieToken = getOrderAccessTokenFromCookie(
      order.id,
      request.cookies.get(orderAccessCookieName(order.id))?.value ||
        request.cookies.get(ORDER_ACCESS_COOKIE)?.value,
    );
    const hasGuestToken =
      verifyOrderAccessToken(order.id, explicitToken) || Boolean(cookieToken);
    const recoveryAge = Date.now() - order.createdAt.getTime();
    const hasCheckoutKey =
      order.paymentMethod === "CARD" &&
      ["PENDING", "PROCESSING"].includes(order.paymentStatus) &&
      recoveryAge >= 0 &&
      recoveryAge <= ORDER_PENDING_RECOVERY_WINDOW_MS &&
      verifyCheckoutIdempotencyKey(
        order.checkoutIdempotencyKey,
        request.headers.get("idempotency-key"),
      );

    if (!isPrivileged && !isOwner && !hasGuestToken && !hasCheckoutKey) {
      return NextResponse.json(
        { error: "Nemate pristup ovoj porudžbini" },
        { status: session ? 403 : 401 },
      );
    }

    const hasNormalAccess = Boolean(isPrivileged || isOwner || hasGuestToken);
    const recoveryOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      total: order.total,
      subtotal: order.subtotal,
      shipping: order.shipping,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        picture: item.picture,
      })),
    };
    const response = NextResponse.json({
      order: hasCheckoutKey && !hasNormalAccess
        ? recoveryOrder
        : {
            ...recoveryOrder,
            shippingStreet: order.shippingStreet,
            shippingCity: order.shippingCity,
            shippingPostal: order.shippingPostal,
            shippingCountry: order.shippingCountry,
            note: order.note,
            transaction: order.transaction
              ? {
                  transId: order.transaction.transId,
                  authCode: order.transaction.authCode,
                  amount: order.transaction.amount,
                  status: order.transaction.status,
                  createdAt: order.transaction.createdAt,
                }
              : null,
            customer: {
              email: order.user?.email || order.guestEmail,
              firstName: order.user?.firstName || order.guestFirstName,
              lastName: order.user?.lastName || order.guestLastName,
              phone: order.guestPhone,
            },
        },
    }, { headers: { "Cache-Control": "private, no-store" } });
    return response;
  } catch (error) {
    console.error("Get order error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju porudžbine" },
      { status: 500 }
    );
  }
}
