"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Mail, Send, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { StoreSettingsPanel } from "@/components/admin/StoreSettingsPanel";

export default StoreSettingsPanel;

function LegacyAdminSettingsPage() {
  // Wishlist alerts state
  const [isSendingAlerts, setIsSendingAlerts] = useState(false);
  const [alertResult, setAlertResult] = useState<{
    type: "success" | "error";
    processed?: number;
    notified?: number;
    errors?: number;
    message: string;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [lastSent, setLastSent] = useState<{
    sentAt: string;
    processed: number;
    notified: number;
    errors: number;
  } | null>(null);
  const [isLoadingLastSent, setIsLoadingLastSent] = useState(true);

  const fetchLastSent = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/wishlist-alerts-log");
      if (res.ok) {
        const data = await res.json();
        setLastSent(data.lastSent);
      }
    } catch (error) {
      console.error("Failed to fetch last sent:", error);
    } finally {
      setIsLoadingLastSent(false);
    }
  }, []);

  useEffect(() => {
    fetchLastSent();
  }, [fetchLastSent]);

  const handleSendAlerts = async () => {
    setIsSendingAlerts(true);
    setAlertResult(null);

    try {
      const res = await fetch("/api/cron/wishlist-alerts", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setAlertResult({
          type: "success",
          processed: data.processed,
          notified: data.notified,
          errors: data.errors,
          message: `Uspešno! Obrađeno ${data.processed} korisnika, obavešteno ${data.notified}.`,
        });
        // Refresh last sent info
        fetchLastSent();
        // Clear confirm text
        setConfirmText("");
      } else {
        setAlertResult({
          type: "error",
          message: data.error || "Greška pri slanju obaveštenja",
        });
      }
    } catch {
      setAlertResult({
        type: "error",
        message: "Greška pri povezivanju sa serverom",
      });
    } finally {
      setIsSendingAlerts(false);
    }
  };

  // Check if confirm text matches (case-insensitive)
  const isConfirmed = confirmText.toUpperCase() === "POTVRDI";

  // Format date for display
  const formatLastSent = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-900">Podešavanja</h1>
        <p className="text-stone-600">Upravljanje sistemom i notifikacijama</p>
      </div>

      {/* Email Notifications Section */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifikacije
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-medium text-stone-900 mb-2">
              Obaveštenja o akcijama na favoritima
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              Pošaljite email svim korisnicima čiji su omiljeni proizvodi trenutno na akciji.
              Sistem će proveriti listu želja svakog korisnika i poslati personalizovan email
              sa proizvodima koji su na sniženju.
            </p>

            {alertResult && (
              <div
                className={`p-4 rounded-lg mb-4 flex items-start gap-3 ${
                  alertResult.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {alertResult.type === "success" ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{alertResult.message}</p>
                  {alertResult.type === "success" && alertResult.errors !== undefined && alertResult.errors > 0 && (
                    <p className="text-sm mt-1">
                      Greške pri slanju: {alertResult.errors}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Safety confirmation input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Potvrda slanja
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Ukucajte POTVRDI"
                className="w-full max-w-xs px-4 py-2 border border-stone-300 rounded-lg
                           focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-stone-500">
                Ukucajte &quot;POTVRDI&quot; da biste omogućili slanje
              </p>
            </div>

            <button
              onClick={handleSendAlerts}
              disabled={isSendingAlerts || !isConfirmed}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white
                         rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSendingAlerts ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Slanje u toku...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Pošalji obaveštenja o akcijama
                </>
              )}
            </button>

            {/* Last sent info */}
            <div className="mt-6 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <Clock className="h-4 w-4" />
                {isLoadingLastSent ? (
                  <span>Učitavanje...</span>
                ) : lastSent ? (
                  <span>
                    Poslednje slanje: {formatLastSent(lastSent.sentAt)} -
                    Obavešteno {lastSent.notified} od {lastSent.processed} korisnika
                    {lastSent.errors > 0 && ` (${lastSent.errors} grešaka)`}
                  </span>
                ) : (
                  <span>Još uvek nije slato obaveštenje o akcijama</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
