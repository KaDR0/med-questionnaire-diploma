import { Stack } from "@mui/material";

function ActionBar({ children }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      useFlexGap
      sx={{
        width: "100%",
        flexWrap: "wrap",
        justifyContent: { sm: "flex-end" },
        alignItems: { xs: "stretch", sm: "center" },
      }}
    >
      {children}
    </Stack>
  );
}

export default ActionBar;
