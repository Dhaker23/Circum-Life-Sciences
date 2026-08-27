"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface AuditEvent {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: string;
  reason: string | null;
}

interface ActivityTimelineProps {
  entityType: string;
  entityId: string;
  title?: string;
  maxItems?: number;
}

const OUTCOME_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  SUCCESS: CheckCircle2,
  FAILURE: XCircle,
  DENIED: AlertCircle,
};

const OUTCOME_COLOR: Record<string, string> = {
  SUCCESS: "text-emerald-600 dark:text-emerald-400",
  FAILURE: "text-red-600 dark:text-red-400",
  DENIED: "text-amber-600 dark:text-amber-400",
};

export function ActivityTimeline({
  entityType,
  entityId,
  title,
  maxItems = 20,
}: ActivityTimelineProps) {
  const t = useTranslations("common");

  const { data, isLoading } = useQuery<{ data: AuditEvent[]; total: number }>({
    queryKey: ["audit-activity", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(
        `/api/audit/events?entityType=${entityType}&entityId=${entityId}&pageSize=${maxItems}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return { data: [], total: 0 };
      const json = await res.json();
      return { data: (json.data ?? []) as AuditEvent[], total: json.meta?.total ?? 0 };
    },
    staleTime: 10_000,
  });

  const events = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" />
          {title ?? t("activityTimeline")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("noActivity")}
          </p>
        ) : (
          <ScrollArea className="max-h-[24rem]">
            <div className="space-y-1">
              {events.map((event, index) => {
                const Icon = OUTCOME_ICON[event.outcome] ?? History;
                const colorClass = OUTCOME_COLOR[event.outcome] ?? "text-muted-foreground";
                const isLast = index === events.length - 1;
                return (
                  <div key={event.id} className="flex items-start gap-3">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div className={`mt-0.5 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-border min-h-[2rem]" />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {event.action}
                        </Badge>
                        <Badge
                          variant={event.outcome === "SUCCESS" ? "default" : event.outcome === "DENIED" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {event.outcome}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.occurredAt).toLocaleString()}
                        {event.reason && ` — ${event.reason}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
