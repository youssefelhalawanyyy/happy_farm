import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "@/lib/toast";
import { DataTable } from "@/components/ui/data-table";
import { BarTrendChart } from "@/components/charts/BarTrendChart";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useAuth } from "@/context/AuthContext";
import { COLLECTIONS } from "@/lib/constants";
import { calculateFCR, getBatchAgeInDays, getBatchFeedKg, getLatestAverageWeight } from "@/lib/calculations";
import { compareDateTimeDesc, formatCurrency, formatNumber, isoToday } from "@/lib/utils";
import { recordFeedUsage, recordGrowth } from "@/services/farmService";
import type { Batch, FeedRecord, GrowthRecord, InventoryItem, MarketPriceSnapshot } from "@/types";

type FeedLogRow = {
  id: string; date: string; batch: string; type: string;
  quantity: number; supplier: string; pricePerTon: number;
};
type FcrRow = {
  batchId: string; birdsAlive: number; feedKg: number; feedPerBirdKg: number;
  avgWeight: number; fcr: number; feedCost: number; costPerBird: number;
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  pageBg:      "#f4f6f0",
  surface:     "#ffffff",
  surfaceAlt:  "#f9faf6",
  surfaceHover:"#f1f5ee",
  border:      "#e3e8dc",
  borderMid:   "#cdd5c4",
  text:        "#1c2117",
  textMid:     "#48523f",
  textMuted:   "#7a8870",
  brand:       "#2e6b4e",
  brandDark:   "#1d4a35",
  brandLight:  "#e6f0eb",
  brandMid:    "#4a9068",
  profit:      "#15803d",
  profitBg:    "#dcfce7",
  profitBorder:"#bbf7d0",
  loss:        "#b91c1c",
  lossBg:      "#fee2e2",
  lossBorder:  "#fecaca",
  warn:        "#92400e",
  warnBg:      "#fef3c7",
  warnBorder:  "#fde68a",
  blue:        "#1e40af",
  blueBg:      "#dbeafe",
  blueBorder:  "#93c5fd",
  mono:        "'JetBrains Mono','Fira Code','Courier New',monospace",
  sans:        "'DM Sans','Trebuchet MS',system-ui,sans-serif",
};

// ── Inject styles once ────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

@keyframes fadeSlideUp {
  from { opacity:0; transform:translateY(20px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes fadeIn {
  from { opacity:0; }
  to   { opacity:1; }
}
@keyframes scaleIn {
  from { opacity:0; transform:scale(0.97); }
  to   { opacity:1; transform:scale(1); }
}
@keyframes countUp {
  from { opacity:0; transform:translateY(6px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes pulseRing {
  0%   { box-shadow: 0 0 0 0 rgba(46,107,78,0.35); }
  70%  { box-shadow: 0 0 0 8px rgba(46,107,78,0); }
  100% { box-shadow: 0 0 0 0 rgba(46,107,78,0); }
}
@keyframes barFill {
  from { width:0 !important; }
  to   { width: var(--bar-w); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.fp-page   { animation: fadeIn 0.35s ease both; }
.fp-panel  { animation: fadeSlideUp 0.45s cubic-bezier(.22,1,.36,1) both; }
.fp-scale  { animation: scaleIn 0.35s cubic-bezier(.22,1,.36,1) both; }
.fp-count  { animation: countUp 0.4s cubic-bezier(.22,1,.36,1) both; }

.fp-kpi {
  background: ${T.surface};
  border: 1px solid ${T.border};
  border-radius: 13px;
  padding: 18px 20px;
  transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}
.fp-kpi:hover {
  box-shadow: 0 4px 18px rgba(46,107,78,0.09);
  transform: translateY(-2px);
  border-color: ${T.borderMid};
}

.fp-tab {
  padding: 7px 18px;
  border-radius: 8px;
  border: 1.5px solid transparent;
  font-size: 13px; font-weight: 600;
  font-family: ${T.sans};
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
  color: ${T.textMuted};
  white-space: nowrap;
}
.fp-tab.active {
  background: ${T.brand};
  color: #fff;
  border-color: ${T.brand};
  box-shadow: 0 2px 10px rgba(46,107,78,0.22);
}
.fp-tab:not(.active):hover {
  background: ${T.brandLight};
  color: ${T.brand};
  border-color: ${T.borderMid};
}

.fp-input {
  width: 100%; padding: 9px 12px;
  background: ${T.surfaceAlt};
  border: 1.5px solid ${T.border};
  border-radius: 9px;
  font-size: 13px; color: ${T.text};
  font-family: ${T.sans};
  outline: none; box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.fp-input:focus {
  border-color: ${T.brandMid};
  box-shadow: 0 0 0 3px ${T.brandLight};
  background: ${T.surface};
}
.fp-input:hover:not(:focus) { border-color: ${T.borderMid}; }

.fp-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 10px 22px;
  background: ${T.brand}; color: #fff;
  border: none; border-radius: 9px;
  font-size: 13px; font-weight: 700;
  font-family: ${T.sans};
  cursor: pointer; letter-spacing: 0.01em;
  box-shadow: 0 2px 8px rgba(46,107,78,0.22);
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
}
.fp-btn:hover:not(:disabled) {
  background: ${T.brandDark};
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(46,107,78,0.30);
}
.fp-btn:active:not(:disabled) { transform: translateY(0); }
.fp-btn:disabled {
  background: ${T.surfaceAlt}; color: ${T.textMuted};
  border: 1.5px solid ${T.border};
  box-shadow: none; cursor: not-allowed;
}
.fp-btn-ghost {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 20px;
  background: ${T.brandLight}; color: ${T.brand};
  border: 1.5px solid #bdd5c8; border-radius: 9px;
  font-size: 13px; font-weight: 700;
  font-family: ${T.sans};
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.fp-btn-ghost:hover { background: #d4e8db; transform: translateY(-1px); }
.fp-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.fp-panel-card {
  background: ${T.surface};
  border: 1px solid ${T.border};
  border-radius: 15px;
  padding: 22px 24px;
  transition: box-shadow 0.2s;
}
.fp-panel-card:hover { box-shadow: 0 4px 20px rgba(46,107,78,0.07); }

.fp-opt-row {
  border-bottom: 1px solid ${T.border};
  transition: background 0.15s;
}
.fp-opt-row:last-child { border-bottom: none; }
.fp-opt-row:hover { background: ${T.surfaceHover}; }

.fp-bar-track {
  height: 5px; background: ${T.border}; border-radius: 4px; overflow: hidden; margin-top: 5px;
}
.fp-bar-fill {
  height: 100%; border-radius: 4px;
  transition: width 0.9s cubic-bezier(.22,1,.36,1);
}

.fp-mix-row { transition: background 0.15s; border-radius: 10px; padding: 10px 12px; }
.fp-mix-row:hover { background: ${T.surfaceHover}; }

.fp-form-section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.fp-fcr-good  { color: ${T.profit};  background: ${T.profitBg};  border: 1px solid ${T.profitBorder}; }
.fp-fcr-mid   { color: ${T.warn};    background: ${T.warnBg};    border: 1px solid ${T.warnBorder}; }
.fp-fcr-bad   { color: ${T.loss};    background: ${T.lossBg};    border: 1px solid ${T.lossBorder}; }
.fp-fcr-badge {
  display: inline-flex; align-items: center; padding: 3px 10px;
  border-radius: 20px; font-size: 11.5px; font-weight: 700;
  font-family: ${T.mono}; letter-spacing: 0.02em;
}
`;

let stylesInjected = false;
const injectStyles = () => {
  if (stylesInjected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
};

// ── Atoms ─────────────────────────────────────────────────────────────────────
const SectionTitle = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 3, height: 16, background: T.brand, borderRadius: 2 }} />
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.015em", fontFamily: T.sans }}>{children}</h2>
    </div>
    {sub && <p style={{ margin: "4px 0 0 12px", fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{sub}</p>}
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textMid, letterSpacing: "0.025em", marginBottom: 5, display: "block", fontFamily: T.sans }}>
    {children}
  </label>
);

const Chip = ({ children, color = "default" }: { children: React.ReactNode; color?: "green" | "red" | "amber" | "blue" | "sage" | "default" }) => {
  const s: { bg: string; text: string; border: string } = {
    green:   { bg: T.profitBg,  text: T.profit,  border: T.profitBorder },
    red:     { bg: T.lossBg,    text: T.loss,     border: T.lossBorder },
    amber:   { bg: T.warnBg,    text: T.warn,     border: T.warnBorder },
    blue:    { bg: T.blueBg,    text: T.blue,     border: T.blueBorder },
    sage:    { bg: T.brandLight, text: T.brand,   border: "#bdd5c8" },
    default: { bg: T.surfaceAlt, text: T.textMid, border: T.border },
  }[color];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.text, border: `1px solid ${s.border}`, letterSpacing: "0.03em", fontFamily: T.sans }}>
      {children}
    </span>
  );
};

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconScale = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/>
    <path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
  </svg>
);
const IconFeed = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
  </svg>
);
const IconChart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconBolt = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="fp-bar-track">
      <div className="fp-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const FeedPage = () => {
  injectStyles();
  const { profile } = useAuth();
  const { data: batches }   = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: feed }      = useRealtimeCollection<FeedRecord>(COLLECTIONS.feedRecords);
  const { data: growth }    = useRealtimeCollection<GrowthRecord>(COLLECTIONS.growthRecords);
  const { data: inventory } = useRealtimeCollection<InventoryItem>(COLLECTIONS.inventory);
  const { data: market }    = useRealtimeCollection<MarketPriceSnapshot>(COLLECTIONS.marketPrices);

  const activeBatches = batches.filter(b => b.status === "active");

  const [activeTab, setActiveTab] = useState<"log" | "analytics" | "optimization" | "logs">("log");

  const [feedForm, setFeedForm] = useState<FeedRecord>({
    batchId: "", type: "starter", quantityKg: 500,
    supplier: "", pricePerTon: 16500, recordDate: isoToday()
  });
  const [growthForm, setGrowthForm] = useState<GrowthRecord>({
    batchId: "", recordDate: isoToday(), averageWeightKg: 0.8, sampleSize: 100
  });
  const [submittingFeed, setSubmittingFeed] = useState(false);
  const [submittingGrowth, setSubmittingGrowth] = useState(false);

  const submitFeed = async () => {
    if (!profile || !feedForm.batchId) return;
    setSubmittingFeed(true);
    try {
      await recordFeedUsage(feedForm, profile.uid);
      toast.success("Feed record saved");
      setFeedForm(prev => ({ ...prev, supplier: "" }));
    } catch (err) { console.error(err); toast.error("Unable to save feed record"); }
    finally { setSubmittingFeed(false); }
  };

  const submitGrowth = async () => {
    if (!profile || !growthForm.batchId) return;
    setSubmittingGrowth(true);
    try {
      await recordGrowth(growthForm, profile.uid);
      toast.success("Growth record saved");
    } catch (err) { console.error(err); toast.error("Unable to save growth record"); }
    finally { setSubmittingGrowth(false); }
  };

  // ── Computed values ────────────────────────────────────────────────────────
  const feedInventoryKg = inventory.filter(i => i.category === "feed").reduce((s, i) => s + i.quantity, 0);
  const today = isoToday();
  const todayFeedKg    = feed.filter(e => e.recordDate === today).reduce((s, e) => s + e.quantityKg, 0);
  const weeklyFeedKg   = feed.filter(e => Date.now() - new Date(e.recordDate).getTime() <= 7 * 864e5).reduce((s, e) => s + e.quantityKg, 0);
  const totalFeedCost  = feed.reduce((s, e) => s + (e.pricePerTon / 1000) * e.quantityKg, 0);
  const totalFeedQty   = feed.reduce((s, e) => s + e.quantityKg, 0);
  const avgFeedCostPerKg = totalFeedQty > 0 ? totalFeedCost / totalFeedQty : 0;

  const latestMarket = useMemo(() => [...market].sort((a, b) => compareDateTimeDesc(a.capturedAt, b.capturedAt))[0], [market]);
  const marketFeedPricePerTon = latestMarket?.feedPricePerTon ?? 0;
  const marketFeedCostPerKg   = marketFeedPricePerTon > 0 ? marketFeedPricePerTon / 1000 : 0;

  const potentialCostReductionPercent =
    avgFeedCostPerKg > 0 && marketFeedCostPerKg > 0 && avgFeedCostPerKg > marketFeedCostPerKg
      ? Math.min(((avgFeedCostPerKg - marketFeedCostPerKg) / avgFeedCostPerKg) * 100, 20)
      : 0;
  const targetFeedCostPerKg = avgFeedCostPerKg * (1 - potentialCostReductionPercent / 100);
  const projectedMonthlySavings = Math.max(weeklyFeedKg * 4 * (avgFeedCostPerKg - targetFeedCostPerKg), 0);

  const feedLogs = useMemo<FeedLogRow[]>(
    () => [...feed].sort((a, b) => b.recordDate.localeCompare(a.recordDate)).map(e => ({
      id: e.id ?? `${e.batchId}-${e.recordDate}`,
      date: e.recordDate,
      batch: batches.find(b => b.id === e.batchId)?.batchId ?? e.batchId,
      type: e.type, quantity: e.quantityKg, supplier: e.supplier, pricePerTon: e.pricePerTon,
    })),
    [batches, feed]
  );

  const fcrRows = useMemo<FcrRow[]>(
    () => activeBatches.map(batch => {
      const feedKg   = getBatchFeedKg(batch.id ?? "", feed);
      const avgWeight = getLatestAverageWeight(batch.id ?? "", growth) || batch.targetSellingWeight;
      const fcr      = calculateFCR(feedKg, batch.currentAliveCount, avgWeight);
      const feedCost = feed.filter(e => e.batchId === batch.id).reduce((s, e) => s + (e.pricePerTon / 1000) * e.quantityKg, 0);
      const birdsAlive = Math.max(batch.currentAliveCount, 0);
      return {
        batchId: batch.batchId, birdsAlive, feedKg, feedPerBirdKg: birdsAlive > 0 ? feedKg / birdsAlive : 0,
        avgWeight, fcr, feedCost, costPerBird: birdsAlive > 0 ? feedCost / birdsAlive : 0,
      };
    }),
    [activeBatches, feed, growth]
  );

  const typeBreakdown = useMemo(
    () => ["starter", "grower", "finisher"].map(type => ({
      type, quantity: feed.filter(e => e.type === type).reduce((s, e) => s + e.quantityKg, 0),
    })),
    [feed]
  );

  const stageMix = useMemo(() => {
    const total = typeBreakdown.reduce((s, r) => s + r.quantity, 0);
    return typeBreakdown.map(r => ({ ...r, ratio: total > 0 ? (r.quantity / total) * 100 : 0 }));
  }, [typeBreakdown]);

  const averageBatchAge = useMemo(() => {
    if (!activeBatches.length) return 0;
    return activeBatches.reduce((s, b) => s + getBatchAgeInDays(b.arrivalDate, b.chickAgeAtArrivalDays ?? 0), 0) / activeBatches.length;
  }, [activeBatches]);

  const recommendedMix = useMemo(() => {
    if (averageBatchAge <= 14) return { starter: 55, grower: 35, finisher: 10 };
    if (averageBatchAge <= 28) return { starter: 20, grower: 60, finisher: 20 };
    return { starter: 5, grower: 35, finisher: 60 };
  }, [averageBatchAge]);

  const feedOptimizationRows = useMemo(
    () => fcrRows.map(row => {
      const pct = row.fcr > 1.95 ? 8 : row.fcr > 1.8 ? 5 : 2;
      return {
        ...row, suggestedImprovementPercent: pct,
        estimatedSavings: row.feedCost * (pct / 100),
        action:
          row.fcr > 1.95 ? "High FCR: tighten ration control, increase weighing frequency, reduce wastage."
          : row.fcr > 1.8 ? "Moderate FCR: optimize grower/finisher transition, check feeder calibration."
          : "Good FCR: maintain current plan, focus on supplier price negotiation.",
        severity: row.fcr > 1.95 ? "red" as const : row.fcr > 1.8 ? "amber" as const : "green" as const,
      };
    }),
    [fcrRows]
  );

  const feedLogColumns = useMemo<ColumnDef<FeedLogRow>[]>(() => [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.brand, fontSize: 12 }}>{row.original.batch}</span> },
    { accessorKey: "type", header: "Type", cell: ({ row }) => {
      const c = row.original.type === "starter" ? "blue" : row.original.type === "grower" ? "sage" : "green";
      return <Chip color={c as "blue" | "sage" | "green"}>{row.original.type}</Chip>;
    }},
    { accessorKey: "quantity", header: "Qty (kg)", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{formatNumber(row.original.quantity)}</span> },
    { accessorKey: "pricePerTon", header: "Price/Ton", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{formatCurrency(row.original.pricePerTon)}</span> },
    { accessorKey: "supplier", header: "Supplier", cell: ({ row }) => <span style={{ color: T.textMuted, fontSize: 12 }}>{row.original.supplier || "—"}</span> },
  ], []);

  const fcrColumns = useMemo<ColumnDef<FcrRow>[]>(() => [
    { accessorKey: "batchId", header: "Batch", cell: ({ row }) => <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.brand }}>{row.original.batchId}</span> },
    { accessorKey: "birdsAlive", header: "Birds Alive", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{formatNumber(row.original.birdsAlive)}</span> },
    { accessorKey: "feedKg", header: "Total Feed (kg)", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{formatNumber(row.original.feedKg)}</span> },
    { accessorKey: "feedPerBirdKg", header: "Feed/Bird (kg)", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{row.original.feedPerBirdKg.toFixed(2)}</span> },
    { accessorKey: "avgWeight", header: "Avg Weight", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{row.original.avgWeight.toFixed(2)} kg</span> },
    {
      accessorKey: "fcr", header: "FCR",
      cell: ({ row }) => {
        const v = row.original.fcr;
        const cls = v <= 1.7 ? "fp-fcr-good" : v <= 1.95 ? "fp-fcr-mid" : "fp-fcr-bad";
        return <span className={`fp-fcr-badge ${cls}`}>{v}</span>;
      }
    },
    { accessorKey: "feedCost", header: "Feed Cost", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{formatCurrency(row.original.feedCost)}</span> },
    { accessorKey: "costPerBird", header: "Cost/Bird", cell: ({ row }) => <span style={{ fontFamily: T.mono }}>{formatCurrency(row.original.costPerBird)}</span> },
  ], []);

  const tabs = [
    { id: "log" as const,          label: "Log Entry",    icon: <IconFeed /> },
    { id: "analytics" as const,    label: "Analytics",    icon: <IconChart /> },
    { id: "optimization" as const, label: "Optimization", icon: <IconBolt /> },
    { id: "logs" as const,         label: "All Logs",     icon: <IconList /> },
  ];

  const stageColors = { starter: T.blue, grower: T.brand, finisher: T.profit };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <section className="fp-page" style={{ background: T.pageBg, minHeight: "100vh", padding: "24px 28px", fontFamily: T.sans, color: T.text }}>

      {/* ── Header ── */}
      <div className="fp-panel" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.brand, textTransform: "uppercase", letterSpacing: "0.12em" }}>Farm Operations</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.025em", lineHeight: 1.1 }}>Feed Management</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: T.textMuted }}>Feed intake, growth sampling, conversion analytics, and cost control.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: feedInventoryKg < 500 ? T.warnBg : T.brandLight, border: `1px solid ${feedInventoryKg < 500 ? T.warnBorder : "#bdd5c8"}`, borderRadius: 12 }}>
          <IconFeed />
          <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>Feed inventory:</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: feedInventoryKg < 500 ? T.warn : T.brand, fontFamily: T.mono }}>{formatNumber(feedInventoryKg)} kg</span>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="fp-panel" style={{ animationDelay: "0.05s", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Feed Used Today",       value: `${formatNumber(todayFeedKg)} kg`,  sub: "All batches",         topColor: T.brand,    valueColor: T.brand },
          { label: "Feed Used (7 Days)",    value: `${formatNumber(weeklyFeedKg)} kg`, sub: "Rolling week",        topColor: T.blue,     valueColor: T.blue },
          { label: "Avg Cost / kg",         value: formatCurrency(avgFeedCostPerKg),   sub: "Blended rate",        topColor: "#d97706",  valueColor: T.warn },
          { label: "Cumulative Feed Cost",  value: formatCurrency(totalFeedCost),      sub: "All time",            topColor: T.loss,     valueColor: T.loss },
        ].map((kpi, i) => (
          <div key={kpi.label} className="fp-kpi fp-count" style={{ animationDelay: `${0.06 + i * 0.04}s`, borderTop: `3px solid ${kpi.topColor}` }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{kpi.label}</p>
            <p style={{ margin: "0 0 3px", fontSize: 21, fontWeight: 800, color: kpi.valueColor, fontFamily: T.mono, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{kpi.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: T.textMuted }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tab Nav ── */}
      <div className="fp-panel" style={{ animationDelay: "0.1s", display: "flex", gap: 5, marginBottom: 20, padding: "6px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, width: "fit-content", flexWrap: "wrap" }}>
        {tabs.map(tab => (
          <button key={tab.id} className={`fp-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{tab.icon} {tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: LOG ENTRY ═══════════════ */}
      {activeTab === "log" && (
        <div className="fp-scale" style={{ animationDelay: "0.12s", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Feed Form */}
          <div className="fp-panel-card">
            <SectionTitle sub="Record feed deliveries or daily usage per batch.">Log Feed Usage</SectionTitle>
            <div className="fp-form-section">
              <div>
                <FieldLabel>Batch</FieldLabel>
                <select className="fp-input" value={feedForm.batchId} onChange={e => setFeedForm(p => ({ ...p, batchId: e.target.value }))}>
                  <option value="">Select batch…</option>
                  {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchId}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Feed Type</FieldLabel>
                <select className="fp-input" value={feedForm.type} onChange={e => setFeedForm(p => ({ ...p, type: e.target.value as FeedRecord["type"] }))}>
                  <option value="starter">Starter</option>
                  <option value="grower">Grower</option>
                  <option value="finisher">Finisher</option>
                </select>
              </div>
              <div>
                <FieldLabel>Quantity (kg)</FieldLabel>
                <input type="number" className="fp-input" value={feedForm.quantityKg} onChange={e => setFeedForm(p => ({ ...p, quantityKg: Number(e.target.value) }))} />
              </div>
              <div>
                <FieldLabel>Price per Ton (EGP)</FieldLabel>
                <input type="number" className="fp-input" value={feedForm.pricePerTon} onChange={e => setFeedForm(p => ({ ...p, pricePerTon: Number(e.target.value) }))} />
              </div>
              <div>
                <FieldLabel>Supplier</FieldLabel>
                <input className="fp-input" value={feedForm.supplier} onChange={e => setFeedForm(p => ({ ...p, supplier: e.target.value }))} placeholder="e.g. Cairo Feed Co." />
              </div>
              <div>
                <FieldLabel>Date</FieldLabel>
                <input type="date" className="fp-input" value={feedForm.recordDate} onChange={e => setFeedForm(p => ({ ...p, recordDate: e.target.value }))} />
              </div>
            </div>

            {/* Live cost preview */}
            {feedForm.quantityKg > 0 && feedForm.pricePerTon > 0 && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: T.brandLight, border: `1px solid #bdd5c8`, borderRadius: 9, display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.brandMid, textTransform: "uppercase", letterSpacing: "0.06em" }}>Batch cost</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.brand, fontFamily: T.mono }}>{formatCurrency((feedForm.pricePerTon / 1000) * feedForm.quantityKg)}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.brandMid, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cost / kg</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.brand, fontFamily: T.mono }}>{formatCurrency(feedForm.pricePerTon / 1000)}</p>
                </div>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <button className="fp-btn" onClick={() => void submitFeed()} disabled={!profile || !feedForm.batchId || submittingFeed}>
                <IconPlus /> {submittingFeed ? "Saving…" : "Add Feed Delivery"}
              </button>
            </div>
          </div>

          {/* Growth Form */}
          <div className="fp-panel-card">
            <SectionTitle sub="Record weight samples to track growth performance and update FCR calculations.">Log Weight Growth</SectionTitle>
            <div className="fp-form-section">
              <div>
                <FieldLabel>Batch</FieldLabel>
                <select className="fp-input" value={growthForm.batchId} onChange={e => setGrowthForm(p => ({ ...p, batchId: e.target.value }))}>
                  <option value="">Select batch…</option>
                  {activeBatches.map(b => <option key={b.id} value={b.id}>{b.batchId}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Average Weight (kg)</FieldLabel>
                <input type="number" step="0.01" className="fp-input" value={growthForm.averageWeightKg} onChange={e => setGrowthForm(p => ({ ...p, averageWeightKg: Number(e.target.value) }))} />
              </div>
              <div>
                <FieldLabel>Sample Size (birds)</FieldLabel>
                <input type="number" className="fp-input" value={growthForm.sampleSize} onChange={e => setGrowthForm(p => ({ ...p, sampleSize: Number(e.target.value) }))} />
              </div>
              <div>
                <FieldLabel>Date</FieldLabel>
                <input type="date" className="fp-input" value={growthForm.recordDate} onChange={e => setGrowthForm(p => ({ ...p, recordDate: e.target.value }))} />
              </div>
            </div>

            {/* Growth preview */}
            {growthForm.averageWeightKg > 0 && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: T.profitBg, border: `1px solid ${T.profitBorder}`, borderRadius: 9 }}>
                <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: T.profit, textTransform: "uppercase", letterSpacing: "0.06em" }}>Weight progress</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.profit, fontFamily: T.mono }}>{growthForm.averageWeightKg.toFixed(2)} kg avg · {formatNumber(growthForm.sampleSize)} birds sampled</p>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <button className="fp-btn-ghost" onClick={() => void submitGrowth()} disabled={!profile || !growthForm.batchId || submittingGrowth}>
                <IconScale /> {submittingGrowth ? "Saving…" : "Save Growth Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: ANALYTICS ═══════════════ */}
      {activeTab === "analytics" && (
        <div className="fp-scale" style={{ animationDelay: "0.12s", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Feed stage chart + mix guidance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
            <div className="fp-panel-card">
              <SectionTitle sub="Total kg consumed per feed stage across all batches.">Feed Stage Breakdown</SectionTitle>
              <BarTrendChart data={typeBreakdown} xKey="type" yKey="quantity" color={T.brand} />
            </div>

            <div className="fp-panel-card">
              <SectionTitle sub="Actual vs recommended mix ratios.">Feed Mix Guidance</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stageMix.map(row => {
                  const recommended = recommendedMix[row.type as keyof typeof recommendedMix];
                  const color = (stageColors as Record<string, string>)[row.type] ?? T.brand;
                  return (
                    <div key={row.type} className="fp-mix-row">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
                          <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", color: T.text }}>{row.type}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontFamily: T.mono, color: T.textMid }}>{formatNumber(row.quantity)} kg</span>
                          <Chip color={Math.abs(row.ratio - recommended) < 5 ? "green" : "amber"}>
                            {row.ratio.toFixed(0)}% <span style={{ fontWeight: 400, opacity: 0.7 }}>/ {recommended}% rec</span>
                          </Chip>
                        </div>
                      </div>
                      <MiniBar value={row.ratio} max={100} color={color} />
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, padding: "10px 12px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 11.5, color: T.textMuted, lineHeight: 1.6 }}>
                <strong style={{ color: T.textMid }}>Avg flock age:</strong> {averageBatchAge.toFixed(1)} days<br />
                Recommended: Starter {recommendedMix.starter}% · Grower {recommendedMix.grower}% · Finisher {recommendedMix.finisher}%<br />
                Keep growth records updated weekly for accurate FCR tracking.
              </div>
            </div>
          </div>

          {/* FCR table */}
          <div className="fp-panel-card">
            <SectionTitle sub="Feed conversion ratio per active batch. Lower is better — target ≤ 1.7.">Batch Feed Efficiency (FCR)</SectionTitle>
            <DataTable columns={fcrColumns} data={fcrRows} searchColumn="batchId" searchPlaceholder="Search batch…" />
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: OPTIMIZATION ═══════════════ */}
      {activeTab === "optimization" && (
        <div className="fp-scale" style={{ animationDelay: "0.12s", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Cost benchmark cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { label: "Your Feed Cost / kg",      value: formatCurrency(avgFeedCostPerKg),      color: T.text,   bg: T.surfaceAlt,  border: T.border },
              { label: "Market Benchmark / kg",    value: marketFeedCostPerKg > 0 ? formatCurrency(marketFeedCostPerKg) : "—",
                color: T.blue,   bg: T.blueBg,     border: T.blueBorder },
              { label: "Potential Cost Reduction", value: `${potentialCostReductionPercent.toFixed(1)}%`,
                color: T.warn,   bg: T.warnBg,     border: T.warnBorder },
              { label: "Projected Monthly Savings", value: formatCurrency(projectedMonthlySavings),
                color: T.profit, bg: T.profitBg,   border: T.profitBorder },
            ].map(item => (
              <div key={item.label} style={{ padding: "16px 18px", background: item.bg, border: `1px solid ${item.border}`, borderRadius: 12, transition: "transform 0.15s", cursor: "default" }}>
                <p style={{ margin: "0 0 7px", fontSize: 10.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: item.color, fontFamily: T.mono }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Optimization per batch */}
          <div className="fp-panel-card">
            <SectionTitle sub="AI-powered recommendations per batch based on FCR performance.">Per-Batch Optimization Actions</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {feedOptimizationRows.map((row) => (
                <div key={row.batchId} className="fp-opt-row" style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "140px 80px 110px 90px 110px 1fr", gap: 14, alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{row.batchId}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>{formatNumber(row.birdsAlive)} birds</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>FCR</p>
                    <Chip color={row.severity}>{row.fcr}</Chip>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Feed Cost</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: T.mono }}>{formatCurrency(row.feedCost)}</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Save</p>
                    <Chip color={row.severity === "green" ? "default" : row.severity}>{row.suggestedImprovementPercent}%</Chip>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Est. Saving</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.profit, fontFamily: T.mono }}>{formatCurrency(row.estimatedSavings)}</p>
                  </div>
                  <div style={{ padding: "8px 12px", background: row.severity === "red" ? T.lossBg : row.severity === "amber" ? T.warnBg : T.profitBg, borderRadius: 8, border: `1px solid ${row.severity === "red" ? T.lossBorder : row.severity === "amber" ? T.warnBorder : T.profitBorder}` }}>
                    <p style={{ margin: 0, fontSize: 12, color: row.severity === "red" ? T.loss : row.severity === "amber" ? T.warn : T.profit, lineHeight: 1.5 }}>{row.action}</p>
                  </div>
                </div>
              ))}
              {feedOptimizationRows.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: T.textMuted, fontSize: 13 }}>
                  No active batch feed data available yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: ALL LOGS ═══════════════ */}
      {activeTab === "logs" && (
        <div className="fp-scale" style={{ animationDelay: "0.12s", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="fp-panel-card">
            <SectionTitle sub="All feed delivery records sorted by date.">Feed Logs</SectionTitle>
            <DataTable columns={feedLogColumns} data={feedLogs} searchColumn="batch" searchPlaceholder="Search by batch ID…" />
          </div>
        </div>
      )}

    </section>
  );
};
