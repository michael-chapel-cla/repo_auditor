import axios from "axios";

export interface ContributorStats {
  email: string;
  name: string;
  commits: number;
  additions?: number;
  deletions?: number;
  firstCommitAt?: string;
  lastCommitAt?: string;
}

export interface ContributorRun {
  auditId: string;
  repoFullName: string;
  startedAt?: string;
  agentTool?: string;
  hasFullStats: boolean;
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
  }> {
    const { data } = await axios.get<{
      results: {
        repoFullName: string;
        contributors: ContributorStats[];
        hasFullStats: boolean;
      }[];
    }>("/api/contributors", { params: { auditId } });
    const entry = data.results[0];
    return entry ?? { repoFullName: "", contributors: [], hasFullStats: false };
  },
};
