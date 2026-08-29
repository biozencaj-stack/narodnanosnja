import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'node:crypto';
import { authOptions } from '@/lib/auth';
import { buildHppFields, getConfig, renderAutoPostHtml } from '@/lib/nestpay';
import {
  createPaymentHandoffToken,
  getOrderAccessTokenFromCookie,
  orderAccessCookieName,
  ORDER_ACCESS_COOKIE,
  verifyPaymentHandoffToken,
  verifyCheckoutIdempotencyKey,
  verifyOrderAccessToken,
} from '@/lib/orders/access';
import { beginCardPayment, PaymentStateError } from '@/lib/orders/payment';
import { checkRateLimit } from '@/lib/rate-limit';
import { storeCapabilities } from '@/lib/config/capabilities';
import { prisma } from '@/lib/db';

const CHECKOUT_RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

const CLEARABLE_PAYMENT_ERRORS = new Set([
  'ORDER_NOT_FOUND',
  'NON_CARD_ORDER',
  'ORDER_NOT_PENDING',
  'PAYMENT_ALREADY_TERMINAL',
]);

function createStartPayload(order: {
  orderNumber: string;
  total: number;
  currency: string;
}) {
  if (order.currency !== 'RSD' || order.total <= 0) {
    throw new PaymentStateError(
      'Valuta ili iznos porudžbine nisu podržani',
      'UNSUPPORTED_ORDER_AMOUNT',
    );
  }

  const cfg = getConfig();
  const paymentUrl = new URL(cfg.hppUrl);
  const { fields } = buildHppFields({
    amount: order.total.toFixed(2),
    oid: order.orderNumber,
  });
  const payload = {
    provider: 'NESTPAY',
    actionUrl: paymentUrl.toString(),
    nonce: randomBytes(16).toString('base64url'),
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, String(value)]),
    ),
  } satisfies import('@/lib/orders/payment').StoredPaymentStartPayload;

  // Config i renderer se validiraju pre commit-a payment start transakcije.
  renderAutoPostHtml(payload.actionUrl, payload.fields, payload.nonce);
  return payload;
}

// Pokreće NestPay placanje - generiše HTML formu koja redirektuje na Banca Intesa
export async function POST(req: NextRequest) {
  let retryOrderId = '';
  const isJsonRequest = (req.headers.get('content-type') || '').includes(
    'application/json',
  );
  try {
    if (!storeCapabilities.cardPayments) {
      return NextResponse.json({ error: 'Kartično plaćanje nije omogućeno' }, { status: 503 });
    }
    let orderId: string;
    let accessToken = '';
    let handoffToken = '';

    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await req.json();
      orderId = String(body.orderId || '');
      accessToken = String(body.accessToken || '');
    } else {
      const fd = await req.formData();
      orderId = String(fd.get('orderId') || '');
      handoffToken = String(fd.get('handoffToken') || '');
    }

    if (!orderId || orderId.length > 128) {
      return NextResponse.json({ error: 'Nevažeća porudžbina' }, { status: 400 });
    }

    if (!isJsonRequest) {
      if (!verifyPaymentHandoffToken(orderId, handoffToken)) {
        return NextResponse.json(
          { error: 'Handoff za plaćanje je istekao ili nije validan' },
          { status: 403 },
        );
      }
      retryOrderId = orderId;
    } else {
      const cookieToken = getOrderAccessTokenFromCookie(
        orderId,
        req.cookies.get(orderAccessCookieName(orderId))?.value ||
          req.cookies.get(ORDER_ACCESS_COOKIE)?.value,
      );
      const hasOrderAccess =
        verifyOrderAccessToken(orderId, accessToken) || Boolean(cookieToken);
      let hasSessionOwnerAccess = false;
      let hasCheckoutRecovery = false;
      if (!hasOrderAccess) {
        const [session, recoveryOrder] = await Promise.all([
          getServerSession(authOptions),
          prisma.order.findUnique({
            where: { id: orderId },
            select: {
              userId: true,
              checkoutIdempotencyKey: true,
              paymentMethod: true,
              paymentStatus: true,
              createdAt: true,
            },
          }),
        ]);
        hasSessionOwnerAccess = Boolean(
          session?.user?.id && recoveryOrder?.userId === session.user.id,
        );
        const recoveryAge = recoveryOrder
          ? Date.now() - recoveryOrder.createdAt.getTime()
          : Number.POSITIVE_INFINITY;
        hasCheckoutRecovery = Boolean(
          recoveryOrder?.paymentMethod === 'CARD' &&
          ['PENDING', 'PROCESSING'].includes(recoveryOrder.paymentStatus) &&
          recoveryAge >= 0 &&
          recoveryAge <= CHECKOUT_RECOVERY_WINDOW_MS &&
          verifyCheckoutIdempotencyKey(
            recoveryOrder.checkoutIdempotencyKey,
            req.headers.get('idempotency-key'),
          ),
        );
      }
      if (
        !hasOrderAccess &&
        !hasSessionOwnerAccess &&
        !hasCheckoutRecovery
      ) {
        return NextResponse.json({ error: 'Nevažeći pristup porudžbini' }, { status: 403 });
      }
      retryOrderId = orderId;

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      if (!checkRateLimit(`payment-start:${orderId}:${ip}`, 8)) {
        return NextResponse.json(
          {
            error: 'Previše pokušaja. Sačekajte minut i nastavite istu porudžbinu.',
            retryable: true,
            clearPending: false,
            orderId,
          },
          { status: 429 },
        );
      }
    }

    const started = await beginCardPayment(orderId, createStartPayload);
    if (started.kind === 'REVIEW') {
      return NextResponse.json(
        {
          error: 'Plaćanje zahteva ručnu proveru',
          code: started.reason,
          review: true,
          clearPending: true,
          orderId,
        },
        { status: 409 },
      );
    }

    if (isJsonRequest) {
      return NextResponse.json(
        {
          success: true,
          orderId,
          startKind: started.kind,
          handoffToken: createPaymentHandoffToken(orderId),
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }

    const { payload } = started;
    const html = renderAutoPostHtml(
      payload.actionUrl,
      payload.fields,
      payload.nonce,
    );
    const paymentOrigin = new URL(payload.actionUrl).origin;

    console.log(`[NestPay] Payment ${started.kind.toLowerCase()}: order=${orderId}`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': [
          "default-src 'none'",
          `script-src 'nonce-${payload.nonce}'`,
          `form-action ${paymentOrigin}`,
          "base-uri 'none'",
          "frame-ancestors 'none'",
        ].join('; '),
      },
    });
  } catch (err) {
    console.error('[NestPay] Start error:', err);
    if (err instanceof PaymentStateError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          retryable: err.retryable,
          clearPending: CLEARABLE_PAYMENT_ERRORS.has(err.code),
          ...(err.retryable && retryOrderId ? { orderId: retryOrderId } : {}),
        },
        { status: err.status },
      );
    }
    return NextResponse.json(
      {
        error: 'Servis plaćanja trenutno nije dostupan. Nastavite istu porudžbinu.',
        retryable: true,
        clearPending: false,
        ...(retryOrderId ? { orderId: retryOrderId } : {}),
      },
      { status: 500 },
    );
  }
}
