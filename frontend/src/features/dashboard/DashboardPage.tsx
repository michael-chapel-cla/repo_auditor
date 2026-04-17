import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Grid,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useResultsList } from "../../hooks/useResults.ts";
import { severityColors } from "../../theme.ts";
import type { AuditListItem } from "../../services/results.service.ts";

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#388e3c" : score >= 60 ? "#f57c00" : "#d32f2f";
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <CircularProgress variant="determinate" value={score} size={64} sx={{ color }} />
      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="caption" fontWeight="bold">{score}</Typography>
      </Box>
    </Box>
  );
}

function RepoCard({ item }: { item: AuditListItem }) {
  const navigate = useNavigate();
  const { summary } = item;
  const riskColor = severityColors[summary.riskLevel] ?? severityColors["info"];

  return (
    <Card>
      <CardActionArea onClick={() => navigate(`/results/${item.auditId}`)}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">{item.repoFullName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(item.startedAt).toLocaleDateString()}
              </Typography>
            </Box>
            <Chip
              label={summary.riskLevel.toUpperCase()}
              size="small"
              sx={{ backgroundColor: riskColor, color: "white", fontWeight: "bold" }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <ScoreRing score={summary.overallScore} />
            <Box>
              <Typography variant="body2" color="text.secondary">Findings</Typography>
              <Typography variant="h6">{summary.totalFindings}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Critical</Typography>
              <Typography variant="h6" color="error">{summary.bySeverity["critical"] ?? 0}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">High</Typography>
              <Typography variant="h6" color="warning.main">{summary.bySeverity["high"] ?? 0}</Typography>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function DashboardPage() {
  const { results, loading, error } = useResultsList();

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  if (results.length === 0) {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <Typography variant="h5" gutterBottom>No audits yet</Typography>
        <Typography color="text.secondary">
          Go to <strong>Run Audit</strong> to start your first repository audit.
        </Typography>
      </Box>
    );
  }

  // Show the latest audit per repo
  const latestByRepo = new Map<string, AuditListItem>();
  for (const r of results) {
    if (!latestByRepo.has(r.repoFullName)) latestByRepo.set(r.repoFullName, r);
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Dashboard</Typography>
      <Typography color="text.secondary" gutterBottom>Latest audit results per repository</Typography>
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {Array.from(latestByRepo.values()).map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.auditId}>
            <RepoCard item={item} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
