import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface LineTrendChartProps<T extends Record<string, string | number>> {
  data: T[];
  xKey: keyof T;
  yKey: keyof T;
  color?: string;
}

export const LineTrendChart = <T extends Record<string, string | number>>({
  data,
  xKey,
  yKey,
  color = "#1F7A63"
}: LineTrendChartProps<T>) => (
  <ResponsiveContainer width="100%" height={280}>
    <LineChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
      <XAxis dataKey={xKey as string} stroke="#64748b" tick={{ fontSize: 12 }} />
      <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
      <Tooltip
        contentStyle={{
          backgroundColor: "#ffffff",
          border: "1px solid rgba(226, 232, 240, 0.95)",
          borderRadius: 12,
          fontSize: 12,
          color: "#1e293b",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)"
        }}
      />
      <Line type="monotone" dataKey={yKey as string} stroke={color} strokeWidth={2.6} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);
