# Repo Auditor

> AI-powered repository auditing platform. Run security, code quality, API compliance, and database migration checks against any GitHub repository — using Claude Code, OpenAI Codex, or GitHub Copilot as the audit engine.

---

## What it does

Agents clone a target repository, run static analysis tools, and use LLM reasoning to surface issues that tools alone miss. Results are written to `reports/` as structured JSON, Markdown, and HTML. A React/MUI dashboard reads those reports — no backend audit logic required.

**Audit categories:** Security · Code Quality · API Standards · DB Migrations · Contributors

---

## Quick start

```bash
git clone <this-repo> repo_auditor && cd repo_auditor
cp .env.example .env        # add your AI key + target repos
npm run bootstrap            # install deps + semgrep + gitleaks + flyway

# Run an audit
./scripts/run-with-claude.sh owner/repo   # Claude Code
./scripts/run-with-codex.sh  owner/repo   # OpenAI Codex
./scripts/run-with-copilot.sh myorg/repo-auditor owner/repo  # GitHub Copilot

# View results
npm run dev:api       # http://localhost:4000
npm run dev:frontend  # http://localhost:5173
```

---

## Documentation

| Doc | Description |
| --- | ----------- |
| [docs/instructions.md](docs/instructions.md) | Full install, configuration, and usage guide |
| [ROADMAP.md](ROADMAP.md) | Planned features across 6 phases |
| [docs/context/01-security.md](docs/context/01-security.md) | 20 security rules loaded by agents |
| [docs/context/02-code-quality.md](docs/context/02-code-quality.md) | 18 code quality standards |
| [docs/context/03-api-standards.md](docs/context/03-api-standards.md) | 24 API compliance rules |
| [docs/context/04-db-migrations.md](docs/context/04-db-migrations.md) | 13 DB migration safety rules |
| [scripts/report-schema.json](scripts/report-schema.json) | JSON schema all agents must produce |

---

## Agents

| Tool | Instructions | Slash command |
| ---- | ------------ | ------------- |
| Claude Code | `agents/claude/full-audit.md` | `/full-audit owner/repo` |
| OpenAI Codex | `agents/codex/full-audit.md` | `codex --task agents/codex/full-audit.md` |
| GitHub Copilot | `agents/copilot/audit-instructions.md` | Actions → Run workflow |

---

## Report output

```
reports/
└── {owner_repo}/
    └── {auditId}/
        ├── results.json      ← structured findings (all categories)
        ├── contributors.json ← commit stats per author
        ├── npm-audit.json    ← raw npm audit output
        ├── report.md         ← human-readable summary
        └── report.html       ← color-coded HTML report
```

Overall score: 0–100, starting at 100 with penalties per finding (critical −25, high −15, medium −7, low −3).

---

## License

MIT
