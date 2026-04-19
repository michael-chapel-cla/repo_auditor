# API Audit Agent

You are an API standards reviewer. Audit the repository at `$WORKSPACE` for API compliance.
Reference `docs/context/03-api-standards.md` for the rule set.
Write output to `$OUT_DIR/api-results.json`.

## Checks to perform

### 1. OpenAPI spec presence and completeness

Look for spec files: `docs/openapi.yaml`, `docs/openapi.json`, `openapi.yaml`, `openapi.json`, `swagger.yaml`.

If missing → `severity: high`, rule: `openapi-missing`, fix: "Create docs/openapi.yaml."

If found, read the file and check:

- **Missing `info` section** → `severity: medium`
- **Missing `components/securitySchemes`** → `severity: high` (all non-public endpoints need auth)
- **Endpoints without `summary`/`description`** → `severity: low` per endpoint
- **Endpoints without error response codes** (missing 400, 401, 404, 500) → `severity: medium` per endpoint
- **Missing request body schema** on POST/PUT/PATCH → `severity: medium`
- **No examples** on any endpoint → `severity: low`

### 2. URI versioning

Scan all route definition files (`.ts`, `.js` files containing `.get(`, `.post(`, `.route(`, `router.`, `app.`).
Find route strings. Flag any `/api/...` route that does NOT match `/api/v{n}/` format → `severity: medium`, rule: `api-versioning`.
A versionless `/api/ResourceName` is acceptable **only** if a corresponding `/api/v{n}/ResourceName` route also exists (it acts as a latest-alias). If it is the only form, flag it.
Flag routes using camelCase or snake_case resource names instead of PascalCase → `severity: low`.

### 3. HTTP method correctness

In route files, check:

- GET routes with side effects (writing to DB, calling external APIs mutably) → `severity: high`
- PUT used where PATCH should be used (partial updates) → `severity: low`
- DELETE routes that return 200 instead of 204 → `severity: low`

### 5. HTTP status code specificity (A09)

Check that error handlers and route responses use the most specific code available.

**2XX — flag if wrong:**

- POST that creates a resource returns 200 instead of 201 → `severity: medium`
- POST 201 missing `Location` header → `severity: medium`
- DELETE returns a body instead of 204 → `severity: low`

**3XX — flag if absent when redirect is implied:**

- Permanent resource moves that return 200 instead of 301 → `severity: low`

**4XX — flag generic use:**

- A single `status(400)` or `status(500)` catch-all for all errors → `severity: medium`
- 500 returned for auth failure (should be 401/403) → `severity: medium`
- Missing 409 on duplicate-resource creation → `severity: low`
- Missing 422 for request body validation errors → `severity: low`
- Missing 429 on rate-limited endpoints → `severity: medium`

**5XX — flag missing specifics:**

- Upstream dependency failures returned as generic 500 instead of 502/504 → `severity: low`
- "Not implemented" features returned as 500 instead of 501 → `severity: low`

```bash
grep -rn 'status(400)\|status(500)' src/ | grep -v '401\|403\|404\|409\|422\|429\|502\|503\|504'
```

### 5. Authentication

Scan for JWT usage:

- `jwt.verify()` without `{ algorithms: [...] }` option → `severity: high`, cwe: CWE-327
- Routes that access user data but have no auth middleware → `severity: high`
- Missing token expiry check → `severity: medium`

Scan for OAuth/OIDC:

- Hard-coded client secrets → `severity: critical`
- Missing audience validation → `severity: high`

### 6. CORS, CSRF, rate limiting

- `origin: '*'` in production CORS config → `severity: high`
- Fastify/Express server without `@fastify/csrf-protection` or equivalent → `severity: medium`
- Server without `@fastify/rate-limit` or `express-rate-limit` → `severity: medium`

### 7. Security headers

- Server without `helmet` or `@fastify/helmet` → `severity: medium`
- Missing `Content-Security-Policy` → `severity: medium`
- Missing `Strict-Transport-Security` → `severity: medium`

### 8. Error response format

Check that error responses follow the standard format:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "requestId": "string",
    "timestamp": "ISO"
  }
}
```

Find any error handler that returns stack traces or raw exception messages → `severity: high`, cwe: CWE-209.

### 9. Structured logging and observability (A18)

Check for correlation/requestId in log statements. Flag:

- `console.log` in API route handlers → `severity: medium`
- Logs that include raw error objects (may leak stack traces) → `severity: medium`
- Missing `requestId` in log entries → `severity: low`
- Missing `traceId` / `spanId` in log entries → `severity: low`

**W3C Trace Context** — flag if absent:

```bash
grep -rn 'traceparent\|tracestate' src/ || echo "NO W3C TRACE CONTEXT — flag severity: low, rule: missing-trace-context"
```

**Metrics and observability** — flag if absent:

```bash
grep -rn 'opentelemetry\|prometheus\|pino\|winston\|datadog' src/ package.json \
  || echo "NO METRICS LIBRARY — flag severity: low, rule: missing-metrics"
```

If no metrics library is configured, generate a finding: `severity: low`, rule: `missing-metrics`, fix: "Configure OpenTelemetry or Prometheus metrics for request count, error rate, and P95 latency."

**Operational runbooks** — flag `docs/ops/` missing or empty → `severity: low`, rule: `missing-runbooks` (drives A27).

### 10. JSON payload conventions (A22)

Scan JSON-producing route handlers and schema definitions:

- Property names not camelCase (snake_case, kebab-case, PascalCase) → `severity: low`, rule: `json-naming`
- Date fields not ISO 8601 with timezone (`toLocaleDateString`, `toDateString`, `MM/DD/YYYY` patterns) → `severity: low`, rule: `iso-date`
- Optional fields set to `null` instead of being omitted → `severity: low`, rule: `null-vs-omit`. Fix: "Omit optional absent fields rather than returning null."

```bash
grep -rn 'toLocaleDateString\|\.toDateString\|MM/DD\|DD-MM' src/
grep -rn ': null\b' src/ | grep -v '// allow-null\|\.test\.\|\.spec\.'
```

### 11. Directory structure (A25)

Check that the repository follows a **feature-based** directory structure.

```bash
# Flag top-level technical layer directories
ls src/ 2>/dev/null | grep -E '^(controllers|services|repositories|handlers)$' \
  && echo "VIOLATION: layer-based structure — flag severity: medium, rule: dir-structure"

# Flag missing src/features/
[ -d src/features ] || echo "MISSING src/features/ — severity: medium, rule: dir-structure"

# Flag feature dirs with no version subdirectory
find src/features -maxdepth 1 -mindepth 1 -type d 2>/dev/null | while read f; do
  ls "$f" 2>/dev/null | grep -qE '^v[0-9]' \
    || echo "No version dir in: $f — severity: low, rule: dir-structure"
done
```

### 12. Postman collection (A26)

```bash
ls postman/collections/*.json 2>/dev/null \
  || echo "MISSING Postman collection — severity: low, rule: missing-postman"
grep -l 'pm\.test' postman/collections/*.json 2>/dev/null \
  || echo "NO TEST SCRIPTS in Postman collection — severity: low, rule: missing-postman"
```

If absent or no test scripts: `severity: low`, rule: `missing-postman`, fix: "Create `postman/collections/api-tests.json` with test scripts covering happy path and error cases for every endpoint."

### 13. Backward compatibility (A28)

Compare current `docs/openapi.yaml` against previous git version to detect breaking changes shipped without a new major version.

```bash
git diff HEAD~1 HEAD -- docs/openapi.yaml 2>/dev/null \
  | grep -E '^-.*required|^-[[:space:]]+[a-z].*:' | grep -v '^---'

# All active route major versions
grep -rE '/api/v[0-9]+/' src/ 2>/dev/null \
  | sed 's|.*/api/v\([0-9]\+\)/.*|v\1|' | sort -u
```

Flag each of the following as `severity: high`, rule: `breaking-change` if introduced without a new major version:

- Removing a response field
- Renaming a response field
- Changing a field's data type
- Making an optional request field required
- Removing an endpoint
- Changing a path parameter to a query parameter

### 14. AI code analysis

Read all route, middleware, controller, and service files under `$WORKSPACE` (skip `node_modules/`, `dist/`, `*.test.*`, `*.spec.*`). Prioritize files matching: `*route*`, `*controller*`, `*handler*`, `*middleware*`, `*auth*`, `*service*`, `*api*`.

For each file (or batch of small files), analyze for issues that grep patterns cannot catch:

**Auth and authorization gaps**

- Route handlers that read `req.user` or `req.params.userId` but never verify the caller owns that resource (IDOR) → `severity: critical`, cwe: CWE-639, rule: `missing-authz`
- Middleware that authenticates but does not authorize (role/permission check absent for sensitive operations) → `severity: high`, rule: `missing-authz`
- Auth middleware applied inconsistently — some routes in a router protected, others not → `severity: high`, rule: `missing-authz`

**Input validation gaps**

- Route handler uses `req.body.field` directly in a DB call or file path without schema validation → `severity: high`, cwe: CWE-20, rule: `missing-input-validation`
- Query params or path params cast to numbers with `parseInt`/`Number()` but not range-checked → `severity: medium`, rule: `missing-input-validation`

**Error handling and information leakage**

- `catch (err)` blocks that return `err.message` or `err.stack` in the response body → `severity: high`, cwe: CWE-209, rule: `error-info-leak`
- Generic 500 handlers that include the raw error object in JSON → `severity: high`, cwe: CWE-209, rule: `error-info-leak`

**Idempotency and side effects**

- GET handler bodies that write to DB, send emails, or call mutating external APIs → `severity: high`, rule: `get-side-effect`
- Non-idempotent PUT handlers (should replace entire resource but only updating some fields) → `severity: medium`, rule: `put-not-idempotent`

**API design consistency**

- Inconsistent response envelope shapes across endpoints (some return `{ data: {} }`, others return bare objects) → `severity: low`, rule: `response-shape`
- Pagination implemented differently in different endpoints (some use `offset/limit`, others use `page/pageSize`, others use cursor) → `severity: low`, rule: `pagination-inconsistency`
- Endpoints that silently ignore unknown fields in request bodies instead of rejecting them → `severity: low`, rule: `strict-input`

**Async and concurrency**

- Route handlers with un-awaited promises (fire-and-forget side effects that can fail silently) → `severity: medium`, rule: `unhandled-async`
- Missing concurrency control on resource creation (no unique constraint check, no optimistic lock) → `severity: medium`, rule: `race-condition`

Report each finding with: `severity`, `rule`, `cwe` (if applicable), `file`, `line` (approximate), `description` (specific code reference), `fix`.

## Output

Write to `$OUT_DIR/api-results.json` using the same schema with `"category": "api"`.
