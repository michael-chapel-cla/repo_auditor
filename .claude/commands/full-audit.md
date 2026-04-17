# /full-audit

Run a complete security, quality, API, and DB audit on a GitHub repository.

**Usage:** `/full-audit owner/repo` or `/full-audit` (uses GITHUB_REPOS from .env)

## What I will do

I will act as a multi-agent orchestrator and run all four audits in sequence, then generate reports.

Read the full agent instructions from `agents/claude/full-audit.md` and execute every step precisely.

Key points:
- I will read the relevant `docs/context/` file before beginning each audit category (01-security.md, 02-code-quality.md, 03-api-standards.md, 04-db-migrations.md)
- I will use Bash, Read, and Glob tools to perform the actual checks
- I will write structured JSON output to `reports/{slug}/{auditId}/results.json`
- I will generate `report.md` and `report.html` in the same directory
- I will never commit secrets, hardcode credentials, or read outside the project workspace

The target repo is: $ARGUMENTS
