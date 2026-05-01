import { useState } from "react";
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Code as CodeIcon,
  Api as ApiIcon,
  Storage as StorageIcon,
  Map as MapIcon,
} from "@mui/icons-material";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VectorRule {
  id: string;
  rule: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cwe?: string;
  cweLabel?: string;
  source?: string;
  tool?: string;
  penalty?: string;
}

interface RoadmapEntry {
  cwe: string;
  label: string;
  category: string;
  rationale: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECURITY_RULES: VectorRule[] = [
  {
    id: "S01",
    rule: "User content in AI system prompt",
    severity: "CRITICAL",
    cwe: "CWE-1427",
    cweLabel: "Improper Neutralization of Input Used in a Prompt",
    source: "AI/LLM",
  },
  {
    id: "S02",
    rule: "Unsanitized LLM output used as code/command",
    severity: "CRITICAL",
    cwe: "CWE-1426",
    cweLabel: "Improper Validation of Generative AI Output",
    source: "AI/LLM",
  },
  {
    id: "S03",
    rule: "Hardcoded secret / API key / token",
    severity: "CRITICAL",
    cwe: "CWE-798",
    cweLabel: "Use of Hard-coded Credentials",
    source: "Secrets",
  },
  {
    id: "S04",
    rule: "SQL injection via string concatenation",
    severity: "CRITICAL",
    cwe: "CWE-89",
    cweLabel: "SQL Injection",
    source: "DB",
  },
  {
    id: "S05",
    rule: "NoSQL injection via unvalidated object",
    severity: "CRITICAL",
    cwe: "CWE-943",
    cweLabel: "NoSQL Injection",
    source: "DB",
  },
  {
    id: "S06",
    rule: "Command injection via exec() string",
    severity: "CRITICAL",
    cwe: "CWE-78",
    cweLabel: "OS Command Injection",
    source: "Shell",
  },
  {
    id: "S07",
    rule: "JWT verify without explicit algorithm",
    severity: "CRITICAL",
    cwe: "CWE-327",
    cweLabel: "Broken Cryptographic Algorithm",
    source: "Auth",
  },
  {
    id: "S09",
    rule: "Hardcoded OAuth client secret",
    severity: "CRITICAL",
    cwe: "CWE-798",
    cweLabel: "Use of Hard-coded Credentials",
    source: "Auth",
  },
  {
    id: "S25",
    rule: "RAG / retrieval document injection",
    severity: "CRITICAL",
    cwe: "CWE-1427",
    cweLabel: "Improper Neutralization of Input Used in a Prompt",
    source: "AI/LLM",
  },
  {
    id: "S26",
    rule: "Agent tool-call hijacking via injected content",
    severity: "CRITICAL",
    cwe: "CWE-1427",
    cweLabel: "Improper Neutralization of Input Used in a Prompt",
    source: "AI/LLM",
  },
  {
    id: "S29",
    rule: "Second-order output smuggling between LLM calls",
    severity: "CRITICAL",
    cwe: "CWE-1426",
    cweLabel: "Improper Validation of Generative AI Output",
    source: "AI/LLM",
  },
  {
    id: "S08",
    rule: "Math.random() for security values",
    severity: "HIGH",
    cwe: "CWE-330",
    cweLabel: "Use of Insufficiently Random Values",
    source: "Crypto",
  },
  {
    id: "S10",
    rule: "XSS via innerHTML / dangerouslySetInnerHTML",
    severity: "HIGH",
    cwe: "CWE-79",
    cweLabel: "Cross-site Scripting",
    source: "Output",
  },
  {
    id: "S11",
    rule: "Path traversal — user input in file path",
    severity: "HIGH",
    cwe: "CWE-22",
    cweLabel: "Path Traversal",
    source: "FS",
  },
  {
    id: "S12",
    rule: "Stack trace / internal error in API response",
    severity: "HIGH",
    cwe: "CWE-209",
    cweLabel: "Information Exposure via Error Message",
    source: "Error",
  },
  {
    id: "S13",
    rule: "Missing JWT audience or issuer validation",
    severity: "HIGH",
    cwe: "CWE-287",
    cweLabel: "Improper Authentication",
    source: "Auth",
  },
  {
    id: "S14",
    rule: "Hallucinated / unverified npm package",
    severity: "HIGH",
    cwe: "CWE-1357",
    cweLabel: "Reliance on Insufficiently Trustworthy Component",
    source: "Supply Chain",
  },
  {
    id: "S15",
    rule: "Wildcard CORS origin: '*' in production",
    severity: "HIGH",
    cwe: "CWE-942",
    cweLabel: "Overly Permissive CORS",
    source: "CORS",
  },
  {
    id: "S20",
    rule: "eval() / new Function() / setTimeout(string)",
    severity: "HIGH",
    cwe: "CWE-94",
    cweLabel: "Code Injection",
    source: "Injection",
  },
  {
    id: "S21",
    rule: "Prototype pollution via user-controlled keys",
    severity: "HIGH",
    cwe: "CWE-1321",
    cweLabel: "Prototype Pollution",
    source: "Injection",
  },
  {
    id: "S22",
    rule: "TLS verification disabled (rejectUnauthorized: false)",
    severity: "HIGH",
    cwe: "CWE-295",
    cweLabel: "Improper Certificate Validation",
    source: "Crypto",
  },
  {
    id: "S23",
    rule: "Weak cryptographic algorithm (MD5, SHA-1, DES, ECB)",
    severity: "HIGH",
    cwe: "CWE-327",
    cweLabel: "Broken Cryptographic Algorithm",
    source: "Crypto",
  },
  {
    id: "S24",
    rule: "System prompt exfiltration — secrets in system prompt",
    severity: "HIGH",
    cwe: "CWE-200",
    cweLabel: "Information Exposure",
    source: "AI/LLM",
  },
  {
    id: "S27",
    rule: "Context window flooding — system prompt pushed out",
    severity: "HIGH",
    cwe: "CWE-400",
    cweLabel: "Uncontrolled Resource Consumption",
    source: "AI/LLM",
  },
  {
    id: "S28",
    rule: "Agent memory poisoning via persistent store",
    severity: "HIGH",
    cwe: "CWE-1427",
    cweLabel: "Improper Neutralization of Input Used in a Prompt",
    source: "AI/LLM",
  },
  {
    id: "S30",
    rule: "Multimodal injection via uploaded images or files",
    severity: "HIGH",
    cwe: "CWE-1427",
    cweLabel: "Improper Neutralization of Input Used in a Prompt",
    source: "AI/LLM",
  },
  {
    id: "S31",
    rule: "Over-privileged AI agent — excessive tool/scope access",
    severity: "HIGH",
    cwe: "CWE-1434",
    cweLabel: "Improper Handling of Insufficient Permissions in AI Prompting",
    source: "AI/LLM",
  },
  {
    id: "S16",
    rule: "Missing rate limiting on API server",
    severity: "MEDIUM",
    cwe: "CWE-770",
    cweLabel: "Allocation of Resources Without Limits",
    source: "Auth",
  },
  {
    id: "S17",
    rule: "Missing CSRF protection on state-changing routes",
    severity: "MEDIUM",
    cwe: "CWE-352",
    cweLabel: "Cross-Site Request Forgery",
    source: "Auth",
  },
  {
    id: "S18",
    rule: "Missing security headers (helmet/CSP/HSTS)",
    severity: "MEDIUM",
    cwe: "CWE-693",
    cweLabel: "Protection Mechanism Failure",
    source: "Headers",
  },
  {
    id: "S19",
    rule: "Sensitive data (passwords/tokens) in logs",
    severity: "MEDIUM",
    cwe: "CWE-532",
    cweLabel: "Info Exposure Through Log Files",
    source: "Logging",
  },
];

const QUALITY_RULES: VectorRule[] = [
  {
    id: "Q01",
    rule: "TypeScript any type — explicit or implicit",
    severity: "MEDIUM",
    tool: "tsc / scan",
  },
  {
    id: "Q02",
    rule: "Test coverage below threshold",
    severity: "MEDIUM",
    tool: "jest / vitest",
  },
  {
    id: "Q03",
    rule: "console.log / console.debug in production code",
    severity: "LOW",
    tool: "scan",
  },
  {
    id: "Q04",
    rule: "Unused npm dependencies",
    severity: "LOW",
    tool: "depcheck",
  },
  {
    id: "Q05",
    rule: ".then() / .catch() chains instead of async/await",
    severity: "LOW",
    tool: "scan",
  },
  {
    id: "Q06",
    rule: "Component exceeds 300 lines",
    severity: "LOW",
    tool: "scan",
  },
  {
    id: "Q07",
    rule: "React list key is array index",
    severity: "MEDIUM",
    tool: "scan / eslint",
  },
  {
    id: "Q08",
    rule: "DRY violation — duplicated logic blocks",
    severity: "MEDIUM",
    tool: "AI",
  },
  {
    id: "Q09",
    rule: "Single Responsibility Principle violation",
    severity: "MEDIUM",
    tool: "AI",
  },
  {
    id: "Q10",
    rule: "Hardcoded values — magic numbers / strings",
    severity: "LOW",
    tool: "scan",
  },
  {
    id: "Q11",
    rule: "Direct API call inside React component (no service layer)",
    severity: "MEDIUM",
    tool: "scan",
  },
  {
    id: "Q12",
    rule: "useEffect missing dependency or causing infinite loop",
    severity: "HIGH",
    tool: "eslint",
  },
  {
    id: "Q13",
    rule: "Timer / subscription not cleaned up in useEffect",
    severity: "MEDIUM",
    tool: "scan",
  },
  {
    id: "Q14",
    rule: "Prop drilling beyond 3 levels",
    severity: "LOW",
    tool: "AI",
  },
  {
    id: "Q15",
    rule: "ESLint errors present",
    severity: "MEDIUM",
    tool: "eslint",
  },
  {
    id: "Q16",
    rule: "Missing null/undefined guard",
    severity: "LOW",
    tool: "scan / tsc",
  },
  {
    id: "Q17",
    rule: "dangerouslySetInnerHTML without sanitization",
    severity: "HIGH",
    tool: "scan",
    cwe: "CWE-79",
    cweLabel: "Cross-site Scripting",
  },
  {
    id: "Q18",
    rule: "Import of removed/deprecated package",
    severity: "MEDIUM",
    tool: "scan",
  },
];

const API_RULES: VectorRule[] = [
  {
    id: "A01",
    rule: "No OpenAPI spec in docs/",
    severity: "HIGH",
    penalty: "-15",
    tool: "file check",
  },
  {
    id: "A02",
    rule: "Endpoint missing documentation",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "openapi scan",
  },
  {
    id: "A03",
    rule: "No URI versioning (/api/v{n}/)",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "A04",
    rule: "Verb in URL path",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
  },
  {
    id: "A05",
    rule: "Route resource names not PascalCase plural",
    severity: "LOW",
    penalty: "-3",
    tool: "grep",
  },
  {
    id: "A06",
    rule: "Wrong HTTP method for action",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "A07",
    rule: "POST returns 200 instead of 201+Location",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
  },
  {
    id: "A08",
    rule: "DELETE returns body instead of 204",
    severity: "LOW",
    penalty: "-3",
    tool: "grep",
  },
  {
    id: "A09",
    rule: "Generic 400/500 instead of specific status code",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
  },
  {
    id: "A10",
    rule: "Error response missing required fields",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
  },
  {
    id: "A11",
    rule: "Stack trace in error response",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
    cwe: "CWE-209",
    cweLabel: "Information Exposure via Error Message",
  },
  {
    id: "A12",
    rule: "No JWT iss/aud/exp/scope validation",
    severity: "CRITICAL",
    penalty: "-25",
    tool: "grep",
    cwe: "CWE-287",
    cweLabel: "Improper Authentication",
  },
  {
    id: "A13",
    rule: "Unprotected route (no auth middleware)",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "A14",
    rule: "Wildcard CORS (origins: ['*']) in production",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
    cwe: "CWE-942",
    cweLabel: "Overly Permissive CORS",
  },
  {
    id: "A15",
    rule: "No CSRF protection on state-changing endpoints",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
    cwe: "CWE-352",
    cweLabel: "Cross-Site Request Forgery",
  },
  {
    id: "A16",
    rule: "No rate limiting on public endpoints",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
    cwe: "CWE-770",
    cweLabel: "Allocation of Resources Without Limits",
  },
  {
    id: "A17",
    rule: "Missing security headers (helmet/CSP/HSTS)",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
    cwe: "CWE-693",
    cweLabel: "Protection Mechanism Failure",
  },
  {
    id: "A18",
    rule: "No structured JSON logging / missing correlation ID",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
  },
  {
    id: "A19",
    rule: "Sensitive data (password/token/secret) in logs",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
    cwe: "CWE-532",
    cweLabel: "Info Exposure Through Log Files",
  },
  {
    id: "A20",
    rule: "No health check endpoint",
    severity: "LOW",
    penalty: "-3",
    tool: "grep",
  },
  {
    id: "A21",
    rule: "No input schema validation on request body",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "A22",
    rule: "camelCase not used for JSON property names",
    severity: "LOW",
    penalty: "-3",
    tool: "grep",
  },
  {
    id: "A23",
    rule: "Dates not in ISO 8601 format",
    severity: "LOW",
    penalty: "-3",
    tool: "grep",
  },
  {
    id: "A24",
    rule: "Fat endpoint returning everything (ISP violation)",
    severity: "LOW",
    penalty: "-3",
    tool: "AI / scan",
  },
  {
    id: "A25",
    rule: "Missing feature-based directory structure (src/features/{feature}/v{n}/)",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "ls / find",
  },
  {
    id: "A26",
    rule: "No Postman collection in postman/collections/",
    severity: "LOW",
    penalty: "-3",
    tool: "ls / grep",
  },
  {
    id: "A27",
    rule: "Missing docs/ops/ operational runbooks",
    severity: "LOW",
    penalty: "-3",
    tool: "ls",
  },
  {
    id: "A28",
    rule: "Breaking change introduced without new major version",
    severity: "HIGH",
    penalty: "-15",
    tool: "git diff / openapi",
  },
];

const DB_RULES: VectorRule[] = [
  {
    id: "D01",
    rule: "Migration file breaks naming convention",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "ls / regex",
  },
  {
    id: "D02",
    rule: "Duplicate version numbers",
    severity: "HIGH",
    penalty: "-15",
    tool: "ls / sort",
  },
  {
    id: "D03",
    rule: "Previously-applied migration was edited",
    severity: "CRITICAL",
    penalty: "-25",
    tool: "git log",
  },
  {
    id: "D04",
    rule: "SQL string concatenation (injection risk)",
    severity: "CRITICAL",
    penalty: "-25",
    tool: "grep",
    cwe: "CWE-89",
    cweLabel: "SQL Injection",
  },
  {
    id: "D05",
    rule: "SELECT * in migration",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
  },
  {
    id: "D06",
    rule: "Missing transaction on data migration",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "D07",
    rule: "DROP TABLE / TRUNCATE without safeguard",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "D08",
    rule: "Missing COMMIT / open transaction",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "D09",
    rule: "flyway.conf committed with credentials",
    severity: "CRITICAL",
    penalty: "-25",
    tool: "grep",
    cwe: "CWE-798",
    cweLabel: "Use of Hard-coded Credentials",
  },
  {
    id: "D10",
    rule: "cleanDisabled=false in non-dev config",
    severity: "HIGH",
    penalty: "-15",
    tool: "grep",
  },
  {
    id: "D11",
    rule: "Stored procedure not using repeatable migration",
    severity: "LOW",
    penalty: "-3",
    tool: "ls",
  },
  {
    id: "D12",
    rule: "Version numbers out of order or gaps",
    severity: "LOW",
    penalty: "-3",
    tool: "ls / sort",
  },
  {
    id: "D13",
    rule: "Cross-database reference without existence check",
    severity: "MEDIUM",
    penalty: "-7",
    tool: "grep",
  },
];

const ROADMAP_ITEMS: RoadmapEntry[] = [
  {
    cwe: "CWE-601",
    label: "URL Redirection to Untrusted Site (Open Redirect)",
    category: "Security",
    severity: "HIGH",
    rationale:
      "Common in OAuth callback handlers and redirect-after-login patterns. Not yet detected.",
  },
  {
    cwe: "CWE-918",
    label: "Server-Side Request Forgery (SSRF)",
    category: "Security",
    severity: "CRITICAL",
    rationale:
      "AI agents fetch URLs from repo content — SSRF is a first-class threat in agentic pipelines.",
  },
  {
    cwe: "CWE-611",
    label: "XML External Entity (XXE) Injection",
    category: "Security",
    severity: "HIGH",
    rationale:
      "XML parsers in Node.js audit tooling can expose internal files if XXE not disabled.",
  },
  {
    cwe: "CWE-502",
    label: "Deserialization of Untrusted Data",
    category: "Security",
    severity: "HIGH",
    rationale:
      "JSON.parse from external sources without schema validation is detected, but binary deserialization (e.g. node-serialize) is not.",
  },
  {
    cwe: "CWE-434",
    label: "Unrestricted Upload of File with Dangerous Type",
    category: "Security",
    severity: "HIGH",
    rationale:
      "Audit agents may process uploaded files; extension/MIME type validation not currently checked.",
  },
  {
    cwe: "CWE-307",
    label: "Improper Restriction of Excessive Auth Attempts",
    category: "Security",
    severity: "MEDIUM",
    rationale:
      "Account lockout / brute-force protection beyond basic rate limiting not audited.",
  },
  {
    cwe: "CWE-384",
    label: "Session Fixation",
    category: "Security",
    severity: "MEDIUM",
    rationale:
      "Session token regeneration after authentication not checked in Express/Fastify apps.",
  },
  {
    cwe: "CWE-1004",
    label: "Sensitive Cookie Without HttpOnly Flag",
    category: "Security",
    severity: "MEDIUM",
    rationale:
      "Cookie security attributes (HttpOnly, Secure, SameSite) not yet part of the audit ruleset.",
  },
  {
    cwe: "CWE-614",
    label: "Sensitive Cookie Without Secure Flag",
    category: "Security",
    severity: "MEDIUM",
    rationale:
      "Paired with CWE-1004; Secure flag enforcement not currently detected.",
  },
  {
    cwe: "CWE-116",
    label: "Improper Encoding / Escaping of Output",
    category: "Security",
    severity: "MEDIUM",
    rationale:
      "Encoding for non-HTML contexts (SQL, shell, URL, LDAP) beyond current XSS detection.",
  },
  {
    cwe: "CWE-400",
    label: "Uncontrolled Resource Consumption (general)",
    category: "Security",
    severity: "HIGH",
    rationale:
      "S27 detects LLM context flooding, but general CPU/memory/disk DoS patterns (e.g. regex DoS, zip bomb) not yet covered.",
  },
  {
    cwe: "CWE-915",
    label: "Improperly Controlled Modification of Object Prototype",
    category: "Security",
    severity: "HIGH",
    rationale:
      "Broader mass-assignment patterns beyond the prototype pollution check in S21.",
  },
  {
    cwe: "CWE-312",
    label: "Cleartext Storage of Sensitive Information",
    category: "Security",
    severity: "HIGH",
    rationale:
      "Secrets written to local files, caches, or IndexedDB in plaintext not yet audited.",
  },
  {
    cwe: "CWE-319",
    label: "Cleartext Transmission of Sensitive Information",
    category: "Security",
    severity: "HIGH",
    rationale:
      "HTTP (not HTTPS) endpoints in server configs not yet explicitly flagged.",
  },
  {
    cwe: "CWE-20",
    label: "Improper Input Validation (general)",
    category: "API",
    severity: "HIGH",
    rationale:
      "A21 covers request bodies, but query-param and path-param depth/regex validation not fully scanned.",
  },
  {
    cwe: "CWE-285",
    label: "Improper Authorization (RBAC gaps)",
    category: "API",
    severity: "HIGH",
    rationale:
      "Role-based access control verification beyond auth middleware presence not yet checked.",
  },
  {
    cwe: "CWE-362",
    label: "Race Condition (TOCTOU)",
    category: "Quality",
    severity: "MEDIUM",
    rationale:
      "Time-of-check / time-of-use in file operations and DB reads not yet part of quality rules.",
  },
  {
    cwe: "CWE-476",
    label: "NULL Pointer Dereference",
    category: "Quality",
    severity: "MEDIUM",
    rationale:
      "Q16 covers basic null guards; deeper tsc strict-null analysis with graph traversal not yet done.",
  },
  {
    cwe: "CWE-703",
    label: "Improper Check or Handling of Exceptional Conditions",
    category: "Quality",
    severity: "LOW",
    rationale:
      "Unhandled Promise rejections and missing try/catch on async DB calls beyond Q05 scope.",
  },
  {
    cwe: "CWE-667",
    label: "Improper Locking (async concurrency)",
    category: "DB",
    severity: "MEDIUM",
    rationale:
      "Concurrent migration execution without advisory locks not yet detected.",
  },
  {
    cwe: "CWE-1336",
    label: "Improper Neutralization of Template Expressions (SSTI)",
    category: "Security",
    severity: "HIGH",
    rationale:
      "Server-side template injection in Handlebars/EJS/Nunjucks not yet included in injection checks.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, "error" | "warning" | "info" | "default"> =
  {
    CRITICAL: "error",
    HIGH: "warning",
    MEDIUM: "info",
    LOW: "default",
  };

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function SevChip({ severity }: { severity: string }) {
  return (
    <Chip
      label={severity}
      size="small"
      color={SEVERITY_COLOR[severity] ?? "default"}
      variant={severity === "CRITICAL" ? "filled" : "outlined"}
      sx={{ fontWeight: severity === "CRITICAL" ? 700 : 500, minWidth: 72 }}
    />
  );
}

function CweChip({ cwe, label }: { cwe?: string; label?: string }) {
  if (!cwe)
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    );
  return (
    <Tooltip title={label ?? ""} placement="top" arrow>
      <Chip
        label={cwe}
        size="small"
        variant="outlined"
        color="secondary"
        sx={{ fontFamily: "monospace", cursor: "help" }}
      />
    </Tooltip>
  );
}

function RulesTable({
  rows,
  showPenalty = false,
  showTool = false,
}: {
  rows: VectorRule[];
  showPenalty?: boolean;
  showTool?: boolean;
}) {
  const sorted = [...rows].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow
            sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}
          >
            <TableCell width={60}>ID</TableCell>
            <TableCell>Rule</TableCell>
            <TableCell width={110}>Severity</TableCell>
            <TableCell width={120}>CWE</TableCell>
            {showTool && <TableCell width={150}>Tool / Source</TableCell>}
            {showPenalty && (
              <TableCell width={80} align="center">
                Penalty
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell
                sx={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  color: "text.secondary",
                }}
              >
                {r.id}
              </TableCell>
              <TableCell>{r.rule}</TableCell>
              <TableCell>
                <SevChip severity={r.severity} />
              </TableCell>
              <TableCell>
                <CweChip cwe={r.cwe} label={r.cweLabel} />
              </TableCell>
              {showTool && (
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {r.tool ?? r.source ?? "—"}
                  </Typography>
                </TableCell>
              )}
              {showPenalty && (
                <TableCell align="center">
                  {r.penalty ? (
                    <Chip
                      label={r.penalty}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ fontFamily: "monospace" }}
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Summary chips ─────────────────────────────────────────────────────────────

function SummaryBar({ rules }: { rules: VectorRule[] }) {
  const counts = rules.reduce<Record<string, number>>((acc, r) => {
    acc[r.severity] = (acc[r.severity] ?? 0) + 1;
    return acc;
  }, {});
  const withCwe = rules.filter((r) => r.cwe).length;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
      {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) =>
        counts[s] ? (
          <Chip
            key={s}
            label={`${counts[s]} ${s}`}
            size="small"
            color={SEVERITY_COLOR[s]}
            variant={s === "CRITICAL" ? "filled" : "outlined"}
          />
        ) : null,
      )}
      <Chip
        label={`${rules.length} rules total`}
        size="small"
        variant="outlined"
      />
      <Chip
        label={`${withCwe} with CWE`}
        size="small"
        color="secondary"
        variant="outlined"
      />
    </Stack>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  {
    label: "Security",
    icon: <SecurityIcon fontSize="small" />,
    rules: SECURITY_RULES,
    showTool: true,
    showPenalty: false,
  },
  {
    label: "Quality",
    icon: <CodeIcon fontSize="small" />,
    rules: QUALITY_RULES,
    showTool: true,
    showPenalty: false,
  },
  {
    label: "API",
    icon: <ApiIcon fontSize="small" />,
    rules: API_RULES,
    showTool: false,
    showPenalty: true,
  },
  {
    label: "DB",
    icon: <StorageIcon fontSize="small" />,
    rules: DB_RULES,
    showTool: false,
    showPenalty: true,
  },
  {
    label: "Roadmap",
    icon: <MapIcon fontSize="small" />,
    rules: [],
    showTool: false,
    showPenalty: false,
  },
];

const ROADMAP_CATEGORIES = [...new Set(ROADMAP_ITEMS.map((r) => r.category))];

export default function CoveragePage() {
  const [tab, setTab] = useState(0);

  const current = TABS[tab];
  const isRoadmap = current.label === "Roadmap";

  // All CWEs across all categories for the summary
  const allRules = [
    ...SECURITY_RULES,
    ...QUALITY_RULES,
    ...API_RULES,
    ...DB_RULES,
  ];
  const uniqueCwes = [
    ...new Set(allRules.filter((r) => r.cwe).map((r) => r.cwe!)),
  ].sort();

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Audit Coverage
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, maxWidth: 800 }}
      >
        All rules, vectors, and CWEs actively checked by this auditor across
        four categories. Hover over a CWE chip to see the full weakness name.
        The Roadmap tab lists techniques planned for future versions.
      </Typography>

      <Alert severity="info" sx={{ mb: 3, maxWidth: 800 }}>
        <strong>{allRules.length} rules</strong> across 4 categories
        &nbsp;·&nbsp;
        <strong>{uniqueCwes.length} unique CWEs</strong> currently mapped
        &nbsp;·&nbsp;
        <strong>{ROADMAP_ITEMS.length} CWEs</strong> on the roadmap
      </Alert>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((t, i) => (
          <Tab
            key={t.label}
            label={t.label}
            icon={t.icon}
            iconPosition="start"
            id={`coverage-tab-${i}`}
          />
        ))}
      </Tabs>

      {/* ── Category rule tables ─────────────────────────────────────────── */}
      {!isRoadmap && (
        <>
          <SummaryBar rules={current.rules} />
          <RulesTable
            rows={current.rules}
            showTool={current.showTool}
            showPenalty={current.showPenalty}
          />
        </>
      )}

      {/* ── Roadmap ──────────────────────────────────────────────────────── */}
      {isRoadmap && (
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 3, maxWidth: 800 }}
          >
            The following CWEs are not yet covered but are candidates for
            inclusion in future versions. They are grouped by the audit category
            most likely to surface them.
          </Typography>

          {ROADMAP_CATEGORIES.map((cat) => {
            const items = ROADMAP_ITEMS.filter((r) => r.category === cat).sort(
              (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
            );
            return (
              <Accordion key={cat} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography fontWeight={700}>{cat}</Typography>
                    <Chip
                      label={`${items.length} items`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <TableContainer component={Paper} variant="outlined" square>
                    <Table size="small">
                      <TableHead>
                        <TableRow
                          sx={{
                            "& th": {
                              fontWeight: 700,
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          <TableCell width={120}>CWE</TableCell>
                          <TableCell>Weakness</TableCell>
                          <TableCell width={110}>Severity</TableCell>
                          <TableCell>Rationale / Gap</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((r) => (
                          <TableRow key={r.cwe} hover>
                            <TableCell>
                              <Chip
                                label={r.cwe}
                                size="small"
                                variant="outlined"
                                color="secondary"
                                sx={{ fontFamily: "monospace" }}
                              />
                            </TableCell>
                            <TableCell>{r.label}</TableCell>
                            <TableCell>
                              <SevChip severity={r.severity} />
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {r.rationale}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            );
          })}

          <Divider sx={{ my: 4 }} />

          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            All roadmap CWEs at a glance
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {ROADMAP_ITEMS.sort((a, b) => a.cwe.localeCompare(b.cwe)).map(
              (r) => (
                <Tooltip key={r.cwe} title={r.label} placement="top" arrow>
                  <Chip
                    label={r.cwe}
                    size="small"
                    variant="outlined"
                    color={SEVERITY_COLOR[r.severity]}
                    sx={{ fontFamily: "monospace", cursor: "help", mb: 1 }}
                  />
                </Tooltip>
              ),
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
