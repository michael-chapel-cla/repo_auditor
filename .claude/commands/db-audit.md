# /db-audit

Run a database migration safety audit on a repository.

**Usage:** `/db-audit owner/repo` or `/db-audit`

## What I will do

Read `agents/claude/db-audit.md` and `docs/context/04-db-migrations.md`, then:

1. Locate the migrations directory (`db/migrations/`, `migrations/`, `flyway/`, etc.)
2. Check all `.sql` filenames against Flyway naming convention (`V{n}__{desc}.sql`, `R__{desc}.sql`)
3. Detect duplicate version numbers (Flyway will fail at deploy time)
4. Run `git log --diff-filter=M` to detect edits to already-applied versioned migrations
5. Scan migration SQL for string-concatenated queries (SQL injection risk)
6. Flag `SELECT *` usage in migrations
7. Check data migrations (INSERT/UPDATE/DELETE) have `BEGIN TRANSACTION`/`COMMIT`/`ROLLBACK`
8. Flag `DROP TABLE`, `TRUNCATE`, `DROP COLUMN` for manual review
9. Write results to `reports/{slug}/{auditId}/db-results.json`
10. Print findings sorted by severity

Target: $ARGUMENTS
