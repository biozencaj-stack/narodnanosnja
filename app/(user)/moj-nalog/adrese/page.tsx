"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MapPin, Plus, Trash2, Star, Loader2 } from "lucide-react";

interface Address {
  id: string;
  street: string;
  apartment: string | null;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export default function AddressesPage() {
  const { data: session } = useSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    street: "",
    apartment: "",
    city: "",
    postalCode: "",
    isDefault: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const res = await fetch("/api/user/addresses");
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses);
      }
    } catch (error) {
      console.error("Failed to fetch addresses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/user/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({
          street: "",
          apartment: "",
          city: "",
          postalCode: "",
          isDefault: false,
        });
        fetchAddresses();
      }
    } catch (error) {
      console.error("Failed to save address:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!confirm("Da li ste sigurni da želite da obrišete ovu adresu?")) {
      return;
    }

    try {
      const res = await fetch(`/api/user/addresses/${addressId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchAddresses();
      }
    } catch (error) {
      console.error("Failed to delete address:", error);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      const res = await fetch(`/api/user/addresses/${addressId}/default`, {
        method: "PUT",
      });

      if (res.ok) {
        fetchAddresses();
      }
    } catch (error) {
      console.error("Failed to set default address:", error);
    }
  };

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
          <h1 className="text-2xl font-bold text-stone-900">Moje adrese</h1>
          <p className="text-stone-600 mt-1">
            Upravljajte adresama za dostavu
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white
                     rounded-lg hover:bg-stone-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova adresa
        </button>
      </div>

      {/* Add address form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-stone-900 mb-4">Nova adresa</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Ulica i broj *
                </label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, street: e.target.value }))
                  }
                  required
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Stan/Apartman
                </label>
                <input
                  type="text"
                  value={formData.apartment}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, apartment: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Grad *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, city: e.target.value }))
                  }
                  required
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Poštanski broj *
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, postalCode: e.target.value }))
                  }
                  required
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, isDefault: e.target.checked }))
                }
                className="rounded border-stone-300"
              />
              <span className="text-sm text-stone-700">
                Postavi kao podrazumevanu adresu
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-stone-900 text-white rounded-lg
                           hover:bg-stone-800 disabled:opacity-50 transition-colors"
              >
                {isSaving ? "Čuvanje..." : "Sačuvaj"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-stone-100 text-stone-700 rounded-lg
                           hover:bg-stone-200 transition-colors"
              >
                Otkaži
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Addresses list */}
      {addresses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <MapPin className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nemate sačuvane adrese
          </h2>
          <p className="text-stone-500 mb-6">
            Dodajte adresu za bržu kupovinu
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`bg-white rounded-xl shadow-sm p-6 relative ${
                address.isDefault ? "ring-2 ring-stone-900" : ""
              }`}
            >
              {address.isDefault && (
                <div className="absolute top-4 right-4 flex items-center gap-1 text-xs text-stone-900 bg-stone-100 px-2 py-1 rounded-full">
                  <Star className="h-3 w-3 fill-current" />
                  Podrazumevana
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-stone-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-stone-900">{address.street}</p>
                  {address.apartment && (
                    <p className="text-stone-600">{address.apartment}</p>
                  )}
                  <p className="text-stone-600">
                    {address.postalCode} {address.city}
                  </p>
                  <p className="text-stone-600">{address.country}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-stone-100 flex gap-3">
                {!address.isDefault && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    className="text-sm text-stone-600 hover:text-stone-900"
                  >
                    Postavi kao podrazumevanu
                  </button>
                )}
                <button
                  onClick={() => handleDelete(address.id)}
                  className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Obriši
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
