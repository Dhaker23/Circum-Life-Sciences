# Circum — UI/UX Audit

> **Date:** Post-Phase 14, pre-deployment UI/UX audit
> **Auditor:** Z.ai Code (read-only audit)
> **Purpose:** Assess the current UI/UX state against the target of a professional enterprise medical-device manufacturing + QMS platform.

## 1. Current UI Status

The application has a **functional foundation** but lacks the polish, consistency, and advanced UX patterns expected of a premium enterprise SaaS in 2026. The core issue is not missing functionality (66 pages, 48 UI components, 402 tests all pass) but **inconsistent application** of the design system across pages.

**Summary:** The UI works but feels like a functional prototype rather than a polished enterprise product.

## 2. Existing Components (48 shadcn/ui components — complete set)

All standard shadcn/ui components are installed:
- accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip

**Assessment:** Component library is complete. The issue is not missing components — it's inconsistent usage.

## 3. Existing Pages (66 pages)

- **Dashboard:** Server-rendered, shows 4 stat cards (users/sites/roles/audit). Minimal.
- **List pages (40+):** NCRs, Deviations, CAPAs, Changes, Products, Materials, Work Orders, Batches, Equipment, Documents, etc. Most use Table + Card pattern.
- **Detail pages (5):** NCR, Deviation, CAPA, ChangeControl, BatchReview — have transition buttons + dialogs (Phase 14 D5).
- **Analytics pages (20):** Dashboards + reports with recharts charts.
- **AI Assistant:** Chat interface with 5-part structured response.
- **Integration:** Config list + detail.
- **Settings:** Theme toggle + locale switch.

## 4. Missing Components / Patterns

| Pattern | Status | Impact |
|---|---|---|
| **Breadcrumbs** | ❌ NOT USED (component exists, never imported) | Users lose context in deep navigation |
| **Command/Search palette** | ❌ NOT IMPLEMENTED | No global search; users must navigate manually |
| **Global filter bar** | ❌ NOT ON LIST PAGES | Users cannot filter/search within tables |
| **Pagination on list pages** | ❌ NOT ON UI (API supports it) | All list pages fetch `?pageSize=100` with no pagination control |
| **Empty states** | ⚠️ INCONSISTENT (some pages show "No data", others show nothing) | Users see blank areas with no explanation |
| **Loading skeletons** | ⚠️ PARTIAL (only 5 detail pages use Skeleton; list pages show "Loading..." text) | Jarring loading experience |
| **Toast notifications** | ⚠️ PARTIAL (only 5 detail pages use toast; list pages have no feedback) | Create/update actions give no feedback on list pages |
| **Drawer/Sheet for quick view** | ❌ NOT USED (components exist) | Users must navigate to detail page for every record |
| **Timeline/Activity feed** | ❌ NOT IMPLEMENTED | No audit trail visualization on detail pages |
| **Sidebar collapse** | ❌ NOT IMPLEMENTED | Fixed-width sidebar; no collapse for small screens |
| **Mobile sidebar (Sheet)** | ⚠️ PARTIAL (sidebar is always visible; no mobile drawer) | Mobile experience is poor |
| **Page transitions** | ❌ NOT IMPLEMENTED | No subtle motion on navigation |
| **Form validation feedback** | ⚠️ INCONSISTENT | Some forms use native HTML validation; no inline error display |
| **Confirmation dialogs for destructive actions** | ⚠️ PARTIAL (only batch-review archive has AlertDialog) | Inconsistent |

## 5. Inconsistent Components

| Area | Inconsistency |
|---|---|
| **List page headers** | Some use `h1` + subtitle; some use Card header; some have no header |
| **Table styling** | Some tables have sticky headers; some don't; some have borders; some don't |
| **Badge usage** | Status badges use different variants across pages (e.g., NCR uses `outline/default/secondary/destructive`; other pages use `default/secondary` only) |
| **Button placement** | "New" / "Create" buttons are in different positions on different pages |
| **Card padding** | Some use `p-4`; some `p-6`; some `CardContent` default |
| **Empty state text** | "No data", "No NCRs", "No records", "No items" — no standardized empty state component |
| **Loading state** | "Loading...", "Loading...", Skeleton — no standardized loading component |

## 6. Design Problems

| Problem | Severity |
|---|---|
| **No visual hierarchy on dashboard** — 4 stat cards only; no recent activity, no charts, no quick actions | P1 |
| **Sidebar is plain** — no grouping labels, no icons for section headers, no collapse, no active indicator beyond bg color | P1 |
| **Topbar is minimal** — shows only "Dashboard" label + locale/theme/user; no breadcrumbs, no search, no notifications | P1 |
| **Color palette is grayscale** — primary is `oklch(0.205 0 0)` (near-black); no brand color; feels generic | P1 |
| **No data visualization on dashboard** — the analytics module has charts, but the main dashboard has none | P2 |
| **Typography is default Geist** — no typographic scale; headings are `text-2xl font-bold` everywhere with no variation | P2 |
| **Sign-in page is basic** — functional but no branding, no split-screen, no marketing polish | P2 |
| **List pages are data-tables only** — no card view alternative, no row expansion, no bulk actions | P2 |

## 7. UX Problems

| Problem | Severity |
|---|---|
| **No global search** — users must know which module to navigate to | P0 |
| **No breadcrumbs** — users lose context after 2+ levels of navigation | P1 |
| **No filter/search on list pages** — users must scroll through 100 items | P0 |
| **No pagination controls** — users see up to 100 items with no way to page | P1 |
| **No quick-view drawer** — every record requires a full page navigation | P1 |
| **No recent items / shortcuts** — dashboard doesn't show recent NCRs, open CAPAs, etc. | P1 |
| **No keyboard shortcuts** — no cmd+k, no quick navigation | P2 |
| **Inconsistent action feedback** — some pages toast; some don't | P1 |
| **No undo/confirm for destructive actions** — most actions have no confirmation | P1 |

## 8. Accessibility Problems

| Problem | Severity |
|---|---|
| **84 aria-* attributes across the app** — decent but inconsistent | P2 |
| **Charts lack text alternatives** — recharts charts have no `aria-label` or `desc` | P1 |
| **Table headers lack scope** — some tables have `<th>` without `scope="col"` | P2 |
| **Focus indicators** — present (Tailwind defaults) but not enhanced | P2 |
| **Color contrast** — muted-foreground (`oklch(0.556 0 0)`) may fail WCAG AA for small text | P1 |
| **Skip-to-content link** — not implemented | P2 |
| **Screen reader announcements** — toasts use sonner but dynamic content changes are not announced | P2 |

## 9. Responsive Problems

| Problem | Severity |
|---|---|
| **Sidebar is fixed 240px** — no collapse; no mobile drawer | P0 |
| **Tables overflow on mobile** — `max-h-[32rem] overflow-auto` helps but horizontal scroll is poor UX | P1 |
| **Grid layouts** — 25 `sm:grid-cols-` + 18 `lg:grid-cols-` patterns exist but are inconsistent | P2 |
| **Topbar doesn't adapt** — no responsive collapse of controls on small screens | P1 |
| **Forms are single-column everywhere** — no responsive multi-column forms on desktop | P2 |
| **No tablet-specific layout** — jumps from mobile to desktop with no intermediate | P2 |

## 10. Recommended Design System

| Element | Recommendation |
|---|---|
| **Brand color** | Adopt a professional medical/industrial color (e.g., a refined teal or deep emerald — NOT indigo/blue per owner rule). Use as `--primary` |
| **Neutral palette** | Keep the current oklch grayscale for backgrounds/borders |
| **Status colors** | Standardize: success=emerald, warning=amber, danger=red, info=slate |
| **Typography scale** | Define: page-title `text-2xl`, section-title `text-lg`, card-title `text-base`, body `text-sm`, caption `text-xs` |
| **Spacing scale** | Standardize: page `space-y-6`, card `p-6`, card-header `pb-4`, list `gap-4` |
| **Border radius** | Keep `--radius: 0.625rem` (current) |
| **Shadows** | Add subtle shadow hierarchy: card `shadow-sm`, dialog `shadow-lg`, dropdown `shadow-md` |
| **Motion** | Add `transition-colors` on interactive elements; `transition-all duration-200` on dialogs/drawers |

## 11. Recommended Component Architecture

| Component | Purpose |
|---|---|
| `<PageHeader title subtitle actions />` | Standardized page header with optional action buttons |
| `<DataTable columns data filterable searchable paginated />` | Reusable data table with built-in filter/search/pagination |
| `<EmptyState icon title description action />` | Standardized empty state |
| `<LoadingSkeleton variant />` | Standardized loading (card/table/detail variants) |
| `<StatusBadge status />` | Standardized status badge with consistent color mapping |
| `<BreadcrumbTrail />` | Auto-generated breadcrumbs from route |
| `<CommandPalette />` | Global cmd+k search/navigation |
| `<QuickViewDrawer />` | Slide-in drawer for quick record preview |
| `<ActivityTimeline />` | Audit trail visualization for detail pages |
| `<StatCard icon label value delta />` | Standardized KPI card with trend indicator |
| `<FilterBar />` | Reusable filter bar for list pages |

## 12. Priority Classification

### P0 — Blocking (must fix for usable UAT)
1. **Global search/command palette** — users cannot find records without navigating
2. **Filter/search on list pages** — users cannot filter within tables
3. **Sidebar collapse + mobile drawer** — application is unusable on tablet/mobile

### P1 — Important (must fix for professional appearance)
4. **Breadcrumbs** — contextual navigation
5. **Pagination controls** — on all list pages
6. **Standardized empty states** — consistent "no data" UX
7. **Standardized loading skeletons** — replace "Loading..." text
8. **Toast feedback on all actions** — consistent action feedback
9. **Dashboard redesign** — add recent activity, charts, quick actions
10. **Brand color** — adopt a professional primary color
11. **Sidebar grouping labels** — visual hierarchy in navigation
12. **Quick-view drawer** — reduce page navigations
13. **Color contrast** — fix muted-foreground for WCAG AA

### P2 — Enhancement (polish for premium feel)
14. **Activity timeline on detail pages**
15. **Keyboard shortcuts**
16. **Page transitions (subtle motion)**
17. **Sign-in page branding**
18. **Form validation inline feedback**
19. **Card view alternative for list pages**
20. **Skip-to-content link**
21. **Chart accessibility (aria-label)**

## 13. Proposed Implementation Phases

### Phase UI-1 — Foundation (P0 items)
- Create shared components: `<PageHeader>`, `<DataTable>`, `<EmptyState>`, `<LoadingSkeleton>`, `<StatusBadge>`, `<FilterBar>`
- Implement sidebar collapse + mobile Sheet drawer
- Implement global command palette (cmd+k)
- Add filter/search to all list pages
- **Estimated changes:** ~15 files modified, ~5 new components

### Phase UI-2 — Professional Polish (P1 items)
- Implement breadcrumbs
- Add pagination controls to list pages
- Standardize empty states + loading skeletons + toasts across all pages
- Redesign dashboard (recent activity, charts, quick actions)
- Adopt brand color + status color system
- Add sidebar grouping labels
- Implement quick-view drawer
- Fix color contrast
- **Estimated changes:** ~40 files modified, ~5 new components

### Phase UI-3 — Premium Enhancements (P2 items)
- Activity timeline on detail pages
- Keyboard shortcuts
- Page transitions
- Sign-in page branding
- Form validation feedback
- Chart accessibility
- **Estimated changes:** ~20 files modified, ~3 new components

---

## Summary Scores

| Dimension | Score / 10 | Rationale |
|---|---|---|
| **UI** | 5/10 | Functional but generic; no brand identity; inconsistent components |
| **UX** | 4/10 | No search, no filters, no breadcrumbs; basic navigation only |
| **Accessibility** | 6/10 | Decent aria usage; contrast issues; charts not accessible |
| **Responsive** | 3/10 | No mobile sidebar; tables overflow; no tablet layout |
| **Design-system maturity** | 5/10 | 48 components installed but no shared patterns; no design tokens beyond CSS variables |
| **Overall** | **4.5/10** | Functional foundation but not yet a professional enterprise product |

## What Already Works

- ✅ 66 pages across all 15 domain modules
- ✅ 48 shadcn/ui components installed
- ✅ Sign-in + authentication flow
- ✅ Sidebar navigation with permission-gated sections
- ✅ 5 detail pages with transition buttons + dialogs
- ✅ 20 analytics pages with recharts charts
- ✅ AI Assistant with 5-part structured response
- ✅ Dark/light theme toggle
- ✅ i18n FR/EN/AR + RTL
- ✅ Toast notifications (on detail pages)
- ✅ Skeleton loading (on detail pages)

## What Should Be Improved First

1. **Global search/command palette** (P0) — most impactful UX improvement
2. **Filter/search on list pages** (P0) — second most impactful
3. **Sidebar collapse + mobile drawer** (P0) — unblocks mobile/tablet UAT
4. **Standardized shared components** (P1) — reduces inconsistency
5. **Dashboard redesign** (P1) — first impression of the application

## Exact Files/Components That Should Be Modified

### New components to create
- `src/components/app/page-header.tsx`
- `src/components/app/data-table.tsx`
- `src/components/app/empty-state.tsx`
- `src/components/app/loading-skeleton.tsx`
- `src/components/app/status-badge.tsx`
- `src/components/app/filter-bar.tsx`
- `src/components/app/command-palette.tsx`
- `src/components/app/breadcrumb-trail.tsx`
- `src/components/app/quick-view-drawer.tsx`
- `src/components/app/activity-timeline.tsx`
- `src/components/app/stat-card.tsx`

### Files to modify
- `src/components/app/app-sidebar.tsx` — add collapse + mobile drawer + grouping labels
- `src/components/app/app-topbar.tsx` — add breadcrumbs + search trigger + notifications
- `src/app/[locale]/(app)/page.tsx` — redesign dashboard
- `src/app/[locale]/(app)/layout.tsx` — integrate command palette
- `src/app/globals.css` — adopt brand color + status colors
- `src/app/[locale]/sign-in/page.tsx` — add branding
- All 40+ list pages — adopt `<DataTable>` + `<FilterBar>` + `<EmptyState>` + `<LoadingSkeleton>`
- All 5 detail pages — add `<BreadcrumbTrail>` + `<ActivityTimeline>`

---

**STOP.** This is a read-only audit. No code was modified. Awaiting owner approval before implementing any UI changes.
