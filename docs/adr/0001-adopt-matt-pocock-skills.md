# ADR-0001: Adopt Matt Pocock Skills as the Engineering-Process Toolkit

- **Status:** Proposed (awaiting owner approval — Phase 0)
- **Date:** Phase 0
- **Deciders:** Circum project owner
- **Supersedes:** —

## Context

Circum is a regulated medical-device manufacturing & QMS platform (see `docs/PRD/`). The Master Engineering Prompt (§4, §15) and PRD (§15) direct us to use the Matt Pocock `skills` repository (https://github.com/mattpocock/skills) as an **engineering-process toolkit** — not as Circum application modules. These skills provide disciplined, composable practices for requirements alignment (`grill-with-docs`), domain modeling (`domain-modeling`), codebase design (`codebase-design`), TDD (`tdd`), debugging (`diagnosing-bugs`), code review (`code-review`), architecture improvement (`improve-codebase-architecture`), specification (`to-spec`), ticket decomposition (`to-tickets`), implementation (`implement`), and multi-session planning (`wayfinder`).

The skills are **prompt-driven process disciplines**, not deterministic scripts. They never carry business logic.

## Decision

1. **Install** the Matt Pocock skills into this repo as owned, editable files under `docs/agents/skills/` (the documented "tinkerer" route from the repo README: "writes the skills into your repo as ordinary files you own and can edit"). The promoted `engineering/` (18) and `productivity/` (7) buckets are installed; `misc/` and `in-progress/` are intentionally excluded to keep the surface small.
2. **Configure** the repo via the `setup-matt-pocock-skills` skill: local-markdown issue tracker under `.scratch/` (no git remote exists; local-first controlled environment), single-context domain-doc layout, default triage labels. Config written to `docs/agents/{issue-tracker,domain,triage-labels}.md`.
3. **Hierarchy of authority:** Circum Master PRD > approved ADRs > Matt Pocock skill guidance. If a skill's output conflicts with an approved Circum requirement (especially controlled-workflow, traceability, or data-integrity requirements), follow the PRD conflict rule: **STOP → identify conflict → propose resolution → wait for owner approval.** Never let a skill weaken a controlled quality process or enable AI to autonomously approve/release/close/modify controlled quality records.
4. **Skill selection is deliberate, not blanket.** Match the skill to the engineering problem (see `docs/PRD/PHASE-0-DISCOVERY-REPORT.md` §18 for the per-task mapping).
5. **Root agent file** (`CLAUDE.md` vs `AGENTS.md`): deferred to owner decision (see Open Questions). The `## Agent skills` block will be added to the chosen file after approval.

## Alternatives considered

- **Claude Code managed plugin** (`claude plugins install mattpocock-skills`): read-only, updates automatically. Rejected for Circum because (a) this is a Next.js/Z.ai environment, not a Claude Code session, and (b) controlled medical-device projects benefit from owned, pinned, reviewable process files rather than auto-updating ones.
- **`npx skills@latest add mattpocock/skills` interactive installer**: the documented Codex/agent route. Attempted; the installer's internal clone step exceeded the sandbox execution deadline. Achieved the equivalent outcome (owned editable skill files in-repo) via direct shallow clone + copy, which is the same "tinkerer" install philosophy the README endorses.
- **No skills toolkit**: rejected — the PRD explicitly requires disciplined engineering (TDD, code review, phase gates, domain modeling) and the skills encode those disciplines.

## Consequences

- **Positive:** Disciplined, traceable engineering process aligned to the PRD's validation-minded workflow; reusable grilling/domain-modeling that sharpens the Circum ubiquitous language; clear skill-to-task mapping reduces ad-hoc decisions.
- **Negative / cost:** Skills are prompt-driven and add ceremony; engineers must choose the right skill rather than invoke blindly; `docs/agents/skills/` adds ~25 SKILL.md files to the repo (eslint already ignores the top-level `skills/` dir; the `docs/agents/skills/` path is documentation, not linted source).
- **Risk:** A skill could be misapplied to bypass a controlled workflow. Mitigated by decision point 3 (authority hierarchy + conflict rule) and by keeping all controlled-record state machines in the application/database, never in skill-driven markdown.
- **Reversibility:** Medium. Removing the toolkit is a `git rm`; reconfiguring issue tracker / domain layout later is documented in `setup-matt-pocock-skills`.

## Compliance note

This ADR concerns **engineering process only**. It does not assert ISO 13485 / FDA 21 CFR Part 820 / Part 11 / GxP compliance. Compliance depends on intended use, validated configuration, infrastructure, security, and evidence (per PRD §17).
