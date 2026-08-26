"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { usePermissions } from "@/hooks/use-me";
import { useUIStore } from "@/lib/ui-store";
import { NAV } from "./nav-config";

/**
 * Global command palette.
 *
 * Opens via the global Cmd/Ctrl+K keyboard shortcut (handled here) or via the
 * shared `useUIStore.commandPaletteOpen` flag (toggled by the topbar Search
 * button). Navigation entries are permission-gated through `usePermissions()`.
 *
 * The cmdk primitive handles arrow-key navigation, filtering, and Escape to
 * close. On select we close the palette and `router.push(href)`; cmdk's
 * `value` includes the href so the user can also search by route path.
 */
export function CommandPalette() {
  const t = useTranslations();
  const router = useRouter();
  const permissions = usePermissions();
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);

  // Global Cmd/Ctrl+K listener
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);

  const handleSelect = React.useCallback(
    (href: string) => {
      setOpen(false);
      // Use a microtask to let the dialog close before navigating
      // (prevents a focus jump in some browsers).
      router.push(href);
    },
    [router, setOpen],
  );

  // Split NAV into navigation items (everything except the "system" section)
  // and the settings item (the "system" section).
  const navGroups = NAV.filter((g) => g.section !== "system");
  const settingsGroup = NAV.find((g) => g.section === "system");

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      description={t("common.search.placeholder")}
    >
      <CommandInput placeholder={t("common.search.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("common.search.noResults")}</CommandEmpty>

        {navGroups.map((group) => {
          const visible = group.items.filter(
            (item) => !item.permission || permissions.has(item.permission),
          );
          if (visible.length === 0) return null;
          return (
            <CommandGroup
              key={group.section}
              heading={t("common.search.navigation")}
            >
              {visible.map((item) => {
                const Icon = item.icon;
                const label = t(item.labelKey);
                return (
                  <CommandItem
                    key={item.href}
                    value={`${label} ${item.href}`}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{label}</span>
                    <span className="ms-auto text-[10px] text-muted-foreground/70 font-mono">
                      {item.href}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}

        {settingsGroup ? (
          <CommandGroup heading={t("common.search.settings")}>
            {settingsGroup.items
              .filter(
                (item) => !item.permission || permissions.has(item.permission),
              )
              .map((item) => {
                const Icon = item.icon;
                const label = t(item.labelKey);
                return (
                  <CommandItem
                    key={item.href}
                    value={`${label} ${item.href}`}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{label}</span>
                    <span className="ms-auto text-[10px] text-muted-foreground/70 font-mono">
                      {item.href}
                    </span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
