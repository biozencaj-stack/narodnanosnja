import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  HelpCircle,
  Phone,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { Button } from '@/components/ui/Button';
import { ClearPendingCardPaymentOnMount } from '@/components/checkout/ClearPendingCardPaymentOnMount';
import { authOptions } from '@/lib/auth';
import { storeEmail, storePhone } from '@/lib/config/store';
import { prisma } from '@/lib/db';
import {
  getErrorCategory,
  getErrorRecommendation,
  getUserFriendlyError,
} from '@/lib/nestpay/errors';
import { canAccessOrder } from '@/lib/orders/authorize';
import {
  getOrderAccessTokenFromCookie,
  orderAccessCookieName,
  ORDER_ACCESS_COOKIE,
} from '@/lib/orders/access';

export const metadata = {
  title: 'Status plaćanja',
  robots: { index: false, follow: false },
};

interface PaymentFailedPageProps {
  searchParams: Promise<{
    oid?: string;
    orderNumber?: string;
    error?: string;
    token?: string;
  }>;
}

function orderStatusHref(
  pathname: '/order/success' | '/payment/success',
  orderId: string,
  legacyToken?: string,
) {
  const query = new URLSearchParams({ oid: orderId });
  // Novi tok koristi HttpOnly cookie. Token zadržavamo samo zbog kompatibilnosti
  // sa ranije izdatim linkovima koji još nemaju pristupni cookie.
  if (legacyToken) query.set('token', legacyToken);
  return `${pathname}?${query.toString()}`;
}

function neutralStatusCopy(paymentStatus?: string) {
  switch (paymentStatus) {
    case 'REVIEW':
      return {
        label: 'Na proveri',
        message:
          'Plaćanje je prosleđeno na dodatnu proveru. Moguće je da su sredstva rezervisana ili zadužena dok banka i prodavnica ne potvrde konačan ishod.',
      };
    case 'PROCESSING':
      return {
        label: 'Obrada u toku',
        message:
          'Banka još obrađuje plaćanje i konačan ishod nije potvrđen. Moguće je da su sredstva privremeno rezervisana.',
      };
    case 'PENDING':
      return {
        label: 'Čeka potvrdu',
        message:
          'Još nije stigla konačna potvrda o plaćanju. Moguće je da su sredstva privremeno rezervisana.',
      };
    default:
      return {
        label: 'Nije potvrđen',
        message:
          'Trenutno ne možemo pouzdano da potvrdimo ishod plaćanja. Pre novog pokušaja proverite stanje kod banke i kontaktirajte našu podršku.',
      };
  }
}

async function PaymentFailedContent({ searchParams }: PaymentFailedPageProps) {
  const params = await searchParams;

  let order = params.oid
    ? await prisma.order.findUnique({
        where: { id: params.oid },
        include: { transaction: true },
      })
    : params.orderNumber
      ? await prisma.order.findUnique({
          where: { orderNumber: params.orderNumber },
          include: { transaction: true },
        })
      : null;

  if (order) {
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
      // Ne otkrivamo ni postojanje ni status porudžbine bez autorizacije.
      order = null;
    }
  }

  // Ova ruta nije statusna stranica za pouzeće. Provera pre svih poruka
  // sprečava da CASH porudžbina ikada bude predstavljena kao neuspešno plaćanje.
  if (order?.paymentMethod === 'CASH') {
    redirect(orderStatusHref('/order/success', order.id, params.token));
  }

  // Status iz baze je jedini autoritativni dokaz uspeha.
  if (order?.paymentMethod === 'CARD' && order.paymentStatus === 'PAID') {
    redirect(orderStatusHref('/payment/success', order.id, params.token));
  }

  const transaction = order?.transaction ?? null;
  const isFailed =
    order?.paymentMethod === 'CARD' && order.paymentStatus === 'FAILED';
  const isReview =
    order?.paymentMethod === 'CARD' && order.paymentStatus === 'REVIEW';
  const clearPendingAttempt = isFailed || isReview;

  let statusMessage =
    'Plaćanje je odbijeno. Porudžbina nije označena kao naplaćena.';
  let statusRecommendation =
    'Proverite podatke na kartici ili pokušajte sa drugom karticom.';

  // Raw response objašnjava uzrok samo kada je serverski status već terminalno
  // FAILED. Ne sme da pretvori REVIEW/PENDING/PROCESSING u lažni uspeh ili pad.
  if (isFailed && transaction?.rawResponse) {
    const rawResponse = transaction.rawResponse as Record<string, string>;
    const procReturnCode = rawResponse.ProcReturnCode || '';
    const response = (rawResponse.Response || '').toLowerCase();

    if (procReturnCode !== '00' && response !== 'approved') {
      statusMessage = getUserFriendlyError(rawResponse);
      statusRecommendation = getErrorRecommendation(
        getErrorCategory(procReturnCode),
      );
    }
  } else if (isFailed && params.error) {
    switch (params.error) {
      case 'payment_not_approved':
        statusMessage = 'Plaćanje nije odobreno od strane banke.';
        break;
      case 'order_not_found':
      case 'missing_order_id':
        statusMessage = 'Nije bilo moguće povezati odgovor banke sa porudžbinom.';
        break;
      default:
        statusMessage =
          'Plaćanje nije završeno. Proverite podatke na kartici pre ponovnog pokušaja.';
    }
  }

  const neutralCopy = neutralStatusCopy(order?.paymentStatus);

  return (
    <div className="container mx-auto px-4 py-8 lg:px-8">
      {clearPendingAttempt && order && (
        <ClearPendingCardPaymentOnMount
          orderId={order.id}
          clearCheckoutAttempt={clearPendingAttempt}
        />
      )}

      <div className="mx-auto max-w-2xl text-center">
        <div
          className={`mb-6 rounded-2xl border p-8 ${
            isFailed
              ? 'border-error/20 bg-error-light'
              : 'border-warning/30 bg-warning-light'
          }`}
        >
          <div className="mb-4 flex justify-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full ${
                isFailed ? 'bg-error/10' : 'bg-warning/10'
              }`}
            >
              {isFailed ? (
                <XCircle className="h-10 w-10 text-error" aria-hidden="true" />
              ) : (
                <AlertTriangle
                  className="h-10 w-10 text-warning"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          <h1 className="mb-4 font-display text-3xl text-text">
            {isFailed ? 'Plaćanje nije uspelo' : 'Status plaćanja se proverava'}
          </h1>

          <p className="mb-4 text-lg text-text-muted">
            {isFailed ? statusMessage : neutralCopy.message}
          </p>

          <p className="mb-6 text-base text-text-muted">
            {isFailed
              ? statusRecommendation
              : 'Nemojte pokretati novo plaćanje dok ne dobijete konačnu potvrdu, kako biste izbegli moguće dvostruko zaduženje.'}
          </p>

          {order && (
            <div className="mb-4 rounded-xl border border-border bg-white p-4 text-left">
              <h2 className="mb-2 font-semibold text-text">Detalji:</h2>
              <div className="space-y-1 text-sm text-text-muted">
                <p>
                  <strong>Broj porudžbine:</strong> {order.orderNumber}
                </p>
                <p>
                  <strong>Status plaćanja:</strong>{' '}
                  <span className={isFailed ? 'text-error' : 'text-warning'}>
                    {isFailed ? 'Neuspešno' : neutralCopy.label}
                  </span>
                </p>
                {transaction?.transId && (
                  <p>
                    <strong>ID transakcije:</strong> {transaction.transId}
                  </p>
                )}
              </div>
            </div>
          )}

          {!order && (params.oid || params.orderNumber || params.error) && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-white p-4 text-left">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-warning"
                aria-hidden="true"
              />
              <p className="text-sm text-text">
                Ne možemo da prikažemo potvrđen status ove porudžbine. Proverite
                stanje kod banke i javite se podršci pre novog pokušaja plaćanja.
              </p>
            </div>
          )}

          {isFailed ? (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary-light p-4 text-left">
              <div className="mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="font-medium text-text">Šta možete da uradite:</h2>
              </div>
              <ul className="space-y-2 text-sm text-text-muted">
                <li className="flex items-start gap-2">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Proverite podatke na kartici ili koristite drugu karticu</span>
                </li>
                <li className="flex items-start gap-2">
                  <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Izaberite plaćanje pouzećem</span>
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Kontaktirajte banku ako problem potraje</span>
                </li>
              </ul>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary-light p-4 text-left">
              <div className="mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="font-medium text-text">Šta sada:</h2>
              </div>
              <ul className="space-y-2 text-sm text-text-muted">
                <li>Ne pokušavajte ponovo da platite istu porudžbinu.</li>
                <li>Proverite rezervacije i zaduženja u svojoj banci.</li>
                <li>
                  Sačuvajte broj porudžbine i kontaktirajte podršku radi provere.
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          {isFailed ? (
            <Button asChild>
              <Link href="/checkout">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Pokušaj ponovo
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <a href={`mailto:${storeEmail}`}>Kontaktiraj podršku</a>
            </Button>
          )}
          <Button variant="secondary" asChild>
            <Link href="/">Povratak na početnu</Link>
          </Button>
        </div>

        <div className="mt-8 text-sm text-text-muted">
          <p>
            Podršku možete kontaktirati na{' '}
            <a href={`mailto:${storeEmail}`} className="text-primary hover:underline">
              {storeEmail}
            </a>
            {storePhone && (
              <>
                {' '}ili pozvati{' '}
                <a
                  href={`tel:${storePhone.replace(/\s/g, '')}`}
                  className="text-primary hover:underline"
                >
                  {storePhone}
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage(props: PaymentFailedPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="animate-pulse">Učitavanje...</div>
        </div>
      }
    >
      <PaymentFailedContent {...props} />
    </Suspense>
  );
}
