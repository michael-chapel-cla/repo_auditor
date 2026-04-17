import { Chip } from "@mui/material";
import { severityColors, severityTextColors } from "../theme.ts";

interface Props {
  severity: string;
}

export default function SeverityChip({ severity }: Props) {
  const bg = severityColors[severity] ?? severityColors["info"];
  const fg = severityTextColors[severity] ?? severityTextColors["info"];
  return (
    <Chip
      label={severity.toUpperCase()}
      size="small"
      sx={{
        backgroundColor: bg,
        color: fg,
        fontWeight: "bold",
        fontSize: "0.7rem",
        borderRadius: 1,
      }}
    />
  );
}
