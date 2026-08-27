"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  const t = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shortcutsTitle")}</DialogTitle>
          <DialogDescription>{t("shortcutsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys.join("+")} className="flex items-center justify-between py-1">
              <span className="text-sm">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
                    <Badge variant="outline" className="font-mono text-xs px-1.5 py-0.5">
                      {key}
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between py-1 border-t pt-2">
            <span className="text-sm">{t("shortcutsHelp")}</span>
            <Badge variant="outline" className="font-mono text-xs px-1.5 py-0.5">?</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
