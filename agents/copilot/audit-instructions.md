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

2. **Clone the repository** using the `gh` CLI. Use the OAuth session from `gh auth login` — this works with SSO-protected organisations.

   ```bash
   gh repo clone owner/repo workspace/owner_repo -- --depth=50
   ```

   Requires the `gh` CLI to be authenticated (`gh auth login`). The OAuth token issued by `gh auth login` has the necessary `repo` scope and works with SSO-protected organisations.

3. **Run audit checks** using available shell tools:
   - `npm audit --json` for dependency vulnerabilities — see private registry note below
   - `npx --yes npq@latest marshal` for supply-chain signals (deprecated, low downloads, single maintainer, new package, no license, missing from registry). Map each signal to the `npq` findings category with `source: "npq"`. Save raw output to `npq-raw.json`.
   - `semgrep --config .semgrep/ai-code-security.yml` for code patterns
   - Read files directly for AI-powered analysis
   - `npx eslint --format json` for code quality
   - `npx depcheck --json` for unused dependencies

   **Private npm registry**: if the repo's `.npmrc` references `${NPM_TOKEN}`, the token must be set in the environment before running `npm audit`. Check `.env` for `NPM_TOKEN`. If missing, npm audit will return HTTP 401 and produce no findings — record a single `info` finding `"npm audit skipped — NPM_TOKEN not set"` and continue.

   ```bash
   export NPM_TOKEN="$NPM_TOKEN"
   cd "$WORKSPACE" && npm audit --json > "$OUT_DIR/npm-audit.json" 2>/dev/null || true
   ```

   Convert npm vulnerabilities to the standard finding schema:
   - `category`: **`"npm"`** — write these as a **separate result category**, not merged into `security`
   - `severity`: critical→critical, high→high, moderate→medium, low→low
   - `title`: `"npm: {packageName} — {advisory title}"`
   - `rule`: `"S14"`, `source`: `"npm-audit"`
   - `fix`: `"npm install {name}@{fixVersion}"` from `fixAvailable`, or `"npm audit fix"`, or `"No automated fix available"`

   **Azure OpenAI key scanning**: when reading source files, also scan `helm/values-*.yaml` and `.github/workflows/*.yml` for hardcoded Azure OpenAI API keys. Azure keys do NOT start with `sk-` — they use a different format (`[A-Za-z0-9]{40,}J99[A-Z0-9]{4,}`). Flag any literal key value at `DOCAI_AZURE_OPENAI_API_KEY` or similar as `severity: critical`, `rule: S03`.

   **Azure OpenAI prompt injection** (S01): this repo uses `AzureOpenAI` from the `openai` npm package. System prompts use `{ role: 'system', content: ... }` inside the `messages` array of `chat.completions.create()` — not a top-level `system:` field. Flag any system role message whose `content` is interpolated from a variable.

   **Azure OpenAI unvalidated output** (S02): flag any `JSON.parse(response.choices[0].message.content)` without immediate Zod schema validation.

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

   Enrich with the GitHub API via the `gh` CLI:

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
   - `results.json` — following schema in `scripts/report-schema.json`; include `npm` and `npq` as separate categories in `results[]`
   - `npm-audit.json` — raw unmodified output of `npm audit --json` (preserved for UI display)
   - `npq-raw.json` — raw npq marshal output
   - `contributors.json` — contributor stats (see step 4)
   - `report.md` — markdown summary
   - `report.html` — HTML report

6. **Commit and push** the reports back to the repo (or upload as workflow artifacts).

## Output schema

See `scripts/report-schema.json` for the exact JSON structure all agents must produce.
