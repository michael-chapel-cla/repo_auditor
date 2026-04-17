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
  Chip,
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
import type {
  ContributorStats,
  ContributorRun,
} from "../../services/contributors.service.ts";

export default function ContributorsPage() {
  const [runs, setRuns] = useState<ContributorRun[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [hasFullStats, setHasFullStats] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load run list once, default to the run with the most complete stats
  useEffect(() => {
    contributorsService.getRuns().then((r) => {
      // Sort: full-stats runs first, then newest-first
      const sorted = [...r].sort((a, b) => {
        if (a.hasFullStats !== b.hasFullStats) return a.hasFullStats ? -1 : 1;
        return (
          new Date(b.startedAt ?? 0).getTime() -
          new Date(a.startedAt ?? 0).getTime()
        );
      });
      setRuns(sorted);
      setSelectedAuditId(sorted[0]?.auditId ?? "");
    });
  }, []);

  useEffect(() => {
    if (!selectedAuditId) return;
    setLoading(true);
    setError(null);
    contributorsService
      .get(selectedAuditId)
      .then((data) => {
        setContributors(data.contributors ?? []);
        setHasFullStats(data.hasFullStats);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedAuditId]);

  // Chart: top 10 by commits
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

      <FormControl sx={{ minWidth: 400, mb: 2 }}>
        <InputLabel>Audit run</InputLabel>
        <Select
          value={selectedAuditId}
          label="Audit run"
          onChange={(e) => setSelectedAuditId(e.target.value)}
        >
          {runs.map((r) => (
            <MenuItem key={r.auditId} value={r.auditId}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <span>
                  {r.repoFullName}
                  {r.startedAt
                    ? ` — ${new Date(r.startedAt).toLocaleString()}`
                    : ""}
                  {r.agentTool ? ` · ${r.agentTool}` : ""}
                  &nbsp;
                  <span style={{ color: "#9e9e9e", fontSize: "0.7rem" }}>
                    ({r.auditId.slice(0, 8)})
                  </span>
                </span>
                {r.hasFullStats && (
                  <Chip
                    label="full stats"
                    size="small"
                    sx={{
                      fontSize: "0.6rem",
                      height: 16,
                      backgroundColor: "#2e7d32",
                      color: "#fff",
                    }}
                  />
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!hasFullStats && contributors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This run only captured commit counts — additions and deletions were
          not recorded by the agent. Select a run marked{" "}
          <strong>full stats</strong> to see complete data.
        </Alert>
      )}

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
                  stroke="#1565c0"
                  fill="#e3f2fd"
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
                <TableRow sx={{ backgroundColor: "#212121" }}>
                  <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                    #
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                    Contributor
                  </TableCell>
                  <TableCell
                    sx={{ color: "#fff", fontWeight: "bold" }}
                    align="right"
                  >
                    Commits
                  </TableCell>
                  <TableCell
                    sx={{ color: "#fff", fontWeight: "bold" }}
                    align="right"
                  >
                    Additions
                  </TableCell>
                  <TableCell
                    sx={{ color: "#fff", fontWeight: "bold" }}
                    align="right"
                  >
                    Deletions
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                    Last Commit
                  </TableCell>
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
                    <TableCell
                      align="right"
                      sx={{ color: "#2e7d32", fontWeight: "bold" }}
                    >
                      {c.additions != null
                        ? `+${c.additions.toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: "#c62828", fontWeight: "bold" }}
                    >
                      {c.deletions != null
                        ? `-${c.deletions.toLocaleString()}`
                        : "—"}
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
