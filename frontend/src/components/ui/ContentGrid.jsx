import { Grid } from "@mui/material";

function ContentGrid({ left, right, leftWidth = 4, rightWidth = 8 }) {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={leftWidth}>
        {left}
      </Grid>
      <Grid item xs={12} lg={rightWidth}>
        {right}
      </Grid>
    </Grid>
  );
}

export default ContentGrid;
