import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  FolderTree,
  ScrollText,
  Settings,
  Package,
  Boxes,
  Truck,
  Layers,
  ClipboardList,
  Factory,
  Clock,
  AlertTriangle,
  GitBranch,
  FileSearch,
  Wrench,
  Scale,
  Network,
  AlertCircle,
  History,
  FileText,
  GraduationCap,
  ClipboardCheck,
  Cog,
  Wind,
  PackageCheck,
  Radiation,
  Gavel,
  TrendingDown,
  GitGraph,
  BarChart3,
  PieChart,
  Activity,
  Building,
  FileBarChart,
  Plug,
  FlaskConical,
  Microscope,
  TestTube,
  Beaker,
  CheckSquare,
} from "lucide-react";

/**
 * Shared navigation configuration used by:
 *  - `app-sidebar.tsx` (desktop collapsed/expanded, mobile Sheet drawer)
 *  - `command-palette.tsx` (Cmd/Ctrl+K global search)
 *
 * Each item carries a `labelKey` (resolved via next-intl `useTranslations()`),
 * an icon, an href, and an optional `permission` key (matched against the
 * `usePermissions()` Set). Items without a `permission` are always visible
 * (e.g. dashboard, settings).
 *
 * NOTE: this is a plain (non-client) module so it can be imported by both
 * server and client components. The lucide icons themselves are client-safe.
 */
export interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    section: "main",
    items: [{ href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    section: "identity",
    items: [
      { href: "/identity/users", labelKey: "nav.users", icon: Users, permission: "identity.user.read" },
      { href: "/identity/roles", labelKey: "nav.roles", icon: ShieldCheck, permission: "identity.role.read" },
    ],
  },
  {
    section: "organization",
    items: [
      { href: "/organization/sites", labelKey: "nav.sites", icon: Building2, permission: "org.site.read" },
      { href: "/organization/departments", labelKey: "nav.departments", icon: FolderTree, permission: "org.department.read" },
    ],
  },
  {
    section: "manufacturing",
    items: [
      { href: "/manufacturing/products", labelKey: "nav.products", icon: Package, permission: "manufacturing.product.read" },
      { href: "/manufacturing/materials", labelKey: "nav.materials", icon: Boxes, permission: "manufacturing.material.read" },
      { href: "/manufacturing/material-lots", labelKey: "nav.materialLots", icon: Layers, permission: "manufacturing.materiallot.read" },
      { href: "/manufacturing/suppliers", labelKey: "nav.suppliers", icon: Truck, permission: "manufacturing.supplier.read" },
    ],
  },
  {
    section: "production",
    items: [
      { href: "/production/work-orders", labelKey: "nav.workOrders", icon: ClipboardList, permission: "production.workorder.read" },
      { href: "/production/batches", labelKey: "nav.batches", icon: Factory, permission: "production.batch.read" },
      { href: "/production/work-centers", labelKey: "nav.workCenters", icon: Building2, permission: "production.workcenter.read" },
      { href: "/production/shifts", labelKey: "nav.shifts", icon: Clock, permission: "production.shift.read" },
    ],
  },
  {
    section: "quality",
    items: [
      { href: "/quality/ncrs", labelKey: "nav.ncrs", icon: AlertTriangle, permission: "quality.ncr.read" },
      { href: "/quality/deviations", labelKey: "nav.deviations", icon: GitBranch, permission: "quality.deviation.read" },
      { href: "/quality/investigations", labelKey: "nav.investigations", icon: FileSearch, permission: "quality.investigation.read" },
      { href: "/quality/capas", labelKey: "nav.capas", icon: Wrench, permission: "quality.capa.read" },
      { href: "/quality/changes", labelKey: "nav.changes", icon: ClipboardList, permission: "quality.change.read" },
      { href: "/quality/risks", labelKey: "nav.risks", icon: Scale, permission: "quality.risk.read" },
    ],
  },
  {
    section: "traceability",
    items: [
      { href: "/traceability/trace", labelKey: "nav.traceTrace", icon: Network, permission: "traceability.read" },
      { href: "/traceability/impact", labelKey: "nav.traceImpact", icon: AlertCircle, permission: "traceability.read" },
      { href: "/traceability/query-log", labelKey: "nav.traceLog", icon: History, permission: "traceability.read" },
    ],
  },
  {
    section: "laboratory",
    items: [
      { href: "/lab/specifications", labelKey: "nav.specifications", icon: FlaskConical, permission: "lab.specification.read" },
      { href: "/lab/test-methods", labelKey: "nav.testMethods", icon: Microscope, permission: "lab.testmethod.read" },
      { href: "/lab/samples", labelKey: "nav.samples", icon: TestTube, permission: "lab.sample.read" },
      { href: "/lab/test-results", labelKey: "nav.testResults", icon: Beaker, permission: "lab.testresult.read" },
      { href: "/inspection/inspections", labelKey: "nav.inspections", icon: CheckSquare, permission: "inspection.read" },
    ],
  },
  {
    section: "lean",
    items: [
      { href: "/lean/downtime", labelKey: "nav.leanDowntime", icon: TrendingDown, permission: "lean.read" },
      { href: "/lean/oee", labelKey: "nav.leanOee", icon: Scale, permission: "lean.read" },
      { href: "/lean/vsm", labelKey: "nav.leanVsm", icon: GitGraph, permission: "lean.read" },
    ],
  },
  {
    section: "analytics",
    items: [
      { href: "/analytics/dashboards", labelKey: "nav.analyticsDashboards", icon: BarChart3, permission: "analytics.read" },
      { href: "/analytics/reports", labelKey: "nav.analyticsReports", icon: FileBarChart, permission: "analytics.read" },
      { href: "/analytics/vsm", labelKey: "nav.analyticsVsm", icon: PieChart, permission: "analytics.read" },
      { href: "/analytics/corporate", labelKey: "nav.analyticsCorporate", icon: Building, permission: "analytics.corporate.read" },
    ],
  },
  {
    section: "ai",
    items: [
      { href: "/ai-assistant", labelKey: "nav.aiAssistant", icon: Activity, permission: "ai.chat" },
    ],
  },
  {
    section: "integration",
    items: [
      { href: "/integration/configs", labelKey: "nav.integration", icon: Plug, permission: "integration.read" },
    ],
  },
  {
    section: "phase9",
    items: [
      { href: "/cleanroom/rooms", labelKey: "nav.cleanroom", icon: Wind, permission: "cleanroom.read" },
      { href: "/packaging/records", labelKey: "nav.packaging", icon: PackageCheck, permission: "packaging.read" },
      { href: "/sterilization/lots", labelKey: "nav.sterilization", icon: Radiation, permission: "sterilization.read" },
      { href: "/batch-review", labelKey: "nav.batchReview", icon: Gavel, permission: "batchreview.read" },
    ],
  },
  {
    section: "equipmentNav",
    items: [
      { href: "/equipment", labelKey: "nav.equipment", icon: Cog, permission: "equipment.read" },
    ],
  },
  {
    section: "documents",
    items: [
      { href: "/docs/documents", labelKey: "nav.documents", icon: FileText, permission: "docs.document.read" },
    ],
  },
  {
    section: "training",
    items: [
      { href: "/training/records", labelKey: "nav.trainingRecords", icon: GraduationCap, permission: "training.record.read" },
    ],
  },
  {
    section: "supplierAudits",
    items: [
      { href: "/supplier-audits", labelKey: "nav.supplierAudits", icon: ClipboardCheck, permission: "supplieraudit.read" },
    ],
  },
  {
    section: "audit",
    items: [{ href: "/audit/events", labelKey: "nav.events", icon: ScrollText, permission: "audit.read" }],
  },
  {
    section: "system",
    items: [{ href: "/settings", labelKey: "nav.settings", icon: Settings }],
  },
];
