import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface BarTrendChartProps<T extends Record<string, string | number>> {
  data: T[];
  xKey: keyof T;
  yKey: keyof T;
  color?: string;
}

export const BarTrendChart = <T extends Record<string, string | number>>({
  data,
  xKey,
  yKey,
  color = "#1F7A63"
}: BarTrendChartProps<T>) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
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
      <Bar dataKey={yKey as string} fill={color} radius={[6, 6, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);
