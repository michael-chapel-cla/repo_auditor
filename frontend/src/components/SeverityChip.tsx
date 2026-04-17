import { Chip } from "@mui/material";
import { severityColors } from "../theme.ts";

interface Props {
  severity: string;
}

export default function SeverityChip({ severity }: Props) {
  return (
    <Chip
      label={severity.toUpperCase()}
      size="small"
      sx={{
        backgroundColor: severityColors[severity] ?? severityColors["info"],
        color: "white",
        fontWeight: "bold",
        fontSize: "0.7rem",
      }}
    />
  );
}
