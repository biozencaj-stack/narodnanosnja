"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/store";
import { cn } from "@/lib/utils";
import {
  validatePhoneFormat,
  validateSerbianPostal,
  validateEmailAddress,
} from "@/lib/utils/validation";
import { DEFAULT_COUNTRY } from "@/lib/config/checkout";
import { useReCaptcha } from "@/hooks/useReCaptcha";
import { useCheckoutPricing } from "./CheckoutPricingProvider";
import type { OrderForm } from "@/types/order";
import { storeCapabilities } from "@/lib/config/capabilities";
import {
  clearPendingCardPayment,
  readPendingCardPayment,
  savePendingCardPayment,
  type PendingCardPayment,
} from "@/lib/payments/pending-card";
import {
  PaymentStartClientError,
  submitNestPayHandoff,
} from "@/lib/payments/browser-handoff";
import { markCartForOrderClear } from "@/lib/checkout/cart-clear";
import {
  bindCheckoutAttemptToOrder,
  clearCheckoutAttemptForOrder,
  getOrCreateCheckoutIdempotencyKey,
} from "@/lib/checkout/idempotency";

interface FormErrors extends Partial<Record<keyof OrderForm, string>> {
  termsAccepted?: string;
  honeypot?: string;
  submission?: string;
}

export function CheckoutForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const { items } = useCartStore();
  const { executeRecaptcha } = useReCaptcha();
  const {
    couponCode,
    isLoadingCoupon,
    isLoadingQuote,
    quoteError,
  } = useCheckoutPricing();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">(
    storeCapabilities.cardPayments ? "card" : "cash",
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showDifferentAddress, setShowDifferentAddress] = useState(false);

  const [honeypot, setHoneypot] = useState("");

  // Prevent double submission
  const submittedRef = useRef(false);
  const pendingCardPaymentRef = useRef<PendingCardPayment | null>(null);

  const [formData, setFormData] = useState<Partial<OrderForm>>({
    country: DEFAULT_COUNTRY || undefined,
  });

  const showCardRecovery = (orderId: string) => {
    const pending = { orderId };
    pendingCardPaymentRef.current = pending;
    savePendingCardPayment(pending);
    window.location.assign(
      `/checkout?recover=${encodeURIComponent(orderId)}`,
    );
  };

  const continueCardPayment = async (
    pending: PendingCardPayment,
    idempotencyKey?: string,
  ) => {
    try {
      await submitNestPayHandoff(pending.orderId, idempotencyKey);
      return true;
    } catch (error) {
      if (error instanceof PaymentStartClientError) {
        if (error.clearPending) {
          pendingCardPaymentRef.current = null;
          clearPendingCardPayment();
          if (!error.review) {
            clearCheckoutAttemptForOrder(pending.orderId);
          }
        }
        if (error.review) {
          router.push(
            `/payment/failed?oid=${encodeURIComponent(pending.orderId)}&error=payment_review`,
          );
          return false;
        }
        if (!error.clearPending) {
          showCardRecovery(pending.orderId);
          return false;
        }
      }

      if (!(error instanceof PaymentStartClientError)) {
        showCardRecovery(pending.orderId);
        return false;
      }
      throw error;
    }
  };

  // Auto-fill form for logged-in users
  useEffect(() => {
    if (session?.user) {
      fetch("/api/user/checkout-data")
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setFormData((prev) => ({
              ...prev,
              email: data.user.email || prev.email,
              firstName: data.user.firstName || prev.firstName,
              lastName: data.user.lastName || prev.lastName,
              tel: data.user.phone || prev.tel,
            }));
          }
          if (data.defaultAddress) {
            setFormData((prev) => ({
              ...prev,
              address: data.defaultAddress.street || prev.address,
              addressOptional:
                data.defaultAddress.apartment || prev.addressOptional,
              city: data.defaultAddress.city || prev.city,
              postalCode: data.defaultAddress.postalCode || prev.postalCode,
              country: data.defaultAddress.country || prev.country || DEFAULT_COUNTRY,
            }));
          }
        })
        .catch((err) => {
          console.error("Failed to fetch user checkout data:", err);
        });
    }
  }, [session?.user]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error when user types
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = "Email je obavezan";
    } else if (!validateEmailAddress(formData.email)) {
      newErrors.email = "Email adresa nije validna!";
    }

    // Required fields
    if (!formData.firstName) newErrors.firstName = "Ime je obavezno";
    if (!formData.lastName) newErrors.lastName = "Prezime je obavezno";
    if (!formData.address) newErrors.address = "Adresa je obavezna";
    if (!formData.city) newErrors.city = "Grad je obavezan";

    // Phone validation
    if (!formData.tel) {
      newErrors.tel = "Telefon je obavezan";
    } else if (!validatePhoneFormat(formData.tel)) {
      newErrors.tel = "Broj telefona nije validan!";
    }

    // Postal code validation
    if (!formData.postalCode) {
      newErrors.postalCode = "Poštanski broj je obavezan";
    } else if (!validateSerbianPostal(formData.postalCode)) {
      newErrors.postalCode = "Poštanski broj nije validan!";
    }

    // Different address validation
    if (showDifferentAddress) {
      if (!formData.addressAdd) newErrors.addressAdd = "Adresa je obavezna";
      if (!formData.cityAdd) newErrors.cityAdd = "Grad je obavezan";
      if (!formData.postalCodeAdd) {
        newErrors.postalCodeAdd = "Poštanski broj je obavezan";
      } else if (!validateSerbianPostal(formData.postalCodeAdd)) {
        newErrors.postalCodeAdd = "Poštanski broj nije validan!";
      }
    }

    // Terms acceptance
    if (!termsAccepted) {
      newErrors.termsAccepted = "Neophodno je prihvatiti uslove korišćenja";
    }

    // Honeypot check (bot detection)
    if (honeypot) {
      newErrors.honeypot = "Bot je detektovan.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle card payment with NestPay
  const handleCardPayment = async (recaptchaToken: string | null) => {
    try {
      let pending: PendingCardPayment | null =
        pendingCardPaymentRef.current || readPendingCardPayment();
      if (pending) {
        showCardRecovery(pending.orderId);
        return;
      }
      let paymentAttemptKey: string | undefined;
      if (!pending) {
        const idempotencyKey = getOrCreateCheckoutIdempotencyKey();
        paymentAttemptKey = idempotencyKey;
        const itemsForOrder = items.map((item) => ({
          id: item.id,
          size: item.size,
          quantity: item.quantity,
        }));

        const orderResponse = await fetch("/api/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            form: {
              ...formData,
              useDifferentAddress: showDifferentAddress,
            },
            items: itemsForOrder,
            paymentMethod: "card",
            couponCode: couponCode || undefined,
            recaptchaToken: recaptchaToken || undefined,
            honeypot,
          }),
        });

        if (!orderResponse.ok) {
          const errorData = await orderResponse.json();
          throw new Error(errorData.error || "Kreiranje porudžbine nije uspelo");
        }

        const data = await orderResponse.json();
        const orderId = String(data.orderId || "");
        if (!orderId) {
          throw new Error("Server nije vratio podatke za nastavak plaćanja");
        }
        const orderItems = Array.isArray(data.cartItems)
          ? (data.cartItems as Array<{ id: string; size?: string; quantity: number }>)
          : itemsForOrder;
        bindCheckoutAttemptToOrder(idempotencyKey, orderId);
        markCartForOrderClear(orderId, orderItems);
        if (data.paymentStatus === "PAID") {
          router.push(`/payment/success?oid=${encodeURIComponent(orderId)}`);
          return;
        }
        if (["REVIEW", "REFUNDED"].includes(data.paymentStatus)) {
          router.push(`/payment/failed?oid=${encodeURIComponent(orderId)}`);
          return;
        }
        if (data.paymentStatus === "FAILED" || data.status === "CANCELLED") {
          clearCheckoutAttemptForOrder(orderId);
          throw new Error(
            "Prethodni pokušaj je završen. Ponovo pošaljite formu za novu porudžbinu.",
          );
        }
        if (data.replayed === true && data.paymentMethod === "CARD") {
          showCardRecovery(orderId);
          return;
        }
        if (data.paymentMethod === "CASH") {
          router.push(`/order/success?oid=${encodeURIComponent(orderId)}`);
          return;
        }
        pending = {
          orderId,
        };
        pendingCardPaymentRef.current = pending;
        savePendingCardPayment({ orderId: pending.orderId });
      }

      await continueCardPayment(pending, paymentAttemptKey);
    } catch (error) {
      console.error("Card payment initiation failed:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission
    if (submittedRef.current) return;

    if (!storeCapabilities.cardPayments && !storeCapabilities.cashOnDelivery) {
      setErrors((prev) => ({
        ...prev,
        submission: "Trenutno nema dostupnog načina plaćanja. Kontaktirajte podršku.",
      }));
      return;
    }

    const pendingCardPayment =
      pendingCardPaymentRef.current || readPendingCardPayment();
    if (pendingCardPayment) {
      if (storeCapabilities.cardPayments) {
        showCardRecovery(pendingCardPayment.orderId);
      } else {
        setErrors((prev) => ({
          ...prev,
          submission:
            "Postoji rezervisana kartična porudžbina. Kontaktirajte podršku.",
        }));
      }
      return;
    }

    if (isLoadingCoupon || isLoadingQuote || quoteError) {
      setErrors((prev) => ({
        ...prev,
        submission: quoteError || "Sačekajte da proverimo korpu i kupon.",
      }));
      return;
    }

    if (!validateForm()) return;

    setErrors((prev) => ({ ...prev, submission: undefined }));
    setIsSubmitting(true);

    // Token se proverava zajedno sa porudžbinom na serveru. Odvojena klijentska
    // provera bi mogla da se zaobiđe direktnim pozivom order API-ja.
    const recaptchaToken = await executeRecaptcha("checkout");

    submittedRef.current = true;

    try {
      // Handle card payment differently
      if (paymentMethod === "card") {
        await handleCardPayment(recaptchaToken);
        // Don't reset isSubmitting since page will redirect
        return;
      }

      // Cash payment - create order directly
      const itemsForOrder = items.map((item) => ({
        id: item.id,
        size: item.size,
        quantity: item.quantity,
      }));
      const idempotencyKey = getOrCreateCheckoutIdempotencyKey();

      const response = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          form: {
            ...formData,
            useDifferentAddress: showDifferentAddress,
          },
          items: itemsForOrder,
          paymentMethod: "cash",
          couponCode: couponCode || undefined,
          recaptchaToken: recaptchaToken || undefined,
          honeypot,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const orderId = String(data.orderId || "");
        if (!orderId) throw new Error("Server nije vratio broj porudžbine");
        const orderItems = Array.isArray(data.cartItems)
          ? (data.cartItems as Array<{ id: string; size?: string; quantity: number }>)
          : itemsForOrder;
        bindCheckoutAttemptToOrder(idempotencyKey, orderId);
        markCartForOrderClear(orderId, orderItems);
        if (data.paymentStatus === "PAID") {
          router.push(`/payment/success?oid=${encodeURIComponent(orderId)}`);
          return;
        }
        if (["REVIEW", "REFUNDED"].includes(data.paymentStatus)) {
          router.push(`/payment/failed?oid=${encodeURIComponent(orderId)}`);
          return;
        }
        if (data.paymentStatus === "FAILED" || data.status === "CANCELLED") {
          clearCheckoutAttemptForOrder(orderId);
          throw new Error(
            "Prethodni pokušaj je završen. Ponovo pošaljite formu za novu porudžbinu.",
          );
        }
        if (
          data.replayed === true &&
          data.paymentMethod === "CARD"
        ) {
          showCardRecovery(orderId);
          return;
        }
        if (data.paymentMethod === "CARD") {
          const pending = { orderId };
          pendingCardPaymentRef.current = pending;
          savePendingCardPayment(pending);
          await continueCardPayment(pending, idempotencyKey);
          return;
        }
        router.push(`/order/success?oid=${encodeURIComponent(orderId)}`);
        // clearCart se poziva na success stranici da bi se izbegao race condition
      } else {
        const data = await response.json();
        setErrors((prev) => ({
          ...prev,
          submission: data.error || "Došlo je do greške. Pokušajte ponovo.",
        }));
        submittedRef.current = false;
      }
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submission:
          error instanceof Error
            ? error.message
            : "Došlo je do greške. Pokušajte ponovo.",
      }));
      submittedRef.current = false;
    } finally {
      // Kod uspešnog kartičnog toka dokument se odmah zamenjuje bankarskom
      // formom; kod greške checkout mora ponovo postati interaktivan.
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Contact info */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-4">
          Kontakt informacije
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Email *"
            type="email"
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            error={errors.email}
            placeholder="vas@email.com"
          />
          <Input
            label="Telefon *"
            type="tel"
            name="tel"
            value={formData.tel || ""}
            onChange={handleChange}
            error={errors.tel}
            placeholder="0601234567"
          />
        </div>
      </div>

      {/* Personal info */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-4">Lični podaci</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Ime *"
            name="firstName"
            value={formData.firstName || ""}
            onChange={handleChange}
            error={errors.firstName}
          />
          <Input
            label="Prezime *"
            name="lastName"
            value={formData.lastName || ""}
            onChange={handleChange}
            error={errors.lastName}
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-4">
          Adresa za naplatu
        </h2>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Ulica i kućni broj *"
              name="address"
              value={formData.address || ""}
              onChange={handleChange}
              error={errors.address}
              placeholder="Ulica i broj"
            />
            <Input
              label="Apartman, stan (opciono)"
              name="addressOptional"
              value={formData.addressOptional || ""}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              label="Grad *"
              name="city"
              value={formData.city || ""}
              onChange={handleChange}
              error={errors.city}
            />
            <Input
              label="Poštanski broj *"
              name="postalCode"
              value={formData.postalCode || ""}
              onChange={handleChange}
              error={errors.postalCode}
              placeholder="11000"
            />
            <Input
              label="Country"
              name="country"
              value={formData.country || DEFAULT_COUNTRY || ""}
              onChange={handleChange}
              placeholder={DEFAULT_COUNTRY ? undefined : "Enter country"}
              disabled={!!DEFAULT_COUNTRY}
            />
          </div>
        </div>
      </div>

      {/* Different shipping address checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="diffAddress"
          checked={showDifferentAddress}
          onChange={(e) => setShowDifferentAddress(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <label htmlFor="diffAddress" className="text-sm text-text">
          Isporuka na drugu adresu?
        </label>
      </div>

      {/* Alternate shipping address */}
      {showDifferentAddress && (
        <div className="p-5 bg-background-alt rounded-lg">
          <h3 className="text-md font-semibold text-text mb-5">
            Adresa za isporuku
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Ulica i kućni broj *"
              name="addressAdd"
              value={formData.addressAdd || ""}
              onChange={handleChange}
              error={errors.addressAdd}
            />
            <Input
              label="Grad *"
              name="cityAdd"
              value={formData.cityAdd || ""}
              onChange={handleChange}
              error={errors.cityAdd}
            />
            <Input
              label="Poštanski broj *"
              name="postalCodeAdd"
              value={formData.postalCodeAdd || ""}
              onChange={handleChange}
              error={errors.postalCodeAdd}
              placeholder="11000"
            />
            <Input
              label="Država"
              name="countryAdd"
              value={formData.countryAdd || DEFAULT_COUNTRY || ""}
              onChange={handleChange}
              placeholder={DEFAULT_COUNTRY ? undefined : "Unesite državu"}
              disabled={!!DEFAULT_COUNTRY}
            />
          </div>
        </div>
      )}

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">
          Napomene o narudžbini (opciono)
        </label>
        <textarea
          name="note"
          value={formData.note || ""}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-3 rounded-md border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors resize-none"
          placeholder="Posebne instrukcije za dostavu..."
        />
      </div>

      {/* Payment method */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-4">Način plaćanja</h2>
        <div className="space-y-3">
          {storeCapabilities.cardPayments && (
            <label
              className={cn(
                "flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                paymentMethod === "card"
                  ? "border-primary bg-primary-light"
                  : "border-border hover:border-primary",
              )}
            >
              <input
                type="radio"
                name="paymentMethodRadio"
                value="card"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
                className="accent-primary mt-1"
              />
              <div>
                <p className="font-medium text-text">Plaćanje platnim karticama</p>
                <p className="text-sm text-text-muted">
                  Visa, Mastercard, Maestro, DinaCard
                </p>
              </div>
            </label>
          )}

          {storeCapabilities.cashOnDelivery && <label
            className={cn(
              "flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
              paymentMethod === "cash"
                ? "border-primary bg-primary-light"
                : "border-border hover:border-primary",
            )}
          >
            <input
              type="radio"
              name="paymentMethodRadio"
              value="cash"
              checked={paymentMethod === "cash"}
              onChange={() => setPaymentMethod("cash")}
              className="accent-primary mt-1"
            />
            <div>
              <p className="font-medium text-text">Plaćanje pouzećem</p>
              <p className="text-sm text-text-muted">
                Prilikom isporuke, robu je moguće platiti kuriru isključivo
                gotovinom
              </p>
            </div>
          </label>}

          {!storeCapabilities.cardPayments && !storeCapabilities.cashOnDelivery && (
            <div className="p-4 rounded-lg border border-warning/30 bg-warning-light" role="status">
              <p className="text-sm text-text">
                Trenutno nema dostupnog načina plaćanja. Kontaktirajte podršku pre slanja porudžbine.
              </p>
            </div>
          )}
        </div>

        {/* Payment Security Info for card */}
        {storeCapabilities.cardPayments && paymentMethod === "card" && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-gray-700 space-y-2">
            <p>
              <strong>Sigurnost podataka:</strong> Poverljive informacije se
              prenose u zaštićenoj (kriptovanoj) formi upotrebom SSL protokola i
              PKI sistema.
            </p>
            <p>
              Sigurnost garantuje procesor platnih kartica.
            </p>
            <p>
              Niti jednog trenutka podaci o platnoj kartici nisu dostupni našem
              sistemu.
            </p>
            <div className="pt-2 border-t border-blue-100">
              <p className="text-xs">
                <strong>Izjava o konverziji:</strong> Sva plaćanja biće izvršena
                u dinarima (RSD). Iznos za koji će biti zadužena vaša kartica
                biće izražen u vašoj lokalnoj valuti kroz konverziju po kursu
                kartičarskih organizacija.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Terms acceptance */}
      <div className="space-y-2">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(e.target.checked);
              if (errors.termsAccepted) {
                setErrors((prev) => ({ ...prev, termsAccepted: undefined }));
              }
            }}
            className="h-4 w-4 mt-0.5 accent-primary"
          />
          <span className="text-sm text-text">
            Pročitao/la sam i prihvatam{" "}
            <Link
              href="/uslovi-koriscenja"
              target="_blank"
              className="text-primary hover:underline"
            >
              uslove korišćenja
            </Link>
            .
          </span>
        </label>
        {errors.termsAccepted && (
          <p className="text-sm text-error">{errors.termsAccepted}</p>
        )}
      </div>

      {/* Honeypot field (hidden) */}
      <input
        type="text"
        name="honeypot"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
      />

      {errors.submission && (
        <div className="p-3 bg-error-light rounded-lg" role="alert" aria-live="polite">
          <p className="text-sm text-error">{errors.submission}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        size="xl"
        fullWidth
        isLoading={isSubmitting}
        disabled={
          isSubmitting ||
          isLoadingCoupon ||
          isLoadingQuote ||
          Boolean(quoteError) ||
          (!storeCapabilities.cardPayments && !storeCapabilities.cashOnDelivery)
        }
      >
        {isLoadingCoupon || isLoadingQuote
          ? "Provera korpe..."
          : isSubmitting
          ? "Slanje..."
          : paymentMethod === "card"
            ? "Nastavi na plaćanje"
            : "Potvrdi narudžbinu"}
      </Button>
    </form>
  );
}
