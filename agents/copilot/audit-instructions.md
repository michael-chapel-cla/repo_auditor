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

4. **Collect contributor statistics** from the cloned workspace:

   ```bash
   WORKSPACE=workspace/owner_repo
   git -C "$WORKSPACE" log \
     --format="%ae|%an|%H|%aI" \
     --numstat \
     2>/dev/null || true
   ```

   Parse the output and aggregate by author email:
   - `commits` — count of commit entries
   - `additions` / `deletions` — summed from numstat lines
   - `firstCommitAt` / `lastCommitAt` — earliest and most recent ISO date
   - Skip or mark authors whose email matches `*[bot]*` as `isBot: true`

   If `GITHUB_TOKEN` is available, enrich with the GitHub API:

   ```bash
   gh api repos/{owner}/{repo}/contributors?per_page=100
   ```

   Also generate a weekly commit timeline for the last 26 weeks:

   ```bash
   git -C "$WORKSPACE" log --format="%aI" --since="26 weeks ago" 2>/dev/null | \
     awk '{print substr($0,1,10)}' | sort | uniq -c || true
   ```

   Write the result to `reports/{owner}_{repo}/{run-id}/contributors.json`:

   ```json
   {
     "repoFullName": "owner/repo",
     "generatedAt": "<ISO timestamp>",
     "contributors": [
       {
         "email": "...",
         "name": "...",
         "commits": 42,
         "additions": 1200,
         "deletions": 400,
         "firstCommitAt": "...",
         "lastCommitAt": "...",
         "isBot": false
       }
     ],
     "commitTimeline": [{ "week": "2026-W01", "commits": 12 }],
     "totalCommits": 0,
     "activeContributors": 0
   }
   ```

   Sort `contributors` by `commits` descending.

5. **Write output** to `reports/{owner}_{repo}/{run-id}/`:
   - `results.json` — following schema in `scripts/report-schema.json`
   - `contributors.json` — contributor stats (see step 4)
   - `report.md` — markdown summary
   - `report.html` — HTML report

6. **Commit and push** the reports back to the repo (or upload as workflow artifacts).

## Output schema

See `scripts/report-schema.json` for the exact JSON structure all agents must produce.
