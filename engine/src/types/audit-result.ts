export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type AuditCategory =
  | "security"
  | "quality"
  | "api"
  | "db"
  | "contributor";

export interface Finding {
  id: string;
  category: AuditCategory;
  severity: Severity;
  title: string;
  description: string;
  file?: string;
  line?: number;
  rule?: string;
  cwe?: string;
  fix?: string;
  source: "npm-audit" | "gitleaks" | "semgrep" | "ai" | "eslint" | "static" | "depcheck" | "tsc" | "git";
}

export interface AuditResult {
  auditId: string;
  repoFullName: string;
  category: AuditCategory;
  status: "passed" | "failed" | "error";
  score: number;
  findings: Finding[];
  durationMs: number;
  timestamp: string;
  error?: string;
}

export interface RepoAuditResult {
  auditId: string;
  repoFullName: string;
  status: "running" | "complete" | "error";
  startedAt: string;
  completedAt?: string;
  results: AuditResult[];
  summary: AuditSummary;
}

export interface AuditSummary {
  overallScore: number;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<AuditCategory, number>;
  riskLevel: "critical" | "high" | "medium" | "low" | "clean";
}

export interface ContributorStats {
  email: string;
  name: string;
  commits: number;
  additions: number;
  deletions: number;
  pullRequests?: number;
  reviews?: number;
  firstCommitAt: string;
  lastCommitAt: string;
}

export interface RepoMeta {
  fullName: string;
  owner: string;
  repo: string;
  localPath: string;
  defaultBranch: string;
  clonedAt: string;
}
