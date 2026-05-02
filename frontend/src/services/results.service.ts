import axios from "axios";

export interface AuditSummary {
  overallScore: number;
  totalFindings: number;
  riskLevel: string;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  // Phase 1 enhancements
  baselineComparison?: {
    previousAuditFound: boolean;
    previousAuditId?: string;
    newFindings: number;
    existingFindings: number;
  };
  autoFixSuggestions?: {
    totalFixable: number;
    generated: boolean;
  };
  contextAwareSeverity?: {
    adjustmentsApplied: number;
    totalAdjustments: number;
  };
  crossToolDeduplication?: {
    originalFindings: number;
    mergedFindings: number;
    reductionCount: number;
    totalMergeOperations: number;
  };
}

export interface Finding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  rule?: string;
  cwe?: string;
  fix?: string;
  source: string;
  // Phase 1 enhancements
  status?: "new" | "existing";
  sources?: string[];
  autofix?: {
    type: "diff" | "command";
    description: string;
    patch?: string;
    command?: string;
    confidence?: "high" | "medium" | "low";
  };
  severityAdjusted?: {
    originalSeverity: string;
    adjustedSeverity: string;
    rule: string;
    reason: string;
  };
  deduplicated?: {
    mergedFrom: Array<{
      source: string;
      id: string;
      severity: string;
      title: string;
    }>;
    mergedAt: string;
  };
}

export interface AuditResult {
  category: string;
  status: string;
  score: number;
  findings: Finding[];
}

export interface RepoAuditResult {
  auditId: string;
  repoFullName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  agentTool?: string;
  summary: AuditSummary;
  results: AuditResult[];
}

export interface AuditListItem {
  auditId: string;
  repoFullName: string;
  startedAt: string;
  completedAt?: string;
  agentTool?: string;
  summary: AuditSummary;
}

export const resultsService = {
  async list(): Promise<AuditListItem[]> {
    const { data } = await axios.get<{ results: AuditListItem[] }>(
      "/api/reports",
    );
    return data.results;
  },

  async get(auditId: string): Promise<RepoAuditResult> {
    const { data } = await axios.get<RepoAuditResult>(
      `/api/reports/${auditId}`,
    );
    return data;
  },
};
