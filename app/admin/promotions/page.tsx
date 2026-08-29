"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Percent,
  Tag,
  Gift,
  Truck,
  Clock,
} from "lucide-react";

const TYPE_LABELS: Record<string, { label: string; icon: typeof Percent }> = {
  PERCENT_OFF: { label: "% Popust", icon: Percent },
  FIXED_AMOUNT_OFF: { label: "Fiksni popust", icon: Tag },
  BUY_X_GET_Y_FREE: { label: "Kupi X, Y gratis", icon: Gift },
  BUY_X_GET_PERCENT: { label: "Kupi X, sledeći %", icon: Gift },
  FREE_SHIPPING: { label: "Besplatna dostava", icon: Truck },
};

interface PromotionItem {
  id: string;
  name: string;
  type: string;
  value: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  code: string | null;
  stackable: boolean;
  _count: { usages: number };
  products: { product: { id: string; name: string } }[];
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPromotions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promotions");
      if (res.ok) {
        const data = await res.json();
        setPromotions(data.promotions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Da li ste sigurni?")) return;
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchPromotions();
    } catch {
      alert("Greška");
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/promotions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchPromotions();
    } catch {
      console.error("Toggle failed");
    }
  };

  const getStatus = (p: PromotionItem) => {
    const now = new Date();
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    if (!p.isActive)
      return { label: "Neaktivna", cls: "bg-stone-100 text-stone-600" };
    if (now < start)
      return { label: "Zakazana", cls: "bg-blue-100 text-blue-700" };
    if (now > end) return { label: "Istekla", cls: "bg-red-100 text-red-700" };
    return { label: "Aktivna", cls: "bg-green-100 text-green-700" };
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("sr-RS");

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
            Promocije i popusti
          </h1>
          <p className="text-stone-600">
            Upravljajte akcijama, kuponima i bundle ponudama
          </p>
        </div>
        <Link
          href="/admin/promotions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" /> Nova promocija
        </Link>
      </div>

      {promotions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Percent className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nema promocija
          </h2>
          <p className="text-stone-500 mb-4">Kreirajte prvu promociju</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Promocija
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Tip
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Vrednost
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Period
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Proizvoda
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {promotions.map((promo) => {
                const status = getStatus(promo);
                const typeInfo = TYPE_LABELS[promo.type] || {
                  label: promo.type,
                  icon: Percent,
                };
                const TypeIcon = typeInfo.icon;
                return (
                  <tr key={promo.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{promo.name}</p>
                      {promo.code && (
                        <p className="text-xs text-stone-500">
                          Kod: {promo.code}
                        </p>
                      )}
                      {promo.stackable && (
                        <span className="text-xs text-blue-600">Stackable</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-stone-600">
                        <TypeIcon className="h-3.5 w-3.5" /> {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-stone-900">
                      {promo.type === "PERCENT_OFF" ||
                      promo.type === "BUY_X_GET_PERCENT"
                        ? `${promo.value}%`
                        : promo.type === "FREE_SHIPPING"
                          ? "Besplatno"
                          : `${promo.value} RSD`}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(promo.startDate)} -{" "}
                        {formatDate(promo.endDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(promo.id, promo.isActive)}
                        className={`px-2 py-0.5 text-xs rounded-full ${status.cls}`}
                      >
                        {status.label}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600">
                      {promo.products.length === 0
                        ? "Svi"
                        : promo.products.length}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/promotions/${promo.id}`}
                          className="p-2 hover:bg-stone-100 rounded-lg"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Link>
                        <button
                          onClick={() => handleDelete(promo.id)}
                          className="p-2 hover:bg-stone-100 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
