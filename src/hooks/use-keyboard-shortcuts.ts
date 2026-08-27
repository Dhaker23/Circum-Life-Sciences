"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Shortcut {
  keys: string[];
  href: string;
  label: string;
  permission?: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["g", "d"], href: "/", label: "Dashboard" },
  { keys: ["g", "n"], href: "/quality/ncrs", label: "NCRs" },
  { keys: ["g", "c"], href: "/quality/capas", label: "CAPAs" },
  { keys: ["g", "w"], href: "/production/work-orders", label: "Work Orders" },
  { keys: ["g", "a"], href: "/analytics/dashboards", label: "Analytics" },
];

export function useKeyboardShortcuts(
  permissions: Set<string>,
  onShowHelp: () => void,
) {
  const router = useRouter();

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // Don't interfere with form inputs
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;

      // Help dialog
      if (e.key === "?") {
        e.preventDefault();
        onShowHelp();
        return;
      }

      // Two-key shortcuts (g+X)
      if (e.key === "g") {
        const handler = (e2: KeyboardEvent) => {
          const shortcut = SHORTCUTS.find((s) => s.keys[1] === e2.key);
          if (shortcut) {
            if (shortcut.permission && !permissions.has(shortcut.permission)) return;
            e2.preventDefault();
            router.push(shortcut.href);
          }
          document.removeEventListener("keydown", handler);
        };
        document.addEventListener("keydown", handler, { once: true });
        e.preventDefault();
      }
    },
    [router, permissions, onShowHelp],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return SHORTCUTS;
}

export { SHORTCUTS };
