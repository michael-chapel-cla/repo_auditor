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
- Read source files and identify: hardcoded secrets, SQL injection, command injection, insecure randomness, JWT issues, XSS, path traversal

### Quality Checks

- Run `npx eslint --format json --ext .ts,.tsx,.js,.jsx .` in the workspace
- Scan for `console.log` in non-test files
- Run `npx depcheck --json`
- Check for `.then(` / `.catch(` patterns (prefer async/await)
- Check TypeScript files for `: any` usage

### API Checks

Follow the rules in `docs/context/03-api-standards.md`:

- Check for OpenAPI spec file
- Check route versioning (`/api/v{n}/`)
- Check JWT verify calls for algorithm specification
- Check for CORS wildcard, missing rate limiting, missing helmet

### DB Migration Checks

Follow `docs/context/04-db-migrations.md`:

- Check `db/migrations/` or `migrations/` for Flyway naming conventions
- Check for duplicate version numbers
- Check for SELECT \*, missing transactions, parameterized queries

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
