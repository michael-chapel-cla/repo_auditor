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
  Divider,
  Tooltip,
} from "@mui/material";
import { useResultsList } from "../../hooks/useResults.ts";
import { severityColors, severityTextColors } from "../../theme.ts";
import { deriveScore } from "../../utils/score.ts";
import type { AuditListItem } from "../../services/results.service.ts";

const CATEGORY_LABELS: Record<string, string> = {
  security: "SEC",
  npm: "NPM",
  npq: "NPQ",
  quality: "QUAL",
  api: "API",
  db: "DB",
};

const CATEGORY_COLORS: Record<string, string> = {
  security: "#c62828",
  npm: "#e65100",
  npq: "#ad1457",
  quality: "#1565c0",
  api: "#6a1b9a",
  db: "#2e7d32",
};

function ScoreRing({ score, derived }: { score: number; derived: boolean }) {
  const color = score >= 80 ? "#2e7d32" : score >= 60 ? "#e65100" : "#c62828";
  // Show a minimum 3% arc so the ring is always visibly rendered
  const displayValue = score === 0 ? 3 : score;
  return (
    <Tooltip
      title={
        derived
          ? `Derived from findings (agent reported 0)`
          : `Overall score: ${score}/100`
      }
      arrow
    >
      <Box
        sx={{ position: "relative", display: "inline-flex", cursor: "help" }}
      >
        {/* background track */}
        <CircularProgress
          variant="determinate"
          value={100}
          size={56}
          sx={{ color: "#e0e0e0", position: "absolute" }}
        />
        <CircularProgress
          variant="determinate"
          value={displayValue}
          size={56}
          sx={{ color }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="caption"
            fontWeight="bold"
            sx={{ fontSize: "0.7rem", lineHeight: 1 }}
          >
            {score}
          </Typography>
          {derived && (
            <Typography
              sx={{ fontSize: "0.5rem", color: "#9e9e9e", lineHeight: 1 }}
            >
              est
            </Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  );
}

function SevCount({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box sx={{ textAlign: "center", minWidth: 36 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight="bold"
        sx={{ color: value > 0 ? color : "text.disabled" }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function RepoCard({ item }: { item: AuditListItem }) {
  const navigate = useNavigate();
  const { summary } = item;
  const { score, derived } = deriveScore(item.summary);
  const riskColor = severityColors[summary.riskLevel] ?? severityColors["info"];
  const riskText = severityTextColors[summary.riskLevel] ?? "#fff";

  const categories = Object.entries(summary.byCategory ?? {}).filter(
    ([cat]) => cat in CATEGORY_LABELS,
  );

  return (
    <Card>
      <CardActionArea onClick={() => navigate(`/results/${item.auditId}`)}>
        <CardContent sx={{ pb: "12px !important" }}>
          {/* Header row */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              mb: 1.5,
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                {item.repoFullName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(
                  item.completedAt ?? item.startedAt,
                ).toLocaleDateString()}
                {item.agentTool ? ` · ${item.agentTool}` : ""}
              </Typography>
            </Box>
            <Chip
              label={summary.riskLevel.toUpperCase()}
              size="small"
              sx={{
                backgroundColor: riskColor,
                color: riskText,
                fontWeight: "bold",
                fontSize: "0.65rem",
              }}
            />
          </Box>

          {/* Score + severity counts */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
            <ScoreRing score={score} derived={derived} />
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <SevCount
                label="Total"
                value={summary.totalFindings}
                color="#212121"
              />
              <SevCount
                label="Crit"
                value={summary.bySeverity["critical"] ?? 0}
                color={severityColors["critical"]}
              />
              <SevCount
                label="High"
                value={summary.bySeverity["high"] ?? 0}
                color={severityColors["high"]}
              />
              <SevCount
                label="Med"
                value={summary.bySeverity["medium"] ?? 0}
                color={severityColors["medium"]}
              />
              <SevCount
                label="Low"
                value={summary.bySeverity["low"] ?? 0}
                color={severityColors["low"]}
              />
            </Box>
          </Box>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <>
              <Divider sx={{ mb: 1 }} />
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexWrap: "wrap",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                {categories.map(([cat, count]) => (
                  <Chip
                    key={cat}
                    label={`${CATEGORY_LABELS[cat] ?? cat.toUpperCase()}  ${count}`}
                    size="small"
                    sx={{
                      backgroundColor:
                        count > 0
                          ? (CATEGORY_COLORS[cat] ?? "#757575")
                          : "#f5f5f5",
                      color: count > 0 ? "#fff" : "#9e9e9e",
                      fontSize: "0.62rem",
                      height: 20,
                      fontWeight: "bold",
                    }}
                  />
                ))}
              </Box>
            </>
          )}

          {/* Phase 1 Enhancement Indicators */}
          {(summary.baselineComparison ||
            summary.autoFixSuggestions ||
            summary.crossToolDeduplication) && (
            <>
              <Divider sx={{ mb: 1 }} />
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {summary.baselineComparison && (
                  <Tooltip
                    title={`${summary.baselineComparison.newFindings} new, ${summary.baselineComparison.existingFindings} existing findings`}
                    arrow
                  >
                    <Chip
                      label={
                        summary.baselineComparison.newFindings > 0
                          ? "📈 New Issues"
                          : "📊 Tracked"
                      }
                      size="small"
                      sx={{
                        backgroundColor:
                          summary.baselineComparison.newFindings > 0
                            ? "#ff9800"
                            : "#4caf50",
                        color: "#fff",
                        fontSize: "0.6rem",
                        height: 18,
                      }}
                    />
                  </Tooltip>
                )}
                {summary.autoFixSuggestions &&
                  summary.autoFixSuggestions.totalFixable > 0 && (
                    <Tooltip
                      title={`${summary.autoFixSuggestions.totalFixable} findings have auto-fix suggestions`}
                      arrow
                    >
                      <Chip
                        label="✨ Auto-fixes"
                        size="small"
                        sx={{
                          backgroundColor: "#2196f3",
                          color: "#fff",
                          fontSize: "0.6rem",
                          height: 18,
                        }}
                      />
                    </Tooltip>
                  )}
                {summary.crossToolDeduplication &&
                  summary.crossToolDeduplication.reductionCount > 0 && (
                    <Tooltip
                      title={`${summary.crossToolDeduplication.reductionCount} duplicate findings merged`}
                      arrow
                    >
                      <Chip
                        label="🔗 Deduped"
                        size="small"
                        sx={{
                          backgroundColor: "#9c27b0",
                          color: "#fff",
                          fontSize: "0.6rem",
                          height: 18,
                        }}
                      />
                    </Tooltip>
                  )}
                {summary.contextAwareSeverity &&
                  summary.contextAwareSeverity.adjustmentsApplied > 0 && (
                    <Tooltip
                      title={`${summary.contextAwareSeverity.adjustmentsApplied} severity adjustments applied`}
                      arrow
                    >
                      <Chip
                        label="🎯 Smart"
                        size="small"
                        sx={{
                          backgroundColor: "#607d8b",
                          color: "#fff",
                          fontSize: "0.6rem",
                          height: 18,
                        }}
                      />
                    </Tooltip>
                  )}
              </Box>
            </>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function DashboardPage() {
  const { results, loading, error } = useResultsList();

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  if (error) return <Alert severity="error">{error}</Alert>;

  if (results.length === 0) {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <Typography variant="h5" gutterBottom>
          No audits yet
        </Typography>
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
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Dashboard
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        Latest audit results per repository
      </Typography>
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
