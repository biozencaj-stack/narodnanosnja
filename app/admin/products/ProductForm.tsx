"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/admin/ImageUpload";
import { LocalizedInput } from "@/components/admin/LocalizedInput";
import { LocalizedTextarea } from "@/components/admin/LocalizedTextarea";
import { parseLocalized } from "@/lib/i18n/localized";

interface SizeRow {
  size: string;
  stock: number;
}

interface CategoryOption {
  id: string;
  name: unknown; // Json: { sr, en }
}
interface BrandOption {
  id: string;
  name: unknown; // Json: { sr, en }
}
interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

interface ProductFormProps {
  productId?: string;
}

export default function ProductForm({ productId }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!productId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [form, setForm] = useState({
    name: { sr: "", en: "" } as { sr: string; en: string },
    description: { sr: "", en: "" } as { sr: string; en: string },
    sku: "",
    price: "",
    salePrice: "",
    image1: null as string | null,
    image2: null as string | null,
    image3: null as string | null,
    categoryIds: [] as string[],
    brandId: "",
    gender: "",
    active: true,
    featured: false,
    onSale: false,
    novo: false,
    metaTitle: { sr: "", en: "" } as { sr: string; en: string },
    metaDescription: { sr: "", en: "" } as { sr: string; en: string },
    // Universal attributes
    color: "",
    colorHex: "",
    material: "",
    weight: "",
    length: "",
    width: "",
    height: "",
    countryOfOrigin: "",
    careInstructions: { sr: "", en: "" } as { sr: string; en: string },
    barcode: "",
    tags: [] as string[],
  });

  const [sizes, setSizes] = useState<SizeRow[]>([]);

  // Fetch categories, brands, colors
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/brands").then((r) => r.json()),
      fetch("/api/admin/colors")
        .then((r) => r.json())
        .catch(() => ({ colors: [] })),
    ]).then(([catData, brandData, colorData]) => {
      setCategories(catData.categories || []);
      setBrands(brandData.brands || []);
      setColorOptions(colorData.colors || []);
    });
  }, []);

  // Fetch product if editing
  useEffect(() => {
    if (!productId) return;
    fetch(`/api/admin/products/${productId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.product) {
          const p = data.product;
          setForm({
            name: parseLocalized(p.name),
            description: parseLocalized(p.description),
            sku: p.sku || "",
            price: String(p.price || ""),
            salePrice: p.salePrice ? String(p.salePrice) : "",
            image1: p.image1,
            image2: p.image2,
            image3: p.image3,
            categoryIds: p.categoryIds || (p.categoryId ? [p.categoryId] : []),
            brandId: p.brandId || "",
            gender: p.gender || "",
            active: p.active,
            featured: p.featured,
            onSale: p.onSale,
            novo: p.novo ?? false,
            metaTitle: parseLocalized(p.metaTitle),
            metaDescription: parseLocalized(p.metaDescription),
            color: p.color || "",
            colorHex: p.colorHex || "",
            material: p.material || "",
            weight: p.weight ? String(p.weight) : "",
            length: p.length ? String(p.length) : "",
            width: p.width ? String(p.width) : "",
            height: p.height ? String(p.height) : "",
            countryOfOrigin: p.countryOfOrigin || "",
            careInstructions: parseLocalized(p.careInstructions),
            barcode: p.barcode || "",
            tags: p.tags || [],
          });
          setSizes(
            p.sizes?.map((s: SizeRow) => ({ size: s.size, stock: s.stock })) ||
              [],
          );
        }
      })
      .finally(() => setIsLoading(false));
  }, [productId]);

  const addSize = () => setSizes([...sizes, { size: "", stock: 0 }]);
  const removeSize = (i: number) =>
    setSizes(sizes.filter((_, idx) => idx !== i));
  const updateSize = (
    i: number,
    field: keyof SizeRow,
    value: string | number,
  ) =>
    setSizes(sizes.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
      setTagInput("");
    }
  };
  const removeTag = (tag: string) =>
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));

  const handleColorSelect = (colorOpt: ColorOption) => {
    setForm((f) => ({ ...f, color: colorOpt.name, colorHex: colorOpt.hex }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = form.name.sr || form.name.en;
    if (!nameStr || !form.price) {
      alert("Naziv i cena su obavezni");
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description.sr || form.description.en ? form.description : null,
        sku: form.sku || null,
        price: parseFloat(form.price),
        salePrice: form.salePrice ? parseFloat(form.salePrice) : null,
        image1: form.image1,
        image2: form.image2,
        image3: form.image3,
        categoryId: form.categoryIds[0] || null,
        categoryIds: form.categoryIds,
        brandId: form.brandId || null,
        gender: form.gender || null,
        active: form.active,
        featured: form.featured,
        onSale: form.onSale,
        novo: form.novo,
        metaTitle: form.metaTitle.sr || form.metaTitle.en ? form.metaTitle : null,
        metaDescription: form.metaDescription.sr || form.metaDescription.en ? form.metaDescription : null,
        color: form.color || null,
        colorHex: form.colorHex || null,
        material: form.material || null,
        weight: form.weight ? parseFloat(form.weight) : null,
        length: form.length ? parseFloat(form.length) : null,
        width: form.width ? parseFloat(form.width) : null,
        height: form.height ? parseFloat(form.height) : null,
        countryOfOrigin: form.countryOfOrigin || null,
        careInstructions: form.careInstructions.sr || form.careInstructions.en ? form.careInstructions : null,
        barcode: form.barcode || null,
        tags: form.tags,
        sizes: sizes.filter((s) => s.size),
      };

      const url = isEditing
        ? `/api/admin/products/${productId}`
        : "/api/admin/products";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) router.push("/admin/products");
      else {
        const err = await res.json();
        alert(err.error || "Greška pri čuvanju");
      }
    } catch {
      alert("Greška pri čuvanju");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );

  const inputCls = "w-full px-4 py-2 border border-stone-300 rounded-lg";
  const labelCls = "block text-sm font-medium text-stone-700 mb-1";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Nazad na listu
        </Link>
        <h1 className="text-2xl font-display font-bold text-stone-900">
          {isEditing ? "Izmeni proizvod" : "Novi proizvod"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Osnovni podaci</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <LocalizedInput
                label="Naziv *"
                name="name"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                required
              />
            </div>
            <div className="md:col-span-2">
              <LocalizedTextarea
                label="Opis"
                name="description"
                value={form.description}
                onChange={(v) => setForm((f) => ({ ...f, description: v }))}
                rows={4}
              />
            </div>
            <div>
              <label className={labelCls}>SKU (šifra)</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sku: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Barkod (EAN)</label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, barcode: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Cene</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cena (RSD) *</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                required
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Akcijska cena (RSD)</label>
              <input
                type="number"
                step="0.01"
                value={form.salePrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, salePrice: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Slike (max 3)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ImageUpload
              value={form.image1}
              folder="products"
              label="Slika 1 (glavna)"
              onChange={(path) => setForm((f) => ({ ...f, image1: path }))}
            />
            <ImageUpload
              value={form.image2}
              folder="products"
              label="Slika 2"
              onChange={(path) => setForm((f) => ({ ...f, image2: path }))}
            />
            <ImageUpload
              value={form.image3}
              folder="products"
              label="Slika 3"
              onChange={(path) => setForm((f) => ({ ...f, image3: path }))}
            />
          </div>
        </div>

        {/* Color & Material */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Boja i materijal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Boja</label>
              <div className="flex items-center gap-2">
                <select
                  value={form.color}
                  onChange={(e) => {
                    const selected = colorOptions.find(
                      (c) => c.name === e.target.value,
                    );
                    if (selected) handleColorSelect(selected);
                    else
                      setForm((f) => ({
                        ...f,
                        color: e.target.value,
                        colorHex: "",
                      }));
                  }}
                  className={inputCls}
                >
                  <option value="">-- Bez boje --</option>
                  {colorOptions.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {form.colorHex && (
                  <div
                    className="w-10 h-10 rounded-lg border border-stone-300 flex-shrink-0"
                    style={{ backgroundColor: form.colorHex }}
                  />
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>HEX kod boje</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.colorHex}
                  placeholder="#FF0000"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, colorHex: e.target.value }))
                  }
                  className={inputCls}
                />
                <input
                  type="color"
                  value={form.colorHex || "#000000"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, colorHex: e.target.value }))
                  }
                  className="w-10 h-10 rounded cursor-pointer border border-stone-300"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Materijal / Sastav</label>
              <textarea
                value={form.material}
                rows={2}
                placeholder="npr. 100% pamuk, Koža, Poliester..."
                onChange={(e) =>
                  setForm((f) => ({ ...f, material: e.target.value }))
                }
                className={inputCls + " resize-none"}
              />
            </div>
          </div>
        </div>

        {/* Dimensions & Weight */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Dimenzije i težina</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Težina (g)</label>
              <input
                type="number"
                step="0.01"
                value={form.weight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weight: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Dužina (cm)</label>
              <input
                type="number"
                step="0.01"
                value={form.length}
                onChange={(e) =>
                  setForm((f) => ({ ...f, length: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Širina (cm)</label>
              <input
                type="number"
                step="0.01"
                value={form.width}
                onChange={(e) =>
                  setForm((f) => ({ ...f, width: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Visina (cm)</label>
              <input
                type="number"
                step="0.01"
                value={form.height}
                onChange={(e) =>
                  setForm((f) => ({ ...f, height: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Klasifikacija</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Kategorije</label>
              <div className="max-h-48 overflow-y-auto border border-stone-300 rounded-lg p-2 space-y-1">
                {categories.length === 0 && (
                  <p className="text-xs text-stone-400 p-1">Nema kategorija</p>
                )}
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-stone-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(c.id)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          categoryIds: e.target.checked
                            ? [...f.categoryIds, c.id]
                            : f.categoryIds.filter((id) => id !== c.id),
                        }));
                      }}
                      className="rounded accent-primary"
                    />
                    <span className="text-sm text-stone-700">{parseLocalized(c.name).sr || parseLocalized(c.name).en}</span>
                    {form.categoryIds[0] === c.id && form.categoryIds.length > 1 && (
                      <span className="text-[10px] bg-primary-light text-primary px-1.5 py-0.5 rounded-full ml-auto">
                        Glavna
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {form.categoryIds.length > 1 && (
                <p className="text-xs text-stone-500 mt-1">
                  Prva izabrana kategorija je glavna (za breadcrumbs).
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Brend</label>
              <select
                value={form.brandId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brandId: e.target.value }))
                }
                className={inputCls}
              >
                <option value="">-- Bez brenda --</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {parseLocalized(b.name).sr || parseLocalized(b.name).en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Pol</label>
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gender: e.target.value }))
                }
                className={inputCls}
              >
                <option value="">-- Nije odabrano --</option>
                <option value="zenski">Ženski</option>
                <option value="muski">Muški</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Zemlja porekla</label>
              <input
                type="text"
                value={form.countryOfOrigin}
                placeholder="npr. Srbija, Italija..."
                onChange={(e) =>
                  setForm((f) => ({ ...f, countryOfOrigin: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Tagovi</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagInput}
              placeholder="Dodajte tag i pritisnite Enter"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              className="flex-1 px-4 py-2 border border-stone-300 rounded-lg"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-stone-100 rounded-lg hover:bg-stone-200 text-sm"
            >
              Dodaj
            </button>
          </div>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-stone-100 rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-stone-500 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Care instructions */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">
            Uputstva za održavanje
          </h2>
          <LocalizedTextarea
            label="Uputstva"
            name="careInstructions"
            value={form.careInstructions}
            onChange={(v) => setForm((f) => ({ ...f, careInstructions: v }))}
            rows={3}
            placeholder="npr. Perite na 30°C, Ne koristite izbeljivač..."
          />
        </div>

        {/* Sizes & stock */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">
              Veličine i stanje na lageru
            </h2>
            <button
              type="button"
              onClick={addSize}
              className="inline-flex items-center gap-1 px-3 py-1 bg-stone-100 rounded-lg text-sm hover:bg-stone-200"
            >
              <Plus className="h-3 w-3" /> Dodaj veličinu
            </button>
          </div>
          {sizes.length === 0 ? (
            <p className="text-sm text-stone-500">
              Nema definisanih veličina. Kliknite &quot;Dodaj veličinu&quot; za
              dodavanje.
            </p>
          ) : (
            <div className="space-y-2">
              {sizes.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={s.size}
                    placeholder="Veličina (npr. 42, M, L)"
                    onChange={(e) => updateSize(i, "size", e.target.value)}
                    className="w-40 px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={s.stock}
                    min={0}
                    placeholder="Količina"
                    onChange={(e) =>
                      updateSize(i, "stock", parseInt(e.target.value) || 0)
                    }
                    className="w-24 px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                  <span className="text-xs text-stone-500">kom</span>
                  <button
                    type="button"
                    onClick={() => removeSize(i)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status flags */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Status</h2>
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
              <span className="text-sm text-stone-700">Aktivan</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm((f) => ({ ...f, featured: e.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-stone-700">Istaknuti</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.onSale}
                onChange={(e) =>
                  setForm((f) => ({ ...f, onSale: e.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-stone-700">Na akciji</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.novo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, novo: e.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-stone-700">Novo</span>
            </label>
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">SEO</h2>
          <div className="grid grid-cols-1 gap-4">
            <LocalizedInput
              label="Meta naslov"
              name="metaTitle"
              value={form.metaTitle}
              onChange={(v) => setForm((f) => ({ ...f, metaTitle: v }))}
            />
            <LocalizedTextarea
              label="Meta opis"
              name="metaDescription"
              value={form.metaDescription}
              onChange={(v) => setForm((f) => ({ ...f, metaDescription: v }))}
              rows={2}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 font-medium"
          >
            {isSaving
              ? "Čuvanje..."
              : isEditing
                ? "Sačuvaj izmene"
                : "Kreiraj proizvod"}
          </button>
          <Link
            href="/admin/products"
            className="px-8 py-3 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200"
          >
            Otkaži
          </Link>
        </div>
      </form>
    </div>
  );
}
