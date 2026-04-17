import { useState } from "react";
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
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
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
import { severityColors } from "../../theme.ts";
import type { Finding } from "../../services/results.service.ts";

const COLUMNS: GridColDef<Finding>[] = [
  {
    field: "severity",
    headerName: "Severity",
    width: 110,
    renderCell: ({ row }) => <SeverityChip severity={row.severity} />,
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
  { field: "fix", headerName: "Fix", flex: 1, minWidth: 200 },
];

export default function ResultsPage() {
  const { auditId: paramAuditId } = useParams<{ auditId?: string }>();
  const { results: allResults, loading: listLoading } = useResultsList();
  const [selectedAuditId, setSelectedAuditId] = useState<string>(paramAuditId ?? "");
  const { result, loading, error } = useResult(selectedAuditId || paramAuditId);
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  if (listLoading || loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!result && allResults.length > 0) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Results</Typography>
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
            {allResults.map((r) => (
              <MenuItem key={r.auditId} value={r.auditId}>
                {r.repoFullName} — {new Date(r.startedAt).toLocaleDateString()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  if (!result) {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <Typography variant="h5">No results found</Typography>
        <Typography color="text.secondary">Run an audit first from the Audit page.</Typography>
      </Box>
    );
  }

  const categories = result.results.map((r) => r.category);
  const currentCategory = result.results[tab];
  const findings = currentCategory?.findings ?? [];

  const severityCounts = Object.entries(result.summary.bySeverity).map(([name, value]) => ({ name, value }));

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">{result.repoFullName}</Typography>
          <Typography color="text.secondary">
            Audit {result.auditId.slice(0, 8)} — {new Date(result.startedAt).toLocaleString()}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip
            label={`Risk: ${result.summary.riskLevel.toUpperCase()}`}
            sx={{ backgroundColor: severityColors[result.summary.riskLevel], color: "white" }}
          />
          <Chip label={`Score: ${result.summary.overallScore}/100`} variant="outlined" />
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

      <Box sx={{ mb: 3, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={severityCounts}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value">
              {severityCounts.map((entry) => (
                <Cell key={entry.name} fill={severityColors[entry.name] ?? "#757575"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v as number)} sx={{ mb: 2 }}>
        {categories.map((cat, i) => (
          <Tab key={cat} label={`${cat} (${result.results[i]?.findings.length ?? 0})`} />
        ))}
      </Tabs>

      <DataGrid
        rows={findings}
        columns={COLUMNS}
        autoHeight
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        disableRowSelectionOnClick
        sx={{ backgroundColor: "white", borderRadius: 2 }}
      />
    </Box>
  );
}
