"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, Pencil, Trash2, Eye, EyeOff, MessageCircle } from "lucide-react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  active: boolean;
}

export default function AdminChatFAQPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: "",
    sortOrder: 0,
    active: true,
  });

  const fetchFaqs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chat");
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs || []);
      }
    } catch (error) {
      console.error("Failed to fetch FAQs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ question: "", answer: "", category: "", sortOrder: 0, active: true });
  };

  const handleEdit = (faq: FAQItem) => {
    setEditingId(faq.id);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || "",
      sortOrder: faq.sortOrder,
      active: faq.active,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question || !form.answer) {
      alert("Pitanje i odgovor su obavezni");
      return;
    }

    setIsSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch("/api/admin/chat", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          category: form.category || null,
        }),
      });
      if (res.ok) {
        resetForm();
        fetchFaqs();
      } else alert("Greška pri čuvanju");
    } catch {
      alert("Greška");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Da li ste sigurni?")) return;
    try {
      const res = await fetch(`/api/admin/chat?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchFaqs();
      else alert("Greška pri brisanju");
    } catch {
      alert("Greška");
    }
  };

  const toggleActive = async (faq: FAQItem) => {
    try {
      await fetch("/api/admin/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: faq.id, active: !faq.active }),
      });
      fetchFaqs();
    } catch {
      alert("Greška");
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Chat FAQ</h1>
          <p className="text-text-muted">Upravljajte pitanjima i odgovorima za chat widget</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo pitanje
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-border p-6">
          <h2 className="font-semibold text-text mb-4">
            {editingId ? "Izmeni pitanje" : "Novo pitanje"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Pitanje *</label>
              <input
                type="text"
                value={form.question}
                required
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Npr: Kako mogu da naručim?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Odgovor *</label>
              <textarea
                value={form.answer}
                required
                rows={4}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                className="w-full px-4 py-2 border border-border rounded-lg resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Odgovor koji će se prikazati korisniku..."
              />
              <p className="text-xs text-text-light mt-1">Podržava HTML tagove za formatiranje.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Kategorija</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Npr: Dostava, Plaćanje"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Redosled</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="rounded accent-primary"
                  />
                  <span className="text-sm text-text">Aktivno</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {isSaving ? "Čuvanje..." : "Sačuvaj"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-background-alt text-text-muted rounded-lg hover:bg-background-hover transition-colors"
              >
                Otkaži
              </button>
            </div>
          </form>
        </div>
      )}

      {faqs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-border p-12 text-center">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 text-text-light" />
          <h2 className="text-xl font-semibold text-text mb-2">Nema FAQ pitanja</h2>
          <p className="text-text-muted">Dodajte prva pitanja koja će se prikazivati u chat widgetu</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-alt border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Pitanje</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Kategorija</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {faqs.map((faq) => (
                  <tr key={faq.id} className="hover:bg-background-alt/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-text-muted">{faq.sortOrder}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text line-clamp-1">{faq.question}</p>
                      <p className="text-xs text-text-light line-clamp-1 mt-0.5">{faq.answer.replace(/<[^>]*>/g, "").slice(0, 80)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted hidden md:table-cell">
                      {faq.category || <span className="text-text-light">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(faq)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors",
                          faq.active
                            ? "bg-success-light text-success"
                            : "bg-background-alt text-text-light"
                        )}
                      >
                        {faq.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {faq.active ? "Aktivno" : "Neaktivno"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(faq)} className="p-2 hover:bg-background-alt rounded-lg transition-colors">
                          <Pencil className="h-4 w-4 text-primary" />
                        </button>
                        <button onClick={() => handleDelete(faq.id)} className="p-2 hover:bg-error-light rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4 text-error" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
