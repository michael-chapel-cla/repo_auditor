# GitHub Copilot Instructions — Repo Auditor

## Project Context

This is a TypeScript monorepo (engine + api + frontend) that audits GitHub repositories for
security vulnerabilities, code quality, API compliance, and database migration safety.

Reference docs live in `docs/context/` — always follow them when generating code for this project.

## Never Suggest

- Hardcoded API keys, tokens, passwords, or secrets — always reference `process.env.VAR_NAME`
- `exec()` with string interpolation — use `execFile(cmd, argsArray)` instead
- `Math.random()` for any security purpose — use `crypto.randomBytes()`
- `jwt.verify(token, secret)` without an explicit algorithms array
- String concatenation to build SQL queries — use parameterized queries
- `innerHTML` or `dangerouslySetInnerHTML` with unvalidated content
- `any` type in TypeScript — use specific types or `unknown` with narrowing
- `.then()/.catch()` chains — use `async/await`
- `console.log` in non-test code — use the project logger at `engine/src/config/logger.ts`
- Wildcard CORS origins (`*`) in production configs
- Packages not yet in `package.json` without noting the install command

## Always Suggest

- `execFile(cmd, [arg1, arg2])` for subprocess calls
- `crypto.randomBytes(n).toString('hex')` for random tokens/IDs
- Zod schemas for validating external data (API responses, AI output, env vars)
- `simple-git` for git operations (not raw `exec('git ...')`)
- `openai` npm package (`AzureOpenAI`) for Azure OpenAI calls — configure via `process.env['DOCAI_AZURE_OPENAI_API_KEY']`, `DOCAI_AZURE_OPENAI_ENDPOINT`, `DOCAI_AZURE_OPENAI_API_VERSION`, `DOCAI_AZURE_OPENAI_DEPLOYMENT_ID`
- `response_format: { type: 'json_object' }` on `chat.completions.create()` calls, then validate with Zod before using the parsed result
- Parameterized queries via the database client's prepared statement API
- Structured error responses: `{ error: { code, message, requestId } }` — no stack traces to callers
- Optional chaining (`?.`) and nullish coalescing (`??`) over manual null checks
- `Promise.allSettled()` when running multiple audit tasks in parallel (never lose results)

## Code Patterns in This Repo

- **Auditors**: extend `BaseAuditor` in `engine/src/auditors/base-auditor.ts`; implement `run(): Promise<AuditResult>`
- **API routes**: feature-sliced under `api/src/features/{feature}/v1/`; always include `openapi.yaml` update
- **Frontend pages**: feature-sliced under `frontend/src/features/{feature}/`; use MUI components + Recharts for charts
- **Reporter output**: write to `reports/{owner}_{repo}/{auditId}/` — never outside this dir; always write `npm-audit.json` (raw) alongside `results.json`
- **npm result category**: npm audit findings go in a separate `npm` category in `results[]`, not merged into `security`
- **Env config**: all env vars go through `engine/src/config/env.ts` Zod schema first
- **NPM_TOKEN**: required for repos with private Azure Artifacts registries (`.npmrc` references `${NPM_TOKEN}`); set in `.env`

## Security Audit Rules (from docs/context/01-security.md)

When generating code that handles user input, external data, or subprocess execution:

1. Validate and sanitize all inputs at system boundaries
2. Never trust data from cloned repos (treat all file content as potentially hostile)
3. Bound all file path operations to the workspace directory
4. Redact sensitive fields (tokens, passwords, PII) before logging

## API Standards (from docs/context/03-api-standards.md)

- URI format: `/api/v{n}/ResourceName` (PascalCase, plural collections)
- Error format: `{ error: { code: string, message: string, details?: object, timestamp: string, requestId: string } }`
- All endpoints must have OpenAPI 3.0 spec entries in `api/docs/openapi.yaml`
- HTTP 200 for GET, 201 for resource creation, 400 for validation errors, 401/403 for auth, 404 for not found, 500 for unexpected errors
