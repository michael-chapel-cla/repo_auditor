import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Box, Typography, Button } from "@mui/material";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to structured logger in production
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h5" gutterBottom>Something went wrong</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            An unexpected error occurred. Please refresh the page.
          </Typography>
          <Button variant="contained" onClick={() => this.setState({ hasError: false })}>
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
