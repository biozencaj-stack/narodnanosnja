import { NextRequest, NextResponse } from "next/server";
import { sendOrderConfirmation } from "@/lib/email/mailer";
import {
  validateEmailAddress,
  validatePhoneFormat,
  validateSerbianPostal,
} from "@/lib/utils/validation";
import { createOrder } from "@/lib/orders";
import { SHIPPING_COST, type CartItem } from "@/types/cart";
import { DEFAULT_COUNTRY } from "@/lib/config/checkout";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export { POST } from "@/lib/checkout/order-handler";

interface OrderForm {
  email: string;
  firstName: string;
  lastName: string;
  tel: string;
  address: string;
  addressOptional?: string;
  city: string;
  postalCode: string;
  country: string;
  useDifferentAddress?: boolean;
  addressAdd?: string;
  cityAdd?: string;
  postalCodeAdd?: string;
  countryAdd?: string;
  note?: string;
}

interface OrderItem {
  id: string;
  code: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  price1?: number;
  price2?: number;
  picture?: string;
  pictureName?: string;
  model?: string;
}

interface TransactionDetails {
  authCode: string;
  transDate: string;
  transId: string;
  amount: number;
}

interface OrderRequest {
  form: OrderForm;
  items: OrderItem[];
  paymentMethod: "cash" | "card";
  total: number;
  subtotal: number;
  shipping: number;
  discount?: number;
  couponCode?: string;
  promotionIds?: string[];
  transactionDetails?: TransactionDetails;
}

function validateOrderForm(form: OrderForm): string | null {
  if (!form.email || !validateEmailAddress(form.email)) {
    return "Unesite validnu email adresu";
  }
  if (!form.firstName || form.firstName.length < 2) {
    return "Ime mora imati najmanje 2 karaktera";
  }
  if (!form.lastName || form.lastName.length < 2) {
    return "Prezime mora imati najmanje 2 karaktera";
  }
  if (!form.tel || !validatePhoneFormat(form.tel)) {
    return "Unesite validan broj telefona";
  }
  if (!form.address || form.address.length < 5) {
    return "Unesite validnu adresu";
  }
  if (!form.city || form.city.length < 2) {
    return "Unesite grad";
  }
  if (!form.postalCode || !validateSerbianPostal(form.postalCode)) {
    return "Unesite validan poštanski broj";
  }
  if (form.useDifferentAddress) {
    if (!form.addressAdd) {
      return "Unesite adresu za isporuku";
    }
    if (!form.cityAdd) {
      return "Unesite grad za isporuku";
    }
    if (!form.postalCodeAdd || !validateSerbianPostal(form.postalCodeAdd)) {
      return "Unesite validan poštanski broj za isporuku";
    }
  }
  return null;
}

function validateOrderItems(items: OrderItem[]): string | null {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return "Korpa ne sme biti prazna";
  }
  for (const item of items) {
    if (!item.id || !item.code || !item.name || !item.size) {
      return "Neispravan artikal u korpi";
    }
    if (typeof item.quantity !== "number" || item.quantity < 1) {
      return "Neispravan broj artikala";
    }
    if (typeof item.price !== "number") {
      return "Neispravna cena artikla";
    }
  }
  return null;
}

async function legacyPOST(request: NextRequest) {
  try {
    const body: OrderRequest = await request.json();

    // Validate form
    const formError = validateOrderForm(body.form);
    if (formError) {
      return NextResponse.json(
        { success: false, error: formError },
        { status: 400 },
      );
    }

    // Validate items
    const itemsError = validateOrderItems(body.items);
    if (itemsError) {
      return NextResponse.json(
        { success: false, error: itemsError },
        { status: 400 },
      );
    }

    // Validate payment method
    if (!body.paymentMethod || !["cash", "card"].includes(body.paymentMethod)) {
      return NextResponse.json(
        { success: false, error: "Izaberite način plaćanja" },
        { status: 400 },
      );
    }

    // Validate total
    if (typeof body.total !== "number" || body.total <= 0) {
      return NextResponse.json(
        { success: false, error: "Neispravan ukupan iznos" },
        { status: 400 },
      );
    }

    const {
      form,
      items,
      paymentMethod,
      total,
      subtotal,
      shipping,
      discount,
      couponCode,
      promotionIds,
      transactionDetails,
    } = body;

    // Get session if user is logged in
    const session = await getServerSession(authOptions);

    // Use subtotal from request, fallback to calculated
    const calculatedSubtotal =
      subtotal ||
      items.reduce((sum: number, item: OrderItem) => {
        const price = item.price2 || item.price1 || item.price;
        return sum + price * item.quantity;
      }, 0);
    const shippingCost = shipping ?? SHIPPING_COST;

    // Determine shipping address
    const shippingStreet = form.useDifferentAddress
      ? form.addressAdd || form.address
      : form.address + (form.addressOptional ? " " + form.addressOptional : "");

    // Prepare order data for database
    // Always save contact info from form (even for logged-in users)
    // This makes the order self-contained with all contact data
    const orderData = {
      userId: session?.user?.id,
      guestEmail: form.email,
      guestFirstName: form.firstName,
      guestLastName: form.lastName,
      guestPhone: form.tel,
      shippingStreet,
      shippingCity: form.useDifferentAddress
        ? form.cityAdd || form.city
        : form.city,
      shippingPostal: form.useDifferentAddress
        ? form.postalCodeAdd || form.postalCode
        : form.postalCode,
      shippingCountry: form.useDifferentAddress
        ? form.countryAdd || form.country || DEFAULT_COUNTRY || ""
        : form.country || DEFAULT_COUNTRY || "",
      paymentMethod:
        paymentMethod === "card" ? ("CARD" as const) : ("CASH" as const),
      subtotal: calculatedSubtotal,
      shipping: shippingCost,
      discount: discount || 0,
      total,
      couponCode: couponCode || null,
      promotionIds: promotionIds || [],
      note: form.note,
      items: items.map((item: OrderItem) => ({
        productCode: item.code,
        productName: item.name,
        size: item.size,
        quantity: item.quantity,
        price: item.price2 || item.price1 || item.price,
        picture: item.pictureName, // Filename only (~30 bytes), not base64
      })),
    };

    // CARD PAYMENT: Only save to database, don't send email yet
    // Email will be sent after successful payment in NestPay callback
    if (paymentMethod === "card") {
      const dbOrder = await createOrder(orderData);

      // Record coupon usage for card payments too
      if (couponCode) {
        try {
          const { recordCouponUsage } = await import("@/lib/promotions");
          await recordCouponUsage(couponCode, session?.user?.id, dbOrder.id);
        } catch (couponErr) {
          console.error("[Order API] Failed to record coupon usage:", couponErr);
        }
      }

      return NextResponse.json({
        success: true,
        orderNumber: dbOrder.orderNumber,
        orderId: dbOrder.id,
      });
    }

    // CASH PAYMENT: Save to local database + send email
    console.log("[Order API] Processing cash order...");
    const dbOrder = await createOrder(orderData);
    console.log("[Order API] Order saved:", dbOrder.orderNumber);

    // Send confirmation email
    await sendOrderConfirmation(
      {
        contactEmail: form.email,
        contactFirstName: form.firstName,
        contactLastName: form.lastName,
        contactTelephone: form.tel,
        contactAddress:
          form.useDifferentAddress && form.addressAdd
            ? form.addressAdd
            : form.address,
        contactCity:
          form.useDifferentAddress && form.cityAdd ? form.cityAdd : form.city,
        contactPostalCode: form.useDifferentAddress
          ? form.postalCodeAdd || form.postalCode
          : form.postalCode,
        contactCountry: form.useDifferentAddress
          ? form.countryAdd || form.country || DEFAULT_COUNTRY || ""
          : form.country || DEFAULT_COUNTRY || "",
        contactNote: form.note,
        orderLines: [],
      },
      items as CartItem[],
      total,
      calculatedSubtotal,
      shippingCost,
      paymentMethod,
    );

    // Record coupon usage if a coupon was used
    if (couponCode) {
      try {
        const { recordCouponUsage } = await import("@/lib/promotions");
        await recordCouponUsage(couponCode, session?.user?.id, dbOrder.id);
        console.log("[Order API] Coupon usage recorded:", couponCode);
      } catch (couponErr) {
        console.error("[Order API] Failed to record coupon usage:", couponErr);
      }
    }

    console.log("[Order API] Order completed:", dbOrder.orderNumber);

    return NextResponse.json({
      success: true,
      orderNumber: dbOrder.orderNumber,
    });
  } catch (error) {
    console.error("[Order API] FATAL ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
