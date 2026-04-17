import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

const MONO =
  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Courier New', monospace";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#212121",
    },
    secondary: {
      main: "#616161",
    },
    error: {
      main: "#424242",
    },
    warning: {
      main: "#616161",
    },
    info: {
      main: "#9e9e9e",
    },
    success: {
      main: "#212121",
    },
    background: {
      default: "#fafafa",
      paper: "#ffffff",
    },
    text: {
      primary: "#111111",
      secondary: "#757575",
    },
    divider: "#e0e0e0",
  },
  typography: {
    fontFamily: MONO,
    fontSize: 11,
    h1: { fontFamily: MONO, fontSize: "1.6rem" },
    h2: { fontFamily: MONO, fontSize: "1.4rem" },
    h3: { fontFamily: MONO, fontSize: "1.2rem" },
    h4: { fontFamily: MONO, fontSize: "1.1rem" },
    h5: { fontFamily: MONO, fontSize: "1rem" },
    h6: { fontFamily: MONO, fontSize: "0.875rem" },
    subtitle1: { fontFamily: MONO, fontSize: "0.8rem" },
    subtitle2: { fontFamily: MONO, fontSize: "0.75rem" },
    body1: { fontFamily: MONO, fontSize: "0.8rem" },
    body2: { fontFamily: MONO, fontSize: "0.75rem" },
    caption: { fontFamily: MONO, fontSize: "0.68rem" },
    overline: { fontFamily: MONO, fontSize: "0.65rem" },
    button: { fontFamily: MONO, fontSize: "0.75rem" },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          boxShadow: "none",
          border: "1px solid #e0e0e0",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e0e0e0",
          boxShadow: "none",
          color: "#111111",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e0e0e0",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { fontFamily: MONO, borderRadius: 2 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: MONO, borderRadius: 2 },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontFamily: MONO },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontFamily: MONO,
          borderColor: "#e0e0e0",
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          fontFamily: MONO,
          border: "1px solid #e0e0e0",
          borderRadius: 2,
        },
        columnHeaders: { borderBottom: "1px solid #e0e0e0" },
        row: {
          "&:hover": { backgroundColor: "#f5f5f5" },
        },
        cell: { borderColor: "#e0e0e0" },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontFamily: MONO, borderRadius: 2 },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: { fontFamily: MONO },
        secondary: { fontFamily: MONO },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontFamily: MONO },
      },
    },
  },
});

// Severity colours for chips and charts
export const severityColors: Record<string, string> = {
  critical: "#c62828",
  high: "#e65100",
  medium: "#f9a825",
  moderate: "#f9a825",
  low: "#1565c0",
  info: "#757575",
  clean: "#2e7d32",
};

// Text colour to pair with severityColors backgrounds
export const severityTextColors: Record<string, string> = {
  critical: "#ffffff",
  high: "#ffffff",
  medium: "#111111",
  moderate: "#111111",
  low: "#ffffff",
  info: "#ffffff",
  clean: "#ffffff",
};
