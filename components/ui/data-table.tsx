export function DataTable({ rows, empty = "No rows available." }: { rows: Array<Record<string, string>>; empty?: string }) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  if (!rows.length) return <p className="rounded-xl border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">{empty}</p>;
  return (
    <div className="scrollbar-thin overflow-auto rounded-xl border border-borderStrong">
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-sidebar text-textMuted">
          <tr>{columns.map((column) => <th key={column} className="border-b border-borderStrong px-3 py-2 font-medium">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <tr key={index} className="hover:bg-panelHover/60">{columns.map((column) => <td key={column} className="border-b border-borderStrong/50 px-3 py-2 tabular text-textSecondary last:border-b-0">{row[column]}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
