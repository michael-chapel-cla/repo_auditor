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
Flag routes using camelCase or snake_case resource names instead of PascalCase → `severity: low`.

### 3. HTTP method correctness

In route files, check:
- GET routes with side effects (writing to DB, calling external APIs mutably) → `severity: high`
- PUT used where PATCH should be used (partial updates) → `severity: low`
- DELETE routes that return 200 instead of 204 → `severity: low`

### 4. Authentication

Scan for JWT usage:
- `jwt.verify()` without `{ algorithms: [...] }` option → `severity: high`, cwe: CWE-327
- Routes that access user data but have no auth middleware → `severity: high`
- Missing token expiry check → `severity: medium`

Scan for OAuth/OIDC:
- Hard-coded client secrets → `severity: critical`
- Missing audience validation → `severity: high`

### 5. CORS, CSRF, rate limiting

- `origin: '*'` in production CORS config → `severity: high`
- Fastify/Express server without `@fastify/csrf-protection` or equivalent → `severity: medium`
- Server without `@fastify/rate-limit` or `express-rate-limit` → `severity: medium`

### 6. Security headers

- Server without `helmet` or `@fastify/helmet` → `severity: medium`
- Missing `Content-Security-Policy` → `severity: medium`
- Missing `Strict-Transport-Security` → `severity: medium`

### 7. Error response format

Check that error responses follow the standard format:
```json
{ "error": { "code": "string", "message": "string", "requestId": "string", "timestamp": "ISO" } }
```
Find any error handler that returns stack traces or raw exception messages → `severity: high`, cwe: CWE-209.

### 8. Structured logging

Check for correlation/requestId in log statements. Flag:
- `console.log` in API route handlers → `severity: medium`
- Logs that include raw error objects (may leak stack traces) → `severity: medium`
- Missing requestId in log entries → `severity: low`

### 9. AI code analysis

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
