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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { contributorsService } from "../../services/contributors.service.ts";
import type {
  ContributorStats,
  ContributorRun,
  RiskAttribution,
} from "../../services/contributors.service.ts";

export default function ContributorsPage() {
  const [runs, setRuns] = useState<ContributorRun[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [hasFullStats, setHasFullStats] = useState(false);
  const [riskAttribution, setRiskAttribution] = useState<RiskAttribution | null>(null);
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
        setRiskAttribution(data.riskAttribution ?? null);
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
                  {riskAttribution && (
                    <TableCell 
                      sx={{ color: "#fff", fontWeight: "bold" }}
                      align="right"
                    >
                      Risk Score
                    </TableCell>
                  )}
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
                    {riskAttribution && (
                      <TableCell 
                        align="right"
                        sx={{ 
                          color: c.totalRiskScore && c.totalRiskScore > 0 ? "#d32f2f" : "inherit",
                          fontWeight: c.totalRiskScore && c.totalRiskScore > 0 ? "bold" : "normal"
                        }}
                      >
                        {c.totalRiskScore || 0}
                        {c.findingsCount && c.findingsCount > 0 && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {c.findingsCount} findings
                          </Typography>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Risk Attribution Section */}
          {riskAttribution && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
                Risk Attribution
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Risk attribution shows which contributors introduced lines flagged by security/quality audits. 
                  Coverage: {riskAttribution.analysis.analyzedFindings}/{riskAttribution.analysis.totalFindings} findings ({riskAttribution.analysis.coveragePercentage}%) 
                  — informational only, not punitive.
                </Typography>
              </Alert>

              {/* Risk Timeline Chart */}
              <Typography variant="subtitle1" gutterBottom>
                Risk Introduction Timeline (Last 26 Weeks)
              </Typography>
              <Box sx={{ height: 200, mb: 3 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={riskAttribution.riskTimeline}>
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => `Week ${value}`}
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'totalRisk' ? 'Risk Score' : 'Findings'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalRisk"
                      stroke="#d32f2f"
                      fill="#ffebee"
                      name="totalRisk"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>

              {/* Risk by Contributor Bar Chart */}
              <Typography variant="subtitle1" gutterBottom>
                Risk Score by Contributor (Top 10)
              </Typography>
              <Box sx={{ height: 250, mb: 3 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskAttribution.contributors.slice(0, 10)}>
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'totalRiskScore' ? 'Risk Score' : name
                      ]}
                    />
                    <Bar dataKey="totalRiskScore" fill="#f44336" name="totalRiskScore" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              {/* Severity Breakdown Pie Chart */}
              <Typography variant="subtitle1" gutterBottom>
                Findings by Severity
              </Typography>
              <Box sx={{ height: 250, mb: 3 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Critical', value: riskAttribution.contributors.reduce((sum, c) => sum + (c.severityBreakdown?.critical || 0), 0), fill: '#d32f2f' },
                        { name: 'High', value: riskAttribution.contributors.reduce((sum, c) => sum + (c.severityBreakdown?.high || 0), 0), fill: '#f57c00' },
                        { name: 'Medium', value: riskAttribution.contributors.reduce((sum, c) => sum + (c.severityBreakdown?.medium || 0), 0), fill: '#fbc02d' },
                        { name: 'Low', value: riskAttribution.contributors.reduce((sum, c) => sum + (c.severityBreakdown?.low || 0), 0), fill: '#388e3c' },
                        { name: 'Info', value: riskAttribution.contributors.reduce((sum, c) => sum + (c.severityBreakdown?.info || 0), 0), fill: '#1976d2' },
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label
                    >
                      {[
                        { name: 'Critical', value: 1, fill: '#d32f2f' },
                        { name: 'High', value: 1, fill: '#f57c00' },
                        { name: 'Medium', value: 1, fill: '#fbc02d' },
                        { name: 'Low', value: 1, fill: '#388e3c' },
                        { name: 'Info', value: 1, fill: '#1976d2' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              {/* Risk Summary Stats */}
              <Typography variant="subtitle1" gutterBottom>
                Risk Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Paper sx={{ p: 2, minWidth: 150 }}>
                  <Typography variant="h6" color="error">
                    {riskAttribution.summary.totalRiskScore}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Risk Score
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 150 }}>
                  <Typography variant="h6">
                    {riskAttribution.summary.totalContributors}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Contributors with Findings
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 150 }}>
                  <Typography variant="h6">
                    {riskAttribution.summary.averageRiskPerContributor.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Average Risk per Contributor
                  </Typography>
                </Paper>
              </Box>
            </>
          )}
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
