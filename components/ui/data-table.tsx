import type { TableColumn, TableRow } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export function DataTable({ columns, rows }: { columns: TableColumn[]; rows: TableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 bg-panel">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn("border-b border-border pb-2 text-left font-medium text-mutedText", column.align === "right" && "text-right", column.align === "center" && "text-center")}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-panelHover">
              {columns.map((column) => (
                <td key={column.key} className={cn("border-b border-border/40 py-2 text-secondaryText", column.align === "right" && "text-right font-mono", column.align === "center" && "text-center")}>
                  {row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
