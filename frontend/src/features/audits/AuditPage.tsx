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
} from "@mui/material";
import {
  Terminal as TerminalIcon,
  SmartToy as SmartToyIcon,
  GitHub as GitHubIcon,
} from "@mui/icons-material";

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
    </Box>
  );
}
