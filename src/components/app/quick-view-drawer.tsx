"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface QuickViewRecord {
  id: string;
  code: string;
  status: string;
  [key: string]: unknown;
}

interface QuickViewField {
  key: string;
  label: string;
  render?: (value: unknown, record: QuickViewRecord) => React.ReactNode;
}

export type { QuickViewField };

interface QuickViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  entityType: string;
  fields: QuickViewField[];
  title: string;
  detailHref: (id: string) => string;
  fetchUrl: (id: string) => string;
}

export function QuickViewDrawer({
  open,
  onOpenChange,
  recordId,
  entityType,
  fields,
  title,
  detailHref,
  fetchUrl,
}: QuickViewDrawerProps) {
  const router = useRouter();

  const { data, isLoading } = useQuery<QuickViewRecord>({
    queryKey: ["quickview", entityType, recordId],
    queryFn: async () => {
      if (!recordId) return null as unknown as QuickViewRecord;
      const res = await fetch(fetchUrl(recordId), { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as QuickViewRecord;
    },
    enabled: !!recordId && open,
    staleTime: 10_000,
  });

  const record = data ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {title}
            {record && (
              <span className="font-mono text-sm text-muted-foreground">
                {record.code}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Quick view for {entityType} record
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : record ? (
          <div className="space-y-4 px-1">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <StatusBadge status={record.status} />
            </div>

            {/* Fields */}
            <dl className="space-y-3">
              {fields.map((field) => {
                const value = record[field.key];
                return (
                  <div key={field.key} className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="text-sm">
                      {field.render
                        ? field.render(value, record)
                        : value !== null && value !== undefined && value !== ""
                          ? String(value)
                          : <span className="text-muted-foreground">—</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>

            {/* Action */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (recordId) {
                    onOpenChange(false);
                    router.push(detailHref(recordId));
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 me-2" />
                View Full Details
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No record found.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
