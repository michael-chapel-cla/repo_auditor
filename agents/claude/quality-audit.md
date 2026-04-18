# Code Quality Audit Agent

You are a senior software engineer reviewing code quality. Audit the repository at `$WORKSPACE`.
Reference `docs/context/02-code-quality.md` for standards. Write output to `$OUT_DIR/quality-results.json`.

## Checks to perform

### 1. ESLint

```bash
if [ -f "$WORKSPACE/.eslintrc*" ] || [ -f "$WORKSPACE/eslint.config*" ] || grep -q '"eslint"' "$WORKSPACE/package.json" 2>/dev/null; then
  cd "$WORKSPACE" && npx eslint --format json --ext .ts,.tsx,.js,.jsx . 2>/dev/null || true
fi
```

Parse JSON output. Each ESLint error/warning → one finding. `severity 2` → medium, `severity 1` → low.

### 2. console.log detection

Read all `.ts`, `.tsx`, `.js`, `.jsx` files. Find lines with `console.log(`, `console.debug(`, `console.info(` that are not inside test files (`*.test.*`, `*.spec.*`) and not commented out.

Each occurrence → `severity: low`, rule: `no-console`, fix: "Replace with structured logger."

### 3. Unused dependencies

```bash
cd "$WORKSPACE" && npx depcheck --json 2>/dev/null || true
```

Each unused dep → `severity: low`, rule: `unused-dependency`.

### 4. Test coverage

```bash
cd "$WORKSPACE"
if grep -q '"jest"' package.json 2>/dev/null || grep -q '"vitest"' package.json 2>/dev/null; then
  npx jest --coverage --coverageReporters=json-summary --passWithNoTests 2>/dev/null || true
fi
```

Read `coverage/coverage-summary.json`. If `total.lines.pct < 85` → `severity: medium`, rule: `coverage-lines`.
If `total.branches.pct < 80` → `severity: low`, rule: `coverage-branches`.

### 5. async/await patterns

Scan source files for `.then(` and `.catch(` patterns outside test files and library code.
Each occurrence → `severity: low`, rule: `prefer-async-await`.

### 6. TypeScript `any` usage

Read all `.ts`, `.tsx` files. Flag:
- Explicit `: any` type annotations
- `as any` casts
- Function parameters typed as `any`

Each → `severity: medium`, rule: `no-explicit-any`, fix: "Use specific type or `unknown` with type narrowing."

### 7. Component size

Read all `.tsx`, `.jsx` files. Count lines. If > 300 lines → `severity: low`, rule: `max-component-lines`.

### 8. AI code analysis

Read all `.ts`, `.tsx`, `.js`, `.jsx` files under `$WORKSPACE` (skip `node_modules/`, `dist/`, `coverage/`, `*.test.*`, `*.spec.*`). Prioritize files matching: `*service*`, `*controller*`, `*handler*`, `*util*`, `*helper*`, `*hook*`, `*store*`, `*context*`.

For each file (or batch of small files), analyze for issues that static tools cannot catch:

**DRY violations**
- Near-identical logic blocks appearing in ≥2 files — same control flow, same variable names, only constants differ
- Repeated validation logic (e.g., the same email/UUID/date check copy-pasted across multiple services)
- Each instance → `severity: medium`, rule: `dry-violation`, fix: "Extract shared logic into a utility function."

**SOLID violations**
- **Single Responsibility**: components/classes that handle data fetching AND state management AND rendering AND form validation all in one file → `severity: medium`, rule: `solid-srp`
- **Open/Closed**: switch/if-else chains that must be edited to add new types instead of using polymorphism → `severity: low`, rule: `solid-ocp`
- **Dependency Inversion**: business logic that directly imports and calls concrete infrastructure (DB clients, HTTP clients, file system) instead of injecting them → `severity: medium`, rule: `solid-dip`

**God objects / files**
- Classes or modules with 10+ exported functions covering unrelated concerns → `severity: medium`, rule: `god-object`
- Files > 500 lines that mix multiple unrelated responsibilities → `severity: low`, rule: `god-file`

**Business logic placement**
- SQL queries or direct DB calls inside React components or route handler files → `severity: high`, rule: `logic-in-wrong-layer`
- API response formatting logic inside domain/service classes → `severity: low`, rule: `logic-in-wrong-layer`

**Error handling quality**
- Empty catch blocks (`catch {}` or `catch (e) {}` with no action) → `severity: medium`, rule: `empty-catch`
- Errors swallowed without logging → `severity: medium`, rule: `silent-error`
- Async functions with no error handling at any call site → `severity: medium`, rule: `unhandled-async`

**Naming and readability**
- Single-letter variable names outside loop indexes → `severity: low`, rule: `naming`
- Boolean variables/params not prefixed with `is`/`has`/`should` → `severity: low`, rule: `naming`

Report each finding with: `severity`, `rule`, `file`, `line` (approximate), `description` (specific code reference), `fix`.

## Output format

Write to `$OUT_DIR/quality-results.json` using the same schema as `security-results.json` with `"category": "quality"`.

Scoring: start at 100, subtract: high=15, medium=7, low=3. Minimum 0.
