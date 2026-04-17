import axios from "axios";

export interface ContributorStats {
  email: string;
  name: string;
  commits: number;
  additions: number;
  deletions: number;
  firstCommitAt: string;
  lastCommitAt: string;
}

export const contributorsService = {
  async get(
    repo?: string,
  ): Promise<{ repoFullName: string; contributors: ContributorStats[] }> {
    const params = repo ? { repo } : {};
    const { data } = await axios.get<{
      results: { repoFullName: string; contributors: ContributorStats[] }[];
    }>("/api/contributors", { params });
    const entry = data.results[0];
    return entry ?? { repoFullName: repo ?? "", contributors: [] };
  },
};
