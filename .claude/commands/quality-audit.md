# /quality-audit

Run a code quality audit on a repository.

**Usage:** `/quality-audit owner/repo` or `/quality-audit` (uses workspace/)

## What I will do

Read `agents/claude/quality-audit.md` and `docs/context/02-code-quality.md`, then execute:

1. Run ESLint (`npx eslint --format json`) if ESLint config exists
2. Scan for `console.log` in non-test source files
3. Run `npx depcheck --json` for unused dependencies
4. Run `jest --coverage` and check if line coverage < 85% or branch coverage < 80%
5. Scan for `.then(` / `.catch(` chains (prefer async/await)
6. Scan TypeScript files for `: any` and `as any`
7. Check `.tsx`/`.jsx` component files for > 300 lines
8. Analyze code for DRY violations and SOLID principle breaches
9. Write results to `reports/{slug}/{auditId}/quality-results.json`
10. Print findings sorted by severity

Target: $ARGUMENTS
