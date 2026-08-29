'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Eye, EyeOff, MapPin, Pencil } from 'lucide-react';

interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  hours: string;
  mapUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = {
  name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  hours: '',
  mapUrl: '',
};

export default function StoreLocationsAdminPage() {
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/admin/store-locations');
      const data = await res.json();
      if (data.locations) setLocations(data.locations);
    } catch {
      setError('Greška pri učitavanju lokacija');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.address || !form.city || !form.hours) {
      setError('Naziv, adresa, grad i radno vreme su obavezni');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/admin/store-locations/${editingId}`
        : '/api/admin/store-locations';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setForm(emptyForm);
        setShowForm(false);
        setEditingId(null);
        fetchLocations();
      } else {
        const data = await res.json();
        setError(data.error || 'Greška pri čuvanju');
      }
    } catch {
      setError('Greška pri povezivanju sa serverom');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (loc: StoreLocation) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      phone: loc.phone || '',
      email: loc.email || '',
      hours: loc.hours,
      mapUrl: loc.mapUrl || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Da li ste sigurni da želite da obrišete ovu lokaciju?')) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/store-locations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLocations();
      } else {
        const data = await res.json();
        setError(data.error || 'Greška pri brisanju');
      }
    } catch {
      setError('Greška pri brisanju');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await fetch(`/api/admin/store-locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      fetchLocations();
    } catch {
      setError('Greška pri promeni statusa');
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Prodajna Mesta</h1>
          <p className="text-text-muted mt-1">
            Upravljajte lokacijama vaših prodavnica.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova lokacija
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-5 h-5" /></button>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-lg text-stone-900 mb-4">
            {editingId ? 'Izmeni lokaciju' : 'Nova lokacija'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Naziv *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="npr. DemoShop Beograd Centar"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Grad *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="npr. Beograd"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1">Adresa *</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="npr. Knez Mihailova 25"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Radno vreme *</label>
              <input
                type="text"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                placeholder="npr. Pon-Pet: 09-21h; Sub: 09-15h"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Telefon</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="npr. 011 123 4567"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="npr. beograd@demoshop.rs"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Google Maps URL</label>
              <input
                type="url"
                value={form.mapUrl}
                onChange={(e) => setForm({ ...form, mapUrl: e.target.value })}
                placeholder="https://maps.google.com/..."
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
            <button
              onClick={cancelForm}
              className="px-5 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Otkaži
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {locations.length === 0 ? (
          <div className="text-center py-16 bg-stone-50 rounded-xl">
            <MapPin className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Nema prodajnih mesta. Dodajte prvo.</p>
          </div>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.id}
              className={`bg-white border border-stone-200 rounded-xl p-5 shadow-sm transition-opacity ${
                !loc.isActive ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <MapPin className="h-5 w-5 text-stone-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-stone-900">{loc.name}</h3>
                    <p className="text-sm text-stone-600">{loc.address}, {loc.city}</p>
                    <p className="text-sm text-stone-500 mt-1">{loc.hours}</p>
                    {loc.phone && <p className="text-sm text-stone-500">Tel: {loc.phone}</p>}
                    {loc.email && <p className="text-sm text-stone-500">Email: {loc.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(loc)}
                    className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
                    title="Izmeni"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(loc.id, loc.isActive)}
                    className={`p-2 rounded-lg transition-colors ${
                      loc.isActive ? 'text-green-600 hover:bg-green-50' : 'text-stone-400 hover:bg-stone-100'
                    }`}
                    title={loc.isActive ? 'Aktivna' : 'Neaktivna'}
                  >
                    {loc.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Obriši"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
