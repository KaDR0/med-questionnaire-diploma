import { Chip } from "@mui/material";

const statusColorMap = {
  stable: "success",
  monitoring: "info",
  attention: "warning",
  critical: "error",
};

function StatusChip({ label, status, size = "small" }) {
  return (
    <Chip
      label={label}
      color={statusColorMap[status] || "default"}
      variant="outlined"
      size={size}
      sx={{ borderRadius: 2, fontWeight: 600, borderWidth: 1.25 }}
    />
  );
}

export default StatusChip;
