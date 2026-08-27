import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardList,
  Plus,
  Activity,
  BarChart3,
  ArrowRight,
  Factory,
  CheckCircle2,
} from "lucide-react";
import { requireAuthContext } from "@/lib/auth-context";
import { can } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";

/**
 * Dashboard — server-rendered enterprise overview.
 *
 * Permission-gated: each section is only fetched + rendered when the user has
 * the relevant read permission. The page itself requires at least one of the
 * dashboard-relevant permissions (otherwise we throw ForbiddenError).
 *
 * All counts respect the user's site scope (resolvedSites) so a site-scoped
 * user only sees their own site's data.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const ctx = await requireAuthContext();

  // --- Permission flags ----------------------------------------------------
  const canSeeNcrs = can(ctx, "quality.ncr.read");
  const canSeeDeviations = can(ctx, "quality.deviation.read");
  const canSeeCapas = can(ctx, "quality.capa.read");
  const canSeeWorkOrders = can(ctx, "production.workorder.read");
  const canSeeBatches = can(ctx, "production.batch.read");
  const canSeeAudit = can(ctx, "audit.read");
  const canSeeAnalytics = can(ctx, "analytics.read");
  const canUseAi = can(ctx, "ai.chat");

  const canSeeAnyQuality = canSeeNcrs || canSeeDeviations || canSeeCapas;
  const canSeeAnyProduction = canSeeWorkOrders || canSeeBatches;

  if (
    !canSeeAnyQuality &&
    !canSeeAnyProduction &&
    !canSeeAudit &&
    !canSeeAnalytics &&
    !canUseAi
  ) {
    throw new ForbiddenError();
  }

  // --- Site scope filter (resolvedSites = "*" means global) ----------------
  const siteIdFilter =
    ctx.resolvedSites === "*"
      ? {}
      : { siteId: { in: [...ctx.resolvedSites] } };

  // 7-day window for audit + completed batches
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // --- KPI counts (run in parallel) ---------------------------------------
  const [openNcrs, openCapas, activeWorkOrders, audit7d] = await Promise.all([
    canSeeNcrs
      ? db.nCR.count({
          where: {
            ...siteIdFilter,
            status: { notIn: ["CLOSED", "CANCELLED"] },
          },
        })
      : Promise.resolve(0),
    canSeeCapas
      ? db.cAPA.count({
          where: {
            ...siteIdFilter,
            status: { not: "CLOSED" },
          },
        })
      : Promise.resolve(0),
    canSeeWorkOrders
      ? db.workOrder.count({
          where: {
            ...siteIdFilter,
            status: { in: ["RELEASED", "IN_PRODUCTION"] },
          },
        })
      : Promise.resolve(0),
    canSeeAudit
      ? db.auditEvent.count({ where: { occurredAt: { gte: sevenDaysAgo } } })
      : Promise.resolve(0),
  ]);

  // --- Recent quality activity (5 most recent across NCR / Deviation / CAPA)
  const recentActivity = canSeeAnyQuality
    ? await Promise.all([
        canSeeNcrs
          ? db.nCR.findMany({
              where: siteIdFilter,
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                code: true,
                status: true,
                createdAt: true,
              },
            })
          : [],
        canSeeDeviations
          ? db.deviation.findMany({
              where: siteIdFilter,
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                code: true,
                status: true,
                createdAt: true,
              },
            })
          : [],
        canSeeCapas
          ? db.cAPA.findMany({
              where: siteIdFilter,
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                code: true,
                status: true,
                createdAt: true,
              },
            })
          : [],
      ]).then(([ncrs, devs, capas]) =>
        [
          ...ncrs.map((n) => ({
            id: n.id,
            code: n.code,
            status: n.status,
            createdAt: n.createdAt,
            type: "NCR" as const,
            href: `/quality/ncrs/${n.id}`,
          })),
          ...devs.map((d) => ({
            id: d.id,
            code: d.code,
            status: d.status,
            createdAt: d.createdAt,
            type: "DEV" as const,
            href: `/quality/deviations/${d.id}`,
          })),
          ...capas.map((c) => ({
            id: c.id,
            code: c.code,
            status: c.status,
            createdAt: c.createdAt,
            type: "CAPA" as const,
            href: `/quality/capas/${c.id}`,
          })),
        ]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5),
      )
    : [];

  // --- Production overview -------------------------------------------------
  const [activeBatches, completedBatches7d] = canSeeBatches
    ? await Promise.all([
        db.manufacturingBatch.count({
          where: {
            ...siteIdFilter,
            status: { in: ["PLANNED", "IN_PRODUCTION", "ON_HOLD"] },
          },
        }),
        db.manufacturingBatch.count({
          where: {
            ...siteIdFilter,
            status: "COMPLETED",
            completedAt: { gte: sevenDaysAgo },
          },
        }),
      ])
    : [0, 0];

  const totalBatchesConsidered = activeBatches + completedBatches7d;
  const completionRate =
    totalBatchesConsidered > 0
      ? Math.round((completedBatches7d / totalBatchesConsidered) * 100)
      : 0;

  // --- KPI cards configuration --------------------------------------------
  const kpiCards = [
    canSeeNcrs && {
      icon: "alert-triangle" as const,
      label: t("kpis.openNcrs"),
      value: openNcrs,
      accent: "error" as const,
      href: "/quality/ncrs",
      deltaLabel: t("kpis.openNcrsDelta"),
    },
    canSeeCapas && {
      icon: "wrench" as const,
      label: t("kpis.openCapas"),
      value: openCapas,
      accent: "warning" as const,
      href: "/quality/capas",
      deltaLabel: t("kpis.openCapasDelta"),
    },
    canSeeWorkOrders && {
      icon: "clipboard-list" as const,
      label: t("kpis.activeWorkOrders"),
      value: activeWorkOrders,
      accent: "primary" as const,
      href: "/production/work-orders",
      deltaLabel: t("kpis.activeWorkOrdersDelta"),
    },
    canSeeAudit && {
      icon: "scroll-text" as const,
      label: t("kpis.recentAudit"),
      value: audit7d,
      accent: "neutral" as const,
      href: "/audit/events",
      deltaLabel: t("kpis.recentAuditDelta"),
    },
  ].filter(Boolean) as {
    icon: "alert-triangle" | "wrench" | "clipboard-list" | "scroll-text";
    label: string;
    value: number;
    accent: "error" | "warning" | "primary" | "neutral";
    href: string;
    deltaLabel: string;
  }[];

  return (
    <div className="space-y-6">
      <PageHeader title={t("welcome")} subtitle={t("subtitle")} />

      {/* KPI row */}
      {kpiCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((kpi) => (
            <StatCard
              key={kpi.href}
              icon={kpi.icon}
              label={kpi.label}
              value={kpi.value}
              accent={kpi.accent}
              href={kpi.href}
              delta={{ value: 0, label: kpi.deltaLabel }}
            />
          ))}
        </div>
      ) : null}

      {/* Two-column section: recent activity (2/3) + quick actions (1/3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent quality activity */}
        {canSeeAnyQuality ? (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-2 border-b">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">{t("recentActivity")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("recentActivitySubtitle")}
                </CardDescription>
              </div>
              {canSeeNcrs ? (
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href="/quality/ncrs" aria-label={t("viewAll")}>
                    {t("viewAll")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              {recentActivity.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("noRecentActivity")}
                  </p>
                </div>
              ) : (
                <ul className="divide-y" role="list">
                  {recentActivity.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:bg-muted"
                        aria-label={`${item.type} ${item.code}: ${item.status}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground">
                            {item.type}
                          </span>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium">
                              {item.code}
                            </span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {item.createdAt.toLocaleDateString(locale, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Quick actions */}
        <Card className={canSeeAnyQuality ? "" : "lg:col-span-3"}>
          <CardHeader className="border-b">
            <CardTitle className="text-base">{t("quickActions")}</CardTitle>
            <CardDescription className="text-xs">
              {t("quickActionsSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {canSeeNcrs ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                >
                  <Link href="/quality/ncrs" aria-label={t("newNcr")}>
                    <Plus className="h-5 w-5" />
                    <span className="text-xs">{t("newNcr")}</span>
                  </Link>
                </Button>
              ) : null}
              {canSeeWorkOrders ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                >
                  <Link href="/production/work-orders" aria-label={t("newWorkOrder")}>
                    <ClipboardList className="h-5 w-5" />
                    <span className="text-xs">{t("newWorkOrder")}</span>
                  </Link>
                </Button>
              ) : null}
              {canSeeAnalytics ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                >
                  <Link href="/analytics/dashboards" aria-label={t("viewAnalytics")}>
                    <BarChart3 className="h-5 w-5" />
                    <span className="text-xs">{t("viewAnalytics")}</span>
                  </Link>
                </Button>
              ) : null}
              {canUseAi ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                >
                  <Link href="/ai-assistant" aria-label={t("aiAssistant")}>
                    <Activity className="h-5 w-5" />
                    <span className="text-xs">{t("aiAssistant")}</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production overview */}
      {canSeeBatches ? (
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-4 w-4 text-muted-foreground" />
                  {t("productionOverview")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("productionOverviewSubtitle")}
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/production/batches" aria-label={t("viewAll")}>
                  {t("viewAll")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("activeBatches")}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {activeBatches}
                  </span>
                  <Factory className="h-4 w-4 text-muted-foreground" />
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("completedBatches")}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {completedBatches7d}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t("completionRate")}
                  </span>
                  <span className="text-xs font-medium tabular-nums">
                    {completionRate}%
                  </span>
                </div>
                <Progress
                  value={completionRate}
                  className="h-2"
                  aria-label={t("completionRate")}
                />
                <p className="text-[10px] text-muted-foreground">
                  {t("completedBatches")} / {t("activeBatches")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
