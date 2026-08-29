import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPriceWithCurrency, clearProductSufix } from "@/lib/utils/format";
import { ArrowLeft, Package, MapPin, CreditCard, User } from "lucide-react";
import { OrderStatusForm } from "./OrderStatusForm";

// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Porudžbina #${id.slice(0, 8)} | Admin`,
  };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      transaction: true,
      user: true,
    },
  });

  if (!order) {
    notFound();
  }

  const statusLabels: Record<string, string> = {
    PENDING: "Na čekanju",
    CONFIRMED: "Potvrđena",
    SHIPPED: "Poslata",
    CANCELLED: "Otkazana",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/orders"
          className="p-2 hover:bg-stone-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900">
            Porudžbina #{order.orderNumber}
          </h1>
          <p className="text-stone-500">
            {new Date(order.createdAt).toLocaleDateString("sr-RS", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-stone-100">
              <h2 className="font-semibold text-stone-900 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Artikli ({order.items.length})
              </h2>
            </div>
            <div className="divide-y divide-stone-100">
              {order.items.map((item) => (
                <div key={item.id} className="p-6 flex gap-4">
                  <div className="w-20 h-20 bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {item.picture ? (
                      <img
                        src={`/api/image/${encodeURIComponent(item.picture)}`}
                        alt={item.productName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-stone-500">
                        {item.productCode.slice(0, 6)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-stone-900">
                      {clearProductSufix(item.productName)}
                    </h3>
                    <p className="text-sm text-stone-500">
                      Šifra: {item.productCode} | Veličina: {item.size} |
                      Količina: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-stone-900">
                      {formatPriceWithCurrency(Number(item.price) * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-stone-50 border-t border-stone-100">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Međuzbir</span>
                  <span>{formatPriceWithCurrency(Number(order.subtotal))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Dostava</span>
                  <span>{formatPriceWithCurrency(Number(order.shipping))}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-stone-200">
                  <span>Ukupno</span>
                  <span>{formatPriceWithCurrency(Number(order.total))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status update */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-stone-900 mb-4">Promeni status</h3>
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
              currentTrackingNumber={order.trackingNumber}
              statusLabels={statusLabels}
              paymentMethod={order.paymentMethod}
              paymentStatus={order.paymentStatus}
            />
          </div>

          {/* Customer info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
              <User className="h-5 w-5" />
              Kupac
            </h3>
            <div className="text-stone-600 space-y-1">
              <p className="font-medium">
                {order.user?.firstName || order.guestFirstName}{" "}
                {order.user?.lastName || order.guestLastName}
              </p>
              <p>{order.user?.email || order.guestEmail}</p>
              {order.guestPhone && <p>{order.guestPhone}</p>}
              {order.userId && (
                <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  Registrovan korisnik
                </span>
              )}
            </div>
          </div>

          {/* Shipping */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Dostava
            </h3>
            <div className="text-stone-600">
              <p>{order.shippingStreet}</p>
              <p>
                {order.shippingPostal} {order.shippingCity}
              </p>
              <p>{order.shippingCountry}</p>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plaćanje
            </h3>
            <div className="text-stone-600 space-y-2">
              <p>
                <span className="text-stone-500">Način:</span>{" "}
                {order.paymentMethod === "CARD" ? "Kartica" : "Pouzeće"}
              </p>
              <p>
                <span className="text-stone-500">Status:</span>{" "}
                <span
                  className={
                    order.paymentStatus === "PAID"
                      ? "text-green-600"
                      : order.paymentStatus === "FAILED"
                        ? "text-red-600 font-semibold"
                        : order.paymentStatus === "REFUNDED"
                          ? "text-stone-500"
                          : "text-yellow-600"
                  }
                >
                  {order.paymentStatus === "PAID"
                    ? "Plaćeno"
                    : order.paymentStatus === "FAILED"
                      ? "Neuspešno"
                      : order.paymentStatus === "REFUNDED"
                        ? "Refundirano"
                        : "Čeka"}
                </span>
              </p>
              {order.transaction && (
                <>
                  {order.transaction.transId && (
                    <p className="text-sm">
                      <span className="text-stone-500">Trans ID:</span>{" "}
                      {order.transaction.transId}
                    </p>
                  )}
                  {order.transaction.authCode && (
                    <p className="text-sm">
                      <span className="text-stone-500">Auth:</span>{" "}
                      {order.transaction.authCode}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Note */}
          {order.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-semibold text-amber-900 mb-2">Napomena kupca</h3>
              <p className="text-amber-800 text-sm">{order.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
