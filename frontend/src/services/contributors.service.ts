import axios from "axios";

export interface ContributorStats {
  email: string;
  name: string;
  commits: number;
  additions?: number;
  deletions?: number;
  firstCommitAt?: string;
  lastCommitAt?: string;
  // Risk attribution fields
  totalRiskScore?: number;
  findingsCount?: number;
  averageRiskPerFinding?: number;
  severityBreakdown?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  categories?: string[];
  isBot?: boolean;
}

export interface ContributorRun {
  auditId: string;
  repoFullName: string;
  startedAt?: string;
  agentTool?: string;
  hasFullStats: boolean;
  hasRiskAttribution?: boolean;
}

export interface RiskAttribution {
  repoFullName: string;
  generatedAt: string;
  analysis: {
    totalFindings: number;
    analyzedFindings: number;
    coveragePercentage: number;
  };
  contributors: ContributorStats[];
  riskTimeline: Array<{
    week: string;
    weekStart: string;
    totalRisk: number;
    findingsCount: number;
    contributors: number;
  }>;
  summary: {
    totalContributors: number;
    totalRiskScore: number;
    highestRiskContributor: string | null;
    averageRiskPerContributor: number;
    botsDetected: number;
  };
}

export const contributorsService = {
  async getRuns(): Promise<ContributorRun[]> {
    const { data } = await axios.get<{ runs: ContributorRun[] }>(
      "/api/contributors/runs",
    );
    return data.runs ?? [];
  },

  async get(
    auditId: string,
  ): Promise<{
    repoFullName: string;
    contributors: ContributorStats[];
    hasFullStats: boolean;
    riskAttribution?: RiskAttribution;
  }> {
    const { data } = await axios.get<{
      results: {
        repoFullName: string;
        contributors: ContributorStats[];
        hasFullStats: boolean;
        riskAttribution?: RiskAttribution;
      }[];
    }>("/api/contributors", { params: { auditId } });
    const entry = data.results[0];
    return entry ?? { repoFullName: "", contributors: [], hasFullStats: false };
  },
};
