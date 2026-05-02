# Repo Auditor — GitHub Copilot Quickstart

Run AI-powered audits on any GitHub repository using GitHub Copilot via GitHub Actions.

---

## Prerequisites

| Requirement    | Details                                                                            |
| -------------- | ---------------------------------------------------------------------------------- |
| `gh` CLI       | [cli.github.com](https://cli.github.com) — must be authenticated (`gh auth login`) |
| GitHub Actions | Workflow file `.github/workflows/audit.yml` must exist in this repo                |
| Node.js ≥ 20   | For the report viewer only                                                         |

---

## 1. Authenticate the GitHub CLI

```bash
gh auth login
```

Select **GitHub.com**, **HTTPS**, and authenticate via browser. This grants the `repo` scope needed to clone SSO-protected repositories.

---

## 2. Trigger an audit

In **GitHub Copilot Chat**, type:

```
Run audit on myorg/target-repo
```

Copilot will read `agents/copilot/audit-instructions.md` and execute the audit steps automatically.

---

## 3. Results

Copilot will:

1. Clone the target repository into `workspace/`
2. Run security, quality, API, and DB audits
3. Write results to `reports/{owner}_{repo}/{auditId}/results.json`
4. Generate `report.md` and `report.html`

Once complete, the findings are visible in the **Results** page of this viewer.

---

## 4. View results

Start the report viewer:

```bash
npm run bootstrap      # first time only
npm run dev:api        # API server on http://localhost:4000
npm run dev:frontend   # UI on http://localhost:5173
```

Open **http://localhost:5173** → **Dashboard** to see scores, or **Results** to browse findings.

---

## Private npm registries

If the target repo's `.npmrc` references `${NPM_TOKEN}` (e.g. Azure Artifacts), add the token to `.env` before running:

```bash
echo "NPM_TOKEN=your-token-here" >> .env
```

Without it, `npm audit` is skipped and an `info` finding is recorded.

---

## Output structure

```
reports/
  owner_repo/
    {auditId}/
      results.json      ← findings + scores (all categories)
      npm-audit.json    ← raw npm audit output
      report.md         ← human-readable summary
      report.html       ← styled HTML report
      contributors.json ← commit stats + leaderboard
```

### Severity levels

| Level      | Meaning                  |
| ---------- | ------------------------ |
| `critical` | Immediate fix required   |
| `high`     | Fix before next release  |
| `medium`   | Schedule for remediation |
| `low`      | Best-effort              |
| `info`     | Informational only       |

---

## Audit categories

| Category   | What it checks                                                             |
| ---------- | -------------------------------------------------------------------------- |
| `security` | Hardcoded secrets, injection, unsafe patterns (gitleaks, semgrep, AI scan) |
| `npm`      | Dependency vulnerabilities (`npm audit`)                                   |
| `quality`  | ESLint, TypeScript errors, unused deps, console.log, `any` types           |
| `api`      | OpenAPI spec, versioning, auth, CORS, rate-limiting                        |
| `db`       | Migration naming, transactions, SQL injection safety                       |

---

## Further reading

- [docs/instructions.md](docs/instructions.md) — full install and configuration guide (Claude, Codex, Copilot)
- [ROADMAP.md](ROADMAP.md) — planned features across 6 phases
