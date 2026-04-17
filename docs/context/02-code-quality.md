# Code Quality Audit Rules
> Load this file before running a quality audit. Rules cover TypeScript/JavaScript, React, Node.js, and general coding principles. Ordered by impact.

---

## Quick Reference — All Rules

| # | Rule | Severity | Tool |
|---|---|---|---|
| Q01 | TypeScript `any` type — explicit or implicit | MEDIUM | tsc / scan |
| Q02 | Test coverage below threshold | MEDIUM | jest/vitest |
| Q03 | `console.log` / `console.debug` in production code | LOW | scan |
| Q04 | Unused npm dependencies | LOW | depcheck |
| Q05 | `.then()` / `.catch()` chains instead of async/await | LOW | scan |
| Q06 | Component exceeds 300 lines | LOW | scan |
| Q07 | React list key is array index | MEDIUM | scan / eslint |
| Q08 | DRY violation — duplicated logic blocks | MEDIUM | AI |
| Q09 | Single Responsibility Principle violation | MEDIUM | AI |
| Q10 | Hardcoded values — magic numbers / strings | LOW | scan |
| Q11 | Direct API call inside React component (no service layer) | MEDIUM | scan |
| Q12 | `useEffect` missing dependency or causing infinite loop | HIGH | eslint |
| Q13 | Timer / subscription not cleaned up in `useEffect` | MEDIUM | scan |
| Q14 | Prop drilling beyond 3 levels | LOW | AI |
| Q15 | ESLint errors present | MEDIUM | eslint |
| Q16 | Missing null/undefined guard | LOW | scan / tsc |
| Q17 | `dangerouslySetInnerHTML` without sanitization | HIGH | scan |
| Q18 | Import of removed/deprecated package | MEDIUM | scan |

---

## Q01 — TypeScript `any` Type
**Severity**: MEDIUM

`any` disables TypeScript's type checking, defeating its purpose. Every `any` is a hidden runtime error waiting to happen.

### Detect
```bash
# Run TypeScript compiler in strict mode
npx tsc --noEmit --strict 2>&1 | grep -E "(implicit|explicit) any|TS7006|TS7005|TS2683"

# Scan source files directly
grep -rn ": any\b\|as any\b\|<any>" src/ --include="*.ts" --include="*.tsx"
```

### ❌ NEVER
```typescript
function process(data: any): any { ... }          // ❌ no type safety
const result: any = await fetchUser(id);          // ❌
const items = JSON.parse(raw) as any[];           // ❌ cast to any
```

### ✅ ALWAYS
```typescript
function process(data: unknown): ProcessedResult {
  const validated = DataSchema.parse(data);       // ✅ narrow with Zod
  return transform(validated);
}

type ApiResponse = { users: User[]; total: number };
const result: ApiResponse = await fetchUser(id); // ✅ explicit type
```

**Exceptions**: `catch (err: unknown)` is correct TypeScript. Use `unknown` not `any` and narrow before use.

---

## Q02 — Test Coverage Below Threshold
**Severity**: MEDIUM

**Required minimums**: Lines ≥ 85% | Branches ≥ 80% | Functions ≥ 85%

### Detect
```bash
# Run coverage (Jest)
npx jest --coverage --coverageReporters=json-summary --passWithNoTests

# Read result
cat coverage/coverage-summary.json | python3 -c "
import sys,json; d=json.load(sys.stdin)['total']
print(f'Lines: {d[\"lines\"][\"pct\"]}%')
print(f'Branches: {d[\"branches\"][\"pct\"]}%')
print(f'Functions: {d[\"functions\"][\"pct\"]}%')"
```

### What to test (required scenarios)
For every component, service, and utility:
- ✅ Happy path with valid inputs
- ✅ Validation errors / rejected inputs
- ✅ Not-found / empty state
- ✅ Authentication / authorization enforcement
- ✅ Async error handling (rejected promises, network errors)
- ✅ Edge cases: empty arrays, null values, maximum values

### Flag as MEDIUM if
- Line coverage < 85%
- Branch coverage < 80%
- No test files found at all in the repo

---

## Q03 — `console.log` in Production Code
**Severity**: LOW

`console.log` is not structured logging — it has no level, no timestamp, no requestId, and no redaction. It also leaks to STDOUT in production.

### Detect
```bash
# Find console statements outside test files
grep -rn "console\.\(log\|debug\|info\|warn\|error\)" src/ \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  | grep -v "\.test\.\|\.spec\.\|__tests__"
```

### ❌ NEVER
```typescript
console.log('User logged in:', userId);         // ❌ in production code
console.log(req.body);                          // ❌ may log sensitive data
```

### ✅ ALWAYS
```typescript
logger.info({ userId, action: 'login' }, 'User logged in');  // ✅ structured
logger.debug({ path: req.url }, 'Request received');          // ✅ level-controlled
```

---

## Q04 — Unused npm Dependencies
**Severity**: LOW

Unused packages increase bundle size, attack surface, and maintenance burden.

### Detect
```bash
npx depcheck --json 2>/dev/null | python3 -c "
import sys,json; d=json.load(sys.stdin)
unused = d.get('dependencies',[]) + d.get('devDependencies',[])
for pkg in unused: print(f'Unused: {pkg}')"
```

### Fix
```bash
npm uninstall {package-name}
```

---

## Q05 — `.then()` / `.catch()` Chains
**Severity**: LOW

Promise chains are harder to read, harder to debug, and error-prone when mixed with `await`.

### Detect
```bash
grep -rn "\.\(then\|catch\|finally\)(" src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "Promise\.\|\.test\.\|\.spec\." \
  | grep -v "// allow-promise-chain"  # escape hatch for intentional use
```

### ❌ AVOID
```typescript
fetchUser(id)
  .then(user => processUser(user))
  .then(result => saveResult(result))
  .catch(err => handleError(err));     // ❌ — hard to follow, swallows context
```

### ✅ PREFER
```typescript
try {
  const user = await fetchUser(id);    // ✅ readable linear flow
  const result = await processUser(user);
  await saveResult(result);
} catch (err) {
  handleError(err);
}
```

**Exception**: `Promise.all([...]).then(...)` and `promise.finally(cleanup)` in libraries are acceptable.

---

## Q06 — Component Exceeds 300 Lines
**Severity**: LOW

### Detect
```bash
find . -name "*.tsx" -o -name "*.jsx" | grep -v node_modules | grep -v dist \
  | while read f; do
    lines=$(wc -l < "$f")
    [ "$lines" -gt 300 ] && echo "$lines lines: $f"
  done
```

### Signs of a component that needs splitting
- Manages 5+ state variables
- Contains both data-fetching AND rendering logic
- Has multiple unrelated event handlers
- JSX tree depth > 8 levels
- Multiple `useEffect` blocks doing unrelated things

### How to split
```typescript
// Before: one component doing everything ❌
export function UserDashboard() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  // ... 400 lines of mixed concerns

// After: separated concerns ✅
export function UserDashboard() {
  const { user } = useUser(id);           // data hook
  const { posts } = usePosts(user?.id);  // data hook
  return <UserLayout user={user} posts={posts} />; // pure rendering
}
```

---

## Q07 — React List Key Is Array Index
**Severity**: MEDIUM

Using array index as key causes subtle rendering bugs when the list is reordered, filtered, or items are inserted.

### Detect
```bash
grep -rn "key={index}\|key={i}\|\.map((.*,\s*\(index\|i\)\s*)\s*=>" src/ \
  --include="*.tsx" --include="*.jsx"
```

### ❌ NEVER
```tsx
{items.map((item, index) => (
  <ListItem key={index} ... />  // ❌ — wrong item re-renders on insertion
))}
```

### ✅ ALWAYS
```tsx
{items.map((item) => (
  <ListItem key={item.id} ... />  // ✅ stable unique ID
))}
```

**Exception**: Static, non-reorderable, non-filterable lists (e.g., navigation links rendered from a fixed array) may use index as key.

---

## Q08 — DRY Violation — Duplicated Logic
**Severity**: MEDIUM

Look for near-identical blocks of code appearing in 2+ files. Focus on:
- Business validation logic copy-pasted between files
- Identical error handling patterns repeated in every service
- Same transformation/mapping logic duplicated across components

### AI analysis approach
When reviewing files for DRY violations, generate a digest of each file's exported functions with their parameter signatures. Ask: do any two functions do the same thing with only variable names changed?

### Flag when
- 15+ consecutive lines are near-identical in two different files
- The same business rule is encoded in 3+ places
- A helper function is defined multiple times with slightly different names (`formatDate`, `formatDateString`, `dateFormatter`)

### Fix
```typescript
// Extract to shared utility
// shared/utils/formatDate.ts
export function formatDate(date: Date | string): string { ... }

// Both consumers import from one place
import { formatDate } from '../shared/utils/formatDate';
```

---

## Q09 — Single Responsibility Principle Violation
**Severity**: MEDIUM

A module, class, or component should have exactly one reason to change.

### Signs of SRP violation — flag these
- Service class that handles HTTP calls AND business logic AND database writes
- React component that fetches data, transforms it, renders it, AND handles form submission
- Utility file with 20+ unrelated functions
- Route handler with > 30 lines of business logic inline

### AI analysis approach
For each file > 150 lines, list its exported functions/classes and their responsibilities. If they fall into more than one of: (1) data fetching, (2) business logic, (3) data persistence, (4) UI rendering, (5) configuration — flag it.

### ✅ Correct structure (Node.js API)
```typescript
// routes/users.route.ts    — only routing (thin)
// services/user.service.ts — only business logic
// repositories/user.repo.ts — only DB queries
// models/user.model.ts     — only type/schema definition
```

---

## Q10 — Hardcoded Magic Values
**Severity**: LOW

### Detect
```bash
# Numbers that look like limits, timeouts, sizes, ports
grep -rn "[^a-zA-Z][0-9]\{4,\}\b" src/ --include="*.ts" | grep -v "test\|spec\|date\|year\|2024\|2025\|2026"

# String values that look like config (not UI copy)
grep -rn "'[a-z][a-z0-9_-]\{8,\}'" src/ --include="*.ts" | grep -v "test\|spec"
```

### ❌ AVOID
```typescript
setTimeout(fn, 300000);                         // ❌ what is 300000?
if (users.length > 1000) { ... }                // ❌ magic limit
const endpoint = 'https://api.example.com/v1'; // ❌ hardcoded URL
```

### ✅ PREFER
```typescript
const CACHE_TTL_MS = 5 * 60 * 1000;            // ✅ named constant
const MAX_USERS_PER_PAGE = 1000;               // ✅ self-documenting
const API_BASE_URL = process.env['API_URL']!;  // ✅ from env
```

---

## Q11 — Direct API Call Inside React Component
**Severity**: MEDIUM

Components that call APIs directly are impossible to unit test without mocking the network. They also duplicate error handling and loading state management.

### Detect
```bash
grep -rn "fetch(\|axios\.\|\.get(\|\.post(" src/features src/components \
  --include="*.tsx" --include="*.jsx" \
  | grep -v "services\|hooks\|__tests__"
```

### ❌ NEVER
```tsx
export function UserList() {
  useEffect(() => {
    fetch('/api/v1/users').then(r => r.json()).then(setUsers); // ❌ in component
  }, []);
  ...
}
```

### ✅ ALWAYS
```tsx
// services/user.service.ts
export const userService = {
  async getUsers(): Promise<User[]> {
    const { data } = await axios.get('/api/v1/users');
    return data;
  }
};

// hooks/useUsers.ts
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => { userService.getUsers().then(setUsers); }, []);
  return users;
}

// Component is clean
export function UserList() {
  const users = useUsers(); // ✅
  ...
}
```

---

## Q12 — `useEffect` Missing Dependency or Infinite Loop
**Severity**: HIGH

Missing dependencies cause stale closures. Unstable object/function dependencies cause infinite re-renders.

### Detect
```bash
npx eslint --rule '{"react-hooks/exhaustive-deps": "error"}' src/ --ext .tsx,.jsx
```

### ❌ NEVER
```tsx
useEffect(() => {
  fetchUser(userId);  // userId used but not in deps — stale closure ❌
}, []);

useEffect(() => {
  setCount(count + 1); // setCount triggers re-render → count changes → infinite loop ❌
}, [count]);

useEffect(() => {
  doSomething(options); // options is a new object every render → infinite loop ❌
}, [options]);
```

### ✅ ALWAYS
```tsx
useEffect(() => {
  fetchUser(userId);
}, [userId]);               // ✅ userId in deps

const increment = useCallback(() => setCount(c => c + 1), []); // ✅ stable reference

const options = useMemo(() => ({ page, limit }), [page, limit]); // ✅ stable object
useEffect(() => { fetchData(options); }, [options]);
```

---

## Q13 — Timer / Subscription Not Cleaned Up
**Severity**: MEDIUM

Uncleaned timers and subscriptions cause memory leaks and state updates on unmounted components.

### Detect
```bash
grep -rn "setInterval\|setTimeout\|addEventListener\|subscribe\|EventSource\|WebSocket" \
  src/ --include="*.tsx" --include="*.ts" \
  | grep -v "clearInterval\|clearTimeout\|removeEventListener\|unsubscribe"
```

Cross-check: every `setInterval` should have a matching `clearInterval` in the `useEffect` return.

### ❌ NEVER
```tsx
useEffect(() => {
  const interval = setInterval(pollStatus, 5000); // ❌ never cleared
  const sub = eventBus.subscribe(handler);        // ❌ never unsubscribed
}, []);
```

### ✅ ALWAYS
```tsx
useEffect(() => {
  const interval = setInterval(pollStatus, 5000);
  const sub = eventBus.subscribe(handler);

  return () => {                    // ✅ cleanup function
    clearInterval(interval);
    sub.unsubscribe();
  };
}, []);
```

---

## Q14 — Prop Drilling Beyond 3 Levels
**Severity**: LOW

Passing props through 4+ component levels makes components tightly coupled and refactoring painful.

### AI analysis approach
When reviewing React component trees, trace any prop that is passed through a component that doesn't use it (it only forwards it down). If a prop passes through 3+ intermediary components, flag it.

### Fix options
```typescript
// Option 1: React Context (for global/app-wide state)
const UserContext = createContext<User | null>(null);

// Option 2: Component composition (lift rendering up)
<ParentComponent renderAction={() => <ActionButton onClick={handle} />} />

// Option 3: State management (Zustand, Redux) for cross-cutting state
```

---

## Q15 — ESLint Errors Present
**Severity**: MEDIUM

### Detect
```bash
npx eslint --format json --ext .ts,.tsx,.js,.jsx . 2>/dev/null
```

Parse JSON output. `severity: 2` = error (MEDIUM finding), `severity: 1` = warning (LOW finding).

### Key rules to always enforce
- `no-console` — no console statements in production code
- `no-unused-vars` — no declared but unused variables
- `react-hooks/rules-of-hooks` — hooks only at top level
- `react-hooks/exhaustive-deps` — useEffect dependency array
- `@typescript-eslint/no-explicit-any` — no `any` type
- `@typescript-eslint/no-floating-promises` — await all promises

---

## Q16 — Missing Null / Undefined Guard
**Severity**: LOW

### Detect
```bash
# Find property access on potentially null values
grep -rn "\.[a-zA-Z]\+\(\.[a-zA-Z]\+\)\+" src/ --include="*.ts" \
  | grep -v "?\." | grep -v "test\|spec" | head -50
```

### ❌ AVOID
```typescript
const name = user.profile.displayName; // ❌ user or profile could be undefined
const first = arr[0].name;             // ❌ arr could be empty
```

### ✅ PREFER
```typescript
const name = user?.profile?.displayName ?? 'Anonymous'; // ✅ optional chaining
const first = arr.at(0)?.name ?? 'Unknown';             // ✅ safe array access
```

---

## Q17 — `dangerouslySetInnerHTML` Without Sanitization
**Severity**: HIGH

See also S10 in the security rules. This is both a security and quality issue.

### Detect
```bash
grep -rn "dangerouslySetInnerHTML" src/ --include="*.tsx" --include="*.jsx"
```

Any occurrence without a call to `DOMPurify.sanitize()` or equivalent immediately before the value → HIGH finding.

---

## Q18 — Deprecated / Removed Package Import
**Severity**: MEDIUM

### Detect
```bash
# Check for commonly deprecated packages
DEPRECATED="request,moment,node-fetch@1,tslint,@types/enzyme,react-scripts"
for pkg in $(echo $DEPRECATED | tr ',' ' '); do
  grep -rn "from '$pkg'\|require('$pkg')" src/ --include="*.ts" && echo "DEPRECATED: $pkg"
done
```

### Common replacements
| Deprecated | Replace with |
|---|---|
| `request` | `node-fetch`, `axios`, native `fetch` |
| `moment` | `date-fns`, `luxon`, native `Intl` |
| `node-fetch@1` | `node-fetch@3` or native `fetch` (Node 18+) |
| `tslint` | `eslint` + `@typescript-eslint` |
| `@types/enzyme` | `@testing-library/react` |

---

## Scoring Reference for Quality Audits

```
Starting score: 100

Deductions:
  Each HIGH finding:   -15
  Each MEDIUM finding: -7
  Each LOW finding:    -3

Coverage sub-score:
  Lines < 85%:    -10
  Branches < 80%: -7
  Lines < 60%:    -20 (additional penalty)

Status:
  "failed" → any HIGH finding OR coverage < 60%
  "passed" → no HIGH findings AND coverage >= 60%
```
