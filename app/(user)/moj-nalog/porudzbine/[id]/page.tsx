import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, Package, Truck, CreditCard, MapPin } from "lucide-react";
import { formatPriceWithCurrency } from "@/lib/utils/format";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderDetailPageProps) {
  const { id } = await params;
  return {
    title: `Porudžbina #${id.slice(0, 8)}`,
  };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      transaction: true,
    },
  });

  // Check if order exists and belongs to user
  if (!order) {
    notFound();
  }

  if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
    notFound();
  }

  const statusLabels: Record<string, string> = {
    PENDING: "Na čekanju",
    CONFIRMED: "Potvrđena",
    SHIPPED: "Poslata",
    CANCELLED: "Otkazana",
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
    SHIPPED: "bg-green-100 text-green-800 border-green-200",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
  };

  const paymentStatusLabels: Record<string, string> = {
    PENDING: "Čeka uplatu",
    PAID: "Plaćeno",
    FAILED: "Neuspešno",
    REFUNDED: "Refundirano",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/moj-nalog/porudzbine"
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-stone-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
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

      {/* Status banner */}
      <div
        className={`rounded-xl p-4 border ${statusColors[order.status]} flex items-center gap-3`}
      >
        <Package className="h-6 w-6" />
        <div>
          <p className="font-semibold">{statusLabels[order.status]}</p>
          <p className="text-sm opacity-80">
            Plaćanje: {paymentStatusLabels[order.paymentStatus]}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order items */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-stone-100">
            <h2 className="font-semibold text-stone-900 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Artikli ({order.items.length})
            </h2>
          </div>
          <div className="divide-y divide-stone-100">
            {order.items.map((item) => (
              <div key={item.id} className="p-6 flex gap-4">
                <div className="w-20 h-20 bg-stone-100 rounded-lg flex items-center justify-center text-xs text-stone-500">
                  {item.picture ? (
                    <img
                      src={item.picture}
                      alt={item.productName}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    item.productCode.slice(0, 6)
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-stone-900">
                    {item.productName}
                  </h3>
                  <p className="text-sm text-stone-500">
                    Šifra: {item.productCode} | Veličina: {item.size}
                  </p>
                  <p className="text-sm text-stone-500">
                    Količina: {item.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-stone-900">
                    {formatPriceWithCurrency(Number(item.price) * item.quantity)}
                  </p>
                  <p className="text-sm text-stone-500">
                    {formatPriceWithCurrency(Number(item.price))} / kom
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="p-6 bg-stone-50 border-t border-stone-100">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Međuzbir</span>
                <span>{formatPriceWithCurrency(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Dostava</span>
                <span>{formatPriceWithCurrency(Number(order.shipping))}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-stone-200">
                <span>Ukupno</span>
                <span>{formatPriceWithCurrency(Number(order.total))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Shipping address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Adresa za dostavu
            </h3>
            <div className="text-stone-600">
              <p>{order.shippingStreet}</p>
              <p>
                {order.shippingPostal} {order.shippingCity}
              </p>
              <p>{order.shippingCountry}</p>
            </div>
          </div>

          {/* Payment info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plaćanje
            </h3>
            <div className="text-stone-600 space-y-2">
              <p>
                <span className="text-stone-500">Način:</span>{" "}
                {order.paymentMethod === "CARD" ? "Platna kartica" : "Pouzeće"}
              </p>
              <p>
                <span className="text-stone-500">Status:</span>{" "}
                {paymentStatusLabels[order.paymentStatus]}
              </p>
              {order.transaction && (
                <>
                  {order.transaction.transId && (
                    <p className="text-sm">
                      <span className="text-stone-500">ID transakcije:</span>{" "}
                      {order.transaction.transId}
                    </p>
                  )}
                  {order.transaction.authCode && (
                    <p className="text-sm">
                      <span className="text-stone-500">Auth kod:</span>{" "}
                      {order.transaction.authCode}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Delivery tracking */}
          {order.status === "SHIPPED" && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Praćenje pošiljke
              </h3>
              <p className="text-stone-600 text-sm">
                Pošiljka je na putu. Očekujte je u narednih 2-5 radnih dana.
              </p>
            </div>
          )}

          {/* Note */}
          {order.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-semibold text-amber-900 mb-2">Napomena</h3>
              <p className="text-amber-800 text-sm">{order.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
