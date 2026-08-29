"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Search, Check } from "lucide-react";
import Link from "next/link";
import { parseLocalized } from "@/lib/i18n/localized";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  image1: string | null;
  price: number;
  category: { name: string } | null;
  brand: { name: string } | null;
}

interface PromotionFormProps {
  promotionId?: string;
}

const PROMO_TYPES = [
  { value: "PERCENT_OFF", label: "Procenat popusta (%)" },
  { value: "FIXED_AMOUNT_OFF", label: "Fiksni iznos popusta (RSD)" },
  { value: "BUY_X_GET_Y_FREE", label: "Kupi X, sledeći gratis" },
  { value: "BUY_X_GET_PERCENT", label: "Kupi X, sledeći sa % popusta" },
  { value: "FREE_SHIPPING", label: "Besplatna dostava" },
  { value: "QUANTITY_DISCOUNT", label: "Stepenasti popust po količini" },
];

export default function PromotionForm({ promotionId }: PromotionFormProps) {
  const router = useRouter();
  const isEditing = !!promotionId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "PERCENT_OFF",
    value: "",
    minQuantity: "",
    minCartValue: "",
    maxUses: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    isActive: true,
    code: "",
    stackable: false,
  });

  const [quantityTiers, setQuantityTiers] = useState<{ qty: string; discount: string }[]>([]);

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState({
    categoryId: "",
    brandId: "",
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Fetch all products for the selector
  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (productSearch) params.set("search", productSearch);
      if (productFilter.categoryId)
        params.set("categoryId", productFilter.categoryId);
      if (productFilter.brandId) params.set("brandId", productFilter.brandId);
      const res = await fetch(`/api/admin/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAllProducts(data.products);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [productSearch, productFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch promotion if editing
  useEffect(() => {
    if (!promotionId) return;
    fetch(`/api/admin/promotions/${promotionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.promotion) {
          const p = data.promotion;
          setForm({
            name: p.name || "",
            description: p.description || "",
            type: p.type,
            value: String(p.value),
            minQuantity: p.minQuantity ? String(p.minQuantity) : "",
            minCartValue: p.minCartValue ? String(p.minCartValue) : "",
            maxUses: p.maxUses ? String(p.maxUses) : "",
            startDate: new Date(p.startDate).toISOString().split("T")[0],
            endDate: new Date(p.endDate).toISOString().split("T")[0],
            isActive: p.isActive,
            code: p.code || "",
            stackable: p.stackable,
          });
          if (p.quantityTiers && Array.isArray(p.quantityTiers)) {
            setQuantityTiers(p.quantityTiers.map((t: { qty: number; discount: number }) => ({ qty: String(t.qty), discount: String(t.discount) })));
          }
          setSelectedProductIds(
            new Set(
              p.products.map((pp: { productId: string }) => pp.productId),
            ),
          );
        }
      })
      .finally(() => setIsLoading(false));
  }, [promotionId]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedProductIds(new Set(allProducts.map((p) => p.id)));
  const deselectAll = () => setSelectedProductIds(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.value) {
      alert("Naziv i vrednost su obavezni");
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        value: parseFloat(form.value),
        minQuantity: form.minQuantity ? parseInt(form.minQuantity) : null,
        minCartValue: form.minCartValue ? parseFloat(form.minCartValue) : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.isActive,
        code: form.code || null,
        stackable: form.stackable,
        productIds: Array.from(selectedProductIds),
        quantityTiers: form.type === "QUANTITY_DISCOUNT"
          ? quantityTiers.filter(t => t.qty && t.discount).map(t => ({ qty: parseInt(t.qty), discount: parseFloat(t.discount) }))
          : null,
      };
      const url = isEditing
        ? `/api/admin/promotions/${promotionId}`
        : "/api/admin/promotions";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.push("/admin/promotions");
      else {
        const err = await res.json();
        alert(err.error || "Greška");
      }
    } catch {
      alert("Greška");
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
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link
          href="/admin/promotions"
          className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Nazad
        </Link>
        <h1 className="text-2xl font-display font-bold text-stone-900">
          {isEditing ? "Izmeni promociju" : "Nova promocija"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Osnovno</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Naziv promocije *</label>
              <input
                type="text"
                value={form.name}
                required
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Opis</label>
              <textarea
                value={form.description}
                rows={2}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className={inputCls + " resize-none"}
              />
            </div>
          </div>
        </div>

        {/* Type & Value */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Tip i vrednost</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tip promocije *</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
                className={inputCls}
              >
                {PROMO_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Vrednost *{" "}
                {form.type.includes("PERCENT")
                  ? "(%)"
                  : form.type === "FREE_SHIPPING"
                    ? "(0)"
                    : "(RSD)"}
              </label>
              <input
                type="number"
                step="0.01"
                value={form.value}
                required
                onChange={(e) =>
                  setForm((f) => ({ ...f, value: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            {(form.type === "BUY_X_GET_Y_FREE" ||
              form.type === "BUY_X_GET_PERCENT") && (
              <div>
                <label className={labelCls}>Minimalna količina (kupi X)</label>
                <input
                  type="number"
                  value={form.minQuantity}
                  placeholder="npr. 2"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minQuantity: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Min. vrednost korpe (RSD)</label>
              <input
                type="number"
                step="0.01"
                value={form.minCartValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minCartValue: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Kupon kod (opciono)</label>
              <input
                type="text"
                value={form.code}
                placeholder="npr. POPUST20"
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Max korišćenja</label>
              <input
                type="number"
                value={form.maxUses}
                placeholder="Neograničeno"
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxUses: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Quantity Tiers - only for QUANTITY_DISCOUNT */}
        {form.type === "QUANTITY_DISCOUNT" && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-stone-900">Stepenasti pragovi</h2>
                <p className="text-xs text-stone-500">Definišite popust za svaki prag količine</p>
              </div>
              <button type="button"
                onClick={() => setQuantityTiers([...quantityTiers, { qty: "", discount: "" }])}
                className="px-3 py-1 bg-stone-100 text-sm rounded-lg hover:bg-stone-200">
                + Dodaj prag
              </button>
            </div>
            {quantityTiers.length === 0 ? (
              <p className="text-sm text-stone-500">Dodajte pragove (npr. 2 artikla = 5%, 3 artikla = 10%)</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-stone-500">
                  <span>Količina (min artikala)</span>
                  <span>Popust (%)</span>
                  <span></span>
                </div>
                {quantityTiers.map((tier, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 items-center">
                    <input type="number" value={tier.qty} placeholder="npr. 2" min={1}
                      onChange={(e) => setQuantityTiers(quantityTiers.map((t, idx) => idx === i ? { ...t, qty: e.target.value } : t))}
                      className="px-3 py-2 border border-stone-300 rounded-lg text-sm" />
                    <input type="number" value={tier.discount} placeholder="npr. 5" min={1} max={100} step="0.5"
                      onChange={(e) => setQuantityTiers(quantityTiers.map((t, idx) => idx === i ? { ...t, discount: e.target.value } : t))}
                      className="px-3 py-2 border border-stone-300 rounded-lg text-sm" />
                    <button type="button" onClick={() => setQuantityTiers(quantityTiers.filter((_, idx) => idx !== i))}
                      className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm">Ukloni</button>
                  </div>
                ))}
                {quantityTiers.length > 0 && (
                  <div className="p-3 bg-stone-50 rounded-lg text-sm text-stone-600">
                    <strong>Preview:</strong>{" "}
                    {quantityTiers.filter(t => t.qty && t.discount).map(t => `Kupi ${t.qty}+ = ${t.discount}%`).join(" | ")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Period */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Period trajanja</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Datum početka *</label>
              <input
                type="date"
                value={form.startDate}
                required
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Datum završetka *</label>
              <input
                type="date"
                value={form.endDate}
                required
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-stone-700">Aktivna</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.stackable}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stackable: e.target.checked }))
                }
                className="rounded"
              />
              <span className="text-sm text-stone-700">
                Može se kombinovati (stacking)
              </span>
            </label>
          </div>
        </div>

        {/* Product selector */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-stone-900">
                Proizvodi na akciji
              </h2>
              <p className="text-xs text-stone-500">
                Prazno = primenjuje se na sve proizvode. Izaberite specifične za
                ciljanu akciju.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1 bg-stone-100 text-xs rounded-lg hover:bg-stone-200"
              >
                Izaberi sve
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-3 py-1 bg-stone-100 text-xs rounded-lg hover:bg-stone-200"
              >
                Poništi izbor
              </button>
            </div>
          </div>
          <p className="text-sm text-stone-600">
            Izabrano: <strong>{selectedProductIds.size}</strong> proizvoda
          </p>

          {/* Search & Filter */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={productSearch}
                placeholder="Pretraži proizvode..."
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Product list */}
          <div className="max-h-80 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
            {isLoadingProducts ? (
              <div className="p-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-stone-400" />
              </div>
            ) : allProducts.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-500">
                Nema proizvoda
              </div>
            ) : (
              allProducts.map((product) => {
                const isSelected = selectedProductIds.has(product.id);
                return (
                  <label
                    key={product.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50 ${isSelected ? "bg-green-50" : ""}`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                      ${isSelected ? "bg-green-600 border-green-600" : "border-stone-300"}`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProduct(product.id)}
                      className="hidden"
                    />
                    {product.image1 ? (
                      <img
                        src={product.image1}
                        alt=""
                        className="h-8 w-8 object-cover rounded"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-stone-100 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {parseLocalized(product.name).sr || parseLocalized(product.name).en}
                      </p>
                      <p className="text-xs text-stone-500">
                        {product.sku || "Bez SKU"} |{" "}
                        {product.category ? parseLocalized(product.category.name).sr || parseLocalized(product.category.name).en : "Bez kat."} |{" "}
                        {product.brand ? parseLocalized(product.brand.name).sr || parseLocalized(product.brand.name).en : ""}
                      </p>
                    </div>
                    <span className="text-sm text-stone-600 flex-shrink-0">
                      {new Intl.NumberFormat("sr-RS").format(product.price)} RSD
                    </span>
                  </label>
                );
              })
            )}
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
                ? "Sačuvaj"
                : "Kreiraj promociju"}
          </button>
          <Link
            href="/admin/promotions"
            className="px-8 py-3 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200"
          >
            Otkaži
          </Link>
        </div>
      </form>
    </div>
  );
}
