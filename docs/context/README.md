# Agent Context Docs

These files are optimized for use as LLM agent context during audits.
Load the relevant file(s) before running each audit category.

| File | Load for | Priority |
|---|---|---|
| `01-security.md` | `/security-audit` | Always load first |
| `02-code-quality.md` | `/quality-audit` | Load second |
| `03-api-standards.md` | `/api-audit` | Load for API repos |
| `04-db-migrations.md` | `/db-audit` | Load for repos with `db/migrations/` |

## Severity Scale

| Severity | Score Penalty | Meaning |
|---|---|---|
| CRITICAL | -25 | Must fix before merge. Exploit possible now. |
| HIGH | -15 | Fix in current sprint. Significant risk. |
| MEDIUM | -7 | Fix soon. Moderate risk or standards violation. |
| LOW | -3 | Fix when convenient. Minor issue. |
| INFO | 0 | Note for awareness. No action required. |

Starting score: **100**. Minimum: **0**.

