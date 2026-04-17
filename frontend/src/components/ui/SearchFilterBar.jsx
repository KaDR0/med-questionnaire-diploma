import { Card, CardContent } from "@mui/material";

function SearchFilterBar({ children }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>{children}</CardContent>
    </Card>
  );
}

export default SearchFilterBar;
