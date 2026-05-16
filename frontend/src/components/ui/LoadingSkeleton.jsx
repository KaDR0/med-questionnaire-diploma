import { Box, Card, CardContent, Grid, Skeleton, Stack } from "@mui/material";

/**
 * Reusable loading placeholders. Each variant matches the visual rhythm of the page it
 * stands in for, so the layout doesn't jump when content arrives.
 *
 * Variants:
 *  - "dashboard": KPI strip (4 cards) + 2-column body skeleton
 *  - "table":     header + rows. Pass `rows` and `columns` to tune.
 *  - "card":      a single card body skeleton with paragraph lines
 *  - "list":      vertical list of avatar + lines
 */

export function DashboardSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width={220} height={36} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={320} height={20} sx={{ mb: 2.5 }} />
      <Grid container spacing={2.25} sx={{ mb: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" height={14} />
                <Skeleton variant="text" width="40%" height={36} sx={{ mt: 1 }} />
                <Skeleton variant="text" width="50%" height={14} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2.25}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="40%" height={26} />
              <Skeleton variant="text" width="70%" height={16} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={220} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="55%" height={26} sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                {[0, 1, 2, 3].map((i) => (
                  <Box key={i}>
                    <Skeleton variant="text" width="85%" height={16} />
                    <Skeleton variant="text" width="40%" height={12} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
  const widths = ["18%", "26%", "12%", "16%", "16%", "12%"];
  return (
    <Card>
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            px: 2.5,
            py: 1.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              variant="text"
              height={14}
              width={widths[i % widths.length]}
              sx={{ flex: i === 1 ? 2 : 1 }}
            />
          ))}
        </Box>
        {Array.from({ length: rows }).map((_, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              gap: 2,
              px: 2.5,
              py: 2,
              borderBottom: i < rows - 1 ? "1px solid" : 0,
              borderColor: "divider",
              alignItems: "center",
            }}
          >
            {Array.from({ length: columns }).map((__, j) => (
              <Skeleton
                key={j}
                variant="text"
                height={18}
                width={widths[j % widths.length]}
                sx={{ flex: j === 1 ? 2 : 1 }}
              />
            ))}
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export function CardSkeleton({ lines = 4 }) {
  return (
    <Card>
      <CardContent>
        <Skeleton variant="text" width="40%" height={26} />
        <Skeleton variant="text" width="65%" height={16} sx={{ mb: 2 }} />
        <Stack spacing={0.75}>
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} variant="text" width={`${80 - i * 10}%`} height={14} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <Stack spacing={1.25}>
      {Array.from({ length: rows }).map((_, i) => (
        <Stack key={i} direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="circular" width={36} height={36} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="65%" height={14} />
            <Skeleton variant="text" width="35%" height={12} />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
