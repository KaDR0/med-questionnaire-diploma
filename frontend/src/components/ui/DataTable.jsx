import { useMemo, useState } from "react";
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import { TableSkeleton } from "./LoadingSkeleton";
import EmptyState from "./EmptyState";

/**
 * Lightweight data table built on MUI Table — no extra dependency.
 *
 * Features:
 *  - Sticky head (set `stickyHeader` on parent if needed)
 *  - Single-column sort with accessor support
 *  - Row click handler (whole row becomes a button)
 *  - Loading + empty states via internal Skeleton / EmptyState
 *  - Density "comfortable" (default) | "compact"
 *
 * Columns shape:
 *   {
 *     id: string,
 *     label: string,
 *     accessor?: (row) => sortable scalar
 *     render?: (row) => ReactNode      // visual cell content (defaults to accessor's value)
 *     align?: "left" | "right" | "center"
 *     sortable?: boolean (default: !!accessor)
 *     width?: string | number
 *   }
 *
 * Caller is in charge of search/filter — this component only renders + sorts.
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  density = "comfortable",
  defaultSort = null, // { id, direction }
  onRowClick = null,
  empty = null,
  getRowKey = (row, index) => row?.id ?? index,
  ariaLabel,
  containerSx,
}) {
  const [sort, setSort] = useState(defaultSort);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col || !col.accessor) return rows;
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sort.direction === "asc" ? av - bv : bv - av;
      }
      const sa = String(av).toLocaleLowerCase();
      const sb = String(bv).toLocaleLowerCase();
      if (sa < sb) return sort.direction === "asc" ? -1 : 1;
      if (sa > sb) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
    return cloned;
  }, [columns, rows, sort]);

  const handleSortRequest = (colId) => {
    setSort((prev) => {
      if (!prev || prev.id !== colId) return { id: colId, direction: "asc" };
      if (prev.direction === "asc") return { id: colId, direction: "desc" };
      return null;
    });
  };

  if (loading) {
    return <TableSkeleton rows={6} columns={columns.length} />;
  }

  if (!rows.length) {
    return (
      <Card>
        {empty || <EmptyState title="—" />}
      </Card>
    );
  }

  const cellPadding = density === "compact" ? "8px 12px" : "14px 16px";

  return (
    <Card sx={{ overflow: "hidden" }}>
      <TableContainer sx={containerSx}>
        <Table aria-label={ariaLabel} size={density === "compact" ? "small" : "medium"}>
          <TableHead>
            <TableRow>
              {columns.map((col) => {
                const sortable = col.sortable ?? Boolean(col.accessor);
                const isSorted = sort && sort.id === col.id;
                return (
                  <TableCell
                    key={col.id}
                    align={col.align || "left"}
                    sortDirection={isSorted ? sort.direction : false}
                    sx={{
                      width: col.width,
                      padding: cellPadding,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sortable ? (
                      <TableSortLabel
                        active={Boolean(isSorted)}
                        direction={isSorted ? sort.direction : "asc"}
                        onClick={() => handleSortRequest(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.map((row, index) => {
              const clickable = Boolean(onRowClick);
              return (
                <TableRow
                  key={getRowKey(row, index)}
                  hover
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  tabIndex={clickable ? 0 : -1}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  sx={{
                    cursor: clickable ? "pointer" : "default",
                  }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      align={col.align || "left"}
                      sx={{
                        padding: cellPadding,
                        whiteSpace: col.wrap ? "normal" : "nowrap",
                        verticalAlign: "middle",
                      }}
                    >
                      {col.render ? col.render(row) : col.accessor ? col.accessor(row) : null}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Spacer so the Card border looks balanced when content ends right at table edge */}
      <Box sx={{ height: 0 }} />
    </Card>
  );
}
