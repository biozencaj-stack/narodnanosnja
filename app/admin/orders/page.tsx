import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatPriceWithCurrency } from "@/lib/utils/format";
import { Eye, Search } from "lucide-react";
import { Prisma } from "@prisma/client";
import { ExportOrders } from "./ExportOrders";

// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Porudžbine | Admin",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
    q?: string;
  }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const status = params.status as string | undefined;
  const search = params.q?.trim() || "";
  const perPage = 20;

  // Build where clause
  const where: Prisma.OrderWhereInput = {};

  if (status) {
    where.status = status as never;
  }

  if (search) {
    where.OR = [
      { guestFirstName: { contains: search, mode: "insensitive" } },
      { guestLastName: { contains: search, mode: "insensitive" } },
      { guestEmail: { contains: search, mode: "insensitive" } },
      { guestPhone: { contains: search, mode: "insensitive" } },
      { orderNumber: { contains: search, mode: "insensitive" } },
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
      include: {
        items: true,
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

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

  const statuses = [
    { value: "", label: "Sve" },
    { value: "PENDING", label: "Na čekanju" },
    { value: "CONFIRMED", label: "Potvrđene" },
    { value: "SHIPPED", label: "Poslate" },
    { value: "CANCELLED", label: "Otkazane" },
  ];

  // Build query string for links
  const buildQueryString = (newParams: { status?: string; q?: string; page?: string }) => {
    const merged = { status, q: search, ...newParams };
    const parts: string[] = [];
    if (merged.status) parts.push(`status=${merged.status}`);
    if (merged.q) parts.push(`q=${encodeURIComponent(merged.q)}`);
    if (merged.page && merged.page !== "1") parts.push(`page=${merged.page}`);
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900">Porudžbine</h1>
          <p className="text-stone-600">Ukupno {total} porudžbina</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        {/* Search */}
        <form action="/admin/orders" method="GET" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Pretraži po imenu, emailu, telefonu ili broju porudžbine..."
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2
                         focus:ring-primary focus:border-transparent text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
          >
            Pretraži
          </button>
          {search && (
            <Link
              href={`/admin/orders${status ? `?status=${status}` : ""}`}
              className="px-4 py-2 bg-stone-100 text-stone-700 text-sm rounded-lg hover:bg-stone-200 transition-colors"
            >
              Poništi
            </Link>
          )}
        </form>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Link
              key={s.value}
              href={`/admin/orders${buildQueryString({ status: s.value || undefined, page: undefined })}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === s.value || (!status && !s.value)
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Excel Export */}
      <ExportOrders />

      {/* Orders table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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
                  Artikli
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Plaćanje
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Iznos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Datum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-stone-900 hover:text-blue-600"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-stone-900">
                        {order.user?.firstName ||
                          order.guestFirstName ||
                          "N/A"}{" "}
                        {order.user?.lastName || order.guestLastName || ""}
                      </p>
                      <p className="text-sm text-stone-500">
                        {order.user?.email || order.guestEmail || "N/A"}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-stone-600">
                    {order.items.length} artikala
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        order.paymentStatus === "PAID"
                          ? "text-green-600 bg-green-100"
                          : "text-yellow-600 bg-yellow-100"
                      }`}
                    >
                      {order.paymentMethod === "CARD" ? "Kartica" : "Pouzeće"} -{" "}
                      {order.paymentStatus === "PAID" ? "Plaćeno" : "Čeka"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {formatPriceWithCurrency(Number(order.total))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-stone-500">
                    {new Date(order.createdAt).toLocaleDateString("sr-RS", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white
                                 text-sm rounded-lg hover:bg-stone-700 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      Detalji
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between">
            <p className="text-sm text-stone-600">
              Stranica {page} od {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/orders${buildQueryString({ page: String(page - 1) })}`}
                  className="px-4 py-2 text-sm bg-stone-100 rounded-lg hover:bg-stone-200"
                >
                  Prethodna
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/orders${buildQueryString({ page: String(page + 1) })}`}
                  className="px-4 py-2 text-sm bg-stone-100 rounded-lg hover:bg-stone-200"
                >
                  Sledeća
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
