"use client";

import { useState, useEffect, useRef } from "react";
import { Mail, Send, Users, History, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { NewsletterEditor, NewsletterEditorRef } from "@/components/admin/NewsletterEditor";
import { NewsletterPreview } from "@/components/admin/NewsletterPreview";
import { NewsletterGallery } from "@/components/admin/NewsletterGallery";

interface Newsletter {
  id: string;
  subject: string;
  content: string;
  sentAt: string;
  recipientCount: number;
}

interface NewsletterData {
  newsletters: Newsletter[];
  subscriberCount: number;
  userSubscribers: number;
  guestSubscribers: number;
}

export default function NewsletterPage() {
  const [data, setData] = useState<NewsletterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [confirm, setConfirm] = useState("");

  const editorRef = useRef<NewsletterEditorRef>(null);

  const handleInsertImage = (imageUrl: string) => {
    editorRef.current?.insertImage(imageUrl);
  };

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/newsletter");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch newsletter data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (confirm.toUpperCase() !== "POTVRDI") {
      setMessage({ type: "error", text: "Morate uneti POTVRDI za slanje" });
      return;
    }

    setSending(true);

    try {
      const res = await fetch("/api/admin/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, content, confirm }),
      });

      const json = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: `Newsletter uspešno poslat na ${json.sent} adresa${json.failed > 0 ? ` (${json.failed} neuspešno)` : ""}`
        });
        setSubject("");
        setContent("");
        setConfirm("");
        fetchData();
      } else {
        setMessage({ type: "error", text: json.error || "Greška pri slanju" });
      }
    } catch {
      setMessage({ type: "error", text: "Greška pri slanju newsletter-a" });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Strip HTML for preview in history
  const stripHtml = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-900">Newsletter</h1>
        <p className="text-stone-600 mt-1">Pošaljite newsletter svim pretplatnicima</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{data?.subscriberCount || 0}</p>
              <p className="text-sm text-stone-500">Ukupno pretplatnika</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{data?.userSubscribers || 0}</p>
              <p className="text-sm text-stone-500">Registrovani korisnici</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Mail className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{data?.guestSubscribers || 0}</p>
              <p className="text-sm text-stone-500">Gosti pretplatnici</p>
            </div>
          </div>
        </div>
      </div>

      {/* Send Form */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Send className="h-5 w-5" />
            Kreiraj newsletter
          </h2>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-6">
          {message && (
            <div
              className={`p-4 rounded-lg flex items-center gap-3 ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Naslov
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Naslov newsletter-a..."
              className="w-full px-4 py-3 border border-stone-300 rounded-lg
                         focus:ring-2 focus:ring-primary focus:border-transparent
                         text-lg"
              required
              minLength={3}
            />
          </div>

          {/* Editor + Preview side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Sadržaj
                </label>
                <NewsletterEditor
                  ref={editorRef}
                  content={content}
                  onChange={setContent}
                />
                <p className="mt-2 text-xs text-stone-500">
                  Koristite toolbar za formatiranje teksta, dodavanje slika i linkova.
                </p>
              </div>

              {/* Image Gallery */}
              <NewsletterGallery onInsertImage={handleInsertImage} />
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Preview email-a
              </label>
              <div className="h-[450px]">
                <NewsletterPreview
                  subject={subject}
                  content={content}
                />
              </div>
            </div>
          </div>

          {/* Confirmation */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Sigurnosna potvrda
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Newsletter će biti poslat na <strong>{data?.subscriberCount || 0}</strong> email adresa.
                  Unesite <strong>POTVRDI</strong> da biste nastavili.
                </p>
                <input
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Unesite POTVRDI"
                  className="mt-3 w-full max-w-xs px-4 py-2 border border-amber-300 rounded-lg
                             focus:ring-2 focus:ring-amber-500 focus:border-transparent
                             bg-white"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={sending || confirm.toUpperCase() !== "POTVRDI" || !subject || !content}
              className="px-8 py-3 bg-primary text-white rounded-lg font-medium
                         hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors flex items-center gap-2 text-lg"
            >
              {sending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Šalje se...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Pošalji newsletter
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <History className="h-5 w-5" />
            Istorija slanja
          </h2>
        </div>

        {data?.newsletters && data.newsletters.length > 0 ? (
          <div className="divide-y divide-stone-200">
            {data.newsletters.map((newsletter) => (
              <div key={newsletter.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-stone-900 truncate">
                      {newsletter.subject}
                    </h3>
                    <p className="text-sm text-stone-500 mt-1 line-clamp-2">
                      {stripHtml(newsletter.content)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-stone-900">
                      {newsletter.recipientCount} primalaca
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      {formatDate(newsletter.sentAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Mail className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Još nema poslatih newsletter-a</p>
          </div>
        )}
      </div>
    </div>
  );
}
