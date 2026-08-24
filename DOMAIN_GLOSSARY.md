# Circum — DOMAIN GLOSSARY

> Detailed definitions of Circum medical-device manufacturing & QMS terms, including controlled-workflow state machines and regulatory notes. Complements `CONTEXT.md` (concise ubiquitous language). Required by Circum Master PRD §16.
>
> **Source of truth:** `docs/PRD/` (Circum Master PRD). Terms here are extracted from the PRD; they are **not** invented. Where the PRD is silent on a precise boundary, the entry is marked **(open)** for `/grill-with-docs` resolution.
>
> **AI governance reminder (PRD §9):** AI may assist with Q&A, investigations, hypotheses, trend explanation, KPI analysis, and report drafting — but must **never** release product, approve batch disposition, close CAPA, close critical problems, approve deviations/changes/documents, modify validated parameters, override specifications, delete quality records, or fabricate evidence. Human approval is mandatory; core factory workflows must operate when AI is unavailable.

## 1. Organization & RBAC (PRD §3)

**Site Administrator / Plant Manager / Production Manager / Production Planner / Shift Supervisor / Operator / Quality Manager / QA Reviewer/Approver / Quality Engineer / Laboratory Technician / Validation Engineer / Maintenance Manager / Maintenance Technician / Calibration Technician / Warehouse/Logistics Manager / Lean Manager / Auditor / Executive Viewer / Super Administrator**
Configurable roles. Permissions enforce least privilege, site/department/module access, and controlled-workflow transition authorization.

## 2. Manufacturing master data (PRD §5)

- **Site / Department**: physical + organizational scoping.
- **Product / Device master**: the catalog of manufactured devices.
- **Product Revision**: controlled version of a product's design/spec.
- **BOM / Materials / Material Lots / Suppliers**: controlled input genealogy.
- **Process Routing / Manufacturing Instructions**: how to build.
- **Production Planning / Work Orders**: authorized production intents.
- **Manufacturing Batches / Device Lots**: produced traceable units.
- **Production Execution / Shifts / Handover**: shop-floor execution.

## 3. Traceability genealogy (PRD §5, §10)

Forward and backward:
Customer/Project → Product → Revision → BOM → Material Lot → Work Order → Batch/Device Lot → Operations → Equipment → Operators → Inspection/Testing → Packaging → Sterilization → Disposition → Shipment.

**Traceability errors are critical defects.**

## 4. Quality / QMS controlled records (PRD §5, §9)

Every controlled record carries: unique ID, status, owner, evidence, approval history, audit trail, closure criteria.

### 4.1 Document Control
`Draft → Review → Approval → Effective → Revision → Obsolete/Retired`

### 4.2 Training
`Employee → Required Training → Training → Assessment → Competency → Authorization`

### 4.3 Deviation
`Draft → Assessment → Investigation → Review → Closure`

### 4.4 CAPA
`Open → Investigation → Action Plan → Implementation → Effectiveness → Closure`

### 4.5 Change Control
`Request → Impact → Risk → Approval → Implementation → Verification → Effectiveness → Closure`

### 4.6 NCR / Nonconformity
Record of nonconformance; links to Deviation/RCA/CAPA as applicable. _(open: exact Circum NCR state machine — propose `Draft → Containment → Investigation → Disposition → Closure`)._

### 4.7 Risk Management
Hazards × severity × probability × mitigations; recorded and reviewed.

### 4.8 Supplier Quality / Audits
Supplier qualification, audits, and quality scoring.

## 5. Batch Review & Release (PRD §6)

`Ready for Review → QA Review → Approved (Released) / Hold / Rework / Reject`

**Release/disposition requires authorized human action. Never autonomous.**

## 6. Equipment, Maintenance & Calibration (PRD §5)

Calibration statuses: `VALID / EXPIRING / EXPIRED / OUT OF SERVICE`.

## 7. Validation (IQ/OQ/PQ) (PRD §5)

`Requirement → Protocol → Execution → Result → Deviation → Approval → Report`

**Never invent acceptance criteria.**

## 8. Cleanroom Monitoring (PRD §5)

Configurable: room, classification, point, parameter, unit, alert/action limits, results, excursions. **Limits are never hard-coded.**

## 9. Laboratory / Testing (PRD §5)

`Product/Lot → Sample → Test → Method → Specification → Result → Review → Disposition`

**Never invent specifications.**

## 10. Packaging (PRD §5)

Packaging materials/lots, configuration, process, equipment, operators, parameters, inspection.

## 11. Sterilization (PRD §5)

Configurable processes: EtO, Gamma, Beta/e-beam, X-ray. Track: device lot, sterilization lot, cycle, equipment, parameters, validation status, routine cycle, testing, deviations, release status. **Software must never autonomously release sterile product.**

## 12. Lean / OEE / VSM (PRD §7)

- **OEE** = Availability × Performance × Quality.
- Supports: takt time, cycle time, FPY (First Pass Yield), scrap, rework, downtime, MTBF, MTTR, Pareto, bottleneck analysis.
- **VSM**: Supplier → Material → Process → Inventory → Process → Customer. Metrics: lead time, value-added time, non-value-added time, value-added ratio.

## 13. Audit Trail (PRD §10, §13)

Captures: User, Action, Entity, Timestamp, Previous state/value, New state/value, Reason, Session/IP. **Normal users cannot edit/delete audit history.**

## 14. AI Assistant output contract (PRD §9)

AI responses must distinguish: **Answer / Evidence / Interpretation / Recommendation / Limitations**.

## 15. Priority order (PRD §1, §8)

Safety > Quality > Traceability > Data Integrity > Controlled Workflows > Validation Evidence > Security > Operational Efficiency > Lean/OEE/VSM > AI.

No AI feature, dashboard, or UI shortcut may bypass controlled quality processes.

## 16. Open terminology (for `/grill-with-docs`)

- Exact NCR state machine (§4.6).
- Manufacturing Batch ↔ Device Lot cardinality (1:1 vs 1:N).
- Whether "Release" in Sterilization is distinct from batch Disposition.
- Multi-site data isolation model (per-site DB vs shared DB with site-scoping).
- Demarcation between Deviation (planned) and NCR (unplanned) in Circum's usage.
