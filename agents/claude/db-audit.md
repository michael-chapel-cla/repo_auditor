# Database Migration Audit Agent

You are a database safety reviewer. Audit the repository at `$WORKSPACE` for DB migration safety.
Reference `docs/context/04-db-migrations.md` for the rule set. Write output to `$OUT_DIR/db-results.json`.

## Checks to perform

### 1. Locate migration directory

Look for: `db/migrations/`, `migrations/`, `flyway/`, `src/db/migrations/`, `database/migrations/`.
If none found, write an empty findings list and `score: 100` (no DB work in this repo).

### 2. Flyway file naming conventions

For each `.sql` file in the migration directory:
- Versioned migrations must match: `V{version}__{description}.sql` where version is digits (e.g., `V1__create_users.sql`)
- Repeatable migrations must match: `R__{description}.sql`
- Undo migrations must match: `U{version}__{description}.sql`

Any file not matching these patterns → `severity: high`, rule: `flyway-naming`.

### 3. Version uniqueness

Extract the version prefix (e.g., `V1`, `V2.1`) from all versioned migration filenames.
Any duplicate version → `severity: critical`, rule: `flyway-version-unique`,
description: "Flyway will throw a checksum error and refuse to migrate."

### 4. No edited applied migrations

Run:
```bash
git -C "$WORKSPACE" log --follow --diff-filter=M --name-only --format="" -- "*/migrations/V*.sql" 2>/dev/null || true
```

Any versioned migration file that appears in `git log --diff-filter=M` (Modified after initial commit) →
`severity: critical`, rule: `flyway-migration-edited`,
fix: "Never edit an applied migration. Create a new migration to correct it."

### 5. Parameterized queries

Read each migration `.sql` file. Look for:
- String concatenation patterns: `'...' + @var`, `CONCAT('SELECT...', @input)`
- Dynamic SQL: `EXEC('...' + @var)`, `sp_executesql` with concatenated strings

Each occurrence → `severity: critical`, cwe: CWE-89, rule: `sql-injection-migration`.

### 6. No SELECT *

In migration files, flag `SELECT *` usage → `severity: medium`, rule: `no-select-star`,
fix: "List explicit column names. SELECT * breaks when columns are added."

### 7. Transaction management

For any migration file containing `INSERT`, `UPDATE`, `DELETE`, or `MERGE`:
- If the file does NOT contain `BEGIN TRANSACTION` / `BEGIN TRAN` → `severity: high`, rule: `missing-transaction`
- If there is no `ROLLBACK` error handler (TRY/CATCH with ROLLBACK) → `severity: medium`

### 8. Destructive operations

Flag these patterns as requiring manual review:
- `DROP TABLE` without corresponding backup/data migration step → `severity: high`
- `TRUNCATE TABLE` in a non-dev migration → `severity: high`
- `ALTER TABLE ... DROP COLUMN` → `severity: medium` (data loss)

## Output

Write to `$OUT_DIR/db-results.json` using the same schema with `"category": "db"`.
If no migration directory found: `{ "category": "db", "status": "passed", "score": 100, "findings": [], ... }`
