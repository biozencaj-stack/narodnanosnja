import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Package, MapPin, CreditCard, ArrowRight } from "lucide-react";
import { formatPriceWithCurrency } from "@/lib/utils/format";

export const metadata = {
  title: "Moj Nalog",
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  // Fetch user data with orders and addresses
  const [recentOrders, addressCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        items: true,
      },
    }),
    prisma.address.count({
      where: { userId: session.user.id },
    }),
  ]);

  const totalOrders = await prisma.order.count({
    where: { userId: session.user.id },
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
        <h1 className="text-2xl font-bold text-stone-900">
          Dobrodošli, {session.user.firstName}!
        </h1>
        <p className="text-stone-600 mt-1">
          Pregledajte i upravljajte vašim nalogom
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{totalOrders}</p>
              <p className="text-sm text-stone-500">Ukupno porudžbina</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <MapPin className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{addressCount}</p>
              <p className="text-sm text-stone-500">Sačuvane adrese</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">
                {session.user.role === "ADMIN"
                  ? "Admin"
                  : session.user.role === "OPERATOR"
                    ? "Operater"
                    : "Kupac"}
              </p>
              <p className="text-sm text-stone-500">Status naloga</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            Nedavne porudžbine
          </h2>
          <Link
            href="/moj-nalog/porudzbine"
            className="text-sm text-stone-600 hover:text-stone-900 flex items-center gap-1"
          >
            Sve porudžbine
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-6 text-center text-stone-500">
            <Package className="h-12 w-12 mx-auto mb-3 text-stone-300" />
            <p>Nemate još porudžbina</p>
            <Link
              href="/catalog?sale=true"
              className="text-stone-900 hover:underline mt-2 inline-block"
            >
              Započnite kupovinu →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/moj-nalog/porudzbine/${order.id}`}
                className="block p-6 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-stone-900">
                    {order.orderNumber}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      statusColors[order.status]
                    }`}
                  >
                    {statusLabels[order.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-stone-500">
                  <span>
                    {new Date(order.createdAt).toLocaleDateString("sr-RS", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="font-medium text-stone-900">
                    {formatPriceWithCurrency(Number(order.total))}
                  </span>
                </div>
                <div className="mt-2 text-xs text-stone-500">
                  {order.items.length}{" "}
                  {order.items.length === 1 ? "artikal" : "artikla"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
