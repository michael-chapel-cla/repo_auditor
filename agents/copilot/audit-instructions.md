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
   gh repo clone owner/repo workspace/owner_repo -- --depth=200
   ```

   Requires the `gh` CLI to be authenticated (`gh auth login`). The OAuth token issued by `gh auth login` has the necessary `repo` scope and works with SSO-protected organisations.

3. **Run audit checks** using available shell tools:
   - `npm audit --json` for dependency vulnerabilities — see private registry note below
   - `npx npq --dry-run --plain 2>&1 | tee "$OUT_DIR/npq-raw.json"` for supply-chain signals (deprecated, low downloads, single maintainer, new package, no license, missing from registry). Map each signal to the `npq` findings category with `source: "npq"`. The `--plain` flag produces text output; save it to `npq-raw.json` for the UI.
   - `semgrep scan --config=auto --json src/` for code patterns — the `/usr/local/bin/semgrep` wrapper delegates to Docker automatically; no extra flags needed
   - Read files directly for AI-powered analysis
   - `npx eslint src/ --format json` for code quality
   - `npx tsc --noEmit` for TypeScript compile errors
   - `npx vitest --run --coverage` for test results and coverage
   - `npx depcheck --json` for unused dependencies

   **node_modules prerequisite**: ESLint, tsc, vitest, and npq all require `node_modules` to be installed. Before running any of these tools, check whether `node_modules/` exists in the cloned workspace. If not, install dependencies first:

   ```bash
   # Load NPM_TOKEN if present (required for private Azure Artifacts registries)
   if [ -f /workspace/.env ]; then
     export $(grep -v '^#' /workspace/.env | grep NPM_TOKEN | xargs) 2>/dev/null || true
   fi
   npm install --prefer-offline 2>&1 | tail -5
   ```

   **Private npm registry**: if the repo's `.npmrc` references `${NPM_TOKEN}`, the token must be set in the environment before running `npm audit` or `npm install`. Check `/workspace/.env` for `NPM_TOKEN`. If missing, npm install and npm audit will return HTTP 401 — record a single `info` finding `"npm audit skipped — NPM_TOKEN not set"` and continue without ESLint/tsc/vitest/npq results.

   ```bash
   # Always load from /workspace/.env — it is gitignored and safe
   [ -f /workspace/.env ] && export $(grep -v '^#' /workspace/.env | grep NPM_TOKEN | xargs) 2>/dev/null || true
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

   **Prototype pollution** (S21): `Object.assign(target, req.body/query/params)`, `_.merge()` with untrusted data, dynamic key assignment `obj[req.body.key] = value`. CWE-1321, severity: high.

   **TLS verification disabled** (S22): `rejectUnauthorized: false`, `verify: false`, `strictSSL: false`, `NODE_TLS_REJECT_UNAUTHORIZED = '0'`, `ssl: false` in DB connection config. CWE-295, severity: high.

   **Weak crypto algorithms** (S23): `createHash('md5')`, `createHash('sha1')`, `createCipheriv('des', ...)`, any ECB-mode cipher. CWE-327, severity: high.

   **System prompt exfiltration** (S24): system prompt string constants containing API keys, internal URLs, DB schema, or business secrets — harmful if the model is prompted to repeat them. CWE-200, severity: high.

   **RAG / retrieval injection** (S25): retrieved chunks or vector store results concatenated into the `system` role rather than placed as framed untrusted data in the `user` role. CWE-1427, severity: critical.

   **Agent tool-call hijacking** (S26): `response.tool_calls` / `function_call` arguments dispatched to `fs`, `exec`, HTTP, or DB without Zod validation and path/URL bounds checking. CWE-1427, severity: critical.

   **Context window flooding** (S27): file reads or HTTP bodies fed to LLM context without a token/character cap; missing "sandwich" pattern re-stating key constraints after long content. CWE-400, severity: high.

   **Agent memory poisoning** (S28): memory store reads placed in the `system` role, or raw user input written to persistent memory without injection screening. CWE-1427, severity: high.

   **Second-order / output smuggling** (S29): `response.choices[0].message.content` used directly as `content` in a second LLM call without an intermediate schema parse. CWE-1426, severity: critical.

   **Multimodal injection** (S30): user-uploaded images/PDFs passed to a vision model without EXIF stripping, magic-byte file-type validation, and a low-privilege description step before agentic use. CWE-1427, severity: high.

   **Over-privileged AI agent** (S31): agent registered with more tools, scopes, or data access than the task requires — broad filesystem/shell/DB tools with no argument constraints, no least-privilege enforcement, or admin DB credentials passed to the agent context. CWE-1434, severity: high.

3b. **AI-powered code analysis** — read source files directly and apply your reasoning to find issues static tools miss:

**Quality analysis** (read `.ts`, `.tsx`, `.js`, `.jsx`; skip `node_modules/`, `dist/`, test files):

- DRY violations: near-identical logic in ≥2 files → `category: quality`, `severity: medium`, rule: `dry-violation`
- SRP violations: files mixing data fetching, business logic, and rendering → `severity: medium`, rule: `solid-srp`
- Business logic in wrong layer: SQL in React components, HTTP calls in domain classes → `severity: high`, rule: `logic-in-wrong-layer`
- Silent error handling: empty catch blocks, swallowed errors → `severity: medium`, rule: `silent-error`
- God objects: classes with 10+ unrelated methods → `severity: medium`, rule: `god-object`

**API analysis** (read route, controller, middleware, service files):

- IDOR / missing authorization: handlers reading `req.params.userId` without verifying ownership → `category: api`, `severity: critical`, cwe: CWE-639, rule: `missing-authz`
- Missing input validation: `req.body` fields used in DB calls without schema check → `severity: high`, cwe: CWE-20, rule: `missing-input-validation`
- Error info leakage: catch blocks returning `err.message`/`err.stack` in responses → `severity: high`, cwe: CWE-209, rule: `error-info-leak`
- GET side effects: GET handlers that write to DB → `severity: high`, rule: `get-side-effect`
- Unhandled async: fire-and-forget promises in route handlers → `severity: medium`, rule: `unhandled-async`
- HTTP status code specificity (A09): POST returning 200 instead of 201+Location → `severity: medium`; generic 400/500 catch-all instead of 401/403/409/422/429/502/504 → `severity: medium`; DELETE returning body instead of 204 → `severity: low`; run `grep -rn 'status(400)\|status(500)' src/ | grep -v '401\|403\|404\|409\|422\|429\|502\|504'`
- JSON payload conventions (A22): snake_case or non-camelCase property names → `severity: low`, rule: `json-naming`; dates not ISO 8601 → `severity: low`, rule: `iso-date`; optional fields returned as `null` instead of being omitted → `severity: low`, rule: `null-vs-omit`
- URI versioning (A03): versionless `/api/Resource` route with no corresponding `/api/v{n}/Resource` route → `severity: medium`, rule: `api-versioning`
- W3C Trace Context (A18): no `traceparent`/`tracestate` header propagation → `severity: low`, rule: `missing-trace-context`; no metrics library (`opentelemetry`, `prometheus`, `pino`) → `severity: low`, rule: `missing-metrics`
- Directory structure (A25): top-level `src/controllers/`, `src/services/`, `src/repositories/` instead of `src/features/{feature}/v{n}/` → `severity: medium`, rule: `dir-structure`; feature dirs with no version subdirectory → `severity: low`, rule: `dir-structure`
- Postman collection (A26): no `postman/collections/*.json` or collection has no `pm.test()` scripts → `severity: low`, rule: `missing-postman`
- Operational runbooks (A27): `docs/ops/` missing or empty → `severity: low`, rule: `missing-runbooks`
- Backward compatibility (A28): run `git diff HEAD~1 HEAD -- docs/openapi.yaml` — flag removed/renamed response fields, changed field types, removed endpoints, or newly-required request fields shipped without a new major version number → `severity: high`, rule: `breaking-change`

**DB analysis** (read migration `.sql` files and ORM/repository source files):

- NOT NULL column without DEFAULT or backfill → `category: db`, `severity: critical`, rule: `migration-not-null-no-default`
- Column rename/drop still referenced in application code → `severity: high`, rule: `migration-orphaned-reference`
- Destructive operations with no rollback strategy comment → `severity: high`, rule: `no-rollback-strategy`
- N+1 query patterns: DB calls inside loops → `severity: medium`, rule: `n-plus-one-query`
- ORM raw query with string interpolation → `severity: critical`, cwe: CWE-89, rule: `orm-raw-injection`
- DB connection config with `ssl: false` → `severity: high`, rule: `db-ssl-disabled`

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
     "generatedAt": "2026-04-20T14:23:15Z",
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
     **IMPORTANT**: Use actual timestamps captured at runtime:
     - `"startedAt"` — capture with `date -u +"%Y-%m-%dT%H:%M:%SZ"` at the beginning of the audit (before cloning)
     - `"completedAt"` — capture with `date -u +"%Y-%m-%dT%H:%M:%SZ"` when writing final results (Step 5)
     - `"agentTool": "copilot"`
   - `npm-audit.json` — raw unmodified output of `npm audit --json` (preserved for UI display)
   - `npq-raw.json` — raw npq `--dry-run --plain` output (text, not JSON)
   - `contributors.json` — contributor stats (see step 4)
   - `report.md` — markdown summary
   - `report.html` — HTML report

6. **Apply Phase 1 "Richer Findings" Enhancements** _(mandatory — run before generating reports)_:

   After writing the initial `results.json` and **before** generating `report.md`/`report.html`, run the Phase 1 enhancement utilities from the `/workspace` directory:

   ```bash
   cd /workspace
   node utils/apply-phase1-enhancements.js "$OUT_DIR/results.json" "$REPORTS_DIR" "$WORKSPACE"
   ```

   This applies all Phase 1 enhancements plus Phase 2.4 in sequence:
   - **Baseline Suppression (1.1)** — Tags each finding `new` or `existing` vs the previous audit run
   - **Auto-fix Suggestions (1.2)** — Generates exact diff patches with two levels:
     * **Basic fixes** for simple patterns (console.log, unused deps, `: any` types)
     * **AI-enhanced fixes** using codebase context analysis for complex security and quality issues
   - **Context-aware Severity (1.3)** — Downgrades severity for findings in test/docs/config files
   - **Cross-tool Deduplication (1.4)** — Merges duplicate findings reported by multiple tools
   - **Contributor Risk Attribution (2.4)** — Git blame analysis to identify which contributor introduced each flagged line

   **🤖 Agent-Driven Enhancement**: The auto-fix generator prepares rich context for you (the agent) to analyze and generate intelligent, context-aware fix suggestions during the audit. The findings will include:
   - **Code context**: Surrounding code snippets and project structure
   - **Framework detection**: Identified project patterns (React, Prisma, Express, etc.)  
   - **Contextual suggestions**: Framework-specific fix recommendations
   - **Agent prompt**: Structured guidance for generating optimal fixes

   **For findings marked with `requiresAgentAnalysis: true`**, analyze the provided context and generate specific auto-fixes:
   - SQL injection → Use detected ORM (Prisma/Sequelize/Knex) for parameterized queries
   - XSS vulnerabilities → Apply framework-specific sanitization (React/Vue patterns)
   - Hardcoded secrets → Environment variable migration with project conventions
   - Type issues → Context-aware TypeScript improvements

   Generate exact diff patches using project patterns and dependencies identified in the context.

   The script updates `results.json` in-place. The final `results.json` (after this step) is the authoritative output. Do not skip this step — it significantly enhances fix quality and may change finding counts.

7. **Commit and push** the reports back to the repo (or upload as workflow artifacts).

8. **Clean up the cloned workspace** after all reports are written and pushed:

   ```bash
   rm -rf "workspace/${OWNER}_${REPO}"
   ```

   - Always remove the cloned directory regardless of whether the audit succeeded or failed (use a `trap` in shell scripts to guarantee cleanup).
   - Never leave cloned workspaces on disk — they may contain sensitive source code, secrets, or `.env` files.
   - Example with guaranteed cleanup:

   ```bash
   WORKSPACE="workspace/${OWNER}_${REPO}"
   trap 'rm -rf "$WORKSPACE"' EXIT
   gh repo clone "$OWNER/$REPO" "$WORKSPACE" -- --depth=200
   # ... rest of audit ...
   ```

## Output schema

See `scripts/report-schema.json` for the exact JSON structure all agents must produce.
