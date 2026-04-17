# DB Migrations — Agent Audit Context

Load this file for `/db-audit`. Only applies if `db/migrations/` or `flyway.conf` exists. Starting score: **100**.

---

## Quick Reference

| ID | Rule | Severity | Penalty |
|----|------|----------|---------|
| D01 | Migration file breaks naming convention | MEDIUM | -7 |
| D02 | Duplicate version numbers | HIGH | -15 |
| D03 | Previously-applied migration was edited | CRITICAL | -25 |
| D04 | SQL string concatenation (injection risk) | CRITICAL | -25 |
| D05 | SELECT * in migration | MEDIUM | -7 |
| D06 | Missing transaction on data migration | HIGH | -15 |
| D07 | DROP TABLE / TRUNCATE without safeguard | HIGH | -15 |
| D08 | Missing COMMIT / open transaction | HIGH | -15 |
| D09 | flyway.conf committed with credentials | CRITICAL | -25 |
| D10 | cleanDisabled=false in non-dev config | HIGH | -15 |
| D11 | Stored procedure not using repeatable migration | LOW | -3 |
| D12 | Version numbers out of order or gaps | LOW | -3 |
| D13 | Cross-database reference without existence check | MEDIUM | -7 |

---

## How Flyway Works (Agent Reference)

Flyway tracks applied migrations in `flyway_schema_history`. On each run it:
1. Checksums every `V*__*.sql` file in `db/migrations/`
2. Compares against `flyway_schema_history`
3. Runs new migrations in version order
4. **Errors if any previously-applied file changed** (checksum mismatch)

Key prefixes:
- `V{n}__{desc}.sql` — versioned migration, runs once
- `R__{desc}.sql` — repeatable, re-runs when content changes (views, procs, functions)
- `B{n}__{desc}.sql` — undo migration (Flyway Teams only)

---

## D01 — Naming Convention Violation
**Severity:** MEDIUM | **Penalty:** -7 per file

**Required format:** `V{version}__{description}.sql` (double underscore separates version from description)

```
V1__initial_schema.sql          ✅
V2__create_users_table.sql      ✅
V3__add_email_to_users.sql      ✅
R__vw_user_summary.sql          ✅  (repeatable)
R__usp_get_orders.sql           ✅  (repeatable stored proc)

V1_initial_schema.sql           ❌  (single underscore)
v1__initial_schema.sql          ❌  (lowercase v)
2__create_users.sql             ❌  (missing V prefix)
V1__Create Users Table.sql      ❌  (spaces in filename)
```

**Detect:**
```bash
# Files not matching V{n}__{desc}.sql or R__{desc}.sql
ls db/migrations/ | grep -vE '^(V[0-9]+(\.[0-9]+)*__|R__|B[0-9]+__)[a-zA-Z0-9_]+\.sql$'
```

---

## D02 — Duplicate Version Numbers
**Severity:** HIGH | **Penalty:** -15

Two migrations with the same version number will cause Flyway to fail on deploy. Catch this before it reaches CI.

**Detect:**
```bash
ls db/migrations/V*.sql \
  | sed 's/.*\/V\([0-9.]*\)__.*/\1/' \
  | sort | uniq -d
# Any output = duplicate version numbers
```

❌ `V3__add_email.sql` and `V3__add_phone.sql` — both version 3

---

## D03 — Previously-Applied Migration Edited
**Severity:** CRITICAL | **Penalty:** -25

**This is the #1 Flyway sin.** Once a migration is applied and committed, it MUST NEVER be changed. Flyway checksums every file — any edit causes `ERROR: Validate failed` on all environments.

**Detect:**
```bash
# Check git log for any modifications to V*.sql files after their initial commit
git log --diff-filter=M --name-only --pretty=format: -- 'db/migrations/V*.sql' | grep -v '^$'
# Any output = a versioned migration was modified after its first commit
```

**If a migration has a bug:**
- Do NOT edit the original file
- Create a NEW migration with the next version number that corrects it

❌ Editing `V5__add_column.sql` to fix a typo after it was applied
✅ Creating `V6__fix_column_default.sql` to correct the error

---

## D04 — SQL String Concatenation (Injection Risk)
**Severity:** CRITICAL | **Penalty:** -25

Application code calling the database MUST use parameterized queries. String concatenation creates SQL injection vulnerabilities.

**Detect in application code:**
```bash
# TypeScript/JavaScript
grep -rn "executeQuery\|db\.query\|connection\.query" src/ -A2 \
  | grep -E '\$\{|\+.*req\.|template.*literal'

# Look for string interpolation in SQL
grep -rn "SELECT.*\${" src/
grep -rn "WHERE.*\+.*req\." src/
grep -rn "INSERT.*\${" src/
```

❌
```typescript
const result = await db.query(
  `SELECT * FROM Users WHERE Id = '${userId}'`
);
```
✅
```typescript
const result = await db.executeQuery(
  'SELECT * FROM Users WHERE Id = @id',
  { id: userId }
);
```

**In migration files:**
```bash
grep -rn "EXEC\|EXECUTE" db/migrations/ | grep "'\s*+\s*\|+\s*'"
# Dynamic SQL built via string concat in migrations
```

---

## D05 — SELECT * in Migration
**Severity:** MEDIUM | **Penalty:** -7

`SELECT *` in a migration breaks when columns are added or reordered in later migrations. Always name columns explicitly.

**Detect:**
```bash
grep -rn "SELECT \*" db/migrations/
```

❌
```sql
SELECT * FROM dbo.Users;  -- breaks if Users schema changes
```
✅
```sql
SELECT UserId, Email, DisplayName, CreatedAt FROM dbo.Users;
```

Note: `SELECT *` in repeatable migrations (`R__*.sql`) for view definitions is also problematic — views built on `SELECT *` expose new columns automatically, which can be a security leak.

---

## D06 — Missing Transaction on Data Migration
**Severity:** HIGH | **Penalty:** -15

Any migration that modifies data (UPDATE, INSERT, DELETE, backfills) MUST be wrapped in a transaction with explicit COMMIT and a verification step before committing.

**Detect:**
```bash
# Data migrations without BEGIN TRANSACTION
grep -rln "UPDATE\|INSERT\|DELETE" db/migrations/V*.sql \
  | xargs grep -L "BEGIN TRANSACTION\|BEGIN TRAN"
```

✅ Required pattern:
```sql
-- V8__backfill_status.sql
BEGIN TRANSACTION;

  UPDATE dbo.Users
  SET Status = 'active'
  WHERE Status IS NULL;

  -- Verify before committing
  IF EXISTS (SELECT 1 FROM dbo.Users WHERE Status IS NULL)
  BEGIN
    ROLLBACK;
    THROW 50001, 'Backfill failed: NULL Status values remain', 1;
  END

COMMIT;
```

---

## D07 — DROP TABLE / TRUNCATE Without Safeguard
**Severity:** HIGH | **Penalty:** -15

Destructive DDL (`DROP TABLE`, `TRUNCATE TABLE`) in a migration must include an existence check and ideally a data-preservation step (backup table or archive).

**Detect:**
```bash
grep -rn "DROP TABLE\|TRUNCATE TABLE" db/migrations/
# Any match warrants manual review
```

**For DROP TABLE:**
```sql
-- Must check existence first
IF OBJECT_ID('dbo.LegacyTable', 'U') IS NOT NULL
  DROP TABLE dbo.LegacyTable;
```

**For TRUNCATE:**
- Is data archival needed first?
- Is this in a transaction that can be rolled back?
- Flag as HIGH if no existence check or safeguard present

---

## D08 — Open Transaction (Missing COMMIT)
**Severity:** HIGH | **Penalty:** -15

A `BEGIN TRANSACTION` without a matching `COMMIT` or `ROLLBACK` will cause Flyway to hang indefinitely.

**Detect:**
```bash
# Files with BEGIN TRANSACTION but missing COMMIT
for f in db/migrations/*.sql; do
  begin=$(grep -ci "BEGIN TRANSACTION\|BEGIN TRAN" "$f" || true)
  commit=$(grep -ci "COMMIT" "$f" || true)
  rollback=$(grep -ci "ROLLBACK" "$f" || true)
  if [ "$begin" -gt 0 ] && [ "$commit" -eq 0 ] && [ "$rollback" -eq 0 ]; then
    echo "OPEN TRANSACTION: $f"
  fi
done
```

---

## D09 — flyway.conf Committed with Credentials
**Severity:** CRITICAL | **Penalty:** -25

`flyway.conf` must be in `.gitignore`. Only `flyway.conf.example` (with placeholder values) should be committed.

**Detect:**
```bash
# Is flyway.conf tracked by git?
git ls-files db/flyway.conf flyway.conf

# Does .gitignore exclude it?
grep -n "flyway.conf" .gitignore

# Scan git history for accidental commits
git log --all --full-history -- "flyway.conf" | head -5
```

❌ `flyway.conf` appears in `git ls-files` output
✅ `flyway.conf` in `.gitignore`, only `flyway.conf.example` tracked

---

## D10 — cleanDisabled=false in Non-Dev Config
**Severity:** HIGH | **Penalty:** -15

`flyway clean` drops the entire database schema. It must be disabled (`cleanDisabled=true`) in all environments except local dev.

**Detect:**
```bash
# Check CI/CD workflow files for cleanDisabled setting
grep -rn "cleanDisabled\|FLYWAY_CLEAN_DISABLED" .github/ *.yml *.yaml
# Flag any instance where cleanDisabled is not 'true' in non-local configs

# Check flyway.conf.example
grep "cleanDisabled" flyway.conf.example
```

❌ CI/CD pipeline passing `-cleanDisabled=false` or omitting the flag entirely
✅ All CI/CD configs include: `-cleanDisabled=true` or `FLYWAY_CLEAN_DISABLED=true`

---

## D11 — Stored Procedure Not Using Repeatable Migration
**Severity:** LOW | **Penalty:** -3

Stored procedures, views, and functions change over time. Using a versioned migration (`V__`) forces a new version file on every change. Use repeatable migrations (`R__`) with `CREATE OR ALTER`.

**Detect:**
```bash
# Stored procedures in versioned migrations
grep -rln "CREATE PROCEDURE\|CREATE FUNCTION\|CREATE VIEW" db/migrations/V*.sql
```

❌
```sql
-- V12__update_get_orders_proc.sql
CREATE PROCEDURE dbo.usp_GetOrders ...  -- third version of this proc
```
✅
```sql
-- R__usp_get_orders.sql
CREATE OR ALTER PROCEDURE dbo.usp_GetOrders ...  -- re-runs on content change
```

---

## D12 — Version Numbers Out of Order or Gaps
**Severity:** LOW | **Penalty:** -3

Version numbers should be monotonically increasing. Large gaps are suspicious (suggest missing migrations or deleted files).

**Detect:**
```bash
ls db/migrations/V*.sql \
  | sed 's/.*\/V\([0-9]*\)__.*/\1/' \
  | sort -n \
  | awk 'NR>1 && $1 != prev+1 { print "GAP between V"prev" and V"$1 } { prev=$1 }'
```

---

## D13 — Cross-Database Reference Without Existence Check
**Severity:** MEDIUM | **Penalty:** -7

Referencing objects in another database (`OtherDb.dbo.SomeTable`) without confirming they exist will fail if that database is unavailable or not yet created.

**Detect:**
```bash
grep -rn "\w\+\.\(dbo\|schema\)\.\w\+" db/migrations/ | grep -v "^db/migrations/.*dbo\."
# Look for three-part names: Database.Schema.Table
grep -rn "[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*\.[A-Za-z]" db/migrations/ \
  | grep -v "sys\.\|INFORMATION_SCHEMA\."
```

---

## Migration Authoring Checklist

Before creating a new migration:

- [ ] Filename matches `V{n}__{description}.sql` (double underscore, no spaces)
- [ ] Version number is one higher than the current max
- [ ] No `SELECT *` — name all columns explicitly
- [ ] Data changes wrapped in `BEGIN TRANSACTION ... COMMIT` with verification
- [ ] `DROP`/`TRUNCATE` checked with `IF OBJECT_ID(...) IS NOT NULL`
- [ ] Stored procedures/views use `R__` prefix with `CREATE OR ALTER`
- [ ] No string concatenation in dynamic SQL — use parameters
- [ ] `COMMIT` present for every `BEGIN TRANSACTION`
- [ ] Tested locally with `flyway migrate` → `flyway validate`

## Scoring Reference

| Score | Grade | Meaning |
|-------|-------|---------|
| 90–100 | A | Clean migration history, safe patterns |
| 75–89 | B | Minor issues |
| 60–74 | C | Moderate risk, fix this sprint |
| 40–59 | D | High risk of data loss or deploy failure |
| < 40 | F | Critical issues, do not deploy |
