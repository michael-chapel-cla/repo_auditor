# Codex Full Audit Task

This task instructs OpenAI Codex CLI to run a full repository audit.

## Usage

```bash
codex "Run a full repository audit following agents/codex/full-audit.md on the repo owner/repo"
```

Or with the task file:

```bash
codex --task agents/codex/full-audit.md -- owner/repo
```

## Task Instructions

You are an expert code auditor with access to the filesystem and shell.

1. Read `.env` to get `GITHUB_REPOS`. The target repo is provided as the first argument, or use the first entry from `GITHUB_REPOS`.
2. Clone the repo using the `gh` CLI (uses the OAuth session from `gh auth login` — works with SSO-protected organisations):
   ```bash
   gh repo clone owner/repo workspace/owner_repo -- --depth=50 --quiet
   ```
   Requires `gh auth login` to have been run once.
3. Run these audit checks using shell commands and file reading:

### Security Checks

- Run `npm audit --json` if `package.json` exists
- Run `npx --yes npq@latest marshal -- $(node -e "const p=JSON.parse(require('fs').readFileSync('package.json')); console.log(Object.keys({...(p.dependencies||{}),(p.devDependencies||{})}).join(' '))")` in the workspace and save to `npq-raw.json`. Map signals to an `npq` findings category:
  - 404 from registry → `critical`, rule `npq-hallucinated`
  - deprecated → `high`, rule `npq-deprecated`
  - downloads < 1000/week → `medium`, rule `npq-low-downloads`
  - single maintainer → `medium`, rule `npq-single-maintainer`
  - published < 24 h ago → `high`, rule `npq-new-package`
  - no license → `medium`, rule `npq-no-license`
- Run `gitleaks detect --source workspace/{slug} --report-format json --no-git --exit-code 0`
- Run `semgrep --config .semgrep/ai-code-security.yml --json workspace/{slug}`
- Read source files and identify: hardcoded secrets, SQL injection, command injection, insecure randomness, JWT issues, XSS, path traversal, prototype pollution (`Object.assign` with `req.body`), TLS verification disabled (`rejectUnauthorized: false`), weak crypto algorithms (MD5, SHA-1, DES, ECB mode)

### Quality Checks

- Run `npx eslint --format json --ext .ts,.tsx,.js,.jsx .` in the workspace
- Scan for `console.log` in non-test files
- Run `npx depcheck --json`
- Check for `.then(` / `.catch(` patterns (prefer async/await)
- Check TypeScript files for `: any` usage

### Quality AI Analysis

Read all `.ts`, `.tsx`, `.js`, `.jsx` source files (skip `node_modules/`, `dist/`, test files). Analyze for:
- **DRY violations**: near-identical logic blocks in ≥2 files → `severity: medium`, rule: `dry-violation`
- **SRP violations**: files that mix data fetching, business logic, and rendering → `severity: medium`, rule: `solid-srp`
- **Dependency inversion violations**: business logic directly importing DB/HTTP clients → `severity: medium`, rule: `solid-dip`
- **God objects/files**: classes with 10+ unrelated methods or files mixing multiple concerns → `severity: medium`, rule: `god-object`
- **Business logic in wrong layer**: SQL in React components, formatting logic in domain classes → `severity: high`, rule: `logic-in-wrong-layer`
- **Silent error handling**: empty catch blocks, swallowed errors → `severity: medium`, rule: `silent-error`

### API Checks

Follow the rules in `docs/context/03-api-standards.md`:

- Check for OpenAPI spec file
- Check route versioning (`/api/v{n}/`)
- Check JWT verify calls for algorithm specification
- Check for CORS wildcard, missing rate limiting, missing helmet

### API AI Analysis

Read route, controller, middleware, and service files. Analyze for:
- **IDOR / missing authorization**: handlers that read `req.params.userId` but never verify caller owns the resource → `severity: critical`, cwe: CWE-639, rule: `missing-authz`
- **Missing input validation**: `req.body` fields used directly in DB calls without schema validation → `severity: high`, cwe: CWE-20, rule: `missing-input-validation`
- **Error info leakage**: catch blocks returning `err.message` or `err.stack` in responses → `severity: high`, cwe: CWE-209, rule: `error-info-leak`
- **GET side effects**: GET handlers that write to DB or call mutating external APIs → `severity: high`, rule: `get-side-effect`
- **Unhandled async**: fire-and-forget promises in route handlers → `severity: medium`, rule: `unhandled-async`
- **Inconsistent response shapes**: different envelope formats across endpoints → `severity: low`, rule: `response-shape`

### DB Migration Checks

Follow `docs/context/04-db-migrations.md`:

- Check `db/migrations/` or `migrations/` for Flyway naming conventions
- Check for duplicate version numbers
- Check for SELECT \*, missing transactions, parameterized queries

### DB AI Analysis

Read migration `.sql` files and ORM/repository source files. Analyze for:
- **NOT NULL column without DEFAULT**: migration adds NOT NULL column with no default or backfill → `severity: critical`, rule: `migration-not-null-no-default`
- **Orphaned column references**: migration renames/drops a column still referenced in application code → `severity: high`, rule: `migration-orphaned-reference`
- **Missing FK index**: foreign key column with no supporting index → `severity: medium`, rule: `missing-fk-index`
- **No rollback strategy**: destructive operations (DROP, TRUNCATE, type narrowing) with no comment on how to reverse → `severity: high`, rule: `no-rollback-strategy`
- **N+1 query patterns**: DB calls inside loops in application code → `severity: medium`, rule: `n-plus-one-query`
- **ORM raw injection**: string interpolation into `knex.raw()` or `query()` → `severity: critical`, cwe: CWE-89, rule: `orm-raw-injection`
- **DB SSL disabled**: connection config with `ssl: false` or `sslmode=disable` → `severity: high`, rule: `db-ssl-disabled`

5. Write all results to `reports/{slug}/{uuid}/` as:
   - `results.json` — structured findings following `scripts/report-schema.json`; include `npm` and `npq` as separate categories in `results[]`
   - `npm-audit.json` — raw unmodified output of `npm audit --json`
   - `npq-raw.json` — raw npq marshal output
   - `report.md` — human-readable markdown report
   - `report.html` — HTML report with color-coded severity

6. Delete the cloned repository from the workspace:

   ```bash
   rm -rf "workspace/$SLUG"
   ```

7. Print a summary of findings to stdout.

## Reference files

- `docs/context/01-security.md` — security audit rules
- `docs/context/02-code-quality.md` — quality standards
- `docs/context/03-api-standards.md` — API standards
- `docs/context/04-db-migrations.md` — DB migration rules
- `scripts/report-schema.json` — output schema
