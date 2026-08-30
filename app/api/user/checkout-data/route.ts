import { resolveServerSession } from "@/lib/auth/server-session";
import {
  createCheckoutDataGetHandler,
  type CheckoutDataFailure,
} from "@/lib/checkout/checkout-data-route";
import { prisma } from "@/lib/db";

function reportCheckoutDataFailure(failure: CheckoutDataFailure): void {
  try {
    console.error("Checkout data request failed", failure);
  } catch {
    // Observability must never replace the fail-closed private response.
  }
}

export const GET = createCheckoutDataGetHandler({
  resolveSession: () => resolveServerSession(),
  findUserById: (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        addresses: {
          where: { isDefault: true },
          take: 1,
          select: {
            street: true,
            apartment: true,
            city: true,
            postalCode: true,
            country: true,
          },
        },
      },
    }),
  reportFailure: reportCheckoutDataFailure,
});
