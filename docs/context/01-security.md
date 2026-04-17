# Security Audit Rules
> Load this file before running any security audit. Rules are ordered by severity: AI/LLM risks first, then credentials, then injection, then auth, then general.

---

## Quick Reference — All Rules

| # | Rule | Severity | CWE | Source |
|---|---|---|---|---|
| S01 | User content in AI system prompt | CRITICAL | CWE-77 | AI/LLM |
| S02 | Unsanitized LLM output used as code/command | CRITICAL | CWE-74 | AI/LLM |
| S03 | Hardcoded secret / API key / token | CRITICAL | CWE-798 | Secrets |
| S04 | SQL injection via string concatenation | CRITICAL | CWE-89 | DB |
| S05 | NoSQL injection via unvalidated object | CRITICAL | CWE-943 | DB |
| S06 | Command injection via `exec()` string | CRITICAL | CWE-78 | Shell |
| S07 | JWT verify without explicit algorithm | CRITICAL | CWE-327 | Auth |
| S08 | `Math.random()` for security values | HIGH | CWE-330 | Crypto |
| S09 | Hardcoded OAuth client secret | CRITICAL | CWE-798 | Auth |
| S10 | XSS via `innerHTML` / `dangerouslySetInnerHTML` | HIGH | CWE-79 | Output |
| S11 | Path traversal — user input in file path | HIGH | CWE-22 | FS |
| S12 | Stack trace / internal error in API response | HIGH | CWE-209 | Error |
| S13 | Missing JWT audience or issuer validation | HIGH | CWE-287 | Auth |
| S14 | Hallucinated / unverified npm package | HIGH | CWE-1357 | Supply Chain |
| S15 | Wildcard CORS `origin: '*'` in production | HIGH | CWE-942 | CORS |
| S16 | Missing rate limiting on API server | MEDIUM | CWE-770 | Auth |
| S17 | Missing CSRF protection on state-changing routes | MEDIUM | CWE-352 | Auth |
| S18 | Missing security headers (helmet/CSP/HSTS) | MEDIUM | CWE-693 | Headers |
| S19 | Sensitive data (passwords/tokens) in logs | MEDIUM | CWE-532 | Logging |
| S20 | `eval()` / `new Function()` / `setTimeout(string)` | HIGH | CWE-94 | Injection |

---

## S01 — User Content in AI System Prompt
**Severity**: CRITICAL | **CWE**: CWE-77 (Prompt Injection)

Interpolating user-controlled or repo-read content into an AI system prompt allows an attacker to override the agent's instructions.

### Detect
Search for any AI API call where the `system` role content is built from a variable:
```
Pattern: { role: "system", content: `...${variable}...` }
Pattern: { role: "system", content: "..." + anyVar }
Pattern: system_prompt = base + userInput
```

### ❌ NEVER
```typescript
// User data injected into system prompt — prompt injection attack vector
const response = await anthropic.messages.create({
  system: `You are an assistant. User context: ${req.body.userContext}`,  // ❌
  messages: [{ role: "user", content: userMessage }]
});
```

### ✅ ALWAYS
```typescript
// System prompt is static. User content goes only in the user role.
const SYSTEM_PROMPT = `You are a security auditor. Follow these rules: ...`; // static string

const response = await anthropic.messages.create({
  system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: userMessage }]  // ✅ user content isolated here
});
```

### Also flag
- LLM tool call results fed directly back into system prompt without sanitization
- File contents from the scanned repo placed in the system prompt
- Any `prompt = systemPrompt + repoFileContent` pattern

---

## S02 — Unsanitized LLM Output Used as Code or Command
**Severity**: CRITICAL | **CWE**: CWE-74

Using raw LLM text output to execute code, shell commands, or SQL without validation creates an indirect prompt injection exploit chain.

### Detect
```
Pattern: exec(llmResponse)
Pattern: eval(llmOutput)
Pattern: db.query(aiGeneratedSql)
Pattern: fs.writeFile(path, llmContent) followed by require(path)
```

### ❌ NEVER
```typescript
const code = await callLLM("Generate a migration script");
exec(code.content);  // ❌ AI output executed directly
```

### ✅ ALWAYS
```typescript
const rawOutput = await callLLM("...");
const validated = AiResponseSchema.parse(JSON.parse(rawOutput.content)); // Zod parse
// Use only validated.specificField — never execute raw content
```

---

## S03 — Hardcoded Secret / API Key / Token
**Severity**: CRITICAL | **CWE**: CWE-798

### Detect (patterns to search for in source files)
```
/['"]sk-[A-Za-z0-9]{20,}['"]/ — OpenAI key
/['"]ghp_[A-Za-z0-9]{36,}['"]/ — GitHub token
/['"]AKIA[A-Z0-9]{16}['"]/ — AWS key
/apiKey\s*[:=]\s*['"][^'"]{10,}['"]/ — generic API key
/password\s*[:=]\s*['"][^'"]{4,}['"]/ — hardcoded password
/secret\s*[:=]\s*['"][^'"]{8,}['"]/ — hardcoded secret
/Bearer\s+[A-Za-z0-9._-]{20,}/ — hardcoded token in header
```

Also run: `gitleaks detect --source $WORKSPACE --report-format json`

### ❌ NEVER
```typescript
const client = new MongoClient('mongodb://admin:P@ssw0rd123@prod-server:27017'); // ❌
const apiKey = 'sk-ant-api03-abc123...'; // ❌
```

### ✅ ALWAYS
```typescript
const client = new MongoClient(process.env['MONGODB_URI']!);
const apiKey = process.env['ANTHROPIC_API_KEY']!;
// Fail fast if missing:
if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required');
```

---

## S04 — SQL Injection via String Concatenation
**Severity**: CRITICAL | **CWE**: CWE-89

### Detect
```
Pattern: "SELECT" + variable
Pattern: `SELECT ... ${variable} ...`
Pattern: "WHERE email = '" + email + "'"
Pattern: db.query("..." + req.body.field)
Pattern: EXEC('...' + @userInput)   (in SQL files)
```

### ❌ NEVER
```typescript
const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`); // ❌
const result = await db.execute("UPDATE users SET name = '" + name + "'");   // ❌
```

### ✅ ALWAYS
```typescript
const user = await db.query('SELECT * FROM users WHERE email = @email', { email }); // ✅
const result = await db.execute('UPDATE users SET name = @name WHERE id = @id', { name, id }); // ✅
```

---

## S05 — NoSQL Injection via Unvalidated Object
**Severity**: CRITICAL | **CWE**: CWE-943

### Detect
```
Pattern: collection.find(req.body)  — entire body as query
Pattern: collection.find({ field: req.query.value })  — no type check
Pattern: Model.findOne(userInput)
```

### ❌ NEVER
```typescript
const doc = await collection.find(req.body);           // ❌ — body may contain $where, $ne etc.
const user = await User.findOne({ email: req.query.email }); // ❌ — no type validation
```

### ✅ ALWAYS
```typescript
const { email } = EmailSchema.parse(req.body);         // Zod parse first
const user = await User.findOne({ email: String(email) }); // typed and validated
```

---

## S06 — Command Injection via `exec()` String
**Severity**: CRITICAL | **CWE**: CWE-78

### Detect
```
Pattern: exec(`...${variable}...`)
Pattern: exec("..." + variable)
Pattern: execSync(`...${req.params...}...`)
Pattern: spawn("sh", ["-c", userInput])
```

### ❌ NEVER
```typescript
exec(`git clone ${userRepo}`);           // ❌ — space or ; in userRepo = RCE
exec("npm install " + packageName);      // ❌
child_process.exec(`ls ${req.query.dir}`); // ❌
```

### ✅ ALWAYS
```typescript
import { execFile } from 'node:child_process';

execFile('git', ['clone', '--', userRepo], { cwd: safeDir });  // ✅ args as array
execFile('npm', ['install', packageName]);                      // ✅
```

**Note**: `execFile()` with an argument array never spawns a shell. `exec()` always does.

---

## S07 — JWT Verify Without Explicit Algorithm
**Severity**: CRITICAL | **CWE**: CWE-327

Without `algorithms`, an attacker can submit a JWT with `alg: "none"` or switch to a symmetric algorithm using the public key as the secret.

### Detect
```
Pattern: jwt.verify(token, secret)         — missing third argument
Pattern: jwt.verify(token, secret, {})     — empty options
Pattern: jwt.verify(token, publicKey)      — no algorithm specified
```

### ❌ NEVER
```typescript
const payload = jwt.verify(token, process.env.JWT_SECRET!);  // ❌ — no alg
const payload = jwt.verify(token, publicKey, {});             // ❌ — empty options
```

### ✅ ALWAYS
```typescript
const payload = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],           // ✅ explicit algorithm
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
});
```

Also validate: `exp` (expiration), `nbf` (not before), `iss` (issuer), `aud` (audience), `scope`.

---

## S08 — `Math.random()` for Security Values
**Severity**: HIGH | **CWE**: CWE-330

`Math.random()` is a pseudorandom number generator — output can be predicted.

### Detect
```
Pattern: Math.random()  near  token, secret, key, nonce, salt, id, otp, code
Pattern: Math.random().toString(36)
Pattern: (Math.random() * 1000000).toFixed(0)  — OTP generation
```

### ❌ NEVER
```typescript
const token = Math.random().toString(36).slice(2);  // ❌ predictable
const otp = Math.floor(Math.random() * 1000000);    // ❌ predictable
const sessionId = Date.now() + Math.random();        // ❌
```

### ✅ ALWAYS
```typescript
import { randomBytes, randomInt } from 'node:crypto';

const token = randomBytes(32).toString('hex');       // ✅ 256-bit token
const otp = randomInt(100000, 999999);               // ✅ secure 6-digit OTP
const sessionId = randomBytes(16).toString('base64url'); // ✅
```

---

## S09 — Hardcoded OAuth Client Secret
**Severity**: CRITICAL | **CWE**: CWE-798

Same as S03 but specific to OAuth flows. Client secrets in source allow impersonation of the entire application.

### Detect
```
Pattern: clientSecret: '...' with a literal string value
Pattern: client_secret = "..." in any auth config
Pattern: OAUTH_SECRET or CLIENT_SECRET with a literal value
```

### ✅ ALWAYS
```typescript
const oauth = new OAuth2Client({
  clientId: process.env['OAUTH_CLIENT_ID']!,
  clientSecret: process.env['OAUTH_CLIENT_SECRET']!,  // ✅ never a literal
});
```

---

## S10 — XSS via innerHTML / dangerouslySetInnerHTML
**Severity**: HIGH | **CWE**: CWE-79

### Detect
```
Pattern: element.innerHTML = variable
Pattern: dangerouslySetInnerHTML={{ __html: variable }}
Pattern: document.write(variable)
Pattern: element.outerHTML = variable
```

### ❌ NEVER
```tsx
<div dangerouslySetInnerHTML={{ __html: userContent }} />   // ❌
element.innerHTML = apiResponse.htmlContent;                // ❌
```

### ✅ ALWAYS
```tsx
// Option 1: render as text
<div>{userContent}</div>                                    // ✅ React escapes

// Option 2: if HTML is required, sanitize first
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />  // ✅
```

---

## S11 — Path Traversal — User Input in File Path
**Severity**: HIGH | **CWE**: CWE-22

### Detect
```
Pattern: path.join(baseDir, req.params.filename)
Pattern: fs.readFile(req.query.path)
Pattern: path.resolve(uploadDir, userProvidedName)  — without bounds check
```

### ❌ NEVER
```typescript
const file = path.join(__dirname, 'uploads', req.params.name);  // ❌ name='../../etc/passwd'
fs.readFileSync(req.query.file as string);                       // ❌
```

### ✅ ALWAYS
```typescript
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
const requested = path.resolve(UPLOAD_DIR, req.params.name);

if (!requested.startsWith(UPLOAD_DIR + path.sep)) {
  throw new Error('Path traversal attempt rejected');            // ✅ bounds check
}
fs.readFileSync(requested);
```

---

## S12 — Stack Trace / Internal Error in API Response
**Severity**: HIGH | **CWE**: CWE-209

Stack traces reveal file paths, library versions, and internal logic that attackers use to craft exploits.

### Detect
```
Pattern: res.json({ error: err.stack })
Pattern: res.send(err.message)  — in catch block, no filtering
Pattern: reply.send({ stack: error.stack })
Pattern: response.body contains "at Object." or "at Module."
```

### ❌ NEVER
```typescript
app.setErrorHandler((err, req, reply) => {
  reply.send({ error: err.message, stack: err.stack }); // ❌ — leaks internals
});
```

### ✅ ALWAYS
```typescript
app.setErrorHandler((err, req, reply) => {
  // Log full error internally for debugging
  req.log.error({ err, requestId }, 'Request failed');

  // Return generic message to caller
  const statusCode = err.statusCode ?? 500;
  reply.status(statusCode).send({
    error: {
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : (err.code ?? 'REQUEST_ERROR'),
      message: statusCode >= 500 ? 'An unexpected error occurred.' : err.message,
      requestId,
      timestamp: new Date().toISOString(),
    }
  });
});
```

---

## S13 — Missing JWT Audience or Issuer Validation
**Severity**: HIGH | **CWE**: CWE-287

Without `iss` and `aud` validation, a JWT from any service signed with the same algorithm is accepted.

### Detect
```
Pattern: jwt.verify(token, key, { algorithms: [...] })  — no issuer or audience
Pattern: decoded = jwt.decode(token)  — decode without verify
```

### ❌ NEVER
```typescript
jwt.verify(token, publicKey, { algorithms: ['RS256'] }); // ❌ missing iss/aud
const claims = jwt.decode(token);                        // ❌ no verification at all
```

### ✅ ALWAYS
```typescript
jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: process.env['JWT_ISSUER']!,         // ✅
  audience: process.env['JWT_AUDIENCE']!,     // ✅
});
```

---

## S14 — Hallucinated / Unverified npm Package
**Severity**: HIGH | **CWE**: CWE-1357

AI tools sometimes invent plausible-sounding package names that don't exist. Attackers can publish malicious packages under those names.

### Detect for each package in `package.json`:
```bash
# Check existence
curl -sf "https://registry.npmjs.org/{package}" > /dev/null || echo "NOT FOUND: {package}"

# Check download count
curl -s "https://api.npmjs.org/downloads/point/last-week/{package}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('downloads', 0))"
```

### Flag as CRITICAL if
- Package returns 404 from npm registry
- Package has 0 weekly downloads and was added recently

### Flag as HIGH if
- Package has < 100 weekly downloads
- Package name is a close misspelling of a popular package (typosquatting)
- Package has a `preinstall` or `postinstall` script that runs shell commands

### Check install scripts
```bash
cat node_modules/{package}/package.json | python3 -c "
import sys,json; p=json.load(sys.stdin); s=p.get('scripts',{})
print(s.get('preinstall',''), s.get('postinstall',''), s.get('install',''))"
```

---

## S15 — Wildcard CORS `origin: '*'`
**Severity**: HIGH | **CWE**: CWE-942

### Detect
```
Pattern: origin: '*'
Pattern: "Access-Control-Allow-Origin": "*"
Pattern: cors({ origin: true })  — reflects any origin
```

### ❌ NEVER (in production)
```typescript
app.register(cors, { origin: '*' }); // ❌ — allows any site to make credentialed requests
```

### ✅ ALWAYS
```typescript
const ALLOWED_ORIGINS = process.env['CORS_ORIGINS']!.split(',');
app.register(cors, {
  origin: ALLOWED_ORIGINS,           // ✅ explicit list
  credentials: true,
});
```

---

## S16 — Missing Rate Limiting
**Severity**: MEDIUM | **CWE**: CWE-770

### Detect
```
Pattern: fastify server startup file without @fastify/rate-limit
Pattern: express app without express-rate-limit
Pattern: No rate limiting on auth endpoints (/login, /token, /register)
```

### ✅ ALWAYS
```typescript
import rateLimit from '@fastify/rate-limit';
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // Stricter for auth endpoints:
  keyGenerator: (req) => req.ip,
});
```

---

## S17 — Missing CSRF Protection
**Severity**: MEDIUM | **CWE**: CWE-352

Required on all state-changing routes (POST, PUT, PATCH, DELETE) for browser-facing APIs.

### Detect
```
Pattern: Fastify/Express server without @fastify/csrf-protection / csurf
Pattern: State-changing routes with no CSRF token validation
```

### ✅ ALWAYS
```typescript
import csrf from '@fastify/csrf-protection';
await app.register(csrf);
// Then on protected routes: await reply.generateCsrf()
```

---

## S18 — Missing Security Headers
**Severity**: MEDIUM | **CWE**: CWE-693

### Detect
```
Pattern: Fastify/Express server without helmet or @fastify/helmet
Pattern: No Content-Security-Policy header
Pattern: No Strict-Transport-Security header
Pattern: No X-Frame-Options header
```

### ✅ ALWAYS
```typescript
import helmet from '@fastify/helmet';
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
});
```

**Required headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `Content-Security-Policy`.

---

## S19 — Sensitive Data in Logs
**Severity**: MEDIUM | **CWE**: CWE-532

### Detect
```
Pattern: log(... password ...) where password is a variable value
Pattern: logger.info({ user })  — entire user object including password field
Pattern: console.log(req.body)  — body may contain credentials
Pattern: log entries with: password, token, apiKey, secret, ssn, creditCard, cvv
```

### ❌ NEVER
```typescript
logger.info({ user: req.body.user, password: req.body.password }); // ❌
logger.debug({ headers: req.headers }); // ❌ — may contain Authorization header
```

### ✅ ALWAYS
```typescript
logger.info({
  userId: user.id,
  email: user.email,
  // password: NEVER LOG
  // token: NEVER LOG
});
// Or use a redaction serializer:
const redactedLogger = logger.child({}, { redact: ['password', 'token', 'apiKey', 'authorization'] });
```

---

## S20 — Dynamic Code Execution
**Severity**: HIGH | **CWE**: CWE-94

### Detect
```
Pattern: eval(variable)
Pattern: new Function(variable)
Pattern: setTimeout(string, delay)      — string form, not function form
Pattern: setInterval(string, interval)  — string form
Pattern: vm.runInThisContext(userInput)
```

### ❌ NEVER
```typescript
eval(userCode);                          // ❌
new Function('return ' + expression)();  // ❌
setTimeout('doSomething()', 1000);       // ❌ — string form executes as eval
```

### ✅ ALWAYS
```typescript
// If expression evaluation is needed, use a safe sandbox:
import { runInNewContext } from 'node:vm';
runInNewContext(code, {}, { timeout: 100 }); // ✅ isolated context
// Or better: don't execute user code at all
setTimeout(() => doSomething(), 1000);       // ✅ function form
```

---

## Prompt Injection Detection Patterns

When scanning files for content that may be fed to an LLM, flag these string patterns inside user-controlled data sources (form fields, uploaded files, repo README files, config values):

```python
INJECTION_PATTERNS = [
    r"ignore\s+(previous|all|prior)\s+instructions?",
    r"you\s+are\s+now\s+(?:a\s+)?(?:dan|evil|unrestricted|jailbreak)",
    r"disregard\s+(?:all\s+)?(?:previous\s+)?instructions?",
    r"(?:new|updated|override)\s+(?:system\s+)?(?:prompt|instructions?|rules?)",
    r"<(?:system|instruction|override|agent|INST)\b[^>]*>",
    r"\[(?:SYSTEM|INST|OVERRIDE|IGNORE|FORGET)\]",
    r"pretend\s+(?:you\s+are|to\s+be)\s+(?:a\s+)?(?:different|evil|unrestricted)",
    r"as\s+an?\s+AI\s+without\s+restrictions",
    r"DAN\s+mode",
]
```

---

## Scoring Reference for Security Audits

```
Starting score: 100

Deductions:
  Each CRITICAL finding: -25 (capped at score = 0)
  Each HIGH finding:     -15
  Each MEDIUM finding:   -7
  Each LOW finding:      -3

Status:
  "failed" → any CRITICAL or HIGH finding
  "passed" → only MEDIUM, LOW, or no findings
```
