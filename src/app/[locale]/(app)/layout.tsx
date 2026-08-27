"use client";
import { useState } from "react";
import { useMe, usePermissions } from "@/hooks/use-me";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandPalette } from "@/components/app/command-palette";
import { PageTransition } from "@/components/app/page-transition";
import { ShortcutsHelpDialog } from "@/components/app/shortcuts-help-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const { data: me, isLoading } = useMe();
  const permissions = usePermissions();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useKeyboardShortcuts(permissions, () => setShortcutsOpen(true));

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!me?.authenticated) {
    // Middleware should redirect to sign-in, but guard anyway.
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground focus:text-sm"
      >
        {t("skipToContent")}
      </a>
      <div className="flex flex-1">
        <AppSidebar permissions={permissions} />
        <div className="flex flex-1 flex-col min-w-0">
          <AppTopbar />
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
      <footer className="mt-auto border-t bg-card px-4 py-2.5">
        <div className="flex flex-col items-center justify-between gap-1 text-[10px] text-muted-foreground sm:flex-row">
          <span>
            {t("appName")} - {t("appTagline")}
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{t("demo")}</span>
            <span className="flex items-center gap-1">
              <CircleAlert className="h-3 w-3" />
              Phases 0-14 Complete - DEMO/TEST data
            </span>
          </span>
        </div>
      </footer>
      <CommandPalette />
      <ShortcutsHelpDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
