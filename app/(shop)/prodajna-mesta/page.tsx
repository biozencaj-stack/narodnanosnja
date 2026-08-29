import { MapPin, Phone, Clock, Mail } from "lucide-react";
import { prisma } from "@/lib/db";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { storeCapabilities } from "@/lib/config/capabilities";

export const metadata: Metadata = {
  title: "Prodajna mesta",
  description: "Posetite nas u jednoj od naših prodavnica",
};

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  if (!storeCapabilities.storeLocations) notFound();

  const locations = await prisma.storeLocation.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="container-wide py-5 lg:py-6">
          <nav className="flex items-center gap-2 text-sm text-stone-400 mb-3">
            <a href="/" className="hover:text-stone-700 transition-colors">Početna</a>
            <span>/</span>
            <span className="text-stone-700 font-medium">Prodajna mesta</span>
          </nav>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-stone-900 tracking-tight">
            Prodajna mesta
          </h1>
          <p className="text-stone-500 mt-1 text-sm lg:text-base">
            {locations.length > 0
              ? `Posetite nas u jednoj od naših ${locations.length} prodavnica`
              : "Pronađite nas"}
          </p>
        </div>
      </div>

      <div className="container-wide py-8 lg:py-12">
        {locations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <div
                key={location.id}
                className="bg-white rounded-xl border border-stone-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-stone-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">{location.name}</h3>
                    <p className="text-sm text-stone-500">{location.address}, {location.city}</p>
                  </div>
                </div>

                <div className="space-y-2.5 ml-[52px]">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-stone-400 shrink-0" />
                    <p className="text-sm text-stone-600">{location.hours}</p>
                  </div>
                  {location.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-stone-400 shrink-0" />
                      <a
                        href={`tel:${location.phone.replace(/\s/g, "")}`}
                        className="text-sm text-stone-900 font-medium hover:underline"
                      >
                        {location.phone}
                      </a>
                    </div>
                  )}
                  {location.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-stone-400 shrink-0" />
                      <a
                        href={`mailto:${location.email}`}
                        className="text-sm text-stone-900 font-medium hover:underline"
                      >
                        {location.email}
                      </a>
                    </div>
                  )}
                </div>

                {location.mapUrl && (
                  <div className="mt-4 ml-[52px]">
                    <a
                      href={location.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Prikaži na mapi
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <MapPin className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-stone-700 mb-2">
              Uskoro
            </h2>
            <p className="text-stone-500 max-w-md mx-auto">
              Informacije o prodajnim mestima biće uskoro dostupne.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
