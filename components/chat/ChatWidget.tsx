"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, ChevronDown, ChevronRight, Send, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

type View = "closed" | "faq" | "contact" | "sent";

export function ChatWidget() {
  const [view, setView] = useState<View>("closed");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "", honeypot: "" });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === "faq" && faqs.length === 0) {
      setIsLoadingFaqs(true);
      fetch("/api/chat/faq")
        .then((r) => r.json())
        .then((data) => setFaqs(data.faqs || []))
        .catch(() => {})
        .finally(() => setIsLoadingFaqs(false));
    }
  }, [view, faqs.length]);

  const handleOpen = () => setView("faq");
  const handleClose = () => {
    setView("closed");
    setExpandedId(null);
    setSendError("");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setSendError("Sva polja su obavezna.");
      return;
    }
    setIsSending(true);
    setSendError("");

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setView("sent");
        setContactForm({ name: "", email: "", message: "", honeypot: "" });
      } else {
        const data = await res.json();
        setSendError(data.error || "Greška pri slanju.");
      }
    } catch {
      setSendError("Greška. Pokušajte ponovo.");
    } finally {
      setIsSending(false);
    }
  };

  const groupedFaqs = faqs.reduce<Record<string, FAQ[]>>((acc, faq) => {
    const cat = faq.category || "Opšte";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  if (view === "closed") {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-lg
                   hover:bg-primary-hover hover:shadow-xl hover:scale-105
                   transition-all duration-200 flex items-center justify-center"
        aria-label="Otvorite chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 bg-black/20 z-50 sm:hidden"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed z-50 bg-white shadow-2xl flex flex-col overflow-hidden",
          "sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[520px] sm:rounded-2xl sm:border sm:border-border",
          "bottom-0 right-0 left-0 w-full h-[85vh] rounded-t-2xl sm:left-auto",
          "animate-slide-in-up"
        )}
      >
        {/* Header */}
        <div className="bg-primary px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {(view === "contact" || view === "sent") && (
              <button onClick={() => setView("faq")} className="text-white/70 hover:text-white -ml-1">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h3 className="text-white font-semibold text-sm">
                {view === "contact" ? "Pošaljite poruku" : view === "sent" ? "Poruka poslata" : "Kako vam možemo pomoći?"}
              </h3>
              <p className="text-white/60 text-xs">
                {view === "faq" ? "Izaberite pitanje ili nam pišite" : view === "contact" ? "Odgovorićemo u najkraćem roku" : ""}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === "faq" && (
            <div className="p-4">
              {isLoadingFaqs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                </div>
              ) : faqs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-text-muted text-sm mb-4">Nema često postavljanih pitanja.</p>
                  <button
                    onClick={() => setView("contact")}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    Pošaljite nam poruku
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedFaqs).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-[10px] font-semibold text-text-light uppercase tracking-wider mb-2 px-1">
                        {category}
                      </p>
                      <div className="space-y-1">
                        {items.map((faq) => (
                          <div key={faq.id} className="border border-border rounded-xl overflow-hidden">
                            <button
                              onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                              className="w-full flex items-center justify-between px-4 py-3 text-left
                                         text-sm text-text hover:bg-background-alt transition-colors"
                            >
                              <span className="font-medium pr-4">{faq.question}</span>
                              {expandedId === faq.id ? (
                                <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
                              )}
                            </button>
                            {expandedId === faq.id && (
                              <div className="px-4 pb-3 text-sm text-text-muted leading-relaxed border-t border-border bg-background-alt/50">
                                <div className="pt-3" dangerouslySetInnerHTML={{ __html: faq.answer }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "contact" && (
            <form onSubmit={handleSend} className="p-4 space-y-3">
              <input
                type="text"
                name="honeypot"
                value={contactForm.honeypot}
                onChange={(e) => setContactForm((f) => ({ ...f, honeypot: e.target.value }))}
                style={{ display: "none" }}
                tabIndex={-1}
                autoComplete="off"
              />
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Ime</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm
                             focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Vaše ime"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm
                             focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="vas@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Poruka</label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                  rows={4}
                  maxLength={2000}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm resize-none
                             focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Kako vam možemo pomoći?"
                  required
                />
              </div>

              {sendError && (
                <p className="text-xs text-error bg-error-light px-3 py-2 rounded-lg">{sendError}</p>
              )}

              <button
                type="submit"
                disabled={isSending}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium
                           hover:bg-primary-hover disabled:opacity-50 transition-all
                           flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Pošaljite
                  </>
                )}
              </button>
            </form>
          )}

          {view === "sent" && (
            <div className="p-6 text-center flex flex-col items-center justify-center h-full">
              <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text mb-2">Hvala vam!</h3>
              <p className="text-sm text-text-muted mb-6">
                Vaša poruka je uspešno poslata. Odgovorićemo u najkraćem roku.
              </p>
              <button
                onClick={handleClose}
                className="text-sm text-primary font-medium hover:underline"
              >
                Zatvorite
              </button>
            </div>
          )}
        </div>

        {/* Footer - contact CTA */}
        {view === "faq" && faqs.length > 0 && (
          <div className="border-t border-border p-4 shrink-0 bg-background-alt/50">
            <button
              onClick={() => setView("contact")}
              className="w-full py-2.5 bg-white border border-border rounded-xl text-sm font-medium
                         text-text-muted hover:text-primary hover:border-primary/30 transition-all"
            >
              Niste pronašli odgovor? Pišite nam
            </button>
          </div>
        )}
      </div>
    </>
  );
}
