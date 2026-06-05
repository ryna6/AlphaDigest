import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { t: "9:30", v: 100 },
  { t: "10:30", v: 101.2 },
  { t: "11:30", v: 100.7 },
  { t: "12:30", v: 102.4 },
  { t: "13:30", v: 103.1 }
];

export function MiniChart() {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <Tooltip contentStyle={{ background: "#080B10", border: "1px solid #223041", borderRadius: 12 }} />
          <Line type="monotone" dataKey="v" stroke="#4F8CFF" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
