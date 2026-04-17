# /api-audit

Run an API standards compliance audit on a repository.

**Usage:** `/api-audit owner/repo` or `/api-audit`

## What I will do

Read `agents/claude/api-audit.md` and `docs/context/03-api-standards.md`, then:

1. Look for OpenAPI spec file (`docs/openapi.yaml`, `openapi.yaml`, etc.)
2. Validate spec completeness: missing descriptions, undocumented status codes, missing auth
3. Scan route files for versioning compliance (`/api/v{n}/ResourceName`)
4. Check JWT verify calls for explicit algorithm specification
5. Check for wildcard CORS, missing CSRF protection, missing rate limiting
6. Check for helmet/security headers
7. Check error handlers — ensure no stack traces leak to callers
8. Check logging for correlation IDs and sensitive data redaction
9. Write results to `reports/{slug}/{auditId}/api-results.json`
10. Print findings grouped by rule

Target: $ARGUMENTS
