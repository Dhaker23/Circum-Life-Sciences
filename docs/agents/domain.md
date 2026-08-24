# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`DOMAIN_GLOSSARY.md`** at the repo root: the detailed Circum medical-device / QMS term definitions and controlled-workflow states (required by Circum PRD §16, complements `CONTEXT.md`).
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (this repo):

```
/
├── CONTEXT.md              ← ubiquitous-language glossary (concise)
├── DOMAIN_GLOSSARY.md      ← detailed medical-device/QMS term definitions + workflow states
├── docs/
│   ├── adr/
│   │   ├── 0001-adopt-matt-pocock-skills.md
│   │   └── ...
│   ├── PRD/                ← Circum PRD + phase reports
│   ├── architecture/
│   ├── validation/
│   ├── testing/
│   ├── operations/
│   ├── api/
│   └── user-guides/
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md` / `DOMAIN_GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

## Circum-specific rule

The Circum PRD is the **primary source of truth**. If any Matt Pocock skill output conflicts with an approved Circum requirement, follow the PRD's conflict rule: **STOP → identify conflict → propose resolution → wait for owner approval.** Never let a skill weaken a controlled-workflow, traceability, or data-integrity requirement.
