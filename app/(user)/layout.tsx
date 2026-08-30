import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { User, Package, MapPin, Settings, LogOut, ArrowLeft, Heart, Shield } from "lucide-react";
import { storeCapabilities } from "@/lib/config/capabilities";
import { UnverifiedEmailNotice } from "./moj-nalog/UnverifiedEmailNotice";

const navItems = [
  { href: "/moj-nalog", label: "Pregled", icon: User },
  { href: "/moj-nalog/porudzbine", label: "Porudžbine", icon: Package },
  ...(storeCapabilities.wishlist
    ? [{ href: "/moj-nalog/favoriti", label: "Favoriti", icon: Heart }]
    : []),
  { href: "/moj-nalog/adrese", label: "Adrese", icon: MapPin },
  { href: "/moj-nalog/podesavanja", label: "Podešavanja", icon: Settings },
];

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/moj-nalog");
  }

  const initials = `${session.user.firstName?.[0] ?? ""}${session.user.lastName?.[0] ?? ""}`;

  return (
    <div className="min-h-screen bg-background-alt">
      <div className="container mx-auto px-4 py-8">
        {/* Mobile horizontal nav */}
        <div className="lg:hidden mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-text-muted hover:text-primary text-sm transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Početna
            </Link>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-border/50 p-3">
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary-dark text-white flex items-center justify-center text-sm font-bold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text truncate">
                  {session.user.firstName} {session.user.lastName}
                </p>
                <p className="text-xs text-text-light truncate">{session.user.email}</p>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted
                             hover:bg-primary-light hover:text-primary transition-colors whitespace-nowrap shrink-0"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:w-64 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-border/50 sticky top-8 overflow-hidden">
              <div className="p-5">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-text-muted hover:text-primary
                             transition-colors mb-6 text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Nazad na početnu
                </Link>

                <div className="mb-6 pb-6 border-b border-border">
                  <div className="w-14 h-14 rounded-xl bg-linear-to-br from-primary to-primary-dark text-white flex items-center justify-center text-lg font-bold mb-3 shadow-sm">
                    {initials}
                  </div>
                  <h2 className="font-semibold text-text">
                    {session.user.firstName} {session.user.lastName}
                  </h2>
                  <p className="text-sm text-text-light mt-0.5">{session.user.email}</p>
                </div>

                <nav className="space-y-0.5">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-muted
                                 hover:bg-primary-light hover:text-primary transition-colors"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </Link>
                  ))}

                  {(session.user.role === "ADMIN" || session.user.role === "OPERATOR") && (
                    <>
                      <div className="my-3 border-t border-border" />
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-primary
                                   hover:bg-primary-light transition-colors"
                      >
                        <Shield className="h-[18px] w-[18px]" />
                        Admin Panel
                      </Link>
                    </>
                  )}
                </nav>
              </div>

              <div className="border-t border-border">
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="flex items-center gap-3 px-8 py-3.5 text-sm text-error
                               hover:bg-error-light w-full text-left transition-colors"
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                    Odjava
                  </button>
                </form>
              </div>
            </div>
          </aside>

          <main id="glavni-sadrzaj" tabIndex={-1} className="flex-1 min-w-0">
            <UnverifiedEmailNotice
              show={session.user.requiresEmailVerification === true}
            />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
