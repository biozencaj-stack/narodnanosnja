"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Mail, MailOpen, ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { useStoreIdentity } from "@/components/StoreIdentityProvider";

interface ChatMsg {
  id: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  adminNote: string | null;
  createdAt: string;
}

export default function AdminChatMessagesPage() {
  const { name: storeName } = useStoreIdentity();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (showUnreadOnly) params.set("unread", "true");
      const res = await fetch(`/api/admin/chat/messages?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTotal(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, showUnreadOnly]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const toggleRead = async (msg: ChatMsg) => {
    try {
      await fetch("/api/admin/chat/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: msg.id, isRead: !msg.isRead }),
      });
      fetchMessages();
    } catch {
      alert("Greška");
    }
  };

  const saveNote = async (id: string) => {
    try {
      await fetch("/api/admin/chat/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, adminNote: noteText }),
      });
      setNoteEditing(null);
      fetchMessages();
    } catch {
      alert("Greška");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Poruke iz chata</h1>
          <p className="text-text-muted">
            {unreadCount > 0 ? (
              <span>{unreadCount} nepročitanih od ukupno {total}</span>
            ) : (
              <span>{total} poruka ukupno</span>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => { setShowUnreadOnly(e.target.checked); setPage(1); }}
            className="rounded accent-primary"
          />
          <span className="text-sm text-text-muted">Samo nepročitane</span>
        </label>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-border p-12 text-center">
          <Mail className="h-16 w-16 mx-auto mb-4 text-text-light" />
          <h2 className="text-xl font-semibold text-text mb-2">Nema poruka</h2>
          <p className="text-text-muted">Kada korisnici pošalju poruku kroz chat, ovde će se prikazati.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`bg-white rounded-xl shadow-sm border transition-colors ${
                msg.isRead ? "border-border" : "border-primary/30 bg-primary-light/20"
              }`}
            >
              {/* Header row */}
              <div
                className="flex items-center gap-4 px-4 sm:px-5 py-4 cursor-pointer"
                onClick={() => {
                  setExpandedId(expandedId === msg.id ? null : msg.id);
                  if (!msg.isRead) toggleRead(msg);
                }}
              >
                <div className="shrink-0">
                  {msg.isRead ? (
                    <MailOpen className="h-5 w-5 text-text-light" />
                  ) : (
                    <Mail className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text">{msg.name}</span>
                    <span className="text-xs text-text-light">&lt;{msg.email}&gt;</span>
                  </div>
                  <p className="text-sm text-text-muted line-clamp-1 mt-0.5">{msg.message}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-text-light hidden sm:block">{formatDate(msg.createdAt)}</span>
                  {expandedId === msg.id ? (
                    <ChevronUp className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === msg.id && (
                <div className="border-t border-border px-4 sm:px-5 py-4 space-y-4">
                  <div className="bg-background-alt rounded-lg p-4">
                    <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-light">
                    <span>Od: {msg.name} ({msg.email})</span>
                    <span>Datum: {formatDate(msg.createdAt)}</span>
                  </div>

                  {/* Admin note */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <StickyNote className="h-4 w-4 text-text-muted" />
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Admin beleška</span>
                    </div>
                    {noteEditing === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none
                                     focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="Dodajte internu belešku..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveNote(msg.id)}
                            className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors"
                          >
                            Sačuvaj
                          </button>
                          <button
                            onClick={() => setNoteEditing(null)}
                            className="px-4 py-1.5 bg-background-alt text-text-muted rounded-lg text-xs hover:bg-background-hover transition-colors"
                          >
                            Otkaži
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setNoteEditing(msg.id); setNoteText(msg.adminNote || ""); }}
                        className="text-sm text-text-muted bg-background-alt/50 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:bg-background-alt transition-colors"
                      >
                        {msg.adminNote || <span className="text-text-light italic">Kliknite da dodate belešku...</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <button
                      onClick={() => toggleRead(msg)}
                      className="text-xs text-text-muted hover:text-primary transition-colors"
                    >
                      {msg.isRead ? "Označi kao nepročitano" : "Označi kao pročitano"}
                    </button>
                    <a
                      href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: Vaše pitanje na ${storeName}`)}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Odgovori emailom
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-background-alt transition-colors"
              >
                Prethodna
              </button>
              <span className="text-sm text-text-muted">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-background-alt transition-colors"
              >
                Sledeća
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
