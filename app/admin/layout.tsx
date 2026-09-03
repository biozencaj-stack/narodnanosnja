import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminRole, type AdminRole } from "@/lib/auth/admin-policy";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/admin/AdminShell";

interface NavItemDef {
  href: string;
  label: string;
  iconName: string;
  roles: AdminRole[];
  badgeQuery?: "unreadChat";
}

interface NavGroupDef {
  label: string;
  items: NavItemDef[];
}

const navGroupDefs: NavGroupDef[] = [
  {
    label: "Pregled",
    items: [
      { href: "/admin", label: "Kontrolna tabla", iconName: "LayoutDashboard", roles: ["ADMIN"] },
      { href: "/admin/statistics", label: "Statistika", iconName: "BarChart3", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Katalog",
    items: [
      { href: "/admin/products", label: "Proizvodi", iconName: "ShoppingBag", roles: ["ADMIN"] },
      { href: "/admin/categories", label: "Kategorije", iconName: "FolderTree", roles: ["ADMIN"] },
      { href: "/admin/brands", label: "Brendovi", iconName: "Tag", roles: ["ADMIN"] },
      { href: "/admin/colors", label: "Boje", iconName: "Palette", roles: ["ADMIN"] },
      { href: "/admin/promotions", label: "Promocije", iconName: "Percent", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Prodaja",
    items: [
      { href: "/admin/orders", label: "Porudžbine", iconName: "Package", roles: ["ADMIN", "OPERATOR"] },
      { href: "/admin/users", label: "Korisnici", iconName: "Users", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Chat",
    items: [
      { href: "/admin/chat", label: "FAQ Pitanja", iconName: "MessageCircle", roles: ["ADMIN"] },
      { href: "/admin/chat/poruke", label: "Poruke", iconName: "Inbox", roles: ["ADMIN", "OPERATOR"], badgeQuery: "unreadChat" },
    ],
  },
  {
    label: "Sadržaj",
    items: [
      { href: "/admin/articles", label: "Članci / Blog", iconName: "FileText", roles: ["ADMIN"] },
      { href: "/admin/sekcije", label: "Sekcije stranica", iconName: "LayoutTemplate", roles: ["ADMIN"] },
      { href: "/admin/banners", label: "Baneri", iconName: "ImageIcon", roles: ["ADMIN"] },
      { href: "/admin/ticker", label: "Trakica", iconName: "MessageSquare", roles: ["ADMIN"] },
      { href: "/admin/store-locations", label: "Prodajna mesta", iconName: "MapPin", roles: ["ADMIN"] },
      { href: "/admin/newsletter", label: "Newsletter", iconName: "Mail", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/admin/settings", label: "Podešavanja", iconName: "Settings", roles: ["ADMIN"] },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/admin");
  }

  if (!isAdminRole(session.user.role)) {
    redirect("/");
  }

  const role = session.user.role;

  // Fetch badge counts
  const unreadChat = await prisma.chatMessage.count({ where: { isRead: false } }).catch(() => 0);

  const badgeMap: Record<string, number> = {
    unreadChat,
  };

  const visibleGroups = navGroupDefs
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => item.roles.includes(role))
        .map((item) => ({
          href: item.href,
          label: item.label,
          iconName: item.iconName,
          badge: item.badgeQuery ? badgeMap[item.badgeQuery] : undefined,
        })),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AdminShell
      navGroups={visibleGroups}
      userEmail={session.user.email || "admin"}
      userRole={role}
    >
      {children}
    </AdminShell>
  );
}
