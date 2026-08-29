"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, Pencil, Trash2, Palette } from "lucide-react";

interface ColorItem {
  id: string;
  name: string;
  hex: string;
  active: boolean;
}

export default function AdminColorsPage() {
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", hex: "#000000", active: true });

  const fetchColors = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/colors");
      if (res.ok) {
        const data = await res.json();
        setColors(data.colors);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", hex: "#000000", active: true });
  };

  const handleEdit = (c: ColorItem) => {
    setEditingId(c.id);
    setForm({ name: c.name, hex: c.hex, active: c.active });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.hex) {
      alert("Naziv i HEX su obavezni");
      return;
    }
    setIsSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;
      const res = await fetch("/api/admin/colors", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        resetForm();
        fetchColors();
      } else {
        const err = await res.json();
        alert(err.error || "Greška");
      }
    } catch {
      alert("Greška");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Da li ste sigurni?")) return;
    try {
      const res = await fetch(`/api/admin/colors?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchColors();
    } catch {
      alert("Greška");
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900">
            Boje
          </h1>
          <p className="text-stone-600">
            Upravljajte paletom boja za proizvode
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" /> Nova boja
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-stone-900 mb-4">
            {editingId ? "Izmeni boju" : "Nova boja"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Naziv *
                </label>
                <input
                  type="text"
                  value={form.name}
                  required
                  placeholder="npr. Crvena"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  HEX kod *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.hex}
                    required
                    placeholder="#FF0000"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hex: e.target.value }))
                    }
                    className="flex-1 px-4 py-2 border border-stone-300 rounded-lg"
                  />
                  <input
                    type="color"
                    value={form.hex}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hex: e.target.value }))
                    }
                    className="w-10 h-10 rounded cursor-pointer border border-stone-300"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <div
                  className="w-16 h-10 rounded-lg border border-stone-300"
                  style={{ backgroundColor: form.hex }}
                />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-stone-700">Aktivna</span>
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
              >
                {isSaving ? "Čuvanje..." : "Sačuvaj"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200"
              >
                Otkaži
              </button>
            </div>
          </form>
        </div>
      )}

      {colors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Palette className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nema boja
          </h2>
          <p className="text-stone-500">Dodajte prvu boju za proizvode</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {colors.map((color) => (
            <div
              key={color.id}
              className={`bg-white rounded-xl shadow-sm p-4 ${!color.active ? "opacity-50" : ""}`}
            >
              <div
                className="w-full h-16 rounded-lg mb-3 border border-stone-200"
                style={{ backgroundColor: color.hex }}
              />
              <p className="font-medium text-stone-900 text-sm">{color.name}</p>
              <p className="text-xs text-stone-500 mb-3">{color.hex}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(color)}
                  className="p-1.5 hover:bg-stone-100 rounded-lg"
                >
                  <Pencil className="h-3.5 w-3.5 text-blue-600" />
                </button>
                <button
                  onClick={() => handleDelete(color.id)}
                  className="p-1.5 hover:bg-stone-100 rounded-lg"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
