import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  Terminal as TerminalIcon,
  SmartToy as SmartToyIcon,
  GitHub as GitHubIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";

const AI_LLM_CWES = [
  {
    cwe: "CWE-1427",
    name: "Improper Neutralization of Input Used in a Prompt",
    rules: "S01, S25, S26, S28, S30",
    severity: "CRITICAL/HIGH",
    note: "Prompt injection — user/repo content in system role",
  },
  {
    cwe: "CWE-1426",
    name: "Improper Validation of Generative AI Output",
    rules: "S02, S29",
    severity: "CRITICAL",
    note: "Unvalidated AI output used as code, command, or piped to second LLM",
  },
  {
    cwe: "CWE-1434",
    name: "Improper Handling of Insufficient Permissions in AI Prompting",
    rules: "S31",
    severity: "HIGH",
    note: "Over-privileged agent — more tools/scopes than required",
  },
  {
    cwe: "CWE-200",
    name: "Exposure of Sensitive Information to an Unauthorized Actor",
    rules: "S24",
    severity: "HIGH",
    note: "Secrets, DB schema, or internal URLs embedded in system prompt",
  },
  {
    cwe: "CWE-94",
    name: "Improper Control of Generation of Code (Code Injection)",
    rules: "S20",
    severity: "HIGH",
    note: "eval() / new Function() / LLM-generated code executed without validation",
  },
  {
    cwe: "CWE-400",
    name: "Uncontrolled Resource Consumption",
    rules: "S27",
    severity: "HIGH",
    note: "Context window flooding — no token/character cap on content passed to LLM",
  },
];

const AGENT_TOOLS = [
  {
    label: "Claude Code CLI",
    icon: <SmartToyIcon />,
    chip: "claude",
    command: "./scripts/run-with-claude.sh owner/repo",
    description:
      "Runs the full audit as a Claude Code agent. Requires claude CLI and ANTHROPIC_API_KEY.",
    slashCommand: "/full-audit owner/repo",
  },
  {
    label: "OpenAI Codex CLI",
    icon: <TerminalIcon />,
    chip: "codex",
    command: "./scripts/run-with-codex.sh owner/repo",
    description:
      "Runs the full audit using the Codex CLI agent. Requires codex CLI and OPENAI_API_KEY.",
    slashCommand: "codex --task full-audit -- owner/repo",
  },
  {
    label: "GitHub Copilot (GitHub Actions)",
    icon: <GitHubIcon />,
    chip: "copilot",
    command: "./scripts/run-with-copilot.sh myorg/repo-auditor owner/repo",
    description:
      "Triggers the audit GitHub Actions workflow. Requires gh CLI and the repo to be on GitHub.",
    slashCommand: "gh workflow run audit.yml --field target_repo=owner/repo",
  },
];

export default function AuditPage() {
  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Run Audit
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        Audits are run entirely by AI agents. Choose your agent tool below, then
        check the <strong>Results</strong> page once complete.
      </Typography>

      <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        {AGENT_TOOLS.map((tool) => (
          <Paper key={tool.chip} sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              {tool.icon}
              <Typography variant="h6">{tool.label}</Typography>
              <Chip label={tool.chip} size="small" variant="outlined" />
            </Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {tool.description}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Shell script
            </Typography>
            <Box
              component="pre"
              sx={{
                background: "#f5f5f5",
                color: "#111111",
                p: 1.5,
                borderRadius: 1,
                fontSize: "0.8rem",
                overflowX: "auto",
                mt: 0.5,
                mb: 1.5,
              }}
            >
              {tool.command}
            </Box>
            {tool.slashCommand && (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Or directly
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    background: "#f5f5f5",
                    color: "#424242",
                    p: 1.5,
                    borderRadius: 1,
                    fontSize: "0.8rem",
                    overflowX: "auto",
                    mt: 0.5,
                  }}
                >
                  {tool.slashCommand}
                </Box>
              </>
            )}
          </Paper>
        ))}
      </Box>

      <Paper
        sx={{ p: 3, mt: 3, background: "#fafafa", border: "1px solid #e0e0e0" }}
      >
        <Typography variant="subtitle2" gutterBottom>
          How it works
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <TerminalIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Agent clones/pulls the target repository" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <TerminalIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Agent reads docs/ reference guides, then audits security → quality → API → DB" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <TerminalIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Agent writes results.json, report.md, and report.html to reports/" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <TerminalIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="This viewer reads those files — refresh Results page when the agent finishes" />
          </ListItem>
        </List>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <SecurityIcon fontSize="small" color="error" />
          <Typography variant="subtitle1" fontWeight="bold">
            AI / LLM CWE Coverage
          </Typography>
          <Chip label="6 CWEs" size="small" color="error" variant="outlined" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The security audit checks for these MITRE CWEs specific to AI and LLM
          integrations, in addition to the standard 25 security rules.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ background: "#f5f5f5" }}>
              <TableCell>
                <strong>CWE</strong>
              </TableCell>
              <TableCell>
                <strong>Name</strong>
              </TableCell>
              <TableCell>
                <strong>Rules</strong>
              </TableCell>
              <TableCell>
                <strong>Severity</strong>
              </TableCell>
              <TableCell>
                <strong>Detects</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {AI_LLM_CWES.map((row) => (
              <TableRow key={row.cwe} hover>
                <TableCell>
                  <Chip
                    label={row.cwe}
                    size="small"
                    variant="outlined"
                    color={
                      row.severity.startsWith("CRITICAL") ? "error" : "warning"
                    }
                    sx={{ fontFamily: "monospace", fontSize: "0.73rem" }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: "0.82rem" }}>{row.name}</TableCell>
                <TableCell
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.78rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.rules}
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.severity}
                    size="small"
                    color={
                      row.severity.startsWith("CRITICAL") ? "error" : "warning"
                    }
                    variant="filled"
                    sx={{ fontSize: "0.7rem" }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                  {row.note}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
