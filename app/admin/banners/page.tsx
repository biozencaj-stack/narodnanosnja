"use client";

import { useState, useEffect, useCallback } from "react";
import { Image, Plus, Trash2, Eye, EyeOff, Loader2, Pencil } from "lucide-react";
import { LocalizedInput } from "@/components/admin/LocalizedInput";
import { LocalizedTextarea } from "@/components/admin/LocalizedTextarea";
import { getLocalized, parseLocalized } from "@/lib/i18n/localized";

type LocalizedJson = { sr: string; en: string } | null;

interface Banner {
  id: string;
  title: LocalizedJson;
  subtitle: LocalizedJson | null;
  description: LocalizedJson | null;
  imageData: string;
  contentType: string;
  linkUrl: string | null;
  buttonText: LocalizedJson | null;
  position: string;
  isActive: boolean;
  order: number;
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: { sr: "", en: "" },
    subtitle: { sr: "", en: "" },
    description: { sr: "", en: "" },
    linkUrl: "",
    buttonText: { sr: "", en: "" },
    position: "home_hero",
    isActive: true,
    imageFile: null as File | null,
  });

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/banners");
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners);
      }
    } catch (error) {
      console.error("Failed to fetch banners:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const resetForm = () => {
    setShowForm(false);
    setEditingBanner(null);
    setFormData({
      title: { sr: "", en: "" },
      subtitle: { sr: "", en: "" },
      description: { sr: "", en: "" },
      linkUrl: "",
      buttonText: { sr: "", en: "" },
      position: "home_hero",
      isActive: true,
      imageFile: null,
    });
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: parseLocalized(banner.title),
      subtitle: parseLocalized(banner.subtitle),
      description: parseLocalized(banner.description),
      linkUrl: banner.linkUrl || "",
      buttonText: parseLocalized(banner.buttonText),
      position: banner.position,
      isActive: banner.isActive,
      imageFile: null,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For new banner, image is required
    if (!editingBanner && !formData.imageFile) {
      alert("Molimo izaberite sliku");
      return;
    }

    setIsSaving(true);

    try {
      // If editing without new image
      if (editingBanner && !formData.imageFile) {
        const res = await fetch(`/api/admin/banners/${editingBanner.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            subtitle: formData.subtitle.sr || formData.subtitle.en ? formData.subtitle : null,
            description: formData.description.sr || formData.description.en ? formData.description : null,
            linkUrl: formData.linkUrl || null,
            buttonText: formData.buttonText.sr || formData.buttonText.en ? formData.buttonText : null,
            position: formData.position,
            isActive: formData.isActive,
          }),
        });

        if (res.ok) {
          resetForm();
          fetchBanners();
        } else {
          alert("Greška pri čuvanju");
        }
        setIsSaving(false);
        return;
      }

      // Convert image to base64 (for new banner or edit with new image)
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];

        const url = editingBanner
          ? `/api/admin/banners/${editingBanner.id}`
          : "/api/admin/banners";

        const method = editingBanner ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            subtitle: formData.subtitle.sr || formData.subtitle.en ? formData.subtitle : null,
            description: formData.description.sr || formData.description.en ? formData.description : null,
            linkUrl: formData.linkUrl || null,
            buttonText: formData.buttonText.sr || formData.buttonText.en ? formData.buttonText : null,
            position: formData.position,
            isActive: formData.isActive,
            imageData: base64,
            contentType: formData.imageFile!.type,
          }),
        });

        if (res.ok) {
          resetForm();
          fetchBanners();
        } else {
          alert("Greška pri čuvanju");
        }
        setIsSaving(false);
      };
      reader.readAsDataURL(formData.imageFile!);
    } catch (error) {
      console.error("Failed to save banner:", error);
      setIsSaving(false);
    }
  };

  const handleDelete = async (bannerId: string) => {
    if (!confirm("Da li ste sigurni da želite da obrišete ovaj baner?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/banners/${bannerId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchBanners();
      }
    } catch (error) {
      console.error("Failed to delete banner:", error);
    }
  };

  const handleToggleActive = async (bannerId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/banners/${bannerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        fetchBanners();
      }
    } catch (error) {
      console.error("Failed to toggle banner:", error);
    }
  };

  const positions = [
    { value: "home_hero", label: "Početna - Hero (glavni carousel)", description: "Veliki slider na vrhu početne stranice. Dodajte više banera za automatski carousel." },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900">Baneri</h1>
          <p className="text-stone-600">Upravljajte banerima na sajtu</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white
                     rounded-lg hover:bg-stone-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novi baner
        </button>
      </div>

      {/* Add/Edit banner form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-stone-900 mb-4">
            {editingBanner ? "Izmeni baner" : "Novi baner"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LocalizedInput
                label="Naslov"
                name="title"
                value={formData.title}
                onChange={(v) => setFormData((p) => ({ ...p, title: v }))}
                required
              />
              <LocalizedInput
                label="Podnaslov (kratki)"
                name="subtitle"
                value={formData.subtitle}
                onChange={(v) => setFormData((p) => ({ ...p, subtitle: v }))}
              />
              <div className="md:col-span-2">
                <LocalizedTextarea
                  label="Opis (duži tekst za Hero Carousel)"
                  name="description"
                  value={formData.description}
                  onChange={(v) => setFormData((p) => ({ ...p, description: v }))}
                  rows={2}
                  placeholder="Otkrijte novu kolekciju kvalitetnih proizvoda..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Link URL
                </label>
                <input
                  type="text"
                  value={formData.linkUrl}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, linkUrl: e.target.value }))
                  }
                  placeholder="/catalog"
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <LocalizedInput
                label="Tekst dugmeta"
                name="buttonText"
                value={formData.buttonText}
                onChange={(v) => setFormData((p) => ({ ...p, buttonText: v }))}
                placeholder="Pogledaj kolekciju"
              />
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Pozicija
                </label>
                <select
                  value={formData.position}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, position: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg"
                >
                  {positions.map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-stone-500 mt-1">
                  {positions.find(p => p.value === formData.position)?.description}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Slika {editingBanner ? "(ostavi prazno za zadržavanje postojeće)" : "*"}
                </label>
                {editingBanner && !formData.imageFile && (
                  <div className="mb-2 p-2 bg-stone-50 rounded-lg">
                    <img
                      src={`data:${editingBanner.contentType};base64,${editingBanner.imageData}`}
                      alt="Trenutna slika"
                      className="h-20 w-auto object-cover rounded"
                    />
                    <p className="text-xs text-stone-500 mt-1">Trenutna slika</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      imageFile: e.target.files?.[0] || null,
                    }))
                  }
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg"
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, isActive: e.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-stone-700">Aktivan</span>
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-stone-900 text-white rounded-lg
                           hover:bg-stone-800 disabled:opacity-50"
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

      {/* Banners grid */}
      {banners.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Image className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nema banera
          </h2>
          <p className="text-stone-500">Dodajte prvi baner za sajt</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                !banner.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="aspect-video bg-stone-100 relative">
                <img
                  src={`data:${banner.contentType};base64,${banner.imageData}`}
                  alt={getLocalized(banner.title, "sr")}
                  className="w-full h-full object-cover"
                />
                {!banner.isActive && (
                  <div className="absolute inset-0 bg-stone-900/50 flex items-center justify-center">
                    <span className="text-white font-medium">Neaktivan</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-stone-900">{getLocalized(banner.title, "sr")}</h3>
                {getLocalized(banner.subtitle, "sr") && (
                  <p className="text-sm text-stone-500">{getLocalized(banner.subtitle, "sr")}</p>
                )}
                <p className="text-xs text-stone-400 mt-1">
                  Pozicija:{" "}
                  {positions.find((p) => p.value === banner.position)?.label}
                </p>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => handleToggleActive(banner.id, banner.isActive)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      banner.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {banner.isActive ? (
                      <>
                        <Eye className="h-4 w-4" />
                        Aktivan
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Neaktivan
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(banner)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm
                               bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    <Pencil className="h-4 w-4" />
                    Izmeni
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm
                               bg-red-100 text-red-700 hover:bg-red-200 ml-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                    Obriši
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
