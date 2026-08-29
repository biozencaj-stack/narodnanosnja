import { prisma } from "@/lib/db";
import { formatPriceWithCurrency } from "@/lib/utils/format";
import { BarChart3, TrendingUp, TrendingDown, Calendar } from "lucide-react";

// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Statistika | Admin",
};

export default async function AdminStatisticsPage() {
  // Get last 30 days of orders
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalRevenue,
    monthlyOrders,
    avgOrderValue,
    ordersByStatus,
    ordersByPaymentMethod,
    topProducts,
  ] = await Promise.all([
    // Total revenue (all orders except cancelled)
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: "CANCELLED" } },
    }),
    // Orders in last 30 days
    prisma.order.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    // Average order value
    prisma.order.aggregate({
      _avg: { total: true },
    }),
    // Orders by status
    prisma.order.groupBy({
      by: ["status"],
      _count: true,
    }),
    // Orders by payment method
    prisma.order.groupBy({
      by: ["paymentMethod"],
      _count: true,
    }),
    // Top products (from order items) - top 5
    prisma.orderItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const statusLabels: Record<string, string> = {
    PENDING: "Na čekanju",
    CONFIRMED: "Potvrđena",
    PROCESSING: "U pripremi",
    SHIPPED: "Poslata",
    DELIVERED: "Isporučena",
    CANCELLED: "Otkazana",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-900">Statistika</h1>
        <p className="text-stone-600">Pregled poslovanja</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm text-stone-500">Ukupan prihod</p>
          <p className="text-2xl font-bold text-stone-900">
            {formatPriceWithCurrency(Number(totalRevenue._sum.total || 0))}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
          <p className="text-sm text-stone-500">Porudžbine (30 dana)</p>
          <p className="text-2xl font-bold text-stone-900">{monthlyOrders}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
          <p className="text-sm text-stone-500">Prosečna vrednost</p>
          <p className="text-2xl font-bold text-stone-900">
            {formatPriceWithCurrency(Number(avgOrderValue._avg.total || 0))}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <TrendingDown className="h-8 w-8 text-amber-600" />
          </div>
          <p className="text-sm text-stone-500">Kartica vs Pouzeće</p>
          <p className="text-2xl font-bold text-stone-900">
            {ordersByPaymentMethod.find((p) => p.paymentMethod === "CARD")?._count || 0}
            {" / "}
            {ordersByPaymentMethod.find((p) => p.paymentMethod === "CASH")?._count || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by status */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            Porudžbine po statusu
          </h2>
          <div className="space-y-3">
            {ordersByStatus.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between"
              >
                <span className="text-stone-600">
                  {statusLabels[item.status] || item.status}
                </span>
                <span className="font-semibold text-stone-900">
                  {item._count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            Najprodavaniji proizvodi
          </h2>
          <div className="space-y-3">
            {topProducts.map((item, index) => (
              <div
                key={item.productName}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="text-stone-600 truncate max-w-[200px]">
                    {item.productName}
                  </span>
                </div>
                <span className="font-semibold text-stone-900">
                  {item._sum.quantity} kom
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
