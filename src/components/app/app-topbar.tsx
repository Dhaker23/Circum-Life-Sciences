"use client";
import { useSession, signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, Globe, Menu, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "./theme-toggle";
import { useUIStore } from "@/lib/ui-store";
import { NAV, type NavGroup, type NavItem } from "./nav-config";

/**
 * Resolve the active nav group + item from the current pathname.
 *
 * Picks the longest matching `href` so a sub-route like `/quality/ncrs/[id]`
 * still maps to the `nav.ncrs` item rather than `nav.dashboard`.
 */
function useBreadcrumbMatch(): {
  group: NavGroup | null;
  item: NavItem | null;
  isRoot: boolean;
} {
  const pathname = usePathname();
  const path = pathname.replace(/^\/(en|fr|ar)/, "") || "/";

  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of NAV) {
    for (const item of group.items) {
      const matches = path === item.href || path.startsWith(item.href + "/");
      if (!matches) continue;
      if (!best || item.href.length > best.item.href.length) {
        best = { group, item };
      }
    }
  }
  if (!best) return { group: null, item: null, isRoot: path === "/" };
  return { group: best.group, item: best.item, isRoot: best.item.href === "/" };
}

export function AppTopbar() {
  const { data: session } = useSession();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const setSidebarMobileOpen = useUIStore((s) => s.setSidebarMobileOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

  const { group, item, isRoot } = useBreadcrumbMatch();

  const switchLocale = (next: string) => {
    const path = pathname.replace(/^\/(en|fr|ar)/, "") || "/";
    router.push(`/${next}${path}`);
  };

  const initials = (session?.user?.name ?? session?.user?.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sectionLabel = group?.sectionLabelKey ? t(group.sectionLabelKey) : null;
  const itemLabel = item ? t(item.labelKey) : null;
  const dashboardLabel = t("nav.dashboard");

  // Section landing href: the first item in the matched nav group's section.
  // Falls back to "/" when there's no group (no match) — never 404s.
  const sectionHref = group?.items?.[0]?.href ?? "/";

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-card px-4">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Mobile (<md): sidebar drawer trigger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0"
          onClick={() => setSidebarMobileOpen(true)}
          aria-label={t("common.sidebar.expand")}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Breadcrumb: section / current page (md+) or compact item label (mobile) */}
        <div className="min-w-0 flex-1 md:flex-none">
          {/* Mobile: compact current-page label only (full trail hidden on <md) */}
          {itemLabel && (
            <span className="md:hidden text-sm font-medium text-foreground truncate block">
              {itemLabel}
            </span>
          )}
          {/* md+: full breadcrumb trail — Dashboard > Section > Current Item */}
          <Breadcrumb aria-label="breadcrumb" className="hidden md:block">
            <BreadcrumbList className="text-sm">
              <BreadcrumbItem>
                {isRoot ? (
                  <BreadcrumbPage className="font-medium">
                    {dashboardLabel}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href="/" aria-label={dashboardLabel}>
                      {dashboardLabel}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {sectionLabel && !isRoot && item ? (
                <>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={sectionHref} aria-label={sectionLabel}>
                        {sectionLabel}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={item.href} aria-current="page">
                        {itemLabel}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* md+: command palette search trigger */}
        <Button
          variant="outline"
          className="hidden md:flex ms-auto w-full max-w-xs justify-start gap-2 text-muted-foreground font-normal"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label={t("common.search.placeholder")}
        >
          <Search className="h-4 w-4" />
          <span className="truncate">{t("common.search.placeholder")}</span>
          <kbd className="ms-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </Button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Globe className="h-4 w-4" />
              <span className="uppercase text-xs">{locale}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("settings.language")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => switchLocale("en")}>English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchLocale("fr")}>Francais</DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchLocale("ar")}>العربية</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </span>
              <span className="hidden text-sm sm:inline">{session?.user?.name ?? session?.user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{session?.user?.name}</span>
                <span className="text-xs text-muted-foreground">{session?.user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: `/${locale}/sign-in` })}>
              <LogOut className="me-2 h-4 w-4" />
              {t("auth.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
