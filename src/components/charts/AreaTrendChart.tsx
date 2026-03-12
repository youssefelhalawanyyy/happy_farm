import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface AreaTrendChartProps<T extends Record<string, string | number>> {
  data: T[];
  xKey: keyof T;
  yKey: keyof T;
  color?: string;
}

export const AreaTrendChart = <T extends Record<string, string | number>>({
  data,
  xKey,
  yKey,
  color = "#1F7A63"
}: AreaTrendChartProps<T>) => (
  <ResponsiveContainer width="100%" height={280}>
    <AreaChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.45} />
          <stop offset="95%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
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
      <Area type="monotone" dataKey={yKey as string} stroke={color} fillOpacity={1} fill="url(#areaGradient)" />
    </AreaChart>
  </ResponsiveContainer>
);
