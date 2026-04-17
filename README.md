# Repo Auditor

A multi-AI repository auditing platform. Audits run entirely as AI agent workflows — Claude Code, OpenAI Codex, or GitHub Copilot execute security, code quality, API compliance, and database migration checks against any GitHub repository. The React/MUI frontend is a read-only viewer of the reports those agents produce.

---

## How it works

```
You (or a schedule)
  └─► run-with-claude.sh owner/repo
        └─► Claude Code reads agents/claude/full-audit.md
              ├─► clones the target repo to workspace/
              ├─► runs security, quality, API, and DB audits
              ├─► writes reports/{owner_repo}/{auditId}/results.json
              └─► generates report.md + report.html

Frontend (React + MUI)
  └─► reads reports/ via the API server (api/src/index.ts)
        ├─► Dashboard: latest audit scores per repo
        ├─► Results: findings table + severity breakdown
        └─► Contributors: commit stats and leaderboard
```

---

## Prerequisites

| Tool | Required for | Install |
|------|-------------|---------|
| Node.js ≥ 20 | API server + frontend | [nodejs.org](https://nodejs.org) |
| npm ≥ 10 | Workspace dependencies | bundled with Node |
| claude CLI | Claude Code audits | `npm install -g @anthropic-ai/claude-code` |
| git | Cloning target repos | system package |
| semgrep | Static security scan | `pip install semgrep` or `npm install -g semgrep` |
| gitleaks | Secrets detection | see bootstrap.sh or [gitleaks.io](https://gitleaks.io) |
| codex CLI | OpenAI Codex audits (optional) | `npm install -g @openai/codex` |
| gh CLI | Copilot/Actions audits (optional) | [cli.github.com](https://cli.github.com) |
| Java 17 | Flyway DB audits (optional) | system package |

---

## Quick start

### 1. Clone and configure

```bash
git clone <this-repo> repo_auditor
cd repo_auditor

cp .env.example .env
```

Edit `.env` — only fill in the key for the AI tool you plan to use:

```bash
# Repos to audit — comma-separated owner/repo pairs
GITHUB_REPOS=myorg/my-api,myorg/my-frontend

# GitHub token — needs repo read scope for contributor stats
GITHUB_TOKEN=ghp_your_token_here

# --- Set ONE of the following depending on which AI tool you use ---

# Claude Code: https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-your_key_here

# OpenAI Codex: https://platform.openai.com
# OPENAI_API_KEY=sk-your_key_here

# GitHub Copilot: no API key needed — uses your GitHub login via `gh auth login`
```

### 2. Install dependencies

```bash
npm run bootstrap
# or: bash scripts/bootstrap.sh
```

This installs npm workspace dependencies plus semgrep, gitleaks, and Flyway CLI.

### 3. Run an audit

```bash
# Claude Code (recommended)
./scripts/run-with-claude.sh owner/repo

# OpenAI Codex
./scripts/run-with-codex.sh owner/repo

# GitHub Copilot via Actions
./scripts/run-with-copilot.sh myorg/repo-auditor owner/repo
```

Or use Claude Code slash commands interactively:

```
/full-audit owner/repo
/security-audit owner/repo
/quality-audit owner/repo
/api-audit owner/repo
/db-audit owner/repo
```

### 4. View results

```bash
# Start the API server
npm run dev:api        # http://localhost:4000

# Start the frontend viewer
npm run dev:frontend   # http://localhost:5173
```

---

## DevContainer (recommended)

Open this repo in VS Code and click **Reopen in Container**. The devcontainer:

- Runs Node 20, Java 17 (for Flyway), Docker-in-Docker, and GitHub CLI
- Runs `scripts/bootstrap.sh` automatically on creation
- Forwards ports 5173 (Vite dev), 4000 (API), 3000 (prod), 1433 (MSSQL optional)
- Installs all required VS Code extensions

To enable the optional MSSQL sidecar for DB migration testing:

```bash
docker compose --profile db up
```

---

## Project structure

```
repo_auditor/
├── agents/
│   ├── claude/             # Audit instruction files for Claude Code
│   │   ├── full-audit.md   # Orchestrator: runs all four audit categories
│   │   ├── security-audit.md
│   │   ├── quality-audit.md
│   │   ├── api-audit.md
│   │   ├── db-audit.md
│   │   └── contributors.md
│   ├── codex/              # Same audit logic for OpenAI Codex CLI
│   └── copilot/            # Instructions for GitHub Copilot / Actions
│
├── .claude/
│   ├── commands/           # Claude Code slash commands (/full-audit, etc.)
│   ├── hooks/              # guard.sh — blocks destructive operations
│   └── settings.json
│
├── .github/
│   └── workflows/
│       └── audit.yml       # Manual audit trigger (workflow_dispatch only)
│
├── .devcontainer/          # Dev container config (Node 20 + Java 17 + Docker)
├── .semgrep/               # Custom Semgrep rules (12 security patterns)
│
├── docs/
│   └── context/            # Rule sets loaded by agents before each audit
│       ├── 01-security.md      # 20 security rules with severity + CWE
│       ├── 02-code-quality.md  # 18 quality rules with detection commands
│       ├── 03-api-standards.md # 24 API compliance rules
│       └── 04-db-migrations.md # 13 DB migration safety rules
│
├── scripts/
│   ├── bootstrap.sh            # Install all tools + npm deps
│   ├── run-with-claude.sh      # Run audit with Claude Code CLI
│   ├── run-with-codex.sh       # Run audit with Codex CLI
│   ├── run-with-copilot.sh     # Trigger GitHub Actions workflow
│   └── report-schema.json      # JSON Schema all agents must produce
│
├── api/
│   └── src/index.ts        # Static file server — serves reports/ + frontend
│
├── engine/
│   └── src/types/          # TypeScript type definitions (shared contract)
│
├── frontend/
│   └── src/
│       ├── features/
│       │   ├── dashboard/      # Latest scores per repo
│       │   ├── results/        # Findings table + severity chart
│       │   ├── audits/         # How-to instructions page
│       │   └── contributors/   # Commit timeline + leaderboard
│       ├── hooks/
│       ├── services/
│       └── components/
│
├── reports/                # Agent output (gitignored except .gitkeep)
│   └── {owner_repo}/
│       └── {auditId}/
│           ├── results.json
│           ├── report.md
│           └── report.html
│
├── workspace/              # Cloned repos (gitignored)
├── .env.example
├── CLAUDE.md
└── codex.yaml
```

---

## Audit categories

Each audit produces findings with a severity score (starting at 100, penalties applied per finding).

| Category | Agent file | Slash command | What it checks |
|----------|-----------|---------------|----------------|
| Security | `agents/claude/security-audit.md` | `/security-audit` | npm audit, gitleaks, Semgrep, AI code scan (injection, secrets, JWT, XSS, path traversal) |
| Code Quality | `agents/claude/quality-audit.md` | `/quality-audit` | ESLint, test coverage, console.log, unused deps, TypeScript any, component size, DRY/SOLID |
| API Standards | `agents/claude/api-audit.md` | `/api-audit` | OpenAPI spec, URI versioning, HTTP methods, status codes, auth, CORS, rate limiting, security headers |
| DB Migrations | `agents/claude/db-audit.md` | `/db-audit` | Flyway naming, duplicate versions, edited migrations, SQL injection, transactions, DROP safeguards |
| Contributors | `agents/claude/contributors.md` | (part of full-audit) | Commit stats per author, weekly activity timeline |

### Severity scale

| Severity | Score penalty | Meaning |
|----------|--------------|---------|
| CRITICAL | -25 | Must fix before merge. Exploit possible now. |
| HIGH | -15 | Fix this sprint. Significant risk. |
| MEDIUM | -7 | Fix soon. Moderate risk or standards violation. |
| LOW | -3 | Fix when convenient. Minor issue. |
| INFO | 0 | Note for awareness. No action required. |

---

## Report output schema

All agents write `results.json` conforming to `scripts/report-schema.json`. Key fields:

```json
{
  "auditId": "uuid",
  "repoFullName": "owner/repo",
  "status": "complete",
  "startedAt": "2026-04-17T00:00:00Z",
  "agentTool": "claude",
  "summary": {
    "overallScore": 74,
    "totalFindings": 12,
    "riskLevel": "medium",
    "bySeverity": { "critical": 0, "high": 2, "medium": 5, "low": 5, "info": 0 },
    "byCategory": { "security": 85, "quality": 70, "api": 65, "db": 100 }
  },
  "results": [...],
  "findings": [...],
  "contributors": [...],
  "commitTimeline": [...]
}
```

---

## Running audits with each AI tool

---

### Claude Code CLI

**Requires:** `ANTHROPIC_API_KEY` in `.env` and the `claude` CLI installed.

```bash
npm install -g @anthropic-ai/claude-code
```

#### Option 1 — Shell script (non-interactive, runs and exits)

```bash
./scripts/run-with-claude.sh owner/repo
```

This calls `claude --print` with the full audit instructions and streams output to your terminal. Reports are written to `reports/` when complete.

#### Option 2 — Slash commands (interactive Claude Code session)

Open a terminal in this repo directory and start Claude Code, then run:

```
/full-audit owner/repo
```

Individual category audits:

```
/security-audit owner/repo
/quality-audit owner/repo
/api-audit owner/repo
/db-audit owner/repo
```

#### Option 3 — Direct CLI prompt

```bash
claude "Read agents/claude/full-audit.md and run a full audit on owner/repo"
```

---

### OpenAI Codex CLI

**Requires:** `OPENAI_API_KEY` set and the `codex` CLI installed.

```bash
npm install -g @openai/codex
export OPENAI_API_KEY=sk-...
```

#### Option 1 — Shell script

```bash
./scripts/run-with-codex.sh owner/repo
```

#### Option 2 — Direct Codex prompt

```bash
codex "$(cat agents/codex/full-audit.md)

The target repository is: owner/repo"
```

#### Option 3 — Codex task file

```bash
codex --task agents/codex/full-audit.md -- owner/repo
```

---

### GitHub Copilot

**Requires:** A GitHub Copilot subscription and the `gh` CLI authenticated (`gh auth login`). No API key needed.

#### Option 1 — Copilot Chat (VS Code or github.com)

Open Copilot Chat and paste:

```
@workspace Run a full repository audit on owner/repo following the instructions in agents/copilot/audit-instructions.md
```

For individual categories:

```
@workspace Run a security audit on owner/repo — follow docs/context/01-security.md for rules and write results to reports/
@workspace Run a code quality audit on owner/repo — follow docs/context/02-code-quality.md
@workspace Run an API standards audit on owner/repo — follow docs/context/03-api-standards.md
@workspace Run a DB migration audit on owner/repo — follow docs/context/04-db-migrations.md
```

#### Option 2 — gh CLI (triggers GitHub Actions workflow)

```bash
./scripts/run-with-copilot.sh myorg/repo-auditor owner/repo
```

Or trigger directly with `gh`:

```bash
gh workflow run audit.yml \
  --repo myorg/repo-auditor \
  --field target_repo="owner/repo"

# Watch the run
gh run watch --repo myorg/repo-auditor
```

#### Option 3 — GitHub Actions UI

1. Go to your fork of this repo on GitHub
2. Click **Actions** → **Repository Audit (Copilot Agent)**
3. Click **Run workflow**, enter the target repo (`owner/repo`), click **Run**

Reports are committed back to the repo under `reports/` and uploaded as workflow artifacts.

Reports are uploaded as workflow artifacts (retained 30 days) and are not pushed to any branch.

---

## API server endpoints

The API server (`npm run dev:api`) serves reports on port 4000:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports` | List all audit results (summary only) |
| GET | `/api/reports/:auditId` | Full results JSON for one audit |
| GET | `/api/reports/:auditId/report.md` | Markdown report download |
| GET | `/api/reports/:auditId/report.html` | HTML report download |
| GET | `/api/contributors` | Latest contributor stats per repo |

The server also serves the built frontend from `frontend/dist/` with SPA fallback.

---

## Frontend development

```bash
npm run dev:frontend   # Vite dev server on http://localhost:5173
```

The Vite config proxies all `/api` requests to `http://localhost:4000` so both servers run in parallel during development.

```bash
npm run build          # Build all workspaces (frontend + api + engine types)
npm run lint           # ESLint across all workspaces
```

### Frontend pages

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Health score cards for all audited repos |
| `/audits` | How to audit | Instructions for running each agent |
| `/results/:auditId` | Results | Findings table with severity filters + bar chart |
| `/contributors` | Contributors | Commit timeline (Recharts area chart) + leaderboard |

---

## Environment variables

Copy `.env.example` to `.env` and fill in values. Never commit `.env`.

Only the key for your chosen AI tool is required. You do not need keys for tools you are not using.

| Variable | Required for | Description |
|----------|-------------|-------------|
| `GITHUB_REPOS` | All | Comma-separated `owner/repo` list |
| `GITHUB_TOKEN` | All | PAT with `repo` read scope (contributor stats) |
| `ANTHROPIC_API_KEY` | Claude only | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | Codex only | [platform.openai.com](https://platform.openai.com) |
| `WORKSPACE_DIR` | No | Where repos are cloned (default: `./workspace`) |
| `REPORTS_DIR` | No | Where reports are written (default: `./reports`) |
| `API_PORT` | No | API server port (default: `4000`) |
| `LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` (default: `info`) |

**GitHub Copilot** requires no API key — it runs via GitHub Actions using your repository's built-in `GITHUB_TOKEN` and your Copilot subscription.

---

## Security rules enforced by agents

The `.semgrep/ai-code-security.yml` rules are applied automatically during every security audit. They detect:

- Hardcoded API keys and passwords
- SQL string concatenation (injection risk)
- `exec()` with string interpolation (command injection)
- `Math.random()` used for security-sensitive values
- `jwt.verify()` without explicit algorithm
- `innerHTML` / `dangerouslySetInnerHTML` assignment
- Path traversal via `path.join()`
- Stack traces in API responses
- User content interpolated into AI system prompts
- Wildcard CORS configuration

---

## Adding a new audit rule

1. Add the rule to the relevant context doc in `docs/context/` (01–04)
2. Add a Semgrep rule to `.semgrep/ai-code-security.yml` if it has a detectable code pattern
3. The rule is automatically picked up by all agents on next run — no code changes required

---

## Troubleshooting

**`claude` CLI not found**
```bash
npm install -g @anthropic-ai/claude-code
```

**Audit writes no output to `reports/`**

Check that `ANTHROPIC_API_KEY` is set in `.env` and that the `workspace/` directory is writable.

**Frontend shows no data**

Ensure `npm run dev:api` is running and at least one audit has completed (check `reports/` for subdirectories).

**Semgrep not found**

```bash
pip install semgrep
# or
npm install -g semgrep
```

**Flyway not found (DB audit skipped)**

```bash
bash scripts/bootstrap.sh
# or manually: install Java 17 and run scripts/bootstrap.sh
```

**DevContainer won't start**

Ensure Docker Desktop is running and you have the VS Code Dev Containers extension installed.

---

## License

MIT
