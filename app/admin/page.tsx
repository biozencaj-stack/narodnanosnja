import { prisma } from "@/lib/db";
import {
  AlertTriangle,
  ArrowRight,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatPriceWithCurrency } from "@/lib/utils/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { parseLocalized } from "@/lib/i18n/localized";

const LOW_STOCK_THRESHOLD = 5;

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
    paidRevenue,
    lowStockCount,
    lowStockItems,
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
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
      },
    }),
    prisma.productSize.count({
      where: {
        active: true,
        stock: { lte: LOW_STOCK_THRESHOLD },
        product: { active: true },
      },
    }),
    prisma.productSize.findMany({
      where: {
        active: true,
        stock: { lte: LOW_STOCK_THRESHOLD },
        product: { active: true },
      },
      orderBy: [{ stock: "asc" }, { size: "asc" }],
      take: 5,
      select: {
        id: true,
        size: true,
        stock: true,
        product: {
          select: { id: true, name: true, sku: true },
        },
      },
    }),
  ]);

  const revenue = paidRevenue._sum.total
    ? Number(paidRevenue._sum.total)
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
              <p className="text-sm text-stone-500">Plaćeni prihod</p>
              <p className="text-3xl font-bold text-green-600">
                {formatPriceWithCurrency(revenue)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-stone-500 mt-2">
            Plaćene, neotkazane porudžbine
          </p>
        </div>
      </div>

      {/* Inventory attention queue */}
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-semibold text-amber-950">
                Zalihe koje zahtevaju pažnju
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                {lowStockCount === 0
                  ? "Sve aktivne lager stavke imaju više od pet komada."
                  : `${lowStockCount} aktivnih lager stavki ima ${LOW_STOCK_THRESHOLD} ili manje komada.`}
              </p>
            </div>
          </div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 self-start rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-800"
          >
            Svi proizvodi
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {lowStockItems.length > 0 && (
          <div className="divide-y divide-amber-200 border-t border-amber-200 bg-white/70">
            {lowStockItems.map((item) => {
              const localizedName = parseLocalized(item.product.name);
              const productName =
                localizedName.sr ||
                localizedName.en ||
                item.product.sku ||
                "Proizvod";

              return (
                <Link
                  key={item.id}
                  href={`/admin/products/${item.product.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-3 text-sm transition-colors hover:bg-amber-50"
                >
                  <span className="min-w-0 truncate text-stone-800">
                    {productName}
                    <span className="ml-2 text-stone-500">
                      Veličina: {item.size}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-semibold ${
                      item.stock === 0 ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    {item.stock} kom
                  </span>
                </Link>
              );
            })}
          </div>
        )}
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
