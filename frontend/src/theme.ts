import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#1a237e",
    },
    secondary: {
      main: "#0288d1",
    },
    error: {
      main: "#d32f2f",
    },
    warning: {
      main: "#f57c00",
    },
    background: {
      default: "#f5f5f5",
    },
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        },
      },
    },
  },
});

export const severityColors: Record<string, string> = {
  critical: "#d32f2f",
  high: "#f57c00",
  medium: "#f9a825",
  low: "#1976d2",
  info: "#757575",
  clean: "#388e3c",
};
