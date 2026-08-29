import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatPriceWithCurrency } from '@/lib/utils/format';
import { prisma } from '@/lib/db';
import { storeName } from '@/lib/config/store';
import { ClearCartOnMount } from '@/components/checkout/ClearCartOnMount';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessOrder } from '@/lib/orders/authorize';
import { cookies } from 'next/headers';
import {
  getOrderAccessTokenFromCookie,
  orderAccessCookieName,
  ORDER_ACCESS_COOKIE,
} from '@/lib/orders/access';

export const metadata = {
  title: `Porudžbina je primljena | ${storeName}`,
  robots: { index: false, follow: false },
};

interface OrderSuccessPageProps {
  searchParams: Promise<{
    orderNumber?: string;
    oid?: string;
    token?: string;
  }>;
}

function orderStatusHref(
  pathname: '/payment/success' | '/payment/failed',
  orderId: string,
  legacyToken?: string,
) {
  const query = new URLSearchParams({ oid: orderId });
  // HttpOnly cookie je primarni mehanizam. Token prosleđujemo samo za stare
  // linkove koji su autorizovani putem query parametra i još nemaju cookie.
  if (legacyToken) query.set('token', legacyToken);
  return `${pathname}?${query.toString()}`;
}

async function OrderSuccessContent({ searchParams }: OrderSuccessPageProps) {
  const params = await searchParams;
  const orderNumber = params.orderNumber;
  const orderId = params.oid;

  let order = null;

  if (orderId) {
    order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        transaction: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  } else if (orderNumber) {
    order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        transaction: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  if (!order) {
    redirect('/');
  }

  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const cookieToken = getOrderAccessTokenFromCookie(
    order.id,
    cookieStore.get(orderAccessCookieName(order.id))?.value ||
      cookieStore.get(ORDER_ACCESS_COOKIE)?.value,
  );
  if (
    !canAccessOrder(order, session, params.token) &&
    !canAccessOrder(order, session, cookieToken)
  ) {
    redirect('/');
  }

  // Ova stranica potvrđuje samo porudžbine sa plaćanjem pouzećem. Kartične
  // porudžbine se usmeravaju na statusnu stranicu pre nego što se korpa očisti
  // ili prikaže bilo kakva poruka o uspehu.
  if (order.paymentMethod === 'CARD') {
    redirect(
      orderStatusHref(
        order.paymentStatus === 'PAID'
          ? '/payment/success'
          : '/payment/failed',
        order.id,
        params.token,
      ),
    );
  }

  const customerName = order.user?.firstName || order.guestFirstName || 'Kupac';
  const customerLastName = order.user?.lastName || order.guestLastName || '';
  const customerEmail = order.user?.email || order.guestEmail || '';
  const customerPhone = order.guestPhone || '';

  const paymentMethodLabel = 'Plaćanje pouzećem';

  return (
    <div className="container mx-auto py-8 px-4 lg:px-8">
      <ClearCartOnMount orderId={order.id} />

      <div className="max-w-2xl mx-auto">
        <div className="bg-success-light border border-success/20 rounded-2xl p-8 mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
          </div>

          <h1 className="font-display text-3xl text-text mb-2">
            Hvala na porudžbini!
          </h1>
          <p className="text-lg text-text-muted">
            Porudžbina je uspešno primljena i poslali smo vam potvrdu.
          </p>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 mb-4">
          <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Detalji porudžbine
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-text-muted">Broj porudžbine</p>
              <p className="font-semibold text-text">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-text-muted">Status</p>
              <p className="font-semibold text-success">
                {order.status === 'CONFIRMED' ? 'Potvrđena' :
                 order.status === 'PENDING' ? 'Na čekanju' :
                 order.status === 'SHIPPED' ? 'Poslata' :
                 order.status === 'CANCELLED' ? 'Otkazana' : order.status}
              </p>
            </div>
            <div>
              <p className="text-text-muted">Način plaćanja</p>
              <p className="font-semibold text-text flex items-center gap-1.5">
                <Truck className="h-4 w-4" />
                {paymentMethodLabel}
              </p>
            </div>
            <div>
              <p className="text-text-muted">Datum</p>
              <p className="font-semibold text-text">
                {new Date(order.createdAt).toLocaleDateString('sr-RS', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            {order.transaction?.transId && (
              <div>
                <p className="text-text-muted">ID transakcije</p>
                <p className="font-semibold text-text">{order.transaction.transId}</p>
              </div>
            )}
            {order.transaction?.authCode && (
              <div>
                <p className="text-text-muted">Autorizacioni kod</p>
                <p className="font-semibold text-text">{order.transaction.authCode}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 mb-4">
          <h3 className="font-semibold text-text mb-4">
            Podaci o kupcu
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-text-muted">Ime i prezime</p>
              <p className="font-medium text-text">{customerName} {customerLastName}</p>
            </div>
            <div>
              <p className="text-text-muted">Email</p>
              <p className="font-medium text-text">{customerEmail}</p>
            </div>
            {customerPhone && (
              <div>
                <p className="text-text-muted">Telefon</p>
                <p className="font-medium text-text">{customerPhone}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 mb-4">
          <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Adresa za dostavu
          </h3>
          <div className="text-sm text-text">
            <p className="font-medium">{customerName} {customerLastName}</p>
            <p>{order.shippingStreet}</p>
            <p>{order.shippingPostal} {order.shippingCity}</p>
            <p>{order.shippingCountry}</p>
          </div>
        </div>

        {order.items.length > 0 && (
          <div className="bg-white border border-border rounded-xl p-6 mb-4">
            <h3 className="font-semibold text-text mb-4">
              Artikli ({order.items.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border">
                    <th className="py-2 pr-4">Artikal</th>
                    <th className="py-2 pr-4 text-center">Opcija</th>
                    <th className="py-2 pr-4 text-center">Kol.</th>
                    <th className="py-2 text-right">Cena</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-b-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-text truncate max-w-[200px]">
                          {item.productName}
                        </div>
                        <div className="text-xs text-text-muted">
                          {item.productCode}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="font-mono">{item.size}</span>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="font-mono">{item.quantity}</span>
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatPriceWithCurrency(Number(item.price) * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-text-muted">
                <span>Međuzbir</span>
                <span>{formatPriceWithCurrency(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm text-text-muted">
                <span>Dostava</span>
                <span>{formatPriceWithCurrency(Number(order.shipping))}</span>
              </div>
              <div className="flex justify-between font-semibold text-text text-lg pt-2 border-t border-border">
                <span>Ukupno</span>
                <span>{formatPriceWithCurrency(Number(order.total))}</span>
              </div>
            </div>
          </div>
        )}

        {order.note && (
          <div className="bg-background-alt border border-border rounded-xl p-6 mb-4">
            <h3 className="font-semibold text-text mb-2">Napomena</h3>
            <p className="text-sm text-text-muted">{order.note}</p>
          </div>
        )}

        <div className="bg-primary-light border border-primary/20 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-text mb-3">Šta dalje?</h3>
          <ul className="text-sm text-text-muted space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>Potvrda je poslata na <strong>{customerEmail}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>Kurir će vas kontaktirati pre dostave</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>Pripremite <strong>{formatPriceWithCurrency(Number(order.total))}</strong> za kurira</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>Očekivana isporuka je u roku od 2–4 radna dana</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild>
            <Link href="/">
              Nazad na početnu
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/catalog">
              Nastavi kupovinu
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage(props: OrderSuccessPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-8 px-4 text-center">
          <div className="animate-pulse">Učitavanje...</div>
        </div>
      }
    >
      <OrderSuccessContent {...props} />
    </Suspense>
  );
}
