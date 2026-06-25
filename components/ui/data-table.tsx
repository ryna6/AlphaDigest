import { cn } from "@/lib/utils/cn";

function signedValueClass(value: string) {
  const trimmed = value.trim();
  if (/^-|\s-|\(-/.test(trimmed)) return "text-negative";
  if (/^\+|\s\+/.test(trimmed)) return "text-positive";
  return "text-textSecondary";
}

export function DataTable({
  rows,
  empty = "No rows available.",
  size = "default"
}: {
  rows: Array<Record<string, string>>;
  empty?: string;
  size?: "default" | "comfortable";
}) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  if (!rows.length)
    return (
      <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
        {empty}
      </p>
    );
  return (
    <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
      <table
        className={cn(
          "w-full min-w-[560px] border-collapse text-left",
          size === "comfortable" ? "text-[13px]" : "text-xs"
        )}
      >
        <thead className="sticky top-0 bg-sidebar text-textMuted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-borderStrong px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-panelHover/60">
              {columns.map((column) => (
                <td
                  key={column}
                  className={cn(
                    "border-b border-borderStrong/50 px-3 tabular last:border-b-0",
                    "py-2",
                    signedValueClass(row[column])
                  )}
                >
                  {row[column]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
