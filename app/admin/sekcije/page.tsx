import { zahtevajAdminaNaStranici } from "@/lib/auth/admin-stranica";
import { EkranSekcija } from "@/components/admin/sekcije/EkranSekcija";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sekcije stranica | Admin",
};

export default async function AdminSekcijePage() {
  await zahtevajAdminaNaStranici("/admin/sekcije");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-900">
          Sekcije stranica
        </h1>
        <p className="text-sm text-stone-500">
          Slaganje početne strane. Izmene se čuvaju kao nacrt i ne vide se na
          sajtu dok se ne pritisne „Objavi stranicu”.
        </p>
      </div>

      <EkranSekcija pageKey="home" />
    </div>
  );
}
