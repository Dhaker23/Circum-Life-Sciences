# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

> Decided in Phase 0 setup: keep the default label vocabulary (recommended). The repo uses the local-markdown issue tracker (see `issue-tracker.md`), so these "labels" are recorded as the `Status:` / triage-role line near the top of each `.scratch/<feature>/issues/NN-<slug>.md` file.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Circum note

These triage labels apply only to **engineering planning issues** in `.scratch/`. They do **not** map to Circum controlled-record statuses (e.g. batch `Ready for Review → QA Review → Approved/Hold/Rework/Reject`, or CAPA `Open → Investigation → … → Closure`). Controlled-record state machines are defined in `DOMAIN_GLOSSARY.md` and enforced by the application, never by triage labels.
