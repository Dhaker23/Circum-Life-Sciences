# CIRCUM LIFE SCIENCES — MASTER PRODUCT REQUIREMENTS DOCUMENT
## FINAL CONSOLIDATED EDITION

**Status:** MASTER SOURCE OF TRUTH  
**Purpose:** Medical Device Manufacturing & Quality Management Platform

### 1. Product Vision
Build a production-grade Medical Device Manufacturing & Quality Management Platform for a regulated manufacturing/CDMO environment.

The platform combines Production, Device/Batch/Lot Traceability, BOM/Material Lots, Quality Management, NCR, Deviations, CAPA, Change Control, Risk Management, Document Control, Training, Equipment/Maintenance/Calibration, Cleanroom Monitoring, Laboratory/Testing, IQ/OQ/PQ and validation workflows, Packaging, Sterilization, Batch Review/Release, Lean/OEE/VSM, Analytics, controlled AI assistance, and Enterprise Security.

Priority:
1. Safety
2. Quality
3. Traceability
4. Data integrity
5. Controlled workflows
6. Validation evidence
7. Security
8. Operational efficiency
9. Lean/OEE/VSM
10. AI assistance

### 2. Circum Context
The supplied company context describes Circum Life Sciences as a vertically integrated CDMO focused on medical devices and life sciences, established between Switzerland, France and Tunisia, with Circum Medtech Pharma supporting activities before manufacturing and Circum Life Sciences focusing on manufacturing.

Do not invent real operational data. Sites, products, customers, employees, equipment, cleanroom limits, sterilization parameters, laboratory specifications, regulatory acceptance criteria and capacities must be configurable. Use clearly labelled DEMO/TEST data where real data is unavailable.

### 3. Users and RBAC
Configurable roles include Super Administrator, Site Administrator, Plant Manager, Production Manager, Production Planner, Shift Supervisor, Operator, Quality Manager, QA Reviewer/Approver, Quality Engineer, Laboratory Technician, Validation Engineer, Maintenance Manager, Maintenance Technician, Calibration Technician, Warehouse/Logistics Manager, Lean Manager, Auditor and Executive Viewer.

Permissions must support least privilege, site/department/module access and controlled workflow transitions.

### 4. Languages
Initial UI: French, English and Arabic. Arabic must support RTL. No hard-coded user-facing strings.

### 5. Core Modules
**Manufacturing:** sites/departments, product/device master, revisions, BOM/materials, suppliers, process routing, manufacturing instructions, production planning, work orders, manufacturing batches/device lots, production execution, shifts/handover.

**Traceability:** forward and backward genealogy:
Customer/Project → Product → Revision → BOM → Material Lot → Work Order → Batch/Device Lot → Operations → Equipment → Operators → Inspection/Testing → Packaging → Sterilization → Disposition → Shipment.

**Quality/QMS:** inspection, NCR/nonconformity, deviations, RCA, CAPA, change control, risk management, supplier quality, audits, batch review, release/disposition.

Controlled records require unique ID, status, owner, evidence, approval history, audit trail and closure criteria.

**Document Control:** Draft → Review → Approval → Effective → Revision → Obsolete/Retired.

**Training:** Employee → Required Training → Training → Assessment → Competency → Authorization.

**Equipment:** equipment master, maintenance, calibration and status tracking. Calibration statuses: VALID / EXPIRING / EXPIRED / OUT OF SERVICE.

**Validation:** IQ, OQ, PQ, process validation, equipment qualification, cleanroom qualification and test-method validation where applicable. Workflow: Requirement → Protocol → Execution → Result → Deviation → Approval → Report. Never invent acceptance criteria.

**Cleanroom:** configurable room, classification, point, parameter, unit, alert/action limits, results and excursions. Never hard-code limits.

**Laboratory:** Product/Lot → Sample → Test → Method → Specification → Result → Review → Disposition. Never invent specifications.

**Packaging:** packaging materials/lots, configuration, process, equipment, operators, parameters and inspection.

**Sterilization:** configurable support for applicable processes such as EtO, Gamma, Beta/e-beam or X-ray. Track device lot, sterilization lot, cycle, equipment, parameters, validation status, routine cycle, testing, deviations and release status. Software must never autonomously release sterile product.

### 6. Batch Review / Release
Batch review may include production, materials, traceability, equipment, operators, inspection, laboratory, deviations, NCR, CAPA, packaging, sterilization and controlled documents.

Workflow: Ready for Review → QA Review → Approved / Hold / Rework / Reject.

Release/disposition requires authorized human action.

### 7. Lean / OEE / VSM
Lean/OEE/VSM remains part of Circum, but is built on trusted manufacturing and quality data.

OEE = Availability × Performance × Quality.

Support takt time, cycle time, FPY, scrap, rework, downtime, MTBF, MTTR, Pareto and bottleneck analysis.

VSM: Supplier → Material → Process → Inventory → Process → Customer. Calculate lead time, value-added time, non-value-added time and value-added ratio.

### 8. Analytics
Dashboards: planned vs actual production, OEE, availability, performance, quality, downtime, reject rate, delivery performance, critical problems, overdue actions and bottlenecks.

Reports: shift, daily, weekly, monthly, OEE trends, quality trends, downtime Pareto, equipment performance, recurrence and action effectiveness.

### 9. AI Assistant
AI may assist with factory/QMS Q&A, approved-document Q&A, batch investigation, root-cause hypotheses, recurrence detection, trend explanation, KPI analysis, report drafting and recommendations.

Responses must distinguish Answer / Evidence / Interpretation / Recommendation / Limitations.

AI must NEVER release product, approve batch disposition, close CAPA, close critical problems, approve deviations/changes/documents, modify validated parameters, override specifications, delete quality records or fabricate evidence.

Human approval remains mandatory. Core factory workflows must continue if AI is unavailable.

### 10. Security / Data Integrity
Implement authentication, RBAC, least privilege, secure sessions, API authorization, input validation, applicable injection/XSS/CSRF protection, secrets management, audit logs, backup/recovery and monitoring.

Database constraints and transactions must prevent duplicates, broken references, impossible quantities/timestamps and unauthorized state transitions.

Normal users cannot edit/delete controlled audit history.

### 11. Architecture
Preferred stack: Next.js/React/TypeScript, Tailwind CSS, Python/FastAPI, PostgreSQL, Docker/Docker Compose, Redis only where justified, Keycloak or equivalent, Python analytics and a provider-agnostic AI/RAG layer.

Architecture:
Presentation → API → Application Services → Domain Logic → Infrastructure → Database/Cache/Events.

Critical business logic must not live only in the UI.

The existing project must be inspected before imposing architectural changes.

### 12. Local-First
Core factory workflows must operate on the internal factory LAN without continuous Internet access. Internet may be used for cloud AI, authorized integrations, updates and remote administration.

### 13. Integrations
Use controlled adapters for ERP, MES, PLC, SCADA, IoT, Barcode/RFID, LIMS, PLM, HR and maintenance systems. Avoid tight coupling to one vendor.

### 14. UI/UX
Professional industrial enterprise interface: clear, fast, trustworthy, accessible, data-dense but readable, desktop-first with selected tablet/mobile workflows. Use KPI cards, tables, charts, timelines, status indicators, drill-downs, workflow views, VSM, notifications, search and filters. Motion must improve usability, not distract.

### 15. Matt Pocock Engineering Skills
Repository: https://github.com/mattpocock/skills

These skills are ENGINEERING PROCESS TOOLS, not Circum business modules. Use available/documented skills for requirements analysis, documentation review, domain modeling, codebase design, TDD, debugging, code review, architecture improvement, specification, ticket decomposition and implementation.

The exact installed version and available skill names are authoritative. Never invent a skill name.

Skills never override this PRD. If a skill conflicts with an approved Circum requirement:
STOP → identify conflict → propose resolution → wait for owner approval.

### 16. Documentation
Maintain:
docs/PRD/
docs/architecture/
docs/adr/
docs/validation/
docs/testing/
docs/operations/
docs/api/
docs/user-guides/
CONTEXT.md
DOMAIN_GLOSSARY.md

### 17. Validation-Minded Engineering
For controlled features:
Intended Use → Requirement → Risk → Design → Implementation → Test → Evidence → Review → Approval → Change History.

Do not claim automatic ISO/FDA/GxP compliance merely because software features exist. Compliance depends on applicable requirements, intended use, procedures, validated configuration, infrastructure, security and evidence.

### 18. Consolidated Development Roadmap
**Phase 0:** Discovery / existing-project analysis / architecture / engineering environment / skills capability  
**Phase 1:** Identity / organization / sites / departments / roles / permissions / authentication / audit  
**Phase 2:** Product / device / revision / BOM / material master / suppliers  
**Phase 3:** Production planning / work orders / routing / operations / shifts / execution  
**Phase 4:** Traceability / genealogy / impact analysis  
**Phase 5:** Quality / inspection / laboratory / specifications / testing  
**Phase 6:** NCR / nonconformity / deviation / RCA / CAPA  
**Phase 7:** Document control / training / change control / risk / audits  
**Phase 8:** Equipment / maintenance / calibration / qualification / validation  
**Phase 9:** Cleanroom / packaging / sterilization / batch review / release-disposition  
**Phase 10:** Lean / OEE / VSM / downtime / bottlenecks  
**Phase 11:** Analytics / reporting / dashboards  
**Phase 12:** AI assistant / RAG / controlled intelligence  
**Phase 13:** Integrations / deployment / backup / recovery / observability  
**Phase 14:** Enterprise hardening / performance / security / final validation

### 19. Mandatory Phase Gate
At every phase:
STOP FEATURE DEVELOPMENT → Build → Unit tests → Integration tests → API tests → Database tests → Authorization tests → Workflow tests → UI tests → E2E tests → Regression → Security review → Data-integrity review → Audit review → Domain-language review → Code review → Performance review → Browser/console review → Fix → Retest → Final regression → Phase Validation Report → STOP → Owner approval.

Never advance automatically.

Critical failure = PHASE FAIL; remain in the current phase until fixed and retested.

### 20. Phase Validation Report
Produce:
Phase; Objective; Requirements covered; Features completed; Files changed; Database changes; API changes; UI changes; Domain-model changes; ADR changes; Tests/results; Bugs found/fixed; Regression results; Security review; Data-integrity review; Audit review; Performance review; Known limitations; Remaining issues; Final status PASS / CONDITIONAL / FAIL.

Then:
PHASE GATE STATUS: READY FOR OWNER REVIEW

STOP.

### 21. Demo Data
Use synthetic DEMO/TEST data where real Circum data is unavailable. Label it clearly. Never present invented information as real Circum information. Never include confidential information or secrets.

### 22. Success Criteria
The platform must be reliable, secure, maintainable, scalable, testable, observable, multilingual, traceable, audit-ready, validation-minded, usable by factory personnel, capable of controlled QMS workflows, capable of production analytics and safe AI usage.

END OF CIRCUM MASTER PRD
