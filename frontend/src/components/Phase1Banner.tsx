import {
  Box,
  Typography,
  Chip,
  Paper,
  Fade,
  Tooltip,
} from "@mui/material";
import type { AuditSummary } from "../services/results.service";

interface Phase1BannerProps {
  summary: AuditSummary;
}

export default function Phase1Banner({ summary }: Phase1BannerProps) {
  const hasPhase1Data = !!(
    summary.baselineComparison ||
    summary.autoFixSuggestions ||
    summary.contextAwareSeverity ||
    summary.crossToolDeduplication
  );

  if (!hasPhase1Data) return null;

  const enhancements = [
    {
      key: "baseline",
      enabled: !!summary.baselineComparison,
      icon: "📊",
      title: "Baseline Tracking",
      description: summary.baselineComparison 
        ? `${summary.baselineComparison.newFindings} new, ${summary.baselineComparison.existingFindings} existing findings`
        : "Tracks new vs existing findings",
      color: summary.baselineComparison?.newFindings === 0 ? "#4caf50" : "#ff9800"
    },
    {
      key: "autofix",
      enabled: !!(summary.autoFixSuggestions?.totalFixable),
      icon: "✨",
      title: "Auto-fix Suggestions",
      description: summary.autoFixSuggestions 
        ? `${summary.autoFixSuggestions.totalFixable} findings have exact patches`
        : "Exact diff patches for simple issues",
      color: "#2196f3"
    },
    {
      key: "context",
      enabled: !!(summary.contextAwareSeverity?.adjustmentsApplied),
      icon: "🎯",
      title: "Smart Severity",
      description: summary.contextAwareSeverity 
        ? `${summary.contextAwareSeverity.adjustmentsApplied} severity adjustments applied`
        : "Context-aware severity adjustment",
      color: "#607d8b"
    },
    {
      key: "dedup",
      enabled: !!(summary.crossToolDeduplication?.reductionCount),
      icon: "🔗",
      title: "Deduplication",
      description: summary.crossToolDeduplication 
        ? `${summary.crossToolDeduplication.reductionCount} duplicate findings merged`
        : "Merge findings from multiple tools",
      color: "#9c27b0"
    }
  ].filter(enhancement => enhancement.enabled);

  if (enhancements.length === 0) return null;

  return (
    <Fade in timeout={800}>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
          <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            🚀 Phase 1 "Richer Findings" Active
          </Typography>
        </Box>
        
        <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
          This audit includes enhanced findings with reduced false positives and actionable suggestions
        </Typography>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {enhancements.map((enhancement) => (
            <Tooltip key={enhancement.key} title={enhancement.description} arrow>
              <Chip
                icon={<span>{enhancement.icon}</span>}
                label={enhancement.title}
                sx={{
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  color: "white",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  fontWeight: "500",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                  },
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Paper>
    </Fade>
  );
}