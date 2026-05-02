import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  Paper,
  IconButton,
} from "@mui/material";
import { 
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
} from "@mui/icons-material";
import type { Finding } from "../services/results.service";

interface AutoFixDialogProps {
  open: boolean;
  onClose: () => void;
  finding: Finding;
}

export default function AutoFixDialog({ open, onClose, finding }: AutoFixDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!finding.autofix) return null;

  const handleCopyPatch = async () => {
    if (finding.autofix?.patch) {
      await navigator.clipboard.writeText(finding.autofix.patch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyCommand = async () => {
    if (finding.autofix?.command) {
      await navigator.clipboard.writeText(finding.autofix.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const confidenceColor = {
    high: "success",
    medium: "warning", 
    low: "error"
  } as const;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { maxHeight: '80vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          ✨ Auto-fix Suggestion
          {finding.autofix.confidence && (
            <Chip 
              label={`${finding.autofix.confidence} confidence`}
              size="small"
              color={confidenceColor[finding.autofix.confidence]}
              variant="outlined"
            />
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {finding.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {finding.file}{finding.line ? `:${finding.line}` : ''}
          </Typography>
        </Box>

        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          icon={<CheckIcon />}
        >
          <Typography variant="body2">
            <strong>Suggested Fix:</strong> {finding.autofix.description}
          </Typography>
        </Alert>

        {finding.autofix.type === 'diff' && finding.autofix.patch && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">
                Diff Patch
              </Typography>
              <Button
                startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                variant="outlined"
                size="small"
                onClick={handleCopyPatch}
                color={copied ? "success" : "primary"}
              >
                {copied ? 'Copied!' : 'Copy Patch'}
              </Button>
            </Box>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                maxHeight: '300px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {finding.autofix.patch}
            </Paper>
          </Box>
        )}

        {finding.autofix.type === 'command' && finding.autofix.command && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">
                Command
              </Typography>
              <Button
                startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                variant="outlined"
                size="small"
                onClick={handleCopyCommand}
                color={copied ? "success" : "primary"}
              >
                {copied ? 'Copied!' : 'Copy Command'}
              </Button>
            </Box>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {finding.autofix.command}
            </Paper>
          </Box>
        )}

        {finding.autofix.confidence === 'medium' && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Review Required:</strong> This auto-fix suggestion should be reviewed before applying.
            </Typography>
          </Alert>
        )}

        {finding.autofix.confidence === 'low' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Caution:</strong> This auto-fix suggestion may not be accurate. Please review carefully.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}