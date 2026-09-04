import { zahtevajAdminaNaStranici } from "@/lib/auth/admin-stranica";
import { EkranMedijateke } from "@/components/admin/EkranMedijateke";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Medijateka | Admin",
};

export default async function AdminMedijatekaPage() {
  await zahtevajAdminaNaStranici("/admin/medijateka");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-900">
          Medijateka
        </h1>
        <p className="text-sm text-stone-500">
          Slike otpremljene za sekcije stranica. Slika koja je u upotrebi ne
          može se obrisati dok se ne ukloni iz sekcija koje je koriste.
        </p>
      </div>

      <EkranMedijateke />
    </div>
  );
}
