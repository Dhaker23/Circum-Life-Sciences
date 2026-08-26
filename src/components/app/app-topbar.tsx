"use client";
import { useSession, signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Globe, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { useUIStore } from "@/lib/ui-store";

export function AppTopbar() {
  const { data: session } = useSession();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const setSidebarMobileOpen = useUIStore((s) => s.setSidebarMobileOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

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

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-card px-4">
      <div className="flex items-center gap-2 min-w-0">
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

        {/* md+: command palette search trigger */}
        <Button
          variant="outline"
          className="hidden md:flex w-full max-w-xs justify-start gap-2 text-muted-foreground font-normal"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label={t("common.search.placeholder")}
        >
          <Search className="h-4 w-4" />
          <span className="truncate">{t("common.search.placeholder")}</span>
          <kbd className="ms-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </Button>

        {/* Visible page title on mobile only (search trigger hidden) */}
        <span className="md:hidden text-sm font-medium text-muted-foreground truncate">
          {t("dashboard.title")}
        </span>
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
