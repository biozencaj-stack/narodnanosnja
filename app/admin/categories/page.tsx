"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  FolderTree,
} from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import { LocalizedInput } from "@/components/admin/LocalizedInput";
import { LocalizedTextarea } from "@/components/admin/LocalizedTextarea";
import { parseLocalized } from "@/lib/i18n/localized";

interface CategoryItem {
  id: string;
  name: unknown; // Json: { sr, en }
  slug: string;
  description: unknown;
  image: string | null;
  parentId: string | null;
  parent: { id: string; name: unknown } | null;
  children: { id: string; name: unknown }[];
  active: boolean;
  showInNav: boolean;
  navOrder: number;
  sortOrder: number;
  _count: { products: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: { sr: "", en: "" } as { sr: string; en: string },
    description: { sr: "", en: "" } as { sr: string; en: string },
    image: null as string | null,
    parentId: "",
    active: true,
    showInNav: false,
    navOrder: 0,
    sortOrder: 0,
  });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: { sr: "", en: "" },
      description: { sr: "", en: "" },
      image: null,
      parentId: "",
      active: true,
      showInNav: false,
      navOrder: 0,
      sortOrder: 0,
    });
  };

  const handleEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setForm({
      name: parseLocalized(cat.name),
      description: parseLocalized(cat.description),
      image: cat.image,
      parentId: cat.parentId || "",
      active: cat.active,
      showInNav: cat.showInNav,
      navOrder: cat.navOrder,
      sortOrder: cat.sortOrder,
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
        ? `/api/admin/categories/${editingId}`
        : "/api/admin/categories";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          image: form.image,
          parentId: form.parentId || null,
          active: form.active,
          showInNav: form.showInNav,
          navOrder: form.navOrder,
          sortOrder: form.sortOrder,
        }),
      });
      if (res.ok) {
        resetForm();
        fetchCategories();
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
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchCategories();
      else {
        const err = await res.json();
        alert(err.error || "Greška pri brisanju");
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
            Kategorije
          </h1>
          <p className="text-stone-600">Upravljajte kategorijama proizvoda</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" /> Nova kategorija
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-stone-900 mb-4">
            {editingId ? "Izmeni kategoriju" : "Nova kategorija"}
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
                  Nadkategorija
                </label>
                <select
                  value={form.parentId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, parentId: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg"
                >
                  <option value="">-- Glavna kategorija --</option>
                  {categories
                    .filter((c) => c.id !== editingId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {parseLocalized(c.name).sr || parseLocalized(c.name).en}
                      </option>
                    ))}
                </select>
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
                value={form.image}
                folder="categories"
                label="Slika kategorije"
                onChange={(path) => setForm((f) => ({ ...f, image: path }))}
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
            </div>
            <div className="flex flex-wrap gap-6">
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.showInNav}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, showInNav: e.target.checked }))
                  }
                  className="rounded accent-primary"
                />
                <span className="text-sm text-stone-700">Prikaži u navigaciji</span>
              </label>
              {form.showInNav && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-stone-700">Redosled u meniju:</label>
                  <input
                    type="number"
                    value={form.navOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, navOrder: parseInt(e.target.value) || 0 }))
                    }
                    className="w-20 px-2 py-1 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>
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

      {categories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FolderTree className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nema kategorija
          </h2>
          <p className="text-stone-500">Dodajte prvu kategoriju</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Kategorija
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Nadkategorija
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Proizvoda
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Nav
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={parseLocalized(cat.name).sr || parseLocalized(cat.name).en}
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-stone-100 rounded flex items-center justify-center">
                          <FolderTree className="h-5 w-5 text-stone-400" />
                        </div>
                      )}
                      <span className="font-medium text-stone-900">
                        {parseLocalized(cat.name).sr || parseLocalized(cat.name).en}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {cat.parent ? parseLocalized(cat.parent.name).sr || parseLocalized(cat.parent.name).en : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {cat._count.products}
                  </td>
                  <td className="px-4 py-3">
                    {cat.active ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Aktivna
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-xs rounded-full">
                        Neaktivna
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {cat.showInNav ? (
                      <span className="px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full font-medium">
                        Meni
                      </span>
                    ) : (
                      <span className="text-stone-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
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
