# Security Audit Rules

> Load this file before running any security audit. Rules are ordered by severity: AI/LLM risks first, then credentials, then injection, then auth, then general.

---

## Quick Reference — All Rules

| #   | Rule                                               | Severity | CWE      | Source       |
| --- | -------------------------------------------------- | -------- | -------- | ------------ |
| S01 | User content in AI system prompt                   | CRITICAL | CWE-77   | AI/LLM       |
| S02 | Unsanitized LLM output used as code/command        | CRITICAL | CWE-74   | AI/LLM       |
| S03 | Hardcoded secret / API key / token                 | CRITICAL | CWE-798  | Secrets      |
| S04 | SQL injection via string concatenation             | CRITICAL | CWE-89   | DB           |
| S05 | NoSQL injection via unvalidated object             | CRITICAL | CWE-943  | DB           |
| S06 | Command injection via `exec()` string              | CRITICAL | CWE-78   | Shell        |
| S07 | JWT verify without explicit algorithm              | CRITICAL | CWE-327  | Auth         |
| S08 | `Math.random()` for security values                | HIGH     | CWE-330  | Crypto       |
| S09 | Hardcoded OAuth client secret                      | CRITICAL | CWE-798  | Auth         |
| S10 | XSS via `innerHTML` / `dangerouslySetInnerHTML`    | HIGH     | CWE-79   | Output       |
| S11 | Path traversal — user input in file path           | HIGH     | CWE-22   | FS           |
| S12 | Stack trace / internal error in API response       | HIGH     | CWE-209  | Error        |
| S13 | Missing JWT audience or issuer validation          | HIGH     | CWE-287  | Auth         |
| S14 | Hallucinated / unverified npm package              | HIGH     | CWE-1357 | Supply Chain |
| S15 | Wildcard CORS `origin: '*'` in production          | HIGH     | CWE-942  | CORS         |
| S16 | Missing rate limiting on API server                | MEDIUM   | CWE-770  | Auth         |
| S17 | Missing CSRF protection on state-changing routes   | MEDIUM   | CWE-352  | Auth         |
| S18 | Missing security headers (helmet/CSP/HSTS)         | MEDIUM   | CWE-693  | Headers      |
| S19 | Sensitive data (passwords/tokens) in logs          | MEDIUM   | CWE-532  | Logging      |
| S20 | `eval()` / `new Function()` / `setTimeout(string)` | HIGH     | CWE-94   | Injection    |
| S21 | Prototype pollution via user-controlled object keys | HIGH     | CWE-1321 | Injection    |
| S22 | TLS verification disabled (`rejectUnauthorized: false`) | HIGH  | CWE-295  | Crypto       |
| S23 | Weak cryptographic algorithm (MD5, SHA-1, DES, ECB)  | HIGH    | CWE-327  | Crypto       |

---

## S01 — User Content in AI System Prompt

**Severity**: CRITICAL | **CWE**: CWE-77 (Prompt Injection)

Interpolating user-controlled or repo-read content into an AI system prompt allows an attacker to override the agent's instructions.

This repo uses **Azure OpenAI** via the `openai` npm package (`AzureOpenAI`). System prompts are passed as messages with `role: 'system'` inside the `messages` array of `chat.completions.create()` — not as a top-level `system:` field. Detection patterns must target this shape.

### Detect

Search for any `chat.completions.create()` call where the `system` role message content is built from a variable:

```
Pattern: { role: 'system', content: `...${variable}...` }
Pattern: { role: 'system', content: '...' + anyVar }
Pattern: messages = [{ role: 'system', content: systemPrompt + userInput }, ...]
Pattern: const promptToUse = basePrompt + repoContent  (then used in messages array)
```

### ❌ NEVER

```typescript
// User data injected into system prompt — prompt injection attack vector
const response = await azureOpenai.chat.completions.create({
  model,
  messages: [
    {
      role: "system",
      content: `You are an assistant. User context: ${req.body.userContext}`,
    }, // ❌
    { role: "user", content: userMessage },
  ],
});
```

### ✅ ALWAYS

```typescript
// System prompt is a static constant. User content goes only in the user role.
const SYSTEM_PROMPT = "You are a security auditor. Follow these rules: ..."; // static string

const response = await azureOpenai.chat.completions.create({
  model,
  messages: [
    { role: "system", content: SYSTEM_PROMPT }, // ✅ static — never interpolated
    { role: "user", content: userMessage }, // ✅ user content isolated here
  ],
  temperature: 0.0,
});
```

### Also flag

- LLM tool call results fed directly back into the system role message without sanitization
- File contents from the scanned repo placed inside the `role: 'system'` message content
- Any pattern where the system-role message content is assembled from external or user-controlled input
- `promptToUse` or similar variables built by concatenating repo data, then placed in the system role

---

## S02 — Unsanitized LLM Output Used as Code or Command

**Severity**: CRITICAL | **CWE**: CWE-74

Using raw Azure OpenAI output to execute code, shell commands, or SQL without schema validation creates an indirect prompt injection exploit chain.

### Detect

```
Pattern: exec(response.choices[0].message.content)
Pattern: eval(response.choices[0].message.content)
Pattern: db.query(aiGeneratedSql)  — where aiGeneratedSql comes from chat.completions response
Pattern: fs.writeFile(path, llmContent) followed by require(path)
Pattern: JSON.parse(response.choices[0].message.content)  — without Zod validation after parse
```

### ❌ NEVER

```typescript
const response = await azureOpenai.chat.completions.create({ model, messages });
const content = response.choices[0].message.content || "";
exec(content); // ❌ AI output executed directly
eval(content); // ❌
db.query(content); // ❌ AI-generated SQL
const data = JSON.parse(content); // ❌ no schema validation
```

### ✅ ALWAYS

```typescript
const response = await azureOpenai.chat.completions.create({
  model,
  messages,
  response_format: { type: "json_object" }, // enforce structured output
});
const raw = response.choices[0].message.content || "";
const validated = AiResponseSchema.parse(JSON.parse(raw)); // ✅ Zod parse
// Use only validated.specificField — never execute raw content
```

---

## S03 — Hardcoded Secret / API Key / Token

**Severity**: CRITICAL | **CWE**: CWE-798

### Detect (patterns to search for in source files)

```
/['"]ghp_[A-Za-z0-9]{36,}['"]/ — GitHub token
/['"]AKIA[A-Z0-9]{16}['"]/ — AWS key
/apiKey\s*[:=]\s*['"][^'"]{10,}['"]/ — generic API key
/password\s*[:=]\s*['"][^'"]{4,}['"]/ — hardcoded password
/secret\s*[:=]\s*['"][^'"]{8,}['"]/ — hardcoded secret
/Bearer\s+[A-Za-z0-9._-]{20,}/ — hardcoded token in header
```

#### Azure OpenAI — additional patterns (this repo uses these env vars)

```
/DOCAI_AZURE_OPENAI_API_KEY\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/ — key literal in YAML/env files
/apiKey\s*[:=]\s*['"][A-Za-z0-9]{32,}['"]/ — Azure OAI key literal in TS/JS source
```

Also scan **Helm values files** and **CI workflow env blocks** — Azure OpenAI keys are frequently leaked there:

```bash
grep -rn 'AZURE_OPENAI_API_KEY' helm/ .github/ --include='*.yaml' --include='*.yml'
gitleaks detect --source $WORKSPACE --report-format json
```

### ❌ NEVER

```typescript
const azureOpenai = new AzureOpenAI({
  apiKey: "abc123abc123abc123abc123abc123ab", // ❌ hardcoded key
  endpoint: "https://my-instance.openai.azure.com/",
});
```

```yaml
# helm/values-prd.yaml  ❌
env:
  DOCAI_AZURE_OPENAI_API_KEY: "5Xgsyq7c7SBeUWDzHgTM..." # ❌ hardcoded in Helm values
```

### ✅ ALWAYS

```typescript
const azureOpenai = new AzureOpenAI({
  apiKey: process.env["DOCAI_AZURE_OPENAI_API_KEY"]!,
  endpoint: process.env["DOCAI_AZURE_OPENAI_ENDPOINT"]!,
  apiVersion: process.env["DOCAI_AZURE_OPENAI_API_VERSION"]!,
  deployment: process.env["DOCAI_AZURE_OPENAI_DEPLOYMENT_ID"]!,
});
// Fail fast if missing:
if (!process.env["DOCAI_AZURE_OPENAI_API_KEY"]) {
  throw new Error(
    "DOCAI_AZURE_OPENAI_API_KEY environment variable is required",
  );
}
```

```yaml
# helm/values-prd.yaml  ✅
env:
  DOCAI_AZURE_OPENAI_API_KEY: "" # injected at deploy time from Key Vault / CI secret
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
const result = await db.execute("UPDATE users SET name = '" + name + "'"); // ❌
```

### ✅ ALWAYS

```typescript
const user = await db.query("SELECT * FROM users WHERE email = @email", {
  email,
}); // ✅
const result = await db.execute(
  "UPDATE users SET name = @name WHERE id = @id",
  { name, id },
); // ✅
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
const doc = await collection.find(req.body); // ❌ — body may contain $where, $ne etc.
const user = await User.findOne({ email: req.query.email }); // ❌ — no type validation
```

### ✅ ALWAYS

```typescript
const { email } = EmailSchema.parse(req.body); // Zod parse first
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
exec(`git clone ${userRepo}`); // ❌ — space or ; in userRepo = RCE
exec("npm install " + packageName); // ❌
child_process.exec(`ls ${req.query.dir}`); // ❌
```

### ✅ ALWAYS

```typescript
import { execFile } from "node:child_process";

execFile("git", ["clone", "--", userRepo], { cwd: safeDir }); // ✅ args as array
execFile("npm", ["install", packageName]); // ✅
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
const payload = jwt.verify(token, process.env.JWT_SECRET!); // ❌ — no alg
const payload = jwt.verify(token, publicKey, {}); // ❌ — empty options
```

### ✅ ALWAYS

```typescript
const payload = jwt.verify(token, publicKey, {
  algorithms: ["RS256"], // ✅ explicit algorithm
  issuer: "https://auth.example.com",
  audience: "https://api.example.com",
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
const token = Math.random().toString(36).slice(2); // ❌ predictable
const otp = Math.floor(Math.random() * 1000000); // ❌ predictable
const sessionId = Date.now() + Math.random(); // ❌
```

### ✅ ALWAYS

```typescript
import { randomBytes, randomInt } from "node:crypto";

const token = randomBytes(32).toString("hex"); // ✅ 256-bit token
const otp = randomInt(100000, 999999); // ✅ secure 6-digit OTP
const sessionId = randomBytes(16).toString("base64url"); // ✅
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
  clientId: process.env["OAUTH_CLIENT_ID"]!,
  clientSecret: process.env["OAUTH_CLIENT_SECRET"]!, // ✅ never a literal
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
<div dangerouslySetInnerHTML={{ __html: userContent }} />; // ❌
element.innerHTML = apiResponse.htmlContent; // ❌
```

### ✅ ALWAYS

```tsx
// Option 1: render as text
<div>{userContent}</div>; // ✅ React escapes

// Option 2: if HTML is required, sanitize first
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />; // ✅
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
const file = path.join(__dirname, "uploads", req.params.name); // ❌ name='../../etc/passwd'
fs.readFileSync(req.query.file as string); // ❌
```

### ✅ ALWAYS

```typescript
const UPLOAD_DIR = path.resolve(__dirname, "uploads");
const requested = path.resolve(UPLOAD_DIR, req.params.name);

if (!requested.startsWith(UPLOAD_DIR + path.sep)) {
  throw new Error("Path traversal attempt rejected"); // ✅ bounds check
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
  req.log.error({ err, requestId }, "Request failed");

  // Return generic message to caller
  const statusCode = err.statusCode ?? 500;
  reply.status(statusCode).send({
    error: {
      code:
        statusCode >= 500 ? "INTERNAL_ERROR" : (err.code ?? "REQUEST_ERROR"),
      message:
        statusCode >= 500 ? "An unexpected error occurred." : err.message,
      requestId,
      timestamp: new Date().toISOString(),
    },
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
jwt.verify(token, publicKey, { algorithms: ["RS256"] }); // ❌ missing iss/aud
const claims = jwt.decode(token); // ❌ no verification at all
```

### ✅ ALWAYS

```typescript
jwt.verify(token, publicKey, {
  algorithms: ["RS256"],
  issuer: process.env["JWT_ISSUER"]!, // ✅
  audience: process.env["JWT_AUDIENCE"]!, // ✅
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
app.register(cors, { origin: "*" }); // ❌ — allows any site to make credentialed requests
```

### ✅ ALWAYS

```typescript
const ALLOWED_ORIGINS = process.env["CORS_ORIGINS"]!.split(",");
app.register(cors, {
  origin: ALLOWED_ORIGINS, // ✅ explicit list
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
import rateLimit from "@fastify/rate-limit";
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
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
import csrf from "@fastify/csrf-protection";
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
import helmet from "@fastify/helmet";
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
const redactedLogger = logger.child(
  {},
  { redact: ["password", "token", "apiKey", "authorization"] },
);
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
eval(userCode); // ❌
new Function("return " + expression)(); // ❌
setTimeout("doSomething()", 1000); // ❌ — string form executes as eval
```

### ✅ ALWAYS

```typescript
// If expression evaluation is needed, use a safe sandbox:
import { runInNewContext } from "node:vm";
runInNewContext(code, {}, { timeout: 100 }); // ✅ isolated context
// Or better: don't execute user code at all
setTimeout(() => doSomething(), 1000); // ✅ function form
```

---

## S21 — Prototype Pollution via User-Controlled Object Keys

**Severity**: HIGH | **CWE**: CWE-1321

When user-supplied objects are merged into application objects without key filtering, an attacker can inject `__proto__` or `constructor` keys and modify the prototype of all objects in the process.

### Detect

```
Pattern: Object.assign(target, req.body)        — merging untrusted object
Pattern: _.merge(config, userInput)             — lodash deep merge with user data
Pattern: target[req.body.key] = req.body.value  — dynamic key assignment from request
Pattern: for (key in req.body) { obj[key] = req.body[key] }
```

### ❌ NEVER

```typescript
Object.assign(config, req.body); // ❌ — if body = { __proto__: { admin: true } }
_.merge(options, userInput);     // ❌ — classic lodash prototype pollution vector
```

### ✅ ALWAYS

```typescript
// Validate and destructure only known keys
const { name, email } = UserSchema.parse(req.body); // Zod strips unknown keys
const safe = Object.create(null); // null prototype — cannot be polluted
Object.assign(safe, { name, email });

// If merging is genuinely needed, sanitize keys first:
function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    target[key] = source[key];
  }
}
```

---

## S22 — TLS Verification Disabled

**Severity**: HIGH | **CWE**: CWE-295

Disabling TLS certificate verification allows man-in-the-middle attacks — any party on the network can intercept and modify HTTPS traffic.

### Detect

```
Pattern: rejectUnauthorized: false
Pattern: rejectUnauthorized: 0
Pattern: verify: false     — in request/TLS options
Pattern: NODE_TLS_REJECT_UNAUTHORIZED = '0'
Pattern: ssl: false        — in DB connection config
Pattern: sslmode=disable   — in connection string
Pattern: strictSSL: false  — in older HTTP libs
```

### ❌ NEVER

```typescript
const response = await fetch(url, {
  // @ts-ignore
  agent: new https.Agent({ rejectUnauthorized: false }), // ❌ MitM attack surface
});

const db = new Client({ ssl: false }); // ❌ DB traffic unencrypted
```

### ✅ ALWAYS

```typescript
const response = await fetch(url); // ✅ default TLS verification is on

// If using a private CA, provide the CA cert — don't disable verification:
const agent = new https.Agent({ ca: fs.readFileSync('internal-ca.pem') }); // ✅
const db = new Client({ ssl: { rejectUnauthorized: true } }); // ✅
```

**Exception**: `rejectUnauthorized: false` may be acceptable in local development only — never in production code paths. Flag any occurrence unless it is inside a clearly guarded `if (process.env.NODE_ENV === 'development')` block.

---

## S23 — Weak Cryptographic Algorithm

**Severity**: HIGH | **CWE**: CWE-327

MD5 and SHA-1 are cryptographically broken (collision attacks proven). DES and 3DES have inadequate key lengths. ECB mode leaks patterns in ciphertext.

### Detect

```
Pattern: createHash('md5')
Pattern: createHash('sha1')
Pattern: createCipheriv('des', ...)
Pattern: createCipheriv('des-ede', ...)  — 3DES
Pattern: createCipheriv('aes-128-ecb', ...)
Pattern: createCipheriv('aes-256-ecb', ...)
Pattern: crypto.createHash("MD5")       — case-insensitive
Pattern: hashlib.md5(...)               — Python
Pattern: MessageDigest.getInstance("MD5")  — Java
```

### ❌ NEVER

```typescript
import { createHash, createCipheriv } from 'node:crypto';

const hash = createHash('md5').update(password).digest('hex');       // ❌ broken
const sig  = createHash('sha1').update(data).digest('hex');           // ❌ broken
const cipher = createCipheriv('des', key, iv);                        // ❌56-bit key
const aes = createCipheriv('aes-256-ecb', key, Buffer.alloc(0));      // ❌ ECB leaks patterns
```

### ✅ ALWAYS

```typescript
// Hashing (non-password data)
const hash = createHash('sha256').update(data).digest('hex');         // ✅

// Password hashing — use a KDF, never a raw hash
import argon2 from 'argon2';
const stored = await argon2.hash(password);                           // ✅

// Symmetric encryption
const cipher = createCipheriv('aes-256-gcm', key, iv);               // ✅ authenticated
```

| Use case | Use | Never |
|---|---|---|
| Data integrity hash | SHA-256, SHA-384 | MD5, SHA-1 |
| Password storage | Argon2id, bcrypt | Any raw hash |
| Symmetric encryption | AES-256-GCM | DES, 3DES, AES-ECB |
| HMAC | HMAC-SHA256 | HMAC-MD5, HMAC-SHA1 |

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
