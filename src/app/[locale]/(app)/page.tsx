import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, ShieldCheck, ScrollText } from "lucide-react";
import { requireAuthContext } from "@/lib/auth-context";
import { can } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const ctx = await requireAuthContext();

  // Dashboard is read-only overview; require at least one read permission.
  const canSeeUsers = can(ctx, "identity.user.read");
  const canSeeSites = can(ctx, "org.site.read");
  const canSeeRoles = can(ctx, "identity.role.read");
  const canSeeAudit = can(ctx, "audit.read");
  if (!canSeeUsers && !canSeeSites && !canSeeRoles && !canSeeAudit) {
    throw new ForbiddenError();
  }

  const [userCount, siteCount, roleCount, auditCount] = await Promise.all([
    canSeeUsers ? db.user.count() : Promise.resolve(0),
    canSeeSites ? db.site.count() : Promise.resolve(0),
    canSeeRoles ? db.role.count() : Promise.resolve(0),
    canSeeAudit ? db.auditEvent.count() : Promise.resolve(0),
  ]);

  const stats = [
    { label: t("stats.users"), value: userCount, icon: Users, show: canSeeUsers },
    { label: t("stats.sites"), value: siteCount, icon: Building2, show: canSeeSites },
    { label: t("stats.roles"), value: roleCount, icon: ShieldCheck, show: canSeeRoles },
    { label: t("stats.auditEvents"), value: auditCount, icon: ScrollText, show: canSeeAudit },
  ].filter((s) => s.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("welcome")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
