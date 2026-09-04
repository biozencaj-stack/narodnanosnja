"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowLeft,
  BarChart3,
  FileText,
  FolderTree,
  ImageIcon,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Package,
  Palette,
  Percent,
  Settings,
  ShoppingBag,
  Tag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  iconName: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface AdminShellProps {
  children: React.ReactNode;
  navGroups: NavGroup[];
  userEmail: string;
  userRole: string;
}

const ADMIN_ICONS: Record<string, LucideIcon> = {
  BarChart3,
  FileText,
  FolderTree,
  ImageIcon,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Package,
  Palette,
  Percent,
  Settings,
  ShoppingBag,
  Tag,
  Users,
};

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ADMIN_ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function AdminShell({ children, navGroups, userEmail, userRole }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const activeHref = navGroups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) =>
      href === "/admin"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`)
    )
    .sort((first, second) => second.length - first.length)[0];

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-border">
        <Link href="/" className="block mb-5" onClick={() => setSidebarOpen(false)}>
          <Image src="/logo.svg" alt="Store" width={110} height={32} style={{ width: "auto", height: "28px" }} />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-text-muted hover:text-primary text-sm transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Nazad na sajt
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-6" : ""}>
            <p className="px-3 mb-2 text-[11px] font-semibold text-text-light uppercase tracking-wider">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={activeHref === item.href ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:bg-primary-light hover:text-primary transition-colors",
                    activeHref === item.href &&
                      "bg-primary-light text-primary font-medium"
                  )}
                >
                  <DynamicIcon name={item.iconName} className="h-[18px] w-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {userEmail[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">{userEmail}</p>
            <p className="text-xs text-text-light">{userRole}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 rounded-lg text-text-light hover:bg-error/10 hover:text-error transition-colors"
            aria-label="Odjavi se"
            title="Odjavi se"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="admin-theme min-h-screen bg-background-alt flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-border shrink-0 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl animate-slide-in-right">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:bg-background-alt transition-colors"
              aria-label="Zatvori navigaciju"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-text-muted hover:bg-background-alt transition-colors"
            aria-label="Otvori navigaciju"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/admin" className="flex items-center">
            <Image src="/logo.svg" alt="Store" width={90} height={26} style={{ width: "auto", height: "24px" }} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
              {userEmail[0]?.toUpperCase() ?? "A"}
            </div>
          </div>
        </div>

        {/* Content */}
        <main id="glavni-sadrzaj" tabIndex={-1} className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
