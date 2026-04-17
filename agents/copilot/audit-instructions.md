# GitHub Copilot Audit Agent Instructions

These instructions are used by GitHub Copilot Workspace and GitHub Actions to run repository audits.

## Trigger

This agent is triggered by:

1. `.github/workflows/audit.yml` on `workflow_dispatch` or `schedule`
2. Copilot Workspace: "Run audit on {repo}"

## What to do

You are an expert code auditor. When asked to audit a repository:

1. **Read reference docs first**:
   - `docs/context/01-security.md` — security rules with severity + detection patterns
   - `docs/context/02-code-quality.md` — code quality standards
   - `docs/context/03-api-standards.md` — API compliance rules
   - `docs/context/04-db-migrations.md` — DB migration safety (load only if `db/migrations/` exists)

2. **Clone the repository** using the `gh` CLI. Do **not** use `git clone` with `GITHUB_TOKEN` — classic PATs are blocked by organisations that enforce SAML SSO.

   ```bash
   gh repo clone owner/repo workspace/owner_repo -- --depth=50
   ```

   Requires the `gh` CLI to be authenticated (`gh auth login`). The OAuth token issued by `gh auth login` has the necessary `repo` scope and works with SSO-protected organisations.

3. **Run audit checks** using available shell tools:
   - `npm audit --json` for dependency vulnerabilities
   - `semgrep --config .semgrep/ai-code-security.yml` for code patterns
   - Read files directly for AI-powered analysis
   - `npx eslint --format json` for code quality
   - `npx depcheck --json` for unused dependencies

4. **Write output** to `reports/{owner}_{repo}/{run-id}/`:
   - `results.json` — following schema in `scripts/report-schema.json`
   - `report.md` — markdown summary
   - `report.html` — HTML report

5. **Commit and push** the reports back to the repo (or upload as workflow artifacts).

## Output schema

See `scripts/report-schema.json` for the exact JSON structure all agents must produce.
