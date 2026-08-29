import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendOrderStatusEmail } from "@/lib/email/order-emails";
import {
  cancelOrderAtomically,
  PaymentStateError,
} from "@/lib/orders/payment";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    // Allow both ADMIN and OPERATOR roles to update order status
    const allowedRoles = ["ADMIN", "OPERATOR"];
    if (!session || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, trackingNumber, cancellationNote } = body;

    const validStatuses = ["PENDING", "CONFIRMED", "SHIPPED", "CANCELLED"];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Tracking number je obavezan za status SHIPPED
    if (status === "SHIPPED" && !trackingNumber?.trim()) {
      return NextResponse.json(
        { error: "Broj paketa je obavezan za status Poslata" },
        { status: 400 },
      );
    }

    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        paymentMethod: true,
        paymentStatus: true,
      },
    });
    if (!currentOrder) {
      return NextResponse.json({ error: "Porudžbina nije pronađena" }, { status: 404 });
    }
    if (currentOrder.status === "CANCELLED" && status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Otkazana porudžbina se ne može ponovo aktivirati bez nove provere zalihe" },
        { status: 409 },
      );
    }
    if (
      status !== "CANCELLED" &&
      currentOrder.paymentMethod === "CARD" &&
      ["PROCESSING", "REVIEW"].includes(currentOrder.paymentStatus)
    ) {
      return NextResponse.json(
        { error: "Status se ne može menjati dok se kartično plaćanje razrešava" },
        { status: 409 },
      );
    }
    if (
      ["CONFIRMED", "SHIPPED"].includes(status) &&
      currentOrder.paymentMethod === "CARD" &&
      currentOrder.paymentStatus !== "PAID"
    ) {
      return NextResponse.json(
        { error: "Kartična porudžbina mora biti plaćena pre potvrde ili slanja" },
        { status: 409 },
      );
    }

    // Otkazivanje i vraćanje zalihe su jedna Serializable transakcija. Servis
    // ujedno blokira otkazivanje dok je kartično plaćanje u obradi ili zahteva
    // refund/reconciliation, pa callback i admin zahtev ne mogu nezavisno da
    // promene terminalno stanje.
    const order =
      status === "CANCELLED"
        ? await cancelOrderAtomically(id)
        : await (async () => {
            const updated = await prisma.order.updateMany({
              where: {
                id,
                status: currentOrder.status,
                paymentStatus: currentOrder.paymentStatus,
              },
              data: {
                status,
                ...(status === "SHIPPED" && {
                  trackingNumber: trackingNumber.trim(),
                }),
              },
            });
            if (updated.count !== 1) {
              throw new PaymentStateError(
                "Stanje porudžbine je paralelno promenjeno",
                "ORDER_STATUS_CONFLICT",
              );
            }
            return prisma.order.findUniqueOrThrow({ where: { id } });
          })();

    // Send email notification
    try {
      await sendOrderStatusEmail(
        id,
        status,
        status === "SHIPPED" ? trackingNumber.trim() : undefined,
        status === "CANCELLED" ? cancellationNote?.trim() : undefined,
      );
    } catch (emailError) {
      console.error("Failed to send status email:", emailError);
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Update order status error:", error);
    if (error instanceof PaymentStateError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Greška pri ažuriranju statusa" },
      { status: 500 },
    );
  }
}
