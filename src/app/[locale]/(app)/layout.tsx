"use client";
import { useMe, usePermissions } from "@/hooks/use-me";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandPalette } from "@/components/app/command-palette";
import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const { data: me, isLoading } = useMe();
  const permissions = usePermissions();

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
      <div className="flex flex-1">
        <AppSidebar permissions={permissions} />
        <div className="flex flex-1 flex-col min-w-0">
          <AppTopbar />
          <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6">{children}</main>
        </div>
      </div>
      <footer className="mt-auto border-t bg-card px-4 py-3">
        <div className="flex flex-col items-center justify-between gap-1 text-xs text-muted-foreground sm:flex-row">
          <span>
            {t("appName")} - {t("appTagline")}
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{t("demo")}</span>
            <span className="flex items-center gap-1">
              <CircleAlert className="h-3 w-3" />
              Phase 1 - DEMO/TEST data
            </span>
          </span>
        </div>
      </footer>
      <CommandPalette />
    </div>
  );
}
