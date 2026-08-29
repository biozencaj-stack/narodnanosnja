"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { User, Lock, Bell, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<"profile" | "password" | "notifications">("profile");
  const [loading, setLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [savingNewsletter, setSavingNewsletter] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setProfileData({
            firstName: data.user.firstName || "",
            lastName: data.user.lastName || "",
            phone: data.user.phone || "",
          });
          setNewsletterOptIn(data.user.newsletterOptIn || false);
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [session]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Profil uspešno ažuriran" });
        await update();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Greška pri ažuriranju" });
      }
    } catch {
      setMessage({ type: "error", text: "Greška pri ažuriranju profila" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Lozinke se ne poklapaju" });
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Lozinka uspešno promenjena" });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Greška pri promeni lozinke" });
      }
    } catch {
      setMessage({ type: "error", text: "Greška pri promeni lozinke" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewsletterToggle = async (checked: boolean) => {
    setSavingNewsletter(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterOptIn: checked }),
      });

      if (res.ok) {
        setNewsletterOptIn(checked);
        setMessage({
          type: "success",
          text: checked ? "Pretplaćeni ste na newsletter" : "Odjavljeni ste sa newsletter-a"
        });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Greška pri ažuriranju" });
      }
    } catch {
      setMessage({ type: "error", text: "Greška pri ažuriranju podešavanja" });
    } finally {
      setSavingNewsletter(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Profil", icon: User },
    { id: "password" as const, label: "Lozinka", icon: Lock },
    { id: "notifications" as const, label: "Obaveštenja", icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Podešavanja</h1>
        <p className="text-stone-600 mt-1">Upravljajte podešavanjima vašeg naloga</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-stone-200">
          <nav className="flex gap-4 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMessage(null);
                }}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-stone-900 text-stone-900"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={session?.user?.email || ""}
                  disabled
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg bg-stone-50 text-stone-500"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Email adresa se ne može promeniti
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Ime
                  </label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) =>
                      setProfileData((p) => ({ ...p, firstName: e.target.value }))
                    }
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg
                               focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Prezime
                  </label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) =>
                      setProfileData((p) => ({ ...p, lastName: e.target.value }))
                    }
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg
                               focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder="+381 60 123 4567"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-stone-900 text-white rounded-lg
                           hover:bg-stone-800 disabled:opacity-50 transition-colors
                           flex items-center gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Sačuvaj izmene
              </button>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Trenutna lozinka
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData((p) => ({ ...p, currentPassword: e.target.value }))
                  }
                  required
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Nova lozinka
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((p) => ({ ...p, newPassword: e.target.value }))
                  }
                  required
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Min 8 karaktera, veliko slovo, broj i specijalni znak
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Potvrdite novu lozinku
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))
                  }
                  required
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg
                             focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-stone-900 text-white rounded-lg
                           hover:bg-stone-800 disabled:opacity-50 transition-colors
                           flex items-center gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Promeni lozinku
              </button>
            </form>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-4 max-w-md">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg cursor-not-allowed opacity-60">
                  <input type="checkbox" defaultChecked disabled className="rounded" />
                  <div>
                    <p className="font-medium text-stone-900">Status porudžbine</p>
                    <p className="text-sm text-stone-500">
                      Primajte email kada se status porudžbine promeni
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-4 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors ${savingNewsletter ? 'opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={newsletterOptIn}
                    onChange={(e) => handleNewsletterToggle(e.target.checked)}
                    disabled={savingNewsletter}
                    className="rounded accent-primary h-4 w-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-stone-900">Newsletter</p>
                    <p className="text-sm text-stone-500">
                      Primajte informacije o akcijama, novostima i specijalnim ponudama
                    </p>
                  </div>
                  {savingNewsletter && (
                    <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                  )}
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
