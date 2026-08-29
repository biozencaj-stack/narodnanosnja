"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, Pencil, Trash2, Tag } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import { LocalizedInput } from "@/components/admin/LocalizedInput";
import { LocalizedTextarea } from "@/components/admin/LocalizedTextarea";
import { parseLocalized } from "@/lib/i18n/localized";

interface BrandItem {
  id: string;
  name: unknown; // Json: { sr, en }
  slug: string;
  logo: string | null;
  description: unknown;
  active: boolean;
  sortOrder: number;
  _count: { products: number };
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: { sr: "", en: "" } as { sr: string; en: string },
    logo: null as string | null,
    description: { sr: "", en: "" } as { sr: string; en: string },
    active: true,
    sortOrder: 0,
  });

  const fetchBrands = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/brands");
      if (res.ok) {
        const data = await res.json();
        setBrands(data.brands);
      }
    } catch (error) {
      console.error("Failed to fetch brands:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: { sr: "", en: "" },
      logo: null,
      description: { sr: "", en: "" },
      active: true,
      sortOrder: 0,
    });
  };

  const handleEdit = (brand: BrandItem) => {
    setEditingId(brand.id);
    setForm({
      name: parseLocalized(brand.name),
      logo: brand.logo,
      description: parseLocalized(brand.description),
      active: brand.active,
      sortOrder: brand.sortOrder,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.sr && !form.name.en) {
      alert("Naziv je obavezan");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingId
        ? `/api/admin/brands/${editingId}`
        : "/api/admin/brands";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          logo: form.logo,
          description: form.description || null,
          active: form.active,
          sortOrder: form.sortOrder,
        }),
      });
      if (res.ok) {
        resetForm();
        fetchBrands();
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
      const res = await fetch(`/api/admin/brands/${id}`, { method: "DELETE" });
      if (res.ok) fetchBrands();
      else {
        const err = await res.json();
        alert(err.error || "Greška");
      }
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
            Brendovi
          </h1>
          <p className="text-stone-600">Upravljajte brendovima</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" /> Novi brend
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-stone-900 mb-4">
            {editingId ? "Izmeni brend" : "Novi brend"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LocalizedInput
                label="Naziv *"
                name="name"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                required
              />
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Redosled
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sortOrder: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <LocalizedTextarea
                  label="Opis"
                  name="description"
                  value={form.description}
                  onChange={(v) => setForm((f) => ({ ...f, description: v }))}
                  rows={2}
                />
              </div>
              <ImageUpload
                value={form.logo}
                folder="brands"
                label="Logo brenda"
                onChange={(path) => setForm((f) => ({ ...f, logo: path }))}
              />
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
              <span className="text-sm text-stone-700">Aktivan</span>
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

      {brands.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Tag className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nema brendova
          </h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <div
              key={brand.id}
              className={`bg-white rounded-xl shadow-sm p-4 ${!brand.active ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3 mb-3">
                {brand.logo ? (
                  <img
                    src={brand.logo}
                    alt={parseLocalized(brand.name).sr || parseLocalized(brand.name).en}
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <div className="h-12 w-12 bg-stone-100 rounded-lg flex items-center justify-center">
                    <Tag className="h-6 w-6 text-stone-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-stone-900">{parseLocalized(brand.name).sr || parseLocalized(brand.name).en}</h3>
                  <p className="text-xs text-stone-500">
                    {brand._count.products} proizvoda
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(brand)}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200"
                >
                  <Pencil className="h-3 w-3" /> Izmeni
                </button>
                <button
                  onClick={() => handleDelete(brand.id)}
                  className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 ml-auto"
                >
                  <Trash2 className="h-3 w-3" /> Obriši
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
