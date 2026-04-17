import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { contributorsService } from "../../services/contributors.service.ts";
import { useResultsList } from "../../hooks/useResults.ts";
import type { ContributorStats } from "../../services/contributors.service.ts";

export default function ContributorsPage() {
  const { results } = useResultsList();
  const repos = [...new Set(results.map((r) => r.repoFullName))];
  const [selectedRepo, setSelectedRepo] = useState<string>(repos[0] ?? "");
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRepo) return;
    setLoading(true);
    setError(null);
    contributorsService
      .get(selectedRepo)
      .then((data) => setContributors(data.contributors ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedRepo]);

  // Prepare commit history chart data (last 30 contributors sorted by commits)
  const chartData = contributors.slice(0, 10).map((c) => ({
    name: c.name.split(" ")[0] ?? c.email,
    commits: c.commits,
    additions: c.additions,
    deletions: c.deletions,
  }));

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Contributors
      </Typography>

      <FormControl sx={{ minWidth: 300, mb: 3 }}>
        <InputLabel>Repository</InputLabel>
        <Select
          value={selectedRepo}
          label="Repository"
          onChange={(e) => setSelectedRepo(e.target.value)}
        >
          {repos.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && contributors.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Commit Activity (Top 10)
          </Typography>
          <Box sx={{ height: 250, mb: 4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="commits"
                  stroke="#1a237e"
                  fill="#e8eaf6"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>

          <Typography variant="h6" gutterBottom>
            Leaderboard
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#1a237e" }}>
                  <TableCell sx={{ color: "white" }}>#</TableCell>
                  <TableCell sx={{ color: "white" }}>Contributor</TableCell>
                  <TableCell sx={{ color: "white" }} align="right">
                    Commits
                  </TableCell>
                  <TableCell sx={{ color: "white" }} align="right">
                    Additions
                  </TableCell>
                  <TableCell sx={{ color: "white" }} align="right">
                    Deletions
                  </TableCell>
                  <TableCell sx={{ color: "white" }}>Last Commit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contributors.map((c, i) => (
                  <TableRow key={c.email} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {c.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">{c.commits}</TableCell>
                    <TableCell align="right" sx={{ color: "#388e3c" }}>
                      {c.additions != null ? `+${c.additions}` : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ color: "#d32f2f" }}>
                      {c.deletions != null ? `-${c.deletions}` : "—"}
                    </TableCell>
                    <TableCell>
                      {c.lastCommitAt
                        ? new Date(c.lastCommitAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {!loading && contributors.length === 0 && !error && (
        <Typography color="text.secondary">
          No contributor data available for this repository.
        </Typography>
      )}
    </Box>
  );
}
