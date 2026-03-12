import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchColumn?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

export const DataTable = <TData,>({
  columns,
  data,
  searchColumn,
  searchPlaceholder = "Search...",
  emptyText = "No records found.",
  className
}: DataTableProps<TData>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters: filters
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  });

  const searchValue = useMemo(() => {
    if (!searchColumn) {
      return "";
    }
    return (table.getColumn(searchColumn)?.getFilterValue() as string) ?? "";
  }, [searchColumn, table]);

  return (
    <div className={cn("space-y-3", className)}>
      {searchColumn ? (
        <div className="max-w-sm">
          <Input
            value={searchValue}
            onChange={(event) => table.getColumn(searchColumn)?.setFilterValue(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border/75 bg-card/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border/70 bg-gradient-to-r from-muted/45 via-muted/30 to-muted/20">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-border/80 transition-colors hover:bg-muted/35">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
