import { cn } from "@/lib/utils/cn";

export type Column<T> = { key: keyof T; header: string; align?: "left" | "right" };

export function DataTable<T extends Record<string, string | number>>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-sidebar text-mutedText">
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className={cn("px-3 py-2 font-medium", column.align === "right" ? "text-right" : "text-left")}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border/70 hover:bg-panelHover">
              {columns.map((column) => (
                <td key={String(column.key)} className={cn("px-3 py-2 text-secondaryText tabular-nums", column.align === "right" ? "text-right" : "text-left")}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
