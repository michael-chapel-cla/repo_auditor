import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useResultsList, useResult } from "../../hooks/useResults.ts";
import SeverityChip from "../../components/SeverityChip.tsx";
import AutoFixDialog from "../../components/AutoFixDialog.tsx";
import Phase1Banner from "../../components/Phase1Banner.tsx";
import { severityColors } from "../../theme.ts";
import { deriveScore } from "../../utils/score.ts";
import type { Finding } from "../../services/results.service.ts";

// Move columns inside component to access click handlers

/** NPQ supply-chain specific columns — shows signal type, package, and remediation */
const NPQ_COLUMNS: GridColDef<Finding>[] = [
  {
    field: "severity",
    headerName: "Severity",
    width: 110,
    renderCell: ({ row }) => <SeverityChip severity={row.severity} />,
  },
  { field: "title", headerName: "Package / Signal", flex: 1, minWidth: 240 },
  { field: "rule", headerName: "Signal", width: 200 },
  { field: "description", headerName: "Detail", flex: 1, minWidth: 280 },
  {
    field: "source",
    headerName: "Source",
    width: 120,
    renderCell: ({ row }) =>
      row.source ? (
        <Chip label={row.source} size="small" variant="outlined" />
      ) : (
        "—"
      ),
  },
  { field: "fix", headerName: "Remediation", flex: 1, minWidth: 200 },
];

export default function ResultsPage() {
  const { auditId: paramAuditId } = useParams<{ auditId?: string }>();
  const { results: allResults, loading: listLoading } = useResultsList();
  const [selectedAuditId, setSelectedAuditId] = useState<string>(
    paramAuditId ?? "",
  );
  const { result, loading, error } = useResult(selectedAuditId || paramAuditId);
  const [autoFixDialogOpen, setAutoFixDialogOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  const handleAutoFixClick = (finding: Finding) => {
    setSelectedFinding(finding);
    setAutoFixDialogOpen(true);
  };

  const COLUMNS: GridColDef<Finding>[] = [
    {
      field: "severity",
      headerName: "Severity",
      width: 110,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <SeverityChip severity={row.severity} />
          {row.severityAdjusted && (
            <Tooltip 
              title={`Originally ${row.severityAdjusted.originalSeverity.toUpperCase()}, adjusted to ${row.severityAdjusted.adjustedSeverity.toUpperCase()}: ${row.severityAdjusted.reason}`}
              arrow
            >
              <Chip 
                label="🎯" 
                size="small" 
                sx={{ 
                  minWidth: 24, 
                  height: 18, 
                  fontSize: '0.6rem',
                  backgroundColor: '#607d8b',
                  color: '#fff'
                }}
              />
            </Tooltip>
          )}
        </Box>
      ),
    },
    { field: "title", headerName: "Title", flex: 1, minWidth: 200 },
    {
      field: "file",
      headerName: "File",
      width: 280,
      renderCell: ({ row }) =>
        row.file ? `${row.file}${row.line ? `:${row.line}` : ""}` : "—",
    },
    { field: "rule", headerName: "Rule", width: 160 },
    {
      field: "cwe",
      headerName: "CWE",
      width: 110,
      renderCell: ({ row }) =>
        row.cwe ? <Chip label={row.cwe} size="small" variant="outlined" /> : "—",
    },
    {
      field: "source",
      headerName: "Source",
      width: 120,
      renderCell: ({ row }) =>
        row.sources && row.sources.length > 1 ? (
          <Chip 
            label={`${row.sources.length} tools`} 
            size="small" 
            variant="outlined"
            color="primary"
            title={`Detected by: ${row.sources.join(', ')}`}
          />
        ) : (
          <Chip 
            label={row.source} 
            size="small" 
            variant="outlined" 
            title={`Detected by: ${row.source}`}
          />
        ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 90,
      renderCell: ({ row }) =>
        row.status ? (
          <Chip 
            label={row.status} 
            size="small" 
            variant="filled"
            color={row.status === 'new' ? 'error' : 'default'}
            sx={{ 
              fontSize: '0.75rem',
              fontWeight: row.status === 'new' ? 'bold' : 'normal'
            }}
          />
        ) : "—",
    },
    {
      field: "autofix",
      headerName: "Auto-fix",
      width: 100,
      renderCell: ({ row }) =>
        row.autofix ? (
          <Chip 
            label="✨ Fix"
            size="small" 
            variant="outlined"
            color="success"
            title={row.autofix.description}
            sx={{ cursor: 'pointer' }}
            onClick={() => handleAutoFixClick(row)}
          />
        ) : "—",
    },
    { field: "fix", headerName: "Description", flex: 1, minWidth: 200 },
  ];

  // Default to the most recent audit when no auditId is in the URL
  useEffect(() => {
    if (!paramAuditId && allResults.length > 0 && !selectedAuditId) {
      const sorted = [...allResults].sort(
        (a, b) =>
          new Date(b.completedAt ?? b.startedAt).getTime() -
          new Date(a.completedAt ?? a.startedAt).getTime(),
      );
      const latest = sorted[0].auditId;
      setSelectedAuditId(latest);
      navigate(`/results/${latest}`, { replace: true });
    }
  }, [allResults, paramAuditId, selectedAuditId, navigate]);

  if (listLoading || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  const categories = result?.results.map((r) => r.category) ?? [];
  const currentCategory = result?.results[tab];
  const findings = currentCategory?.findings ?? [];

  const severityCounts = Object.entries(result?.summary.bySeverity ?? {}).map(
    ([name, value]) => ({ name, value }),
  );
  const { score: displayScore, derived: scoreDerived } = deriveScore(
    result?.summary ?? {
      overallScore: 0,
      totalFindings: 0,
      riskLevel: "low",
      bySeverity: {},
      byCategory: {},
    },
  );

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <FormControl sx={{ minWidth: 300 }}>
          <InputLabel>Select Audit</InputLabel>
          <Select
            value={selectedAuditId}
            label="Select Audit"
            onChange={(e) => {
              setSelectedAuditId(e.target.value);
              navigate(`/results/${e.target.value}`);
            }}
          >
            {[...allResults]
              .sort(
                (a, b) =>
                  new Date(b.completedAt ?? b.startedAt).getTime() -
                  new Date(a.completedAt ?? a.startedAt).getTime(),
              )
              .map((r) => (
                <MenuItem key={r.auditId} value={r.auditId}>
                  {r.repoFullName} —{" "}
                  {new Date(r.completedAt ?? r.startedAt).toLocaleString()}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Box>
      {result && (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h4" fontWeight="bold">
                {result.repoFullName}
              </Typography>
              <Typography color="text.secondary">
                Audit {result.auditId.slice(0, 8)} —{" "}
                {new Date(
                  result.completedAt ?? result.startedAt,
                ).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip
                label={`Risk: ${result.summary.riskLevel.toUpperCase()}`}
                sx={{
                  backgroundColor: severityColors[result.summary.riskLevel],
                  color: "white",
                }}
              />
              <Chip
                label={`Score: ${displayScore}/100${scoreDerived ? " (est)" : ""}`}
                variant="outlined"
                title={
                  scoreDerived
                    ? "Estimated from finding severity — agent reported 0"
                    : undefined
                }
              />
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                href={`/api/reports/${result.auditId}/report.html`}
                target="_blank"
              >
                HTML
              </Button>
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                href={`/api/reports/${result.auditId}/report.md`}
                target="_blank"
              >
                Markdown
              </Button>
            </Box>
          </Box>

          {/* Phase 1 Enhancement Banner */}
          <Phase1Banner summary={result.summary} />

          <Box sx={{ mb: 3, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityCounts}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value">
                  {severityCounts.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={severityColors[entry.name] ?? "#757575"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v as number)}
            sx={{ mb: 2 }}
          >
            {categories.map((cat, i) => (
              <Tab
                key={cat}
                label={`${cat} (${result.results[i]?.findings.length ?? 0})`}
              />
            ))}
          </Tabs>

          <DataGrid
            rows={findings}
            columns={
              currentCategory?.category === "npq" ? NPQ_COLUMNS : COLUMNS
            }
            autoHeight
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            disableRowSelectionOnClick
            sx={{ backgroundColor: "white", borderRadius: 2 }}
          />
        </>
      )}
      
      {/* Phase 1 Enhancement: Auto-fix Dialog */}
      {selectedFinding && (
        <AutoFixDialog
          open={autoFixDialogOpen}
          onClose={() => setAutoFixDialogOpen(false)}
          finding={selectedFinding}
        />
      )}
    </Box>
  );
}
