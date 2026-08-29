import { verifyOrderAccessToken } from "@/lib/orders/access";

interface OrderSessionLike {
  user?: {
    id?: string;
    role?: string;
  };
}

export function canAccessOrder(
  order: { id: string; userId: string | null },
  session: OrderSessionLike | null,
  token?: string | null,
): boolean {
  const role = session?.user?.role || "";
  if (["ADMIN", "OPERATOR"].includes(role)) return true;
  if (session?.user?.id && order.userId === session.user.id) return true;
  return verifyOrderAccessToken(order.id, token);
}
