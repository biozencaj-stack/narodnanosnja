import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrder } from "@/lib/orders";
import { DEFAULT_COUNTRY } from "@/lib/config/checkout";
import { checkRateLimit } from "@/lib/rate-limit";

export { POST } from "@/lib/checkout/order-handler";

async function legacyPOST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(`create-order:${ip}`, 10)) {
      return NextResponse.json(
        { error: "Previše zahteva. Pokušajte ponovo za minut." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      form,
      items,
      paymentMethod,
      subtotal,
      shipping,
      total,
    } = body;

    // Validate required fields
    if (!form || !items || !paymentMethod || total === undefined) {
      return NextResponse.json(
        { error: "Nedostaju obavezni podaci" },
        { status: 400 }
      );
    }

    // Get session if user is logged in
    const session = await getServerSession(authOptions);

    // Prepare order data
    const orderInput = {
      // If user is logged in, use their ID; otherwise use guest info
      userId: session?.user?.id,
      guestEmail: !session?.user?.id ? form.email : undefined,
      guestFirstName: !session?.user?.id ? form.firstName : undefined,
      guestLastName: !session?.user?.id ? form.lastName : undefined,
      guestPhone: !session?.user?.id ? form.tel : undefined,

      // Shipping address (use alternate if specified)
      shippingStreet: form.useDifferentAddress
        ? form.addressAdd
        : form.address,
      shippingCity: form.useDifferentAddress ? form.cityAdd : form.city,
      shippingPostal: form.postalCode,
      shippingCountry: form.country || DEFAULT_COUNTRY || "",

      // Payment
      paymentMethod: paymentMethod === "card" ? "CARD" : "CASH",

      // Amounts
      subtotal: subtotal || total,
      shipping: shipping || 0,
      total,

      // Note
      note: form.note,

      // Items
      items: items.map((item: {
        code?: string;
        id?: string;
        name: string;
        size: string;
        quantity: number;
        price: number;
        price1?: number;
        price2?: number;
        picture?: string;
      }) => ({
        productCode: item.code || item.id,
        productName: item.name,
        size: item.size,
        quantity: item.quantity,
        price: item.price2 || item.price1 || item.price,
        picture: item.picture,
      })),
    } as const;

    // Create order
    const order = await createOrder(orderInput);

    return NextResponse.json(
      {
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Greška pri kreiranju porudžbine" },
      { status: 500 }
    );
  }
}
