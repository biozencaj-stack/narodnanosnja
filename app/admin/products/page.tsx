"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { parseLocalized } from "@/lib/i18n/localized";
import {
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Tag,
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  salePrice: number | null;
  image1: string | null;
  active: boolean;
  featured: boolean;
  onSale: boolean;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  sizes: { id: string; size: string; stock: number }[];
  _count: { orderItems: number; reviews: number };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Da li ste sigurni da želite da arhivirate ovaj proizvod?"))
      return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchProducts();
      else alert("Greška pri arhiviranju");
    } catch {
      alert("Greška pri arhiviranju");
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) fetchProducts();
      else {
        const error = await res.json();
        alert(error.error || "Status proizvoda nije moguće promeniti");
      }
    } catch {
      console.error("Toggle failed");
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("sr-RS").format(price) + " RSD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900">
            Proizvodi
          </h1>
          <p className="text-stone-600">Ukupno: {total} proizvoda</p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white
                     rounded-lg hover:bg-stone-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novi proizvod
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
        <input
          type="text"
          placeholder="Pretraži po nazivu ili šifri..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg"
        />
      </div>

      {/* Products table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nema proizvoda
          </h2>
          <p className="text-stone-500 mb-4">Dodajte prvi proizvod</p>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg"
          >
            <Plus className="h-4 w-4" />
            Novi proizvod
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Proizvod
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Kategorija
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Cena
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Stanje
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.image1 ? (
                        <img
                          src={product.image1}
                          alt={parseLocalized(product.name).sr || parseLocalized(product.name).en}
                          className="h-12 w-12 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-stone-100 rounded-lg" />
                      )}
                      <div>
                        <p className="font-medium text-stone-900">
                          {parseLocalized(product.name).sr || parseLocalized(product.name).en}
                        </p>
                        {product.sku && (
                          <p className="text-xs text-stone-400">
                            SKU: {product.sku}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {product.category ? parseLocalized(product.category.name).sr || parseLocalized(product.category.name).en : "-"}
                    {product.brand && (
                      <span className="block text-xs text-stone-400">
                        {parseLocalized(product.brand.name).sr || parseLocalized(product.brand.name).en}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-stone-900">
                      {formatPrice(product.price)}
                    </span>
                    {product.salePrice && (
                      <span className="block text-red-600 text-xs">
                        {formatPrice(product.salePrice)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {product.sizes.reduce((sum, s) => sum + s.stock, 0)} kom
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {product.active ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          Aktivan
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-xs rounded-full">
                          Neaktivan
                        </span>
                      )}
                      {product.featured && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      )}
                      {product.onSale && (
                        <Tag className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleActive(product.id, product.active)}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                        title={product.active ? "Deaktiviraj" : "Aktiviraj"}
                      >
                        {product.active ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-stone-400" />
                        )}
                      </button>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                        title="Arhiviraj proizvod"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200">
              <p className="text-sm text-stone-600">
                Strana {page} od {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  Prethodna
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  Sledeća
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
