import { prisma } from "@/lib/db";
import Link from "next/link";
import { User, Shield, ShoppingBag } from "lucide-react";

// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Korisnici | Admin",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    role?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const role = params.role as "ADMIN" | "OPERATOR" | "CUSTOMER" | undefined;
  const perPage = 20;

  const where = role ? { role } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
      include: {
        _count: {
          select: { orders: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  const roles = [
    { value: "", label: "Svi" },
    { value: "CUSTOMER", label: "Kupci" },
    { value: "OPERATOR", label: "Operateri" },
    { value: "ADMIN", label: "Admini" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900">Korisnici</h1>
          <p className="text-stone-600">Ukupno {total} korisnika</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <Link
              key={r.value}
              href={`/admin/users${r.value ? `?role=${r.value}` : ""}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                role === r.value || (!role && !r.value)
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Korisnik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Uloga
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Porudžbine
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Registrovan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-stone-500" />
                      </div>
                      <div>
                        <p className="font-medium text-stone-900">
                          {user.firstName} {user.lastName}
                        </p>
                        {user.phone && (
                          <p className="text-sm text-stone-500">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-stone-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                        user.role === "ADMIN"
                          ? "text-purple-700 bg-purple-100"
                          : user.role === "OPERATOR"
                          ? "text-amber-700 bg-amber-100"
                          : "text-blue-700 bg-blue-100"
                      }`}
                    >
                      {user.role === "ADMIN" && <Shield className="h-3 w-3" />}
                      {user.role === "ADMIN" ? "Admin" : user.role === "OPERATOR" ? "Operater" : "Kupac"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-stone-600">
                      <ShoppingBag className="h-4 w-4" />
                      {user._count.orders}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-stone-500">
                    {new Date(user.createdAt).toLocaleDateString("sr-RS")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between">
            <p className="text-sm text-stone-600">
              Stranica {page} od {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/users?page=${page - 1}${
                    role ? `&role=${role}` : ""
                  }`}
                  className="px-4 py-2 text-sm bg-stone-100 rounded-lg hover:bg-stone-200"
                >
                  Prethodna
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/users?page=${page + 1}${
                    role ? `&role=${role}` : ""
                  }`}
                  className="px-4 py-2 text-sm bg-stone-100 rounded-lg hover:bg-stone-200"
                >
                  Sledeća
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
