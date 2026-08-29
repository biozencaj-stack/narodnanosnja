"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, MessageSquare } from "lucide-react";

interface OrderStatusFormProps {
  orderId: string;
  currentStatus: string;
  currentTrackingNumber?: string | null;
  statusLabels: Record<string, string>;
  paymentMethod: string;
  paymentStatus: string;
}

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentTrackingNumber,
  statusLabels,
  paymentMethod,
  paymentStatus,
}: OrderStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [trackingNumber, setTrackingNumber] = useState(
    currentTrackingNumber || "",
  );
  const [cancellationNote, setCancellationNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "SHIPPED" && {
            trackingNumber: trackingNumber.trim(),
          }),
          ...(status === "CANCELLED" &&
            cancellationNote.trim() && {
              cancellationNote: cancellationNote.trim(),
            }),
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Status uspešno promenjen" });
        router.refresh();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Greška" });
      }
    } catch {
      setMessage({ type: "error", text: "Greška pri promeni statusa" });
    } finally {
      setIsLoading(false);
    }
  };

  // Koristi samo 4 statusa: Na čekanju, Potvrđena, Poslata, Otkazana
  const allowedStatuses = ["PENDING", "CONFIRMED", "SHIPPED", "CANCELLED"];
  const statuses = Object.entries(statusLabels).filter(([value]) =>
    allowedStatuses.includes(value),
  );

  const isShippedSelected = status === "SHIPPED";
  const isCardPaymentFailed = paymentMethod === "CARD" && paymentStatus === "FAILED";
  const canSubmit =
    status !== currentStatus &&
    (!isShippedSelected || trackingNumber.trim().length > 0) &&
    !isCardPaymentFailed;

  // Show warning for failed card payments
  if (isCardPaymentFailed) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium text-sm">
            Plaćanje karticom nije uspelo
          </p>
          <p className="text-red-600 text-sm mt-1">
            Promena statusa nije moguća jer kartično plaćanje nije prošlo.
          </p>
        </div>
        <div className="text-stone-500 text-sm">
          Trenutni status: <span className="font-medium">{statusLabels[currentStatus]}</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2
                   focus:ring-stone-900 focus:border-transparent"
      >
        {statuses.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Tracking number input - prikazuje se samo kada je izabran SHIPPED */}
      {isShippedSelected && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-700">
            Broj paketa <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Unesite broj paketa za praćenje"
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2
                         focus:ring-stone-900 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-stone-500">
            Obavezan za status "Poslata" - korisnik će dobiti email sa brojem za
            praćenje
          </p>
        </div>
      )}

      {/* Cancellation note - prikazuje se samo kada je izabran CANCELLED */}
      {status === "CANCELLED" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-700">
            Razlog otkazivanja <span className="text-stone-400">(opciono)</span>
          </label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
            <textarea
              value={cancellationNote}
              onChange={(e) => setCancellationNote(e.target.value)}
              placeholder="Unesite razlog otkazivanja koji će biti poslat kupcu..."
              rows={3}
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2
                         focus:ring-stone-900 focus:border-transparent resize-none"
            />
          </div>
          <p className="text-xs text-stone-500">
            Ova napomena će biti prikazana kupcu u email obaveštenju o
            otkazivanju
          </p>
        </div>
      )}

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading || !canSubmit}
        className="w-full px-4 py-2 bg-stone-900 text-white rounded-lg
                   hover:bg-stone-800 disabled:opacity-50 transition-colors"
      >
        {isLoading ? "Ažuriranje..." : "Sačuvaj status"}
      </button>
    </form>
  );
}
