import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { enablePushNotifications, listenForegroundMessages } from "@/services/notificationService";
import { COLLECTIONS } from "@/lib/constants";
import { calculateExpectedProfit, getBatchAgeInDays } from "@/lib/calculations";
import type {
  Batch,
  EnvironmentReading,
  ExpenseRecord,
  FeedRecord,
  GrowthRecord,
  LivestockAdjustmentRecord,
  MarketPriceSnapshot,
  MortalityRecord,
  SaleRecord
} from "@/types";

const C = {
  primary: "#1F7A63",
  accent: "#F4B942",
  card: "#FFFFFF",
  border: "#E2E8F0",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  text: "#1E293B",
  muted: "#64748B",
  subtle: "#94A3B8"
};

type SeriesPoint = { d: string; w: number };
type BatchView = { id: string; house: string; count: number; age: number; health: number };

type MetricItem = {
  label: string;
  value: string;
  sub?: string;
  emoji: string;
  accent: string;
  trend?: number;
  delay: number;
};

const WALK_CSS = `
@keyframes walkX { from{left:-60px} to{left:calc(100% + 60px)} }
@keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(31,122,99,.45)} 60%{box-shadow:0 0 0 9px rgba(31,122,99,0)} }
.ck1{position:absolute;bottom:4px;animation:walkX 20s linear infinite,bob .45s ease-in-out infinite}
.ck2{position:absolute;bottom:4px;animation:walkX 28s linear 8s infinite,bob .45s ease-in-out .2s infinite}
.ck3{position:absolute;bottom:4px;animation:walkX 35s linear 15s infinite,bob .45s ease-in-out .1s infinite}
.pulse-dot{animation:pulse 2s ease infinite}
.row-h:hover{background:#F8FAFC}
.mcard:hover{transform:translateY(-2px)!important;box-shadow:0 8px 28px rgba(31,122,99,.13)!important}
`;

const n = (value: number): string => Number(value).toLocaleString();
const egp = (value: number): string =>
  new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0
  }).format(value);

const shortDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const shortWeekday = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", { weekday: "short" });
};

const safeDivide = (numerator: number, denominator: number): number => (denominator > 0 ? numerator / denominator : 0);

const getSeriesTrend = (series: SeriesPoint[]): number | undefined => {
  if (series.length < 2) {
    return undefined;
  }
  const prev = series[series.length - 2].w;
  const current = series[series.length - 1].w;
  if (prev === 0) {
    return undefined;
  }
  return Number((((current - prev) / prev) * 100).toFixed(1));
};

const resolveMarketSourceUrl = (row?: MarketPriceSnapshot): string | null => {
  if (!row) {
    return null;
  }
  if (row.sourceUrl && /^https?:\/\//i.test(row.sourceUrl)) {
    return row.sourceUrl;
  }
  if (/^https?:\/\//i.test(row.source)) {
    return row.source;
  }
  return null;
};

const useCount = (target: number, duration: number, go: boolean) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!go) {
      return;
    }

    const t0 = Date.now();
    const id = window.setInterval(() => {
      const progress = Math.min((Date.now() - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress >= 1) {
        window.clearInterval(id);
      }
    }, 16);

    return () => window.clearInterval(id);
  }, [target, duration, go]);

  return value;
};

interface LineProps {
  data: SeriesPoint[];
  color: string;
  area?: boolean;
  h?: number;
}

const Line = ({ data, color, area = false, h = 72 }: LineProps) => {
  if (data.length === 0) {
    return null;
  }

  const vals = data.map((entry) => entry.w);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const width = 280;

  const points = data.map((entry, index) => {
    const ratio = data.length === 1 ? 0 : index / (data.length - 1);
    return {
      x: 8 + ratio * (width - 16),
      y: h - 8 - ((entry.w - lo) / span) * (h - 20)
    };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const fillPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;
  const gradientId = `lg-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${h}`} style={{ width: "100%", height: h, display: "block" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {area ? <path d={fillPath} fill={`url(#${gradientId})`} /> : null}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={color} stroke="#fff" strokeWidth="2" />
    </svg>
  );
};

interface BarsProps {
  data: SeriesPoint[];
  color: string;
  h?: number;
}

const Bars = ({ data, color, h = 72 }: BarsProps) => {
  if (data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map((entry) => entry.w), 1);
  const width = 280;
  const barWidth = 24;
  const gap = (width - 16) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${h}`} style={{ width: "100%", height: h, display: "block" }}>
      {data.map((entry, index) => {
        const barHeight = safeDivide(entry.w, maxValue) * (h - 12);
        const x = 8 + index * gap + (gap - barWidth) / 2;
        return (
          <rect
            key={`${entry.d}-${index}`}
            x={x}
            y={h - barHeight}
            width={barWidth}
            height={barHeight}
            rx="4"
            fill={color}
            opacity={index === data.length - 1 ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
};

interface GaugeProps {
  val?: number;
  lo?: number;
  hi?: number;
}

const Gauge = ({ val, lo = 18, hi = 35 }: GaugeProps) => {
  if (typeof val !== "number") {
    return (
      <div
        style={{
          width: 140,
          margin: "0 auto",
          height: 72,
          display: "grid",
          placeItems: "center",
          borderRadius: 10,
          background: "#F8FAFC",
          color: C.subtle,
          fontSize: 12,
          fontWeight: 600
        }}
      >
        No temperature data
      </div>
    );
  }

  const pct = Math.min(Math.max(safeDivide(val - lo, hi - lo), 0), 1);
  const ang = -135 + pct * 270;
  const r = 38;
  const cx = 52;
  const cy = 54;

  const arc = (a1: number, a2: number): string => {
    const toRadians = (degree: number): number => (degree * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRadians(a1));
    const y1 = cy + r * Math.sin(toRadians(a1));
    const x2 = cx + r * Math.cos(toRadians(a2));
    const y2 = cy + r * Math.sin(toRadians(a2));
    const largeArc = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}`;
  };

  const needle = {
    x: cx + 30 * Math.cos(((ang - 90) * Math.PI) / 180),
    y: cy + 30 * Math.sin(((ang - 90) * Math.PI) / 180)
  };

  const color = val < 22 ? C.info : val < 28 ? C.success : val < 32 ? C.warning : C.error;

  return (
    <svg viewBox="0 0 104 72" style={{ width: 140, display: "block", margin: "0 auto" }}>
      <path d={arc(-135, 135)} fill="none" stroke="#F1F5F9" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(-135, -135 + pct * 270)} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill={color} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize="12" fontWeight="800" fill={C.text} fontFamily="Georgia,serif">
        {val.toFixed(1)}°C
      </text>
    </svg>
  );
};

const HBar = ({ value }: { value: number }) => {
  const color = value >= 98 ? C.success : value >= 95 ? C.warning : C.error;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, background: "#F1F5F9", borderRadius: 4, height: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 4, transition: "width 1.2s ease" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 28 }}>{value}%</span>
    </div>
  );
};

const CardShell = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      background: C.card,
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 12px rgba(0,0,0,0.04)",
      overflow: "hidden",
      ...style
    }}
  >
    {children}
  </div>
);

const ChartCard = ({ title, sub, children }: { title: string; sub: string; children: ReactNode }) => (
  <CardShell>
    <div style={{ padding: "16px 18px 8px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "Georgia,serif" }}>{title}</div>
      <div style={{ fontSize: 11, color: C.subtle, marginTop: 2 }}>{sub}</div>
    </div>
    <div style={{ padding: "0 10px 14px" }}>{children}</div>
  </CardShell>
);

const MCard = ({ label, value, sub, emoji, accent, trend, delay, show }: MetricItem & { show: boolean }) => (
  <div
    style={{
      background: C.card,
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 12px rgba(0,0,0,0.04)",
      padding: "18px 20px",
      position: "relative",
      overflow: "hidden",
      opacity: show ? 1 : 0,
      transform: show ? "translateY(0)" : "translateY(18px)",
      transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`
    }}
    className="mcard"
  >
    <div
      style={{
        position: "absolute",
        top: -16,
        right: -16,
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: `${accent}14`
      }}
    />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.subtle,
          textTransform: "uppercase",
          letterSpacing: "0.07em"
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 900, color: C.text, fontFamily: "Georgia,serif", lineHeight: 1 }}>{value}</div>
    {sub ? <div style={{ fontSize: 11, color: C.subtle, marginTop: 5 }}>{sub}</div> : null}
    {typeof trend === "number" ? (
      <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: trend >= 0 ? C.success : C.error,
            background: `${trend >= 0 ? C.success : C.error}18`,
            padding: "2px 6px",
            borderRadius: 4
          }}
        >
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
        </span>
        <span style={{ fontSize: 10, color: "#CBD5E1" }}>vs last week</span>
      </div>
    ) : null}
  </div>
);

const Chick = ({ size = 28, color = "#F4B942" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <ellipse cx="20" cy="28" rx="12" ry="9" fill={color} />
    <circle cx="20" cy="15" r="7" fill={color} />
    <polygon points="20,9 17,4 23,4" fill="#EF4444" />
    <circle cx="17.5" cy="13.5" r="1.5" fill="#1E293B" />
    <ellipse cx="14" cy="35" rx="4" ry="2.2" fill="#F59E0B" transform="rotate(-15 14 35)" />
    <ellipse cx="26" cy="35" rx="4" ry="2.2" fill="#F59E0B" transform="rotate(15 26 35)" />
  </svg>
);

export const DashboardPage = () => {
  const { user } = useAuth();

  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: feed } = useRealtimeCollection<FeedRecord>(COLLECTIONS.feedRecords);
  const { data: growth } = useRealtimeCollection<GrowthRecord>(COLLECTIONS.growthRecords);
  const { data: mortality } = useRealtimeCollection<MortalityRecord>(COLLECTIONS.mortalityRecords);
  const { data: market } = useRealtimeCollection<MarketPriceSnapshot>(COLLECTIONS.marketPrices);
  const { data: readings } = useRealtimeCollection<EnvironmentReading>(COLLECTIONS.environmentReadings);
  const { data: sales } = useRealtimeCollection<SaleRecord>(COLLECTIONS.sales);
  const { data: expenses } = useRealtimeCollection<ExpenseRecord>(COLLECTIONS.expenses);
  const { data: livestockAdjustments } = useRealtimeCollection<LivestockAdjustmentRecord>(COLLECTIONS.livestockAdjustments);

  const [show, setShow] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    void enablePushNotifications(user.uid);

    let cleanup: (() => void) | null = null;
    void (async () => {
      cleanup = await listenForegroundMessages((payload) => {
        toast.message(payload.title ?? "Notification", {
          description: payload.body
        });
      });
    })();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [user]);

  const latestMarket = useMemo(
    () => [...market].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0],
    [market]
  );
  const latestMarketSourceUrl = useMemo(() => resolveMarketSourceUrl(latestMarket), [latestMarket]);

  const latestReading = useMemo(
    () => [...readings].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0],
    [readings]
  );

  const activeBatches = useMemo(() => batches.filter((batch) => batch.status === "active"), [batches]);

  const deadByBatchRef = useMemo(() => {
    const deadMap = new Map<string, number>();

    for (const row of mortality) {
      const key = row.batchId ?? "";
      if (!key) {
        continue;
      }
      deadMap.set(key, (deadMap.get(key) ?? 0) + Math.max(row.birds, 0));
    }

    for (const row of livestockAdjustments) {
      if (row.reason !== "dead_loss") {
        continue;
      }
      const key = row.batchId ?? "";
      if (!key) {
        continue;
      }
      deadMap.set(key, (deadMap.get(key) ?? 0) + Math.max(row.quantity, 0));
    }

    return deadMap;
  }, [livestockAdjustments, mortality]);

  const totalChickens = useMemo(
    () =>
      activeBatches.reduce((sum, batch) => {
        const deadById = batch.id ? deadByBatchRef.get(batch.id) ?? 0 : 0;
        const deadByCode = deadByBatchRef.get(batch.batchId) ?? 0;
        const loggedDead = Math.max(deadById, deadByCode);
        const knownDead = Math.max(batch.mortalityCount, loggedDead);
        const inferredAlive = Math.max(batch.initialChickCount - knownDead, 0);

        // Keep the lower alive value to avoid showing flock numbers before dead/loss is reflected on batch counters.
        const correctedAlive = Math.max(Math.min(batch.currentAliveCount, inferredAlive), 0);
        return sum + correctedAlive;
      }, 0),
    [activeBatches, deadByBatchRef]
  );

  const mortalityToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return mortality.filter((row) => row.recordDate === today).reduce((sum, row) => sum + row.birds, 0);
  }, [mortality]);

  const feedInventoryKg = useMemo(
    () => feed.reduce((sum, row) => sum + row.quantityKg, 0),
    [feed]
  );

  const estimatedProfit = useMemo(
    () =>
      activeBatches.reduce((sum, batch) => {
        const expected = calculateExpectedProfit(batch, latestMarket?.liveBroilerPricePerKg ?? 0, feed, expenses, growth);
        return sum + expected;
      }, 0),
    [activeBatches, latestMarket?.liveBroilerPricePerKg, feed, expenses, growth]
  );

  const totalRevenue = useMemo(() => sales.reduce((sum, sale) => sum + sale.totalRevenue, 0), [sales]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);

  const growthSeries = useMemo<SeriesPoint[]>(() => {
    const grouped = growth.reduce<Record<string, { sum: number; count: number }>>((acc, row) => {
      acc[row.recordDate] = acc[row.recordDate] ?? { sum: 0, count: 0 };
      acc[row.recordDate].sum += row.averageWeightKg;
      acc[row.recordDate].count += 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, payload]) => ({
        d: shortDate(date),
        w: Number((payload.sum / payload.count).toFixed(2))
      }));
  }, [growth]);

  const mortalitySeries = useMemo<SeriesPoint[]>(() => {
    const grouped = mortality.reduce<Record<string, number>>((acc, row) => {
      acc[row.recordDate] = (acc[row.recordDate] ?? 0) + row.birds;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, value]) => ({ d: shortWeekday(date), w: value }));
  }, [mortality]);

  const feedSeries = useMemo<SeriesPoint[]>(() => {
    const grouped = feed.reduce<Record<string, number>>((acc, row) => {
      acc[row.recordDate] = (acc[row.recordDate] ?? 0) + row.quantityKg;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, value]) => ({ d: shortWeekday(date), w: value }));
  }, [feed]);

  const marketSeries = useMemo<SeriesPoint[]>(() => {
    return [...market]
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
      .slice(-7)
      .map((row) => ({
        d: shortDate(row.capturedAt),
        w: row.liveBroilerPricePerKg
      }));
  }, [market]);

  const batchRows = useMemo<BatchView[]>(() => {
    return activeBatches.slice(0, 5).map((batch) => {
      const mortalityRatio = safeDivide(batch.mortalityCount, Math.max(batch.initialChickCount, 1)) * 100;
      const health = Math.max(0, Math.min(100, Math.round(100 - mortalityRatio)));
      return {
        id: batch.batchId,
        house: batch.assignedHouse,
        count: batch.currentAliveCount,
        age: getBatchAgeInDays(batch.arrivalDate, batch.chickAgeAtArrivalDays ?? 0),
        health
      };
    });
  }, [activeBatches]);

  const flockHealth = useMemo(() => {
    if (batchRows.length === 0) {
      return 0;
    }
    const avg = safeDivide(batchRows.reduce((sum, row) => sum + row.health, 0), batchRows.length);
    return Number(avg.toFixed(1));
  }, [batchRows]);

  const nextHarvestDays = useMemo<number | null>(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const values = activeBatches
      .map((batch) => {
        const date = new Date(batch.expectedSellingDate).setHours(0, 0, 0, 0);
        if (Number.isNaN(date)) {
          return null;
        }
        return Math.max(Math.round((date - todayMs) / (1000 * 60 * 60 * 24)), 0);
      })
      .filter((value): value is number => typeof value === "number");

    if (values.length === 0) {
      return null;
    }

    return Math.min(...values);
  }, [activeBatches]);

  const avgDailyFeedUsage = useMemo(() => {
    if (feedSeries.length === 0) {
      return 0;
    }
    const total = feedSeries.reduce((sum, row) => sum + row.w, 0);
    return safeDivide(total, feedSeries.length);
  }, [feedSeries]);
  const feedCoverageDays = useMemo(() => {
    if (avgDailyFeedUsage <= 0) {
      return null;
    }
    return Math.round(feedInventoryKg / avgDailyFeedUsage);
  }, [avgDailyFeedUsage, feedInventoryKg]);

  const mortalityTrend = useMemo(() => getSeriesTrend(mortalitySeries), [mortalitySeries]);
  const feedTrend = useMemo(() => getSeriesTrend(feedSeries), [feedSeries]);
  const marketTrend = useMemo(() => getSeriesTrend(marketSeries), [marketSeries]);

  const flockTarget = Math.round(totalChickens);
  const profitTarget = Math.round(estimatedProfit);
  const revenueTarget = Math.round(totalRevenue);
  const expenseTarget = Math.round(totalExpenses);

  const flock = useCount(flockTarget, 1800, show);
  const profit = useCount(profitTarget, 2000, show);
  const revenue = useCount(revenueTarget, 1800, show);
  const expense = useCount(expenseTarget, 1800, show);

  const metrics = useMemo<MetricItem[]>(
    () => [
      {
        label: "Total Flock",
        value: n(flock),
        sub: `birds across ${activeBatches.length} houses`,
        emoji: "🐔",
        accent: C.primary,
        delay: 0
      },
      {
        label: "Active Batches",
        value: String(activeBatches.length),
        sub: "production cycles",
        emoji: "🏠",
        accent: C.accent,
        delay: 80
      },
      {
        label: "Mortality Today",
        value: n(mortalityToday),
        sub: "birds today",
        emoji: "📉",
        accent: C.error,
        trend: mortalityTrend,
        delay: 160
      },
      {
        label: "Feed Logged",
        value: `${n(Math.round(feedInventoryKg))} kg`,
        sub: "from feed records",
        emoji: "🌾",
        accent: "#8B5E3C",
        trend: feedTrend,
        delay: 240
      },
      {
        label: "Market Price",
        value: latestMarket ? `${latestMarket.liveBroilerPricePerKg.toFixed(2)} EGP/kg` : "No data",
        sub: "live broiler spot",
        emoji: "📊",
        accent: C.info,
        trend: marketTrend,
        delay: 320
      },
      {
        label: "Est. Profit",
        value: egp(profit),
        sub: "across active batches",
        emoji: "💰",
        accent: C.success,
        delay: 400
      }
    ],
    [
      flock,
      activeBatches.length,
      mortalityToday,
      mortalityTrend,
      feedInventoryKg,
      feedTrend,
      latestMarket,
      marketTrend,
      profit
    ]
  );

  return (
    <section className="space-y-5">
      <style>{WALK_CSS}</style>

      <div
        style={{
          background: `linear-gradient(135deg,${C.primary} 0%,#134f3c 100%)`,
          borderRadius: 20,
          padding: "26px 30px 56px",
          marginBottom: 22,
          position: "relative",
          overflow: "hidden",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(-16px)",
          transition: "opacity .6s ease,transform .6s ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "rgba(255,255,255,.05)",
            pointerEvents: "none"
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -50,
            right: 80,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(244,185,66,.1)",
            pointerEvents: "none"
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 14
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ animation: "bob .6s ease-in-out infinite", transformOrigin: "bottom" }}>
              <Chick size={44} color={C.accent} />
            </div>
            <div>
              <div style={{ fontSize: 21, fontWeight: 900, color: "#fff", fontFamily: "Georgia,serif" }}>
                Good {clock.getHours() < 12 ? "morning" : clock.getHours() < 18 ? "afternoon" : "evening"}, {user?.displayName?.split(" ")[0] ?? "Mazra3ty"} 👋
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", marginTop: 3 }}>
                {activeBatches.length} batches active · Market{" "}
                {latestMarket ? `${latestMarket.liveBroilerPricePerKg.toFixed(2)} EGP/kg` : "N/A"} · Next harvest in{" "}
                {nextHarvestDays === null ? "N/A" : `${nextHarvestDays} days`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { em: "💪", label: "Flock Health", value: batchRows.length ? `${flockHealth.toFixed(1)}%` : "N/A", color: C.success },
              { em: "🌾", label: "Feed Coverage", value: feedCoverageDays === null ? "N/A" : `${feedCoverageDays} Days`, color: C.accent },
              { em: "📅", label: "Harvest", value: nextHarvestDays === null ? "N/A" : `${nextHarvestDays} Days`, color: "#93C5FD" }
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(255,255,255,.1)",
                  backdropFilter: "blur(6px)",
                  borderRadius: 12,
                  padding: "11px 14px",
                  minWidth: 100,
                  border: "1px solid rgba(255,255,255,.14)"
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 3 }}>{item.em}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: item.color, fontFamily: "Georgia,serif" }}>{item.value}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, pointerEvents: "none", overflow: "hidden" }}>
          <div className="ck1">
            <Chick size={30} color={C.accent} />
          </div>
          <div className="ck2">
            <Chick size={22} color="#F59E0B" />
          </div>
          <div className="ck3">
            <Chick size={26} color="#FDE68A" />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", marginBottom: 22 }}>
        {metrics.map((item) => (
          <MCard key={item.label} {...item} show={show} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
        <ChartCard title="🐥 Weight Growth" sub="Avg flock weight by day (kg)">
          {growthSeries.length > 0 ? (
            <>
              <Line data={growthSeries} color={C.primary} area />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
                {growthSeries.map((entry, index) => (
                  <span key={`${entry.d}-${index}`} style={{ fontSize: 9, color: "#CBD5E1" }}>
                    {entry.d}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: "16px 10px", fontSize: 12, color: C.subtle }}>No growth records yet.</div>
          )}
        </ChartCard>

        <ChartCard title="📉 Mortality Trend" sub="Daily bird losses this week">
          {mortalitySeries.length > 0 ? (
            <>
              <Bars data={mortalitySeries} color={C.error} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
                {mortalitySeries.map((entry, index) => (
                  <span key={`${entry.d}-${index}`} style={{ fontSize: 9, color: "#CBD5E1" }}>
                    {entry.d}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: "16px 10px", fontSize: 12, color: C.subtle }}>No mortality records yet.</div>
          )}
        </ChartCard>

        <ChartCard title="🌾 Feed Consumption" sub="Daily feed usage (kg)">
          {feedSeries.length > 0 ? (
            <>
              <Line data={feedSeries} color="#8B5E3C" area />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
                {feedSeries.map((entry, index) => (
                  <span key={`${entry.d}-${index}`} style={{ fontSize: 9, color: "#CBD5E1" }}>
                    {entry.d}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: "16px 10px", fontSize: 12, color: C.subtle }}>No feed records yet.</div>
          )}
        </ChartCard>

        <ChartCard title="📈 Market Price" sub="Live broiler spot price (EGP/kg)">
          {marketSeries.length > 0 ? (
            <>
              <Line data={marketSeries} color={C.info} area />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
                {marketSeries.map((entry, index) => (
                  <span key={`${entry.d}-${index}`} style={{ fontSize: 9, color: "#CBD5E1" }}>
                    {entry.d}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: "16px 10px", fontSize: 12, color: C.subtle }}>No market snapshots yet.</div>
          )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              padding: "2px 4px 0",
              fontSize: 11,
              color: C.subtle
            }}
          >
            <span>Source:</span>
            <span style={{ fontWeight: 700, color: C.muted }}>{latestMarket?.source ?? "No source data"}</span>
            {latestMarketSourceUrl ? (
              <a
                href={latestMarketSourceUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: C.info, textDecoration: "none", fontWeight: 600 }}
              >
                Open source link ↗
              </a>
            ) : (
              <span>No source URL</span>
            )}
          </div>
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <CardShell>
          <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "Georgia,serif" }}>🏠 Active Batches</div>
              <div style={{ fontSize: 11, color: C.subtle, marginTop: 1 }}>Live status per poultry house</div>
            </div>
            <div style={{ background: `${C.primary}18`, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: C.primary }}>
              {batchRows.length} Active
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: "#FAFBFC" }}>
                {["Batch", "House", "Birds", "Age", "Health", "Status"].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: "9px 16px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.subtle,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em"
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batchRows.map((row, index) => (
                <tr
                  key={row.id}
                  className="row-h"
                  style={{
                    borderBottom: index < batchRows.length - 1 ? `1px solid ${C.border}` : "none",
                    transition: "background .15s"
                  }}
                >
                  <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 700, color: C.text }}>{row.id}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: C.muted }}>{row.house}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
                    {n(row.count)}
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: C.muted }}>Day {row.age}</td>
                  <td style={{ padding: "11px 16px", minWidth: 110 }}>
                    <HBar value={row.health} />
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.success, boxShadow: `0 0 5px ${C.success}` }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.success }}>Active</span>
                    </div>
                  </td>
                </tr>
              ))}
              {batchRows.length === 0 ? (
                <tr>
                  <td style={{ padding: "14px 16px", fontSize: 12, color: C.subtle }} colSpan={6}>
                    No active batches found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardShell>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardShell style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "Georgia,serif", marginBottom: 14 }}>
              💰 Financial Pulse
            </div>
            {[
              { label: "Total Revenue", value: egp(revenue), color: C.success, bg: "#F0FDF4" },
              { label: "Total Expenses", value: egp(expense), color: C.error, bg: "#FEF2F2" },
              { label: "Net Income", value: egp(revenue - expense), color: C.primary, bg: "#F0FDF9" }
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: item.bg,
                  borderRadius: 10,
                  padding: "11px 13px",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: item.color, fontFamily: "Georgia,serif" }}>{item.value}</span>
              </div>
            ))}
          </CardShell>

          <CardShell style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "Georgia,serif", marginBottom: 6 }}>
              🌡️ Environment
            </div>
            <Gauge val={latestReading?.temperatureC} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {[
                { em: "💧", label: "Humidity", value: typeof latestReading?.humidity === "number" ? `${latestReading.humidity.toFixed(0)}%` : "N/A" },
                { em: "🧪", label: "Ammonia", value: typeof latestReading?.ammoniaPpm === "number" ? `${latestReading.ammoniaPpm.toFixed(0)} ppm` : "N/A" },
                { em: "💨", label: "Ventilation", value: typeof latestReading?.fanStatus === "boolean" ? (latestReading.fanStatus ? "ON" : "OFF") : "N/A" },
                { em: "🔥", label: "Heaters", value: typeof latestReading?.heaterStatus === "boolean" ? (latestReading.heaterStatus ? "ON" : "OFF") : "N/A" }
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ background: "#F8FAFC", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ fontSize: 15 }}>{item.em}</span>
                  <div>
                    <div style={{ fontSize: 9, color: C.subtle }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "20px 0 4px", fontSize: 10, color: "#CBD5E1" }}>
        Mazra3ty Farm Intelligence · Real-time Firestore sync · <span style={{ color: C.success, fontWeight: 700 }}>Live data</span>
      </div>
    </section>
  );
};
