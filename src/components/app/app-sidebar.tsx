"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/ui-store";
import { NAV, type NavItem } from "./nav-config";

/** Sidebar collapse preference persistence key (boolean: "true" | "false"). */
const COLLAPSE_KEY = "circum.sidebar.collapsed";

/**
 * Small media-query hook for the lg breakpoint (>= 1024px).
 *
 * Used to distinguish desktop (lg+: width follows user's collapse preference)
 * from tablet (md only: always collapsed).
 */
function useIsLg() {
  const [isLg, setIsLg] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLg(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isLg;
}

interface SidebarContentProps {
  permissions: Set<string>;
  collapsed: boolean;
  onNavigate?: () => void;
}

/**
 * Renders the nav list. Used by both the inline (md+) sidebar and the mobile
 * Sheet drawer so they share identical markup and i18n / RBAC behavior.
 */
function SidebarNavList({ permissions, collapsed, onNavigate }: SidebarContentProps) {
  const t = useTranslations();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const pathname = usePathname();
  const path = pathname.replace(/^\/(en|fr|ar)/, "") || "/";

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      {NAV.map((group) => {
        const visible: NavItem[] = group.items.filter(
          (item) => !item.permission || permissions.has(item.permission),
        );
        if (visible.length === 0) return null;
        return (
          <div key={group.section} className="mb-4">
            <ul className="space-y-1">
              {visible.map((item) => {
                const active = path === item.href || path.startsWith(item.href + "/");
                const Icon = item.icon;
                const label = t(item.labelKey);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-label={collapsed ? label : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">{label}</span> : null}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side={isRtl ? "left" : "right"}>{label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

interface SidebarChromeProps {
  collapsed: boolean;
  onToggle?: () => void;
  showToggle: boolean;
}

function SidebarHeader({ collapsed, onToggle, showToggle }: SidebarChromeProps) {
  const t = useTranslations();
  return (
    <div
      className={cn(
        "flex h-14 items-center border-b shrink-0",
        collapsed ? "justify-center px-2" : "gap-2 px-4",
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold shrink-0">
        C
      </div>
      {!collapsed ? (
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-semibold truncate">{t("common.appName")}</span>
          <span className="text-[10px] text-muted-foreground">QMS Platform</span>
        </div>
      ) : null}
      {showToggle && onToggle ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", !collapsed && "ms-auto")}
          onClick={onToggle}
          aria-label={collapsed ? t("common.sidebar.expand") : t("common.sidebar.collapse")}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations("common");
  return (
    <div
      className={cn(
        "border-t px-4 py-3 text-[10px] text-muted-foreground shrink-0",
        collapsed && "px-2 text-center",
      )}
    >
      {collapsed ? (
        <span className="block">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{t("demo")}</span>
        </span>
      ) : (
        <>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{t("demo")}</span>
          <span className="ms-2">Phase 1</span>
        </>
      )}
    </div>
  );
}

export function AppSidebar({ permissions }: { permissions: Set<string> }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const isMobile = useIsMobile();
  const isLg = useIsLg();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const sidebarMobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useUIStore((s) => s.setSidebarMobileOpen);

  // Load collapse preference from localStorage once on mount.
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLLAPSE_KEY);
      if (saved === "true") setCollapsed(true);
    } catch {
      // localStorage may be unavailable (private mode); ignore.
    }
    setMounted(true);
  }, []);

  // Persist collapse preference whenever it changes (after mount).
  React.useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed, mounted]);

  // Close the mobile drawer when navigating between routes — handled via
  // the onNavigate callback passed into SidebarNavList.

  if (isMobile) {
    // Mobile (<md): hidden inline, drawer via Sheet.
    return (
      <Sheet open={sidebarMobileOpen} onOpenChange={setSidebarMobileOpen}>
        <SheetContent
          side={isRtl ? "right" : "left"}
          className="w-72 p-0 flex flex-col"
        >
          <SheetTitle className="sr-only">{t("appName")}</SheetTitle>
          <SidebarHeader collapsed={false} showToggle={false} />
          <SidebarNavList
            permissions={permissions}
            collapsed={false}
            onNavigate={() => setSidebarMobileOpen(false)}
          />
          <SidebarFooter collapsed={false} />
        </SheetContent>
      </Sheet>
    );
  }

  // md+: inline sidebar.
  // - lg+: respects user's `collapsed` preference (toggle visible).
  // - md only (not lg): always collapsed (toggle hidden).
  const effectivelyCollapsed = isLg ? collapsed : true;
  const showToggle = isLg;

  return (
    <nav
      className={cn(
        "flex h-full flex-col border-e bg-card shrink-0 transition-[width] duration-200",
        effectivelyCollapsed ? "w-16" : "w-60",
      )}
      aria-label={t("appName")}
    >
      <SidebarHeader
        collapsed={effectivelyCollapsed}
        onToggle={() => setCollapsed((v) => !v)}
        showToggle={showToggle}
      />
      <SidebarNavList permissions={permissions} collapsed={effectivelyCollapsed} />
      <SidebarFooter collapsed={effectivelyCollapsed} />
    </nav>
  );
}
