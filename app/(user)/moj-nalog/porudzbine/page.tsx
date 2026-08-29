import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { formatPriceWithCurrency } from "@/lib/utils/format";

export const metadata = {
  title: "Moje Porudžbine",
};

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      transaction: true,
    },
  });

  const statusLabels: Record<string, string> = {
    PENDING: "Na čekanju",
    CONFIRMED: "Potvrđena",
    SHIPPED: "Poslata",
    CANCELLED: "Otkazana",
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    SHIPPED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Moje porudžbine</h1>
        <p className="text-stone-600 mt-1">
          Pratite status i istoriju vaših porudžbina
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nemate porudžbina
          </h2>
          <p className="text-stone-500 mb-6">
            Vaša istorija kupovine će se pojaviti ovde
          </p>
          <Link
            href="/catalog"
            className="inline-flex items-center px-6 py-3 bg-stone-900 text-white rounded-lg
                       hover:bg-stone-800 transition-colors"
          >
            Započnite kupovinu
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/moj-nalog/porudzbine/${order.id}`}
              className="block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-stone-900">
                      Porudžbina #{order.orderNumber}
                    </h3>
                    <p className="text-sm text-stone-500">
                      {new Date(order.createdAt).toLocaleDateString("sr-RS", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-3 py-1 rounded-full ${
                        statusColors[order.status]
                      }`}
                    >
                      {statusLabels[order.status]}
                    </span>
                    <ChevronRight className="h-5 w-5 text-stone-400" />
                  </div>
                </div>

                {/* Order items preview */}
                <div className="flex items-center gap-4 mb-4">
                  {order.items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="w-16 h-16 bg-stone-100 rounded-lg flex items-center justify-center text-xs text-stone-500"
                    >
                      {item.productCode.slice(0, 6)}
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="w-16 h-16 bg-stone-100 rounded-lg flex items-center justify-center text-sm text-stone-500">
                      +{order.items.length - 3}
                    </div>
                  )}
                </div>

                {/* Order summary */}
                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <div className="text-sm text-stone-500">
                    <span className="font-medium">{order.items.length}</span>{" "}
                    {order.items.length === 1 ? "artikal" : "artikala"} •{" "}
                    {order.paymentMethod === "CARD" ? "Kartica" : "Pouzeće"}
                  </div>
                  <div className="text-lg font-semibold text-stone-900">
                    {formatPriceWithCurrency(Number(order.total))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
