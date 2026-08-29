import { prisma } from "@/lib/db";
import { Package, Users, CreditCard, TrendingUp } from "lucide-react";
import { formatPriceWithCurrency } from "@/lib/utils/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Kontrolna tabla | Admin",
};

export default async function AdminDashboardPage() {
  // Check if user is OPERATOR - redirect them to orders page
  const session = await getServerSession(authOptions);
  if (session?.user.role === "OPERATOR") {
    redirect("/admin/orders");
  }
  // Fetch stats
  const [
    totalOrders,
    pendingOrders,
    totalUsers,
    recentOrders,
    todayOrders,
    totalRevenue,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.user.count(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true },
    }),
    prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: "CANCELLED" } },
    }),
  ]);

  const revenue = totalRevenue._sum.total
    ? Number(totalRevenue._sum.total)
    : 0;

  const statusLabels: Record<string, string> = {
    PENDING: "Na čekanju",
    CONFIRMED: "Potvrđena",
    SHIPPED: "Poslata",
    CANCELLED: "Otkazana",
  };

  const statusColors: Record<string, string> = {
    PENDING: "text-yellow-600 bg-yellow-100",
    CONFIRMED: "text-blue-600 bg-blue-100",
    SHIPPED: "text-green-600 bg-green-100",
    CANCELLED: "text-red-600 bg-red-100",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-900">Kontrolna tabla</h1>
        <p className="text-stone-600">Pregled ključnih metrika</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500">Ukupno porudžbina</p>
              <p className="text-3xl font-bold text-stone-900">{totalOrders}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-stone-500 mt-2">
            {todayOrders} danas
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500">Na čekanju</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingOrders}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-sm text-stone-500 mt-2">Zahteva pažnju</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500">Korisnici</p>
              <p className="text-3xl font-bold text-stone-900">{totalUsers}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-stone-500 mt-2">Registrovani</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500">Ukupan prihod</p>
              <p className="text-3xl font-bold text-green-600">
                {formatPriceWithCurrency(revenue)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-stone-500 mt-2">Sve porudžbine (bez otkazanih)</p>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">
            Nedavne porudžbine
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Porudžbina
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Kupac
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Iznos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Datum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-stone-900 hover:text-stone-600"
                    >
                      {order.orderNumber}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-stone-600">
                    {order.guestEmail || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        statusColors[order.status]
                      }`}
                    >
                      {statusLabels[order.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {formatPriceWithCurrency(Number(order.total))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-stone-500">
                    {new Date(order.createdAt).toLocaleDateString("sr-RS")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
