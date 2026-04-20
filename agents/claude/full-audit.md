# Full Repository Audit Agent

You are an expert code auditor. Your job is to run a comprehensive audit of a GitHub repository and produce structured JSON, Markdown, and HTML reports.

## Inputs

- `$REPO` — the repository to audit in `owner/repo` format (from `$ARGUMENTS` or from `GITHUB_REPOS` in `.env`)
- Output destination: `reports/{owner}_{repo}/{ISO_TIMESTAMP}/`

## Steps

### Step 1 — Parse target

Read `.env` to get `GITHUB_REPOS`, `WORKSPACE_DIR`, and `REPORTS_DIR`.
If `$ARGUMENTS` is set, use it as the repo. Otherwise use the first entry in `GITHUB_REPOS`.

> All cloning and GitHub API calls use the `gh` CLI OAuth session. No personal access token is required.

Set:

- `REPO_SLUG` = `owner_repo` (slash replaced with underscore)
- `AUDIT_ID` = generate with `python3 -c "import uuid; print(uuid.uuid4())"`
- `AUDIT_START_TS` = `date -u +"%Y-%m-%dT%H:%M:%SZ"` — **capture this immediately when the audit starts**
- `OUT_DIR` = `reports/$REPO_SLUG/$AUDIT_ID`
- `WORKSPACE` = the local checkout path (default: `workspace/$REPO_SLUG`)

Run: `mkdir -p "$OUT_DIR" "$WORKSPACE"`

### Step 2 — Checkout

```bash
# Use gh CLI -- works with SSO-protected orgs where classic PATs are blocked
if [ -d "$WORKSPACE/.git" ]; then
  git -C "$WORKSPACE" pull --quiet
else
  gh repo clone "$REPO" "$WORKSPACE" -- --depth=50 --quiet
fi
echo "Checked out $REPO to $WORKSPACE"
```

Prerequisite: `gh auth login` must have been run once. The `gh` CLI OAuth token has `repo` scope and is not subject to SAML SSO restrictions that block classic PATs.

### Step 3 — Run all four audit agents

Invoke each sub-audit in sequence, passing `$WORKSPACE` and `$OUT_DIR`. Read the relevant context doc before each audit:

1. **Security Audit** — read `docs/context/01-security.md`, then follow `agents/claude/security-audit.md`
   - Outputs: `security-results.json`, `npm-results.json`, `npm-audit.json`, `npq-results.json`, `npq-raw.json`
2. **Quality Audit** — read `docs/context/02-code-quality.md`, then follow `agents/claude/quality-audit.md`
3. **API Audit** — read `docs/context/03-api-standards.md`, then follow `agents/claude/api-audit.md`
4. **DB Audit** — read `docs/context/04-db-migrations.md`, then follow `agents/claude/db-audit.md`
5. **Contributors** — follow `agents/claude/contributors.md`

> **Private registry**: if `$WORKSPACE/.npmrc` references `${NPM_TOKEN}`, export the token before running the security audit: `export NPM_TOKEN="$NPM_TOKEN"`. If unset, the npm audit step will record a skipped finding and continue.

### Step 4 — Aggregate results

After all sub-agents complete, read each category's output JSON from `$OUT_DIR/`:

- `security-results.json`
- `npm-results.json` (npm dependency vulnerabilities — separate `npm` category)
- `npq-results.json` (supply-chain safety signals — separate `npq` category)
- `quality-results.json`
- `api-results.json`
- `db-results.json`
- `contributors.json`

Merge into a single `results.json` matching the schema in `scripts/report-schema.json`. The `npm` and `npq` categories each appear as their own entries in `results[]` alongside security/quality/api/db.

**IMPORTANT**: Use the actual timestamps captured at audit start and completion:

- `"startedAt": "$AUDIT_START_TS"` — use the timestamp captured in Step 1
- `"completedAt"` — capture with `date -u +"%Y-%m-%dT%H:%M:%SZ"` at this step (when merging completes)
- `"auditId": "$AUDIT_ID"`
- `"agentTool": "claude"`

Calculate `summary`:

- `overallScore` = average of all category scores
- `totalFindings` = sum of all findings
- `bySeverity` = count by severity across all categories
- `byCategory` = count by category
- `riskLevel` = "critical" if any critical findings, "high" if any high, etc.

Write the merged file: `$OUT_DIR/results.json`

### Step 5 — Generate reports

**Markdown report** (`$OUT_DIR/report.md`):

- Title: `# Audit Report: {repo}`
- Executive summary table: score, risk level, finding counts by severity/category
- One section per category with findings table (severity | title | file:line | fix)

**HTML report** (`$OUT_DIR/report.html`):

- Same structure as Markdown but with inline CSS
- Color-coded severity badges (critical=red, high=orange, medium=yellow, low=blue)
- Summary metric cards at the top

### Step 6 — Cleanup

Delete the cloned repository from the workspace to avoid leaving sensitive code on disk:

```bash
rm -rf "$WORKSPACE"
echo "Removed workspace: $WORKSPACE"
```

### Step 7 — Done

Print a summary:

```
✅ Audit complete: {repo}
   Audit ID: {auditId}
   Score: {overallScore}/100
   Risk: {riskLevel}
   Findings: {total} ({critical} critical, {high} high, {medium} medium, {low} low)
   Reports:
     JSON: {OUT_DIR}/results.json
     MD:   {OUT_DIR}/report.md
     HTML: {OUT_DIR}/report.html
```
