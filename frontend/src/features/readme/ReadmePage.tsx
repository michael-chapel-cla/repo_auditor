import { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Alert } from "@mui/material";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MONO = '"Fira Mono", "Cascadia Code", "Consolas", "Menlo", monospace';

export default function ReadmePage() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<string>("/api/readme", { responseType: "text" })
      .then((res) => setContent(res.data))
      .catch(() => setError("Failed to load README.md"));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;

  if (content === null) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Copilot Quickstart
      </Typography>
      <Box
        sx={{
          fontFamily: MONO,
          fontSize: "0.85rem",
          lineHeight: 1.7,
          backgroundColor: "grey.100",
          border: "1px solid",
          borderColor: "grey.300",
          borderRadius: 2,
          p: 3,
          "& h1, & h2, & h3, & h4, & h5, & h6": {
            fontFamily: MONO,
            fontWeight: "bold",
            mt: 2,
            mb: 0.5,
          },
          "& h1": { fontSize: "1.4rem" },
          "& h2": { fontSize: "1.2rem" },
          "& h3": { fontSize: "1.05rem" },
          "& p": { my: 0.75 },
          "& a": { color: "primary.main" },
          "& code": {
            fontFamily: MONO,
            backgroundColor: "grey.300",
            px: "4px",
            borderRadius: "3px",
            fontSize: "0.82rem",
          },
          "& pre": {
            fontFamily: MONO,
            backgroundColor: "grey.200",
            border: "1px solid",
            borderColor: "grey.300",
            borderRadius: 1,
            p: 1.5,
            overflowX: "auto",
            "& code": { backgroundColor: "transparent", px: 0 },
          },
          "& table": {
            borderCollapse: "collapse",
            width: "100%",
            mb: 1,
          },
          "& th, & td": {
            border: "1px solid",
            borderColor: "grey.400",
            px: 1.5,
            py: 0.5,
            textAlign: "left",
          },
          "& th": { backgroundColor: "grey.200", fontWeight: "bold" },
          "& blockquote": {
            borderLeft: "3px solid",
            borderColor: "grey.400",
            pl: 2,
            ml: 0,
            color: "text.secondary",
          },
          "& ul, & ol": { pl: 3, my: 0.5 },
          "& hr": {
            border: "none",
            borderTop: "1px solid",
            borderColor: "grey.400",
            my: 2,
          },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </Box>
    </Box>
  );
}
