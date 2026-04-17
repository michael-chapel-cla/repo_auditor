# API Standards — Agent Audit Context

Load this file for `/api-audit`. Starting score: **100**. Apply penalties per finding.

---

## Quick Reference

| ID | Rule | Severity | Penalty |
|----|------|----------|---------|
| A01 | No OpenAPI spec in `docs/` | HIGH | -15 |
| A02 | Endpoint missing documentation (no summary/params/responses) | MEDIUM | -7 |
| A03 | No URI versioning (`/api/v{n}/`) | HIGH | -15 |
| A04 | Verb in URL path | MEDIUM | -7 |
| A05 | Route resource names not PascalCase plural | LOW | -3 |
| A06 | Wrong HTTP method for action | HIGH | -15 |
| A07 | POST returns 200 instead of 201+Location | MEDIUM | -7 |
| A08 | DELETE returns body instead of 204 | LOW | -3 |
| A09 | Generic 400/500 instead of specific status code | MEDIUM | -7 |
| A10 | Error response missing required fields | MEDIUM | -7 |
| A11 | Stack trace in error response | HIGH | -15 |
| A12 | No JWT iss/aud/exp/scope validation | CRITICAL | -25 |
| A13 | Unprotected route (no auth middleware) | HIGH | -15 |
| A14 | Wildcard CORS (`origins: ['*']`) in production | HIGH | -15 |
| A15 | No CSRF protection on state-changing endpoints | MEDIUM | -7 |
| A16 | No rate limiting on public endpoints | MEDIUM | -7 |
| A17 | Missing security headers (helmet/CSP/HSTS) | MEDIUM | -7 |
| A18 | No structured JSON logging / missing correlation ID | MEDIUM | -7 |
| A19 | Sensitive data (password/token/secret) in logs | HIGH | -15 |
| A20 | No health check endpoint | LOW | -3 |
| A21 | No input schema validation on request body | HIGH | -15 |
| A22 | camelCase not used for JSON property names | LOW | -3 |
| A23 | Dates not in ISO 8601 format | LOW | -3 |
| A24 | Fat endpoint returning everything (ISP violation) | LOW | -3 |

---

## A01 — OpenAPI Spec Missing
**Severity:** HIGH | **Penalty:** -15

All services MUST publish an OpenAPI 3.0+ spec at `docs/openapi.yaml` or `docs/openapi.json`.

**Detect:**
```bash
ls docs/openapi.yaml docs/openapi.json 2>/dev/null || echo "MISSING"
```

**Check version:**
```bash
grep "^openapi:" docs/openapi.yaml
# Must be 3.0.0 or higher
```

❌ Missing entirely or using Swagger 2.0 (`swagger: "2.0"`)
✅ `openapi: 3.0.3` in `docs/openapi.yaml`

---

## A02 — Endpoint Documentation Incomplete
**Severity:** MEDIUM | **Penalty:** -7 per endpoint

Each endpoint MUST have: summary, description, security (OAuth scopes), all parameters with types/constraints, request/response schemas, ALL expected status codes, at least one happy-path example, at least one error example.

**Detect:** Open `docs/openapi.yaml` and scan each path operation for missing fields.

Required per endpoint:
- `summary` + `description`
- `security` block with required scopes
- `parameters` with `schema` and `example`
- `responses` with schemas for every code listed
- At least one `examples` entry under 2XX and one under 4XX

---

## A03 — No URI Versioning
**Severity:** HIGH | **Penalty:** -15

All routes MUST include version in the URI path.

**Format:** `/api/v{major}/ResourceName` or `/api/v{major}.{minor}/ResourceName`

**Detect:**
```bash
# Find route definitions not matching /api/v\d+/
grep -r "app\.\(get\|post\|put\|patch\|delete\)\|router\.\(get\|post\)" src/ \
  | grep -v '/api/v[0-9]'
```

❌ `/api/users`, `/users`, `/v/users`
✅ `/api/v1/Users`, `/api/v1.1/Users`, `/api/v2/Orders`

---

## A04 — Verb in URL Path
**Severity:** MEDIUM | **Penalty:** -7

URLs represent resources. HTTP methods define the action. No verbs allowed.

**Detect:**
```bash
grep -rE '/(get|create|update|delete|fetch|list|add|remove|find)[A-Z/]' src/
```

❌ `GET /api/v1/getUsers`, `POST /api/v1/createUser`, `GET /api/v1/Users/123/delete`
✅ `GET /api/v1/Users`, `POST /api/v1/Users`, `DELETE /api/v1/Users/123`

---

## A05 — Route Resource Names Not PascalCase Plural
**Severity:** LOW | **Penalty:** -3

Routes use **PascalCase plural nouns**. No hyphens, underscores, or lowercase.

**Detect:**
```bash
grep -rE '/api/v[0-9]+/[a-z]' src/
grep -rE '/api/v[0-9]+/[A-Z][a-z]+-' src/
```

❌ `/api/v1/users`, `/api/v1/user-profiles`, `/api/v1/order_items`
✅ `/api/v1/Users`, `/api/v1/UserProfiles`, `/api/v1/OrderItems`

---

## A06 — Wrong HTTP Method
**Severity:** HIGH | **Penalty:** -15

| Method | Contract |
|--------|----------|
| GET | Safe + idempotent. MUST NOT modify state. No request body. |
| POST | Creates resource. Not idempotent. Returns 201 + Location. |
| PUT | Replaces entire resource. Idempotent. All fields required. |
| PATCH | Partial update. Only modified fields. Returns 200 + updated resource. |
| DELETE | Removes resource. Idempotent. Returns 204. |

**Detect:**
```bash
# GET routes that call update/save/delete/insert methods
grep -rA5 'router\.get\|app\.get' src/ | grep -i 'update\|save\|delete\|insert\|create'
```

❌ `GET /api/v1/Users?action=delete` — GET must not modify state
❌ `POST /api/v1/Users/123` to update — use PUT/PATCH
✅ `DELETE /api/v1/Users/123` → 204

---

## A07 — POST Returns 200 Instead of 201+Location
**Severity:** MEDIUM | **Penalty:** -7

POST that creates a resource MUST return **201 Created** with a `Location` header pointing to the new resource.

**Detect:**
```bash
grep -rA10 'router\.post\|app\.post' src/ | grep -E 'status\(200\)|\.json\(' | grep -v '201'
```

❌
```typescript
res.status(200).json(user);
```
✅
```typescript
res.status(201).location(`/api/v1/Users/${user.id}`).json(user);
```

---

## A08 — DELETE Returns Body Instead of 204
**Severity:** LOW | **Penalty:** -3

DELETE MUST return **204 No Content** with no response body.

**Detect:**
```bash
grep -rA10 'router\.delete\|app\.delete' src/ | grep -v '204'
```

---

## A09 — Generic Status Code
**Severity:** MEDIUM | **Penalty:** -7

Use the most specific status code. Never use raw 400 or 500 for all errors.

**Required codes:**

| Code | When |
|------|------|
| 400 | Malformed request syntax |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but lacks permission |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 422 | Validation errors on valid JSON body |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

**Detect:**
```bash
grep -rn 'status(400)' src/ | grep -v '422\|401\|403\|404\|409'
```

---

## A10 — Error Response Missing Required Fields
**Severity:** MEDIUM | **Penalty:** -7

All error responses MUST follow this exact structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": [{ "field": "email", "message": "Invalid format" }],
  "timestamp": "2026-04-16T12:00:00Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Detect:**
```bash
grep -rn 'res\.status.*\.json\|reply\.status.*\.send' src/ \
  | grep -v 'requestId\|timestamp\|error:'
```

---

## A11 — Stack Trace in Error Response
**Severity:** HIGH | **Penalty:** -15 (also flagged in security as S12)

NEVER expose `error.stack`, `err.stack`, or internal error details in API responses.

**Detect:**
```bash
grep -rn '\.stack\b' src/ | grep -i 'json\|send\|response\|body'
grep -rn 'stack.*trace\|stacktrace' src/
```

❌
```typescript
res.status(500).json({ error: err.message, stack: err.stack });
```
✅
```typescript
req.log.error({ err }, 'Unexpected error');
res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId });
```

---

## A12 — JWT Validation Incomplete
**Severity:** CRITICAL | **Penalty:** -25

Every token validation MUST check ALL of: `iss`, `aud`, `exp`, `nbf`, `scopes`, `roles`, and cryptographic signature with explicit algorithm.

**Detect:**
```bash
grep -rn 'jwt\.verify\|verifyToken\|validateToken' src/
# Check each call — must specify algorithms array
grep -rn 'algorithms.*\[\|algorithm:' src/
```

**Required validation checklist:**
- [ ] `iss` (issuer) matches expected auth server
- [ ] `aud` (audience) matches this service
- [ ] `exp` not expired
- [ ] `nbf` not before check
- [ ] Required scopes present
- [ ] Explicit `algorithms: ['RS256']` or `['ES256']` — never omit
- [ ] Signature cryptographically verified

❌
```typescript
jwt.verify(token, secret);  // No algorithm, no aud/iss check
```
✅
```typescript
jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
});
```

---

## A13 — Unprotected Route
**Severity:** HIGH | **Penalty:** -15

Every non-public route MUST have authentication middleware. Check for routes missing auth config.

**Detect:**
```bash
# Fastify pattern — check for authRequired: true
grep -rn 'fastify\.\(get\|post\|put\|patch\|delete\)' src/ -A5 | grep -v 'authRequired'
# Express pattern
grep -rn 'router\.\(get\|post\|put\|patch\|delete\)' src/ -B2 | grep -v 'authenticate\|authorize\|auth'
```

❌
```typescript
server.route({ method: 'DELETE', url: '/users/:id', handler: deleteUser });
```
✅
```typescript
server.route({ method: 'DELETE', url: '/users/:id',
  config: { authRequired: true, allowedRoles: ['admin'] },
  handler: deleteUser });
```

---

## A14 — Wildcard CORS
**Severity:** HIGH | **Penalty:** -15 (also flagged as S15 in security)

Wildcard CORS (`*`) is never acceptable in production. Only in dev/test.

**Detect:**
```bash
grep -rn "origin.*'\*'\|origin.*\"\*\"\|origins.*\['\*'\]" src/
grep -rn 'cors.*\*\|CORS.*\*' src/
```

❌
```typescript
app.use(cors({ origin: '*' }));
framework.enableCORS({ origins: ['*'] });
```
✅
```typescript
framework.enableCORS({
  origins: ['https://myapp.com', 'https://admin.myapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

## A15 — No CSRF Protection
**Severity:** MEDIUM | **Penalty:** -7

State-changing endpoints (POST/PUT/PATCH/DELETE) MUST have CSRF protection for browser-facing APIs.

**Detect:**
```bash
grep -rn 'csrf\|CSRF\|csrfToken' src/ || echo "NO CSRF FOUND"
grep -rn 'enableCSRFProtection\|csurf\|@fastify/csrf' src/
```

**Expected flow:**
1. Client calls `GET /csrf/token` → gets token in cookie
2. Client sends token in `x-framework-csrf-token` header
3. Framework validates on POST/PUT/DELETE/PATCH

---

## A16 — No Rate Limiting
**Severity:** MEDIUM | **Penalty:** -7

Public and auth endpoints MUST have rate limiting to prevent abuse.

**Detect:**
```bash
grep -rn 'rate-limit\|rateLimit\|@fastify/rate-limit\|express-rate-limit' src/ package.json
```

✅
```typescript
await server.register(rateLimit, { max: 100, timeWindow: '1 minute' });
```

---

## A17 — Missing Security Headers
**Severity:** MEDIUM | **Penalty:** -7

Required headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.

**Detect:**
```bash
grep -rn 'helmet\|X-Content-Type-Options\|X-Frame-Options\|Strict-Transport' src/
```

✅ Minimum required:
```typescript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
res.setHeader('Content-Security-Policy', "default-src 'self'");
```

---

## A18 — No Structured Logging / Missing Correlation ID
**Severity:** MEDIUM | **Penalty:** -7

All log entries MUST be structured JSON with `requestId`, `traceId`, `spanId`, `method`, `path`, `statusCode`, `latencyMs`.

**Detect:**
```bash
grep -rn 'console\.log\|console\.error' src/
grep -rn 'requestId\|correlationId\|traceId' src/ || echo "NO CORRELATION ID"
```

Required log fields:
```json
{
  "timestamp": "ISO8601",
  "level": "INFO",
  "message": "...",
  "requestId": "uuid",
  "traceId": "hex",
  "spanId": "hex",
  "method": "GET",
  "path": "/api/v1/Users",
  "statusCode": 200,
  "latencyMs": 45,
  "service": "service-name"
}
```

---

## A19 — Sensitive Data in Logs
**Severity:** HIGH | **Penalty:** -15 (also flagged as S19 in security)

NEVER log: passwords, tokens, API keys, credit card numbers, SSNs, full auth headers.

**Detect:**
```bash
grep -rn 'log.*password\|log.*token\|log.*secret\|log.*apiKey\|log.*Authorization' src/
grep -rn 'logger\.\(info\|debug\|warn\|error\).*password' src/
```

❌ `logger.info('Login attempt', { email, password });`
✅ `logger.info('Login attempt', { email });`

Mask IPs: `192.168.1.xxx` (last octet). Never log full IPs in prod.

---

## A20 — No Health Check Endpoint
**Severity:** LOW | **Penalty:** -3

Services MUST expose `GET /health` (liveness) and ideally `GET /health/ready` (readiness).

**Detect:**
```bash
grep -rn '/health\|healthCheck\|health-check' src/
```

✅ Expected response:
```json
{ "status": "HEALTHY", "timestamp": "2026-04-16T12:00:00Z", "checks": { "database": "UP" } }
```

---

## A21 — No Input Validation
**Severity:** HIGH | **Penalty:** -15

All request bodies, path params, and query params MUST be validated with schema or a validation library before use.

**Detect:**
```bash
grep -rn 'req\.body\.\|request\.body\.' src/ | grep -v 'schema\|validate\|zod\|joi\|yup'
grep -rn 'req\.params\.\|request\.params\.' src/ | grep -v 'parseInt\|validate\|uuid'
```

✅ Fastify schema validation:
```typescript
fastify.post('/users', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 255 },
        password: { type: 'string', minLength: 8, maxLength: 100 },
      },
    },
  },
  handler: async (req, reply) => { /* body is validated */ },
});
```

---

## A22 — JSON Properties Not camelCase
**Severity:** LOW | **Penalty:** -3

All JSON property names MUST be camelCase. Dates MUST be ISO 8601.

**Detect:**
```bash
grep -rn '"[a-z][a-z]*_[a-z]' src/
grep -rn "'[a-z][a-z]*_[a-z]'" src/
```

❌ `{ "user_id": 1, "first_name": "John", "created_at": "2026-04-16" }`
✅ `{ "userId": 1, "firstName": "John", "createdAt": "2026-04-16T00:00:00Z" }`

---

## A23 — Non-ISO Date Format
**Severity:** LOW | **Penalty:** -3

All date/time values in JSON MUST be ISO 8601 with timezone: `2026-04-16T12:00:00Z`

**Detect:**
```bash
grep -rn 'toLocaleDateString\|\.toDateString\|MM/DD/YYYY\|DD-MM-YYYY' src/
```

---

## A24 — Fat Endpoint (ISP Violation)
**Severity:** LOW | **Penalty:** -3

Endpoints must be focused. Do not return everything in one response — let clients request what they need.

**Detect:** Look for `?include=everything`, `?expand=all`, or response objects with > 20 fields.

❌ `GET /api/v1/Users/123?include=everything`
✅
```
GET /api/v1/Users/123          → basic info
GET /api/v1/Users/123/Profile  → detailed profile
GET /api/v1/Users/123/Orders   → orders
```

---

## Scoring Reference

| Score | Grade | Meaning |
|-------|-------|---------|
| 90–100 | A | Compliant, production-ready |
| 75–89 | B | Minor issues, fix soon |
| 60–74 | C | Several gaps, fix in current sprint |
| 40–59 | D | Significant non-compliance |
| < 40 | F | Critical gaps, do not ship |
