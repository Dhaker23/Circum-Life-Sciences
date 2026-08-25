"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Users, ShieldCheck, Building2, FolderTree, ScrollText, Settings, Package, Boxes, Truck, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "main",
    items: [{ href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    section: "identity",
    items: [
      { href: "/identity/users", labelKey: "nav.users", icon: Users, permission: "identity.user.read" },
      { href: "/identity/roles", labelKey: "nav.roles", icon: ShieldCheck, permission: "identity.role.read" },
    ],
  },
  {
    section: "organization",
    items: [
      { href: "/organization/sites", labelKey: "nav.sites", icon: Building2, permission: "org.site.read" },
      { href: "/organization/departments", labelKey: "nav.departments", icon: FolderTree, permission: "org.department.read" },
    ],
  },
  {
    section: "manufacturing",
    items: [
      { href: "/manufacturing/products", labelKey: "nav.products", icon: Package, permission: "manufacturing.product.read" },
      { href: "/manufacturing/materials", labelKey: "nav.materials", icon: Boxes, permission: "manufacturing.material.read" },
      { href: "/manufacturing/material-lots", labelKey: "nav.materialLots", icon: Layers, permission: "manufacturing.materiallot.read" },
      { href: "/manufacturing/suppliers", labelKey: "nav.suppliers", icon: Truck, permission: "manufacturing.supplier.read" },
    ],
  },
  {
    section: "audit",
    items: [{ href: "/audit/events", labelKey: "nav.events", icon: ScrollText, permission: "audit.read" }],
  },
  {
    section: "system",
    items: [{ href: "/settings", labelKey: "nav.settings", icon: Settings }],
  },
];

export function AppSidebar({ permissions }: { permissions: Set<string> }) {
  const t = useTranslations();
  const pathname = usePathname();
  // Strip locale prefix for comparison.
  const path = pathname.replace(/^\/(en|fr|ar)/, "") || "/";

  return (
    <nav className="flex h-full w-60 flex-col border-e bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          C
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{t("common.appName")}</span>
          <span className="text-[10px] text-muted-foreground">QMS Platform</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group) => {
          const visible = group.items.filter((item) => !item.permission || permissions.has(item.permission));
          if (visible.length === 0) return null;
          return (
            <div key={group.section} className="mb-4">
              <ul className="space-y-1">
                {visible.map((item) => {
                  const active = path === item.href || path.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t px-4 py-3 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{t("common.demo")}</span>
        <span className="ms-2">Phase 1</span>
      </div>
    </nav>
  );
}
