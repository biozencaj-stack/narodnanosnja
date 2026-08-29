"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Contact,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Search,
  Store,
  Truck,
} from "lucide-react";
import {
  builtInStoreSettings,
  storeSettingFields,
  validateStoreThemeContrast,
  type StoreSettingField,
  type StoreSettingsMap,
} from "@/lib/config/store-settings-schema";
import { cn } from "@/lib/utils";

type TabId = "general" | "appearance" | "operations" | "seo";

const tabs: { id: TabId; label: string; description: string; icon: typeof Store }[] = [
  { id: "general", label: "Opšte", description: "Identitet, kontakt i društvene mreže", icon: Store },
  { id: "appearance", label: "Izgled", description: "Paleta i vizuelni identitet", icon: Palette },
  { id: "operations", label: "Prodaja i dostava", description: "Pravila porudžbine i isporuke", icon: Truck },
  { id: "seo", label: "SEO", description: "Podrazumevani prikaz u pretrazi", icon: Search },
];

const fieldsForTab: Record<TabId, StoreSettingField["group"][]> = {
  general: ["general", "contact"],
  appearance: ["appearance"],
  operations: ["operations"],
  seo: ["seo"],
};

export function StoreSettingsPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [values, setValues] = useState<StoreSettingsMap>(builtInStoreSettings);
  const [savedValues, setSavedValues] = useState<StoreSettingsMap>(builtInStoreSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Podešavanja nisu dostupna");
        return response.json();
      })
      .then((data) => {
        const next = { ...builtInStoreSettings, ...(data.settings || {}) };
        setValues(next);
        setSavedValues(next);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedValues),
    [savedValues, values],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const visibleFields = storeSettingFields.filter((field) =>
    fieldsForTab[activeTab].includes(field.group),
  );

  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key.startsWith("theme.")) {
        for (const errorKey of Object.keys(next)) {
          if (errorKey.startsWith("theme.")) delete next[errorKey];
        }
      }
      return next;
    });
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setErrors({});
    try {
      const contrastErrors = validateStoreThemeContrast(values);
      if (Object.keys(contrastErrors).length > 0) {
        setErrors(contrastErrors);
        setActiveTab("appearance");
        setMessage("Proverite kontrast označenih boja.");
        window.setTimeout(() => {
          const firstKey = Object.keys(contrastErrors)[0];
          document
            .getElementById(`setting-${firstKey.replace(/\./g, "-")}`)
            ?.focus();
        });
        return;
      }

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values }),
      });
      const data = await response.json();
      if (!response.ok) {
        const responseErrors = data.errors || {};
        setErrors(responseErrors);
        const firstField = storeSettingFields.find((field) => responseErrors[field.key]);
        if (firstField) {
          const targetTab = (Object.keys(fieldsForTab) as TabId[]).find((tabId) =>
            fieldsForTab[tabId].includes(firstField.group),
          );
          if (targetTab) setActiveTab(targetTab);
          window.setTimeout(() => {
            document
              .getElementById(`setting-${firstField.key.replace(/\./g, "-")}`)
              ?.focus();
          });
        }
        throw new Error(data.error || "Podešavanja nisu sačuvana");
      }
      const next = { ...values, ...(data.settings || {}) };
      setValues(next);
      setSavedValues(next);
      setMessage("Podešavanja su sačuvana i odmah primenjena.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Došlo je do greške");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Učitavanje" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Store className="h-4 w-4" /> Konfiguracioni centar
          </div>
          <h1 className="font-display text-3xl font-bold text-text">Prodavnica i identitet</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Promenite brend i osnovni vizuelni jezik bez izmene koda ili novog deploya.
            Tajne za bazu, email i plaćanje ostaju bezbedno u okruženju servera.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs font-medium text-amber-700">Nesačuvane izmene</span>}
          <button
            type="button"
            onClick={() => setValues(savedValues)}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-muted transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" /> Poništi
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sačuvaj
          </button>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            Object.keys(errors).length === 0 && !message.includes("grešk") && !message.includes("nisu")
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          {Object.keys(errors).length === 0 && <Check className="h-4 w-4" />}
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="h-fit rounded-2xl border border-border bg-white p-2 shadow-sm" aria-label="Grupe podešavanja">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition",
                  active ? "bg-primary-light text-primary" : "text-text-muted hover:bg-background-alt hover:text-text",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-bold">{tab.label}</span>
                  <span className="mt-0.5 block text-xs font-normal opacity-70">{tab.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className={cn("grid gap-6", activeTab === "appearance" && "xl:grid-cols-[minmax(0,1fr)_360px]") }>
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex items-center gap-3 border-b border-border pb-5">
              {activeTab === "general" ? <Contact className="h-5 w-5 text-primary" /> : activeTab === "appearance" ? <Palette className="h-5 w-5 text-primary" /> : activeTab === "operations" ? <Truck className="h-5 w-5 text-primary" /> : <Search className="h-5 w-5 text-primary" />}
              <div>
                <h2 className="font-display text-xl font-bold text-text">{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
                <p className="text-xs text-text-muted">{tabs.find((tab) => tab.id === activeTab)?.description}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {visibleFields.map((field) => {
                const value = values[field.key] ?? "";
                const id = `setting-${field.key.replace(/\./g, "-")}`;
                const descriptionId = field.description ? `${id}-description` : undefined;
                const errorId = errors[field.key] ? `${id}-error` : undefined;
                const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
                const wide = field.type === "textarea" || field.group === "general";
                return (
                  <div key={field.key} className={cn(wide && "md:col-span-2")}>
                    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-text">
                      {field.label}{field.required ? " *" : ""}
                    </label>
                    {field.description && <p id={descriptionId} className="mb-2 text-xs text-text-muted">{field.description}</p>}
                    {field.type === "textarea" ? (
                      <textarea
                        id={id}
                        rows={4}
                        value={value}
                        maxLength={field.maxLength}
                        required={field.required}
                        aria-invalid={Boolean(errors[field.key])}
                        aria-describedby={describedBy}
                        onChange={(event) => update(field.key, event.target.value)}
                        className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    ) : field.type === "color" ? (
                      <div className="flex gap-2">
                        <input
                          id={id}
                          type="color"
                          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                          onChange={(event) => update(field.key, event.target.value)}
                          required={field.required}
                          aria-invalid={Boolean(errors[field.key])}
                          aria-describedby={describedBy}
                          className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-white p-1"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(event) => update(field.key, event.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 font-mono text-sm uppercase text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                          aria-label={`${field.label} HEX vrednost`}
                          required={field.required}
                          aria-invalid={Boolean(errors[field.key])}
                          aria-describedby={describedBy}
                        />
                      </div>
                    ) : (
                      <input
                        id={id}
                        type={field.type}
                        value={value}
                        maxLength={field.maxLength}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        required={field.required}
                        aria-invalid={Boolean(errors[field.key])}
                        aria-describedby={describedBy}
                        onChange={(event) => update(field.key, event.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    )}
                    {errors[field.key] && <p id={errorId} className="mt-1.5 text-xs font-medium text-red-700">{errors[field.key]}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          {activeTab === "appearance" && (
            <aside className="h-fit rounded-2xl border border-border bg-white p-5 shadow-sm xl:sticky xl:top-8">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-text-muted">Pregled uživo</p>
              <div
                className="overflow-hidden rounded-2xl border p-5"
                style={{
                  background: values["theme.background"],
                  borderColor: values["theme.border"],
                  color: values["theme.text"],
                }}
              >
                <div className="mb-7 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-white" style={{ background: values["theme.primary"] }}>✦</span>
                  <div>
                    <p className="font-display text-lg font-bold">{values["store.name"]}</p>
                    <p className="text-xs" style={{ color: values["theme.textMuted"] }}>{values["store.tagline"]}</p>
                  </div>
                </div>
                <div className="rounded-xl border p-4" style={{ background: values["theme.surface"], borderColor: values["theme.border"] }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: values["theme.accent"] }}>Izdvojeno</span>
                  <h3 className="mt-2 font-display text-xl font-bold">Proizvod koji ima priču</h3>
                  <p className="mt-2 text-sm" style={{ color: values["theme.textMuted"] }}>Paleta se primenjuje na ceo storefront kao semantička tema.</p>
                  <button type="button" className="mt-5 rounded-full px-5 py-2 text-sm font-bold text-white" style={{ background: values["theme.primary"] }}>Pogledaj ponudu</button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
