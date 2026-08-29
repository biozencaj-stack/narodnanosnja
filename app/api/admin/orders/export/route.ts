import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearProductSufix } from "@/lib/utils/format";
import type { OrderStatus, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

/**
 * Export orders to Excel format
 * GET /api/admin/orders/export?from=2024-01-01&to=2024-12-31
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nemate pristup" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    // Build where clause
    const where: Prisma.OrderWhereInput = {};

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate + "T23:59:59.999Z");
      }
    }

    // Fetch orders with items
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        transaction: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate Excel file as base64
    const base64Data = generateExcel(orders);

    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const uint8Array = new Uint8Array(bytes);

    // Return as downloadable file
    const filename = `porudzbine-${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export orders error:", error);
    return NextResponse.json(
      { error: "Greška pri exportu porudžbina" },
      { status: 500 }
    );
  }
}

interface OrderWithRelations {
  id: string;
  orderNumber: string;
  createdAt: Date;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: { toString(): string } | number;
  shipping: { toString(): string } | number;
  total: { toString(): string } | number;
  shippingStreet: string;
  shippingCity: string;
  shippingPostal: string;
  shippingCountry: string;
  guestEmail: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestPhone: string | null;
  note: string | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  items: Array<{
    productCode: string;
    productName: string;
    size: string;
    quantity: number;
    price: { toString(): string } | number;
  }>;
  transaction: {
    transId: string | null;
    authCode: string | null;
    status: string;
  } | null;
}

function generateExcel(orders: OrderWithRelations[]): string {
  // Status mappings
  const statusMap: Record<string, string> = {
    PENDING: "Na čekanju",
    CONFIRMED: "Potvrđena",
    PROCESSING: "U pripremi",
    PACKED: "Spakovano",
    SHIPPED: "Poslato",
    DELIVERED: "Isporučeno",
    CANCELLED: "Otkazano",
  };

  const paymentStatusMap: Record<string, string> = {
    PENDING: "Na čekanju",
    PAID: "Plaćeno",
    FAILED: "Neuspešno",
    REFUNDED: "Refundirano",
  };

  const paymentMethodMap: Record<string, string> = {
    CARD: "Kartica",
    CASH: "Pouzeće",
  };

  // Prepare data rows
  const data = orders.map((order) => {
    // Get customer info (user or guest)
    const firstName = order.user?.firstName || order.guestFirstName || "";
    const lastName = order.user?.lastName || order.guestLastName || "";
    const email = order.user?.email || order.guestEmail || "";
    const phone = order.user?.phone || order.guestPhone || "";

    // Format items (clean product names)
    const itemsStr = order.items
      .map((item) => `${clearProductSufix(item.productName)} (${item.productCode}, ${item.size}) x${item.quantity} - ${Number(item.price).toFixed(2)} RSD`)
      .join("; ");

    // Format date
    const date = new Date(order.createdAt).toLocaleString("sr-RS", {
      dateStyle: "short",
      timeStyle: "short",
    });

    return {
      "Broj porudžbine": order.orderNumber,
      "Datum": date,
      "Ime": firstName,
      "Prezime": lastName,
      "Email": email,
      "Telefon": phone,
      "Adresa": order.shippingStreet,
      "Grad": order.shippingCity,
      "Poštanski broj": order.shippingPostal,
      "Artikli": itemsStr,
      "Ukupno": Number(order.total).toFixed(2) + " RSD",
      "Način plaćanja": paymentMethodMap[order.paymentMethod] || order.paymentMethod,
      "Status plaćanja": paymentStatusMap[order.paymentStatus] || order.paymentStatus,
      "Status": statusMap[order.status] || order.status,
      "Napomena": order.note || "",
    };
  });

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Porudžbine");

  // Set column widths
  worksheet["!cols"] = [
    { wch: 15 }, // Broj porudžbine
    { wch: 18 }, // Datum
    { wch: 15 }, // Ime
    { wch: 15 }, // Prezime
    { wch: 25 }, // Email
    { wch: 15 }, // Telefon
    { wch: 30 }, // Adresa
    { wch: 15 }, // Grad
    { wch: 12 }, // Poštanski broj
    { wch: 60 }, // Artikli
    { wch: 15 }, // Ukupno
    { wch: 15 }, // Način plaćanja
    { wch: 15 }, // Status plaćanja
    { wch: 15 }, // Status
    { wch: 30 }, // Napomena
  ];

  // Add autofilter to all columns (header row)
  if (data.length > 0) {
    worksheet["!autofilter"] = { ref: `A1:O${data.length + 1}` };
  }

  // Generate buffer as base64 string
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  return base64;
}
