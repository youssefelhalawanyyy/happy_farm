import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "@/lib/toast";
import { DataTable } from "@/components/ui/data-table";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { BarTrendChart } from "@/components/charts/BarTrendChart";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS, DEFAULT_GROWOUT_DAYS } from "@/lib/constants";
import type {
  Batch,
  ExpenseRecord,
  FeedRecord,
  GrowthRecord,
  InventoryItem,
  LivestockAdjustmentRecord,
  MortalityRecord,
  SaleRecord
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { createBatch } from "@/services/farmService";
import { exportSystemReportPdf } from "@/services/reportExport";
import {
  calculateBatchCost,
  calculateBatchProfit,
  calculateFCR,
  getBatchAgeInDays,
  getLatestAverageWeight,
  getMortalityPercentage
} from "@/lib/calculations";
import {
  type BatchHealthAction,
  getBatchDailyRecommendation,
  projectBatchResourceRange,
  STANDARD_GROWOUT_DAY
} from "@/lib/batchRecommendations";
import { addDaysToIsoDate, compareDateTimeDesc, formatCurrency, formatDateTimeLocal, formatNumber, isoToday, toIsoDateTime } from "@/lib/utils";

const makeBatchId = (): string => `B-${Date.now().toString().slice(-6)}`;

type BatchRow = {
  id: string; batchId: string; supplier: string; ageDays: number;
  alive: number; mortalityText: string; breed: string; house: string;
  batchCost: string; status: Batch["status"]; docId?: string;
};

type BatchEventRow = {
  id: string;
  date: string;
  event: "expense" | "feed" | "sale" | "mortality" | "dead_loss_adjustment" | "growth";
  note: string;
  birds?: number;
  amount?: number;
};

// ── Design tokens — sage/white light theme ────────────────────────────────────
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
  mono:        "'JetBrains Mono','Fira Code','Courier New',monospace",
  sans:        "'DM Sans','Trebuchet MS',system-ui,sans-serif",
};

// ── CSS injected once ─────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.75); }
}
@keyframes bar-grow {
  from { width: 0; }
  to   { width: var(--w); }
}

.page-enter { animation: fadeIn 0.4s ease both; }
.panel-enter { animation: fadeSlideUp 0.45s cubic-bezier(.22,1,.36,1) both; }
.scale-enter { animation: scaleIn 0.35s cubic-bezier(.22,1,.36,1) both; }

.batch-card {
  transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}
.batch-card:hover {
  box-shadow: 0 6px 24px rgba(46,107,78,0.10);
  transform: translateY(-2px);
  border-color: #cdd5c4 !important;
}

.form-input {
  width: 100%;
  padding: 9px 12px;
  background: ${T.surfaceAlt};
  border: 1.5px solid ${T.border};
  border-radius: 9px;
  font-size: 13px;
  color: ${T.text};
  font-family: ${T.sans};
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.form-input:focus {
  border-color: ${T.brandMid};
  box-shadow: 0 0 0 3px ${T.brandLight};
}
.form-input:hover:not(:focus) {
  border-color: ${T.borderMid};
}

.health-row {
  transition: background 0.15s;
}
.health-row:hover {
  background: ${T.surfaceHover} !important;
}

.checklist-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 5px 0;
  transition: color 0.15s;
}
.checklist-item:hover { color: ${T.brand}; }

.submit-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 24px;
  background: ${T.brand};
  color: #fff;
  border: none; border-radius: 10px;
  font-size: 13.5px; font-weight: 700;
  font-family: ${T.sans};
  cursor: pointer;
  letter-spacing: 0.01em;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(46,107,78,0.25);
}
.submit-btn:hover:not(:disabled) {
  background: ${T.brandDark};
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(46,107,78,0.30);
}
.submit-btn:active:not(:disabled) { transform: translateY(0); }
.submit-btn:disabled {
  background: ${T.surfaceAlt};
  color: ${T.textMuted};
  border: 1.5px solid ${T.border};
  box-shadow: none; cursor: not-allowed;
}

.stat-tile {
  padding: 14px 16px;
  background: ${T.surfaceAlt};
  border: 1px solid ${T.border};
  border-radius: 11px;
  transition: background 0.15s, border-color 0.15s;
}
.stat-tile:hover {
  background: ${T.brandLight};
  border-color: #bdd5c8;
}

.tab-btn {
  padding: 7px 16px;
  border-radius: 8px;
  border: 1.5px solid transparent;
  font-size: 13px; font-weight: 600;
  font-family: ${T.sans};
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
  color: ${T.textMuted};
}
.tab-btn.active {
  background: ${T.brand};
  color: #fff;
  border-color: ${T.brand};
  box-shadow: 0 2px 8px rgba(46,107,78,0.2);
}
.tab-btn:not(.active):hover {
  background: ${T.brandLight};
  color: ${T.brand};
  border-color: ${T.borderMid};
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

// ── Small atoms ───────────────────────────────────────────────────────────────
const SectionTitle = ({ children, sub, action }: { children: React.ReactNode; sub?: string; action?: React.ReactNode }) => (
  <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 3, height: 16, background: T.brand, borderRadius: 2 }} />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.015em", fontFamily: T.sans }}>{children}</h2>
      </div>
      {sub && <p style={{ margin: "4px 0 0 12px", fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{sub}</p>}
    </div>
    {action}
  </div>
);

const Panel = ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) => (
  <div className={className} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "22px 24px", ...style }}>
    {children}
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textMid, letterSpacing: "0.03em", marginBottom: 5, display: "block", fontFamily: T.sans }}>
    {children}
  </label>
);

const Chip = ({ children, color = "default" }: { children: React.ReactNode; color?: "green" | "red" | "amber" | "blue" | "sage" | "default" }) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    green:   { bg: T.profitBg,  text: T.profit,  border: T.profitBorder },
    red:     { bg: T.lossBg,    text: T.loss,     border: T.lossBorder },
    amber:   { bg: T.warnBg,    text: T.warn,     border: T.warnBorder },
    blue:    { bg: T.blueBg,    text: T.blue,     border: "#93c5fd" },
    sage:    { bg: T.brandLight, text: T.brand,   border: "#bdd5c8" },
    default: { bg: T.surfaceAlt, text: T.textMid, border: T.border },
  };
  const s = styles[color];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      letterSpacing: "0.03em", fontFamily: T.sans,
    }}>{children}</span>
  );
};

const PulseDot = ({ color }: { color: string }) => (
  <span style={{
    display: "inline-block", width: 7, height: 7, borderRadius: "50%",
    background: color, animation: "pulse-dot 2s ease-in-out infinite",
  }} />
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconBird = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconAlert = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ── Mini progress bar ─────────────────────────────────────────────────────────
const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.8s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );
};

const toUnitKey = (unit: string): string => unit.trim().toLowerCase();

const convertFeedInventoryToKg = (quantity: number, unit: string): number => {
  const safeQty = Number.isFinite(quantity) ? quantity : 0;
  const normalized = toUnitKey(unit);
  if (["kg", "كيلو", "كيلوجرام", "kilogram", "kilograms"].includes(normalized)) {
    return safeQty;
  }
  if (["g", "gram", "grams"].includes(normalized)) {
    return safeQty / 1000;
  }
  if (["ton", "tons", "tonne", "tonnes", "طن"].includes(normalized)) {
    return safeQty * 1000;
  }
  if (["bag", "bags", "كيس", "sack", "sacks"].includes(normalized)) {
    return safeQty * 50;
  }
  return 0;
};

const convertWaterInventoryToLiters = (item: InventoryItem): number => {
  const unit = toUnitKey(item.unit);
  const name = item.name.trim().toLowerCase();
  const mentionsWater = /water|مياه|ماء/.test(name);
  if (!mentionsWater) {
    return 0;
  }
  if (["l", "liter", "liters", "litre", "litres", "لتر"].includes(unit)) {
    return item.quantity;
  }
  if (["ml", "milliliter", "milliliters"].includes(unit)) {
    return item.quantity / 1000;
  }
  if (["m3", "cubic meter", "m³"].includes(unit)) {
    return item.quantity * 1000;
  }
  return 0;
};

// ─────────────────────────────────────────────────────────────────────────────
export const BatchesPage = () => {
  injectStyles();

  const { profile } = useAuth();
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: feed } = useRealtimeCollection<FeedRecord>(COLLECTIONS.feedRecords);
  const { data: inventory } = useRealtimeCollection<InventoryItem>(COLLECTIONS.inventory);
  const { data: expenses } = useRealtimeCollection<ExpenseRecord>(COLLECTIONS.expenses);
  const { data: sales } = useRealtimeCollection<SaleRecord>(COLLECTIONS.sales);
  const { data: growth } = useRealtimeCollection<GrowthRecord>(COLLECTIONS.growthRecords);
  const { data: mortality } = useRealtimeCollection<MortalityRecord>(COLLECTIONS.mortalityRecords);
  const { data: livestockAdjustments } = useRealtimeCollection<LivestockAdjustmentRecord>(COLLECTIONS.livestockAdjustments);
  const [ageRefreshToken, setAgeRefreshToken] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<"form" | "table" | "recommendations" | "details">("form");
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [form, setForm] = useState<Batch>({
    batchId: makeBatchId(), arrivalDate: isoToday(), chickAgeAtArrivalDays: 1,
    supplierHatchery: "", chickPrice: 17, initialChickCount: 1000,
    currentAliveCount: 1000, mortalityCount: 0, breed: "ross",
    assignedHouse: "House-A", targetSellingWeight: 2.2,
    expectedSellingDate: addDaysToIsoDate(isoToday(), DEFAULT_GROWOUT_DAYS),
    batchCost: 17000, status: "active"
  });
  const [expectedDateEdited, setExpectedDateEdited] = useState(false);
  const [batchCostEdited, setBatchCostEdited] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setAgeRefreshToken(Date.now()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (expectedDateEdited) return;
    setForm(prev => ({ ...prev, expectedSellingDate: addDaysToIsoDate(prev.arrivalDate, DEFAULT_GROWOUT_DAYS) }));
  }, [expectedDateEdited, form.arrivalDate]);

  useEffect(() => {
    if (batchCostEdited) return;
    setForm(prev => ({ ...prev, batchCost: Number((prev.initialChickCount * prev.chickPrice).toFixed(2)) }));
  }, [batchCostEdited, form.chickPrice, form.initialChickCount]);

  const submit = async () => {
    if (!profile) return;
    try {
      const batchToCreate: Batch = { ...form, currentAliveCount: form.initialChickCount, mortalityCount: 0 };
      const todayPlan = getBatchDailyRecommendation(batchToCreate);
      await createBatch(batchToCreate, profile.uid);
      toast.success(`Batch created. Today: ${todayPlan.dailyFeedKg} kg feed, ${todayPlan.dailyWaterLiters} L water, ${todayPlan.temperatureMinC}-${todayPlan.temperatureMaxC}°C.`);
      setExpectedDateEdited(false); setBatchCostEdited(false);
      setForm(prev => ({ ...prev, batchId: makeBatchId(), supplierHatchery: "", chickAgeAtArrivalDays: 1, expectedSellingDate: addDaysToIsoDate(isoToday(), DEFAULT_GROWOUT_DAYS) }));
    } catch (err) {
      console.error(err);
      toast.error("Unable to create batch");
    }
  };

  const totalAlive = batches.filter(b => b.status === "active").reduce((s, b) => s + b.currentAliveCount, 0);
  const activeBatches = batches.filter(b => b.status === "active").length;
  const availableFeedKg = useMemo(
    () =>
      inventory
        .filter((item) => item.category === "feed")
        .reduce((sum, item) => sum + convertFeedInventoryToKg(item.quantity, item.unit), 0),
    [inventory]
  );
  const trackedWaterAvailableLiters = useMemo(
    () => inventory.reduce((sum, item) => sum + convertWaterInventoryToLiters(item), 0),
    [inventory]
  );

  const tableRows = useMemo<BatchRow[]>(
    () => batches.sort((a, b) => compareDateTimeDesc(a.arrivalDate, b.arrivalDate)).map(batch => ({
      id: batch.id ?? batch.batchId, batchId: batch.batchId, supplier: batch.supplierHatchery,
      ageDays: getBatchAgeInDays(batch.arrivalDate, batch.chickAgeAtArrivalDays ?? 0),
      alive: batch.currentAliveCount,
      mortalityText: `${batch.mortalityCount} (${getMortalityPercentage(batch)}%)`,
      breed: batch.breed, house: batch.assignedHouse,
      batchCost: formatCurrency(calculateBatchCost(batch, feed, expenses)),
      status: batch.status, docId: batch.id,
    })),
    [ageRefreshToken, batches, expenses, feed]
  );

  const activeBatchRecommendations = useMemo(() => {
    const feedByBatchRef = new Map<string, number>();
    for (const row of feed) {
      const key = row.batchId ?? "";
      if (!key) {
        continue;
      }
      feedByBatchRef.set(key, (feedByBatchRef.get(key) ?? 0) + row.quantityKg);
    }

    return batches
      .filter(b => b.status === "active")
      .sort((a, b) => compareDateTimeDesc(a.arrivalDate, b.arrivalDate))
      .map((batch) => {
        const plan = getBatchDailyRecommendation(batch);
        const refs = new Set<string>();
        if (batch.id) {
          refs.add(batch.id);
        }
        refs.add(batch.batchId);

        let loggedFeedKg = 0;
        for (const key of refs) {
          loggedFeedKg += feedByBatchRef.get(key) ?? 0;
        }

        const cycleTargetTo42 = projectBatchResourceRange(
          Math.max(batch.initialChickCount, 0),
          Math.max(batch.chickAgeAtArrivalDays ?? 0, 0),
          STANDARD_GROWOUT_DAY
        );

        const remainingFeedTo42Kg = Math.max(cycleTargetTo42.feedKg - loggedFeedKg, 0);
        const feedCoveragePercent = remainingFeedTo42Kg > 0 ? Math.min((availableFeedKg / remainingFeedTo42Kg) * 100, 999) : 100;
        const feedShortfallKg = Math.max(remainingFeedTo42Kg - availableFeedKg, 0);

        return {
          batch,
          plan,
          cycleTargetTo42FeedKg: Number(cycleTargetTo42.feedKg.toFixed(1)),
          cycleTargetTo42WaterLiters: Number(cycleTargetTo42.waterLiters.toFixed(1)),
          loggedFeedKg: Number(loggedFeedKg.toFixed(1)),
          remainingFeedTo42Kg: Number(remainingFeedTo42Kg.toFixed(1)),
          remainingWaterTo42Liters: Number(plan.toDay42WaterLiters.toFixed(1)),
          feedCoveragePercent: Number(feedCoveragePercent.toFixed(1)),
          feedShortfallKg: Number(feedShortfallKg.toFixed(1))
        };
      });
  }, [ageRefreshToken, availableFeedKg, batches, feed]);

  const recommendationsTotals = useMemo(
    () =>
      activeBatchRecommendations.reduce(
        (acc, row) => {
          acc.feedRemainingTo42Kg += row.remainingFeedTo42Kg;
          acc.feedLoggedKg += row.loggedFeedKg;
          acc.waterRemainingTo42Liters += row.remainingWaterTo42Liters;
          return acc;
        },
        { feedRemainingTo42Kg: 0, feedLoggedKg: 0, waterRemainingTo42Liters: 0 }
      ),
    [activeBatchRecommendations]
  );

  const totalFeedShortfallKg = Math.max(recommendationsTotals.feedRemainingTo42Kg - availableFeedKg, 0);

  const selectedBatch = useMemo(
    () => (selectedBatchId ? batches.find((batch) => batch.id === selectedBatchId || batch.batchId === selectedBatchId) : undefined),
    [batches, selectedBatchId]
  );
  const selectedBatchKeys = useMemo(() => {
    const keys = new Set<string>();
    if (selectedBatch?.id) {
      keys.add(selectedBatch.id);
    }
    if (selectedBatch?.batchId) {
      keys.add(selectedBatch.batchId);
    }
    return keys;
  }, [selectedBatch]);
  const matchesSelectedBatch = (batchRef?: string): boolean => Boolean(batchRef && selectedBatchKeys.has(batchRef));
  const toDateLabel = (value: unknown): string => {
    const iso = toIsoDateTime(value);
    return iso ? iso.slice(0, 10) : "";
  };

  const selectedFeedRows = useMemo(
    () =>
      selectedBatch
        ? [...feed].filter((row) => matchesSelectedBatch(row.batchId)).sort((a, b) => compareDateTimeDesc(a.recordDate, b.recordDate))
        : [],
    [feed, selectedBatch, selectedBatchKeys]
  );
  const selectedGrowthRows = useMemo(
    () =>
      selectedBatch
        ? [...growth].filter((row) => matchesSelectedBatch(row.batchId)).sort((a, b) => compareDateTimeDesc(a.recordDate, b.recordDate))
        : [],
    [growth, selectedBatch, selectedBatchKeys]
  );
  const selectedSalesRows = useMemo(
    () =>
      selectedBatch
        ? [...sales].filter((row) => matchesSelectedBatch(row.batchId)).sort((a, b) => compareDateTimeDesc(a.saleDate, b.saleDate))
        : [],
    [sales, selectedBatch, selectedBatchKeys]
  );
  const selectedExpenseRows = useMemo(
    () =>
      selectedBatch
        ? [...expenses]
            .filter((row) => Boolean(row.batchId) && matchesSelectedBatch(row.batchId))
            .sort((a, b) => compareDateTimeDesc(a.expenseDate, b.expenseDate))
        : [],
    [expenses, selectedBatch, selectedBatchKeys]
  );
  const selectedMortalityRows = useMemo(
    () =>
      selectedBatch
        ? [...mortality].filter((row) => matchesSelectedBatch(row.batchId)).sort((a, b) => compareDateTimeDesc(a.recordDate, b.recordDate))
        : [],
    [mortality, selectedBatch, selectedBatchKeys]
  );
  const selectedDeadLossRows = useMemo(
    () =>
      selectedBatch
        ? [...livestockAdjustments]
            .filter((row) => row.reason === "dead_loss" && Boolean(row.batchId) && matchesSelectedBatch(row.batchId))
            .sort((a, b) => compareDateTimeDesc(a.adjustedAt || a.createdAt, b.adjustedAt || b.createdAt))
        : [],
    [livestockAdjustments, selectedBatch, selectedBatchKeys]
  );

  const selectedFeedKg = useMemo(
    () => selectedFeedRows.reduce((sum, row) => sum + row.quantityKg, 0),
    [selectedFeedRows]
  );
  const selectedFeedCost = useMemo(
    () => selectedFeedRows.reduce((sum, row) => sum + (row.pricePerTon / 1000) * row.quantityKg, 0),
    [selectedFeedRows]
  );
  const selectedExpenseTotal = useMemo(
    () => selectedExpenseRows.reduce((sum, row) => sum + row.amount, 0),
    [selectedExpenseRows]
  );
  const selectedSalesRevenue = useMemo(
    () => selectedSalesRows.reduce((sum, row) => sum + row.totalRevenue, 0),
    [selectedSalesRows]
  );
  const selectedSoldBirds = useMemo(
    () => selectedSalesRows.reduce((sum, row) => sum + row.birdCount, 0),
    [selectedSalesRows]
  );
  const selectedDeadFromMortality = useMemo(
    () => selectedMortalityRows.reduce((sum, row) => sum + row.birds, 0),
    [selectedMortalityRows]
  );
  const selectedDeadFromAdjustments = useMemo(
    () => selectedDeadLossRows.reduce((sum, row) => sum + row.quantity, 0),
    [selectedDeadLossRows]
  );
  const selectedDeadTotal = selectedDeadFromMortality + selectedDeadFromAdjustments;
  const selectedBaseCost = selectedBatch ? selectedBatch.batchCost ?? selectedBatch.initialChickCount * selectedBatch.chickPrice : 0;
  const selectedKnownCost = selectedBaseCost + selectedFeedCost + selectedExpenseTotal;
  const selectedRealizedProfit = selectedSalesRevenue - selectedKnownCost;
  const selectedAvgWeight =
    selectedBatch && selectedBatch.id
      ? getLatestAverageWeight(selectedBatch.id, growth) || selectedBatch.targetSellingWeight
      : selectedBatch?.targetSellingWeight ?? 0;
  const selectedFcr = selectedBatch ? calculateFCR(selectedFeedKg, selectedBatch.currentAliveCount, selectedAvgWeight) : 0;
  const selectedSystemProfit =
    selectedBatch && selectedBatch.id
      ? calculateBatchProfit(selectedBatch.id, sales, expenses, selectedBaseCost)
      : 0;

  const selectedFeedChart = useMemo(
    () =>
      [...selectedFeedRows]
        .sort((a, b) => a.recordDate.localeCompare(b.recordDate))
        .map((row) => ({ date: row.recordDate, quantityKg: Number(row.quantityKg.toFixed(2)) })),
    [selectedFeedRows]
  );
  const selectedGrowthChart = useMemo(
    () =>
      [...selectedGrowthRows]
        .sort((a, b) => a.recordDate.localeCompare(b.recordDate))
        .map((row) => ({ date: row.recordDate, avgWeightKg: Number(row.averageWeightKg.toFixed(3)) })),
    [selectedGrowthRows]
  );
  const selectedSalesChart = useMemo(
    () =>
      [...selectedSalesRows]
        .sort((a, b) => a.saleDate.localeCompare(b.saleDate))
        .map((row) => ({ date: row.saleDate, revenue: Number(row.totalRevenue.toFixed(2)) })),
    [selectedSalesRows]
  );
  const selectedMortalityChart = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const row of selectedMortalityRows) {
      byDate.set(row.recordDate, (byDate.get(row.recordDate) ?? 0) + row.birds);
    }
    for (const row of selectedDeadLossRows) {
      const date = toDateLabel(row.adjustedAt || row.createdAt);
      if (!date) {
        continue;
      }
      byDate.set(date, (byDate.get(date) ?? 0) + row.quantity);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, birds]) => ({ date, deadBirds: birds }));
  }, [selectedDeadLossRows, selectedMortalityRows]);
  const selectedExpenseCategoryChart = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of selectedExpenseRows) {
      grouped.set(row.category, (grouped.get(row.category) ?? 0) + row.amount);
    }
    return [...grouped.entries()].map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }));
  }, [selectedExpenseRows]);

  const selectedEventRows = useMemo<BatchEventRow[]>(() => {
    const rows: BatchEventRow[] = [];
    for (const row of selectedExpenseRows) {
      rows.push({
        id: `expense-${row.id ?? `${row.expenseDate}-${row.description}`}`,
        date: row.expenseDate,
        event: "expense",
        note: `${row.category.toUpperCase()} - ${row.description}`,
        amount: row.amount
      });
    }
    for (const row of selectedFeedRows) {
      rows.push({
        id: `feed-${row.id ?? `${row.recordDate}-${row.batchId}`}`,
        date: row.recordDate,
        event: "feed",
        note: `${row.type.toUpperCase()} feed from ${row.supplier}`,
        amount: (row.pricePerTon / 1000) * row.quantityKg
      });
    }
    for (const row of selectedSalesRows) {
      rows.push({
        id: `sale-${row.id ?? `${row.saleDate}-${row.buyerName}`}`,
        date: row.saleDate,
        event: "sale",
        note: `Sold to ${row.buyerName}`,
        birds: row.birdCount,
        amount: row.totalRevenue
      });
    }
    for (const row of selectedMortalityRows) {
      rows.push({
        id: `mortality-${row.id ?? `${row.recordDate}-${row.batchId}`}`,
        date: row.recordDate,
        event: "mortality",
        note: row.cause || "Mortality event",
        birds: row.birds
      });
    }
    for (const row of selectedDeadLossRows) {
      rows.push({
        id: `deadloss-${row.id ?? toDateLabel(row.adjustedAt || row.createdAt)}`,
        date: toDateLabel(row.adjustedAt || row.createdAt),
        event: "dead_loss_adjustment",
        note: row.note || "Dead/loss adjustment",
        birds: row.quantity
      });
    }
    for (const row of selectedGrowthRows) {
      rows.push({
        id: `growth-${row.id ?? `${row.recordDate}-${row.batchId}`}`,
        date: row.recordDate,
        event: "growth",
        note: `Average weight ${row.averageWeightKg.toFixed(3)} kg (sample ${formatNumber(row.sampleSize)})`
      });
    }
    return rows.sort((a, b) => compareDateTimeDesc(a.date, b.date));
  }, [selectedDeadLossRows, selectedExpenseRows, selectedFeedRows, selectedGrowthRows, selectedMortalityRows, selectedSalesRows]);

  const selectedDeathLedgerRows = useMemo(
    () =>
      [
        ...selectedMortalityRows.map((row) => ({
          id: `mortality-${row.id ?? `${row.recordDate}-${row.batchId}`}`,
          date: row.recordDate,
          recordedAt: row.recordDate,
          source: "mortality_log",
          birds: row.birds,
          note: row.cause || "-"
        })),
        ...selectedDeadLossRows.map((row) => ({
          id: `dead-loss-${row.id ?? toDateLabel(row.adjustedAt || row.createdAt)}`,
          date: toDateLabel(row.adjustedAt || row.createdAt),
          recordedAt: row.adjustedAt || row.createdAt,
          source: "dead_loss_adjustment",
          birds: row.quantity,
          note: row.note || "-"
        }))
      ].sort((a, b) => compareDateTimeDesc(a.date, b.date)),
    [selectedDeadLossRows, selectedMortalityRows]
  );

  const exportSelectedBatchPdf = async (): Promise<void> => {
    if (!selectedBatch) {
      return;
    }
    try {
      await exportSystemReportPdf({
        reportTitle: `Batch Detailed Report - ${selectedBatch.batchId}`,
        periodLabel: `Arrival ${selectedBatch.arrivalDate} | Status ${selectedBatch.status}`,
        generatedAtLabel: new Date().toLocaleString("en-EG"),
        summaryRows: [
          { metric: "Batch", value: selectedBatch.batchId },
          { metric: "Supplier", value: selectedBatch.supplierHatchery || "-" },
          { metric: "Breed", value: selectedBatch.breed.toUpperCase() },
          { metric: "House", value: selectedBatch.assignedHouse },
          { metric: "Initial Chicks", value: formatNumber(selectedBatch.initialChickCount) },
          { metric: "Alive Birds", value: formatNumber(selectedBatch.currentAliveCount) },
          { metric: "Sold Birds", value: formatNumber(selectedSoldBirds) },
          { metric: "Dead Birds (All Logs)", value: formatNumber(selectedDeadTotal) },
          { metric: "Feed Used (kg)", value: selectedFeedKg.toFixed(2) },
          { metric: "Current Avg Weight (kg)", value: selectedAvgWeight.toFixed(3) },
          { metric: "FCR", value: selectedFcr.toFixed(3) },
          { metric: "Sales Revenue", value: formatCurrency(selectedSalesRevenue) },
          { metric: "Batch Expenses", value: formatCurrency(selectedExpenseTotal) },
          { metric: "Feed Cost (From Logs)", value: formatCurrency(selectedFeedCost) },
          { metric: "Base Chick Cost", value: formatCurrency(selectedBaseCost) },
          { metric: "Known Cost", value: formatCurrency(selectedKnownCost) },
          { metric: "Realized Profit", value: formatCurrency(selectedRealizedProfit) }
        ],
        sections: [
          {
            title: "Sales Ledger",
            columns: ["Date", "Buyer", "Birds", "Avg Weight", "Price/Kg", "Revenue"],
            rows: selectedSalesRows.map((row) => [
              row.saleDate,
              row.buyerName,
              row.birdCount,
              row.averageWeightKg.toFixed(2),
              formatCurrency(row.pricePerKg),
              formatCurrency(row.totalRevenue)
            ])
          },
          {
            title: "Expense Ledger",
            columns: ["Date", "Category", "Description", "Amount"],
            rows: selectedExpenseRows.map((row) => [
              row.expenseDate,
              row.category,
              row.description,
              formatCurrency(row.amount)
            ])
          },
          {
            title: "Feed Ledger",
            columns: ["Date", "Type", "Qty Kg", "Supplier", "Price/Ton", "Estimated Cost"],
            rows: selectedFeedRows.map((row) => [
              row.recordDate,
              row.type,
              row.quantityKg.toFixed(2),
              row.supplier,
              formatCurrency(row.pricePerTon),
              formatCurrency((row.pricePerTon / 1000) * row.quantityKg)
            ])
          },
          {
            title: "Mortality & Dead/Loss Ledger",
            columns: ["Date", "Type", "Birds", "Notes"],
            rows: [
              ...selectedMortalityRows.map((row) => [row.recordDate, "mortality", row.birds, row.cause || "-"]),
              ...selectedDeadLossRows.map((row) => [
                toDateLabel(row.adjustedAt || row.createdAt),
                "dead_loss_adjustment",
                row.quantity,
                row.note || "-"
              ])
            ].sort((a, b) => String(b[0]).localeCompare(String(a[0])))
          },
          {
            title: "Growth Ledger",
            columns: ["Date", "Avg Weight Kg", "Sample Size"],
            rows: selectedGrowthRows.map((row) => [row.recordDate, row.averageWeightKg.toFixed(3), row.sampleSize])
          },
          {
            title: "Batch Timeline",
            columns: ["Date", "Event", "Birds", "Amount", "Details"],
            rows: selectedEventRows.map((row) => [
              row.date,
              row.event,
              row.birds ?? "-",
              typeof row.amount === "number" ? formatCurrency(row.amount) : "-",
              row.note
            ])
          }
        ],
        fileName: `batch-${selectedBatch.batchId}-details-report`
      });
      toast.success("Batch details PDF exported");
    } catch (error) {
      console.error(error);
      toast.error("Unable to export batch details PDF");
    }
  };

  useEffect(() => {
    if (activeTab === "details" && !selectedBatch) {
      setActiveTab("table");
    }
  }, [activeTab, selectedBatch]);

  const resolveHealthStatus = (action: BatchHealthAction): { color: "green" | "amber" | "default"; icon: React.ReactNode; label: string } => {
    if (action.status === "due_now")   return { color: "amber", icon: <IconAlert />, label: "Due now" };
    if (action.status === "completed") return { color: "green", icon: <IconCheck />, label: "Done" };
    return { color: "default", icon: <IconClock />, label: `In ${action.daysUntil}d` };
  };

  const openBatchDetails = (row: BatchRow): void => {
    setSelectedBatchId(row.docId ?? row.id);
    setActiveTab("details");
  };

  const columns = useMemo<ColumnDef<BatchRow>[]>(() => [
    {
      accessorKey: "batchId", header: "Batch",
      cell: ({ row }) => (
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: T.brand, fontFamily: T.mono, fontSize: 13 }}>{row.original.batchId}</p>
          <p style={{ margin: 0, fontSize: 11, color: T.textMuted }}>{row.original.supplier || "—"}</p>
        </div>
      )
    },
    { accessorKey: "ageDays", header: "Age", cell: ({ row }) => <span style={{ fontFamily: T.mono, fontSize: 13 }}>{row.original.ageDays}d</span> },
    { accessorKey: "alive", header: "Alive", cell: ({ row }) => <span style={{ fontFamily: T.mono, fontWeight: 600, color: T.profit }}>{formatNumber(row.original.alive)}</span> },
    { accessorKey: "mortalityText", header: "Mortality", cell: ({ row }) => <span style={{ fontSize: 12, color: T.textMuted, fontFamily: T.mono }}>{row.original.mortalityText}</span> },
    { accessorKey: "breed", header: "Breed", cell: ({ row }) => <span style={{ fontSize: 12, textTransform: "capitalize", fontWeight: 600 }}>{row.original.breed}</span> },
    { accessorKey: "house", header: "House", cell: ({ row }) => <span style={{ fontSize: 12 }}>{row.original.house}</span> },
    { accessorKey: "batchCost", header: "Cost", cell: ({ row }) => <span style={{ fontFamily: T.mono, fontSize: 13 }}>{row.original.batchCost}</span> },
    {
      accessorKey: "status", header: "Status",
      cell: ({ row }) => <Chip color={row.original.status === "active" ? "green" : "default"}>{row.original.status}</Chip>
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => openBatchDetails(row.original)}
          style={{
            border: `1px solid ${T.borderMid}`,
            background: T.surfaceAlt,
            color: T.brandDark,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            cursor: "pointer"
          }}
        >
          Open
        </button>
      )
    }
  ], []);

  // ── TABS ──────────────────────────────────────────────────────────────────
  const tabs: Array<{ id: "form" | "table" | "recommendations" | "details"; label: string }> = [
    { id: "form" as const, label: "New Batch" },
    { id: "table" as const, label: `All Batches (${batches.length})` },
    { id: "recommendations" as const, label: `Daily Plans (${activeBatches})` }
  ];
  if (selectedBatch) {
    tabs.push({ id: "details", label: `Batch Details (${selectedBatch.batchId})` });
  }

  return (
    <section className="page-enter" style={{ background: T.pageBg, minHeight: "100vh", padding: "24px 28px", fontFamily: T.sans, color: T.text }}>

      {/* ── Page Header ── */}
      <div className="panel-enter" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, color: T.brand, textTransform: "uppercase", letterSpacing: "0.12em" }}>Farm Operations</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.025em", lineHeight: 1.1 }}>Batch Management</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: T.textMuted }}>Manage broiler cycle batches from arrival to market-offload with live KPIs.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
            <PulseDot color={T.brand} />
            <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>Active batches:</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.brand, fontFamily: T.mono }}>{activeBatches}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: T.profitBg, border: `1px solid ${T.profitBorder}`, borderRadius: 12 }}>
            <IconBird />
            <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>Live birds:</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.profit, fontFamily: T.mono }}>{formatNumber(totalAlive)}</span>
          </div>
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="panel-enter" style={{ animationDelay: "0.05s", display: "flex", gap: 6, marginBottom: 20, padding: "6px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, width: "fit-content" }}>
        {tabs.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ TAB: NEW BATCH FORM ═══════════════════════ */}
      {activeTab === "form" && (
        <Panel className="scale-enter" style={{ animationDelay: "0.08s" }}>
          <SectionTitle sub="Fill in chick details — batch cost auto-calculates from count × price, and expected date from arrival + growout days.">
            New Batch Intake
          </SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
            {/* Batch ID */}
            <div>
              <FieldLabel>Batch ID</FieldLabel>
              <input className="form-input" value={form.batchId} onChange={e => setForm(p => ({ ...p, batchId: e.target.value }))} />
            </div>
            {/* Arrival Date */}
            <div>
              <FieldLabel>Arrival Date</FieldLabel>
              <input type="date" className="form-input" value={form.arrivalDate} onChange={e => {
                const arrivalDate = e.target.value;
                setForm(p => ({ ...p, arrivalDate, expectedSellingDate: expectedDateEdited ? p.expectedSellingDate : addDaysToIsoDate(arrivalDate, DEFAULT_GROWOUT_DAYS) }));
              }} />
            </div>
            {/* Supplier */}
            <div>
              <FieldLabel>Supplier Hatchery</FieldLabel>
              <input className="form-input" value={form.supplierHatchery} onChange={e => setForm(p => ({ ...p, supplierHatchery: e.target.value }))} placeholder="e.g. Cairo Hatchery" />
            </div>
            {/* Age at Arrival */}
            <div>
              <FieldLabel>Chick Age at Arrival (days)</FieldLabel>
              <input type="number" min={0} className="form-input" value={form.chickAgeAtArrivalDays ?? 0} onChange={e => setForm(p => ({ ...p, chickAgeAtArrivalDays: Math.max(Number(e.target.value), 0) }))} />
            </div>
            {/* Chick Price */}
            <div>
              <FieldLabel>Chick Price (EGP)</FieldLabel>
              <input type="number" className="form-input" value={form.chickPrice} onChange={e => {
                const chickPrice = Number(e.target.value);
                setForm(p => ({ ...p, chickPrice, batchCost: batchCostEdited ? p.batchCost : Number((p.initialChickCount * chickPrice).toFixed(2)) }));
              }} />
            </div>
            {/* Initial Count */}
            <div>
              <FieldLabel>Initial Count</FieldLabel>
              <input type="number" className="form-input" value={form.initialChickCount} onChange={e => {
                const initialChickCount = Number(e.target.value);
                setForm(p => ({ ...p, initialChickCount, batchCost: batchCostEdited ? p.batchCost : Number((initialChickCount * p.chickPrice).toFixed(2)) }));
              }} />
            </div>
            {/* Breed */}
            <div>
              <FieldLabel>Breed</FieldLabel>
              <select className="form-input" value={form.breed} onChange={e => setForm(p => ({ ...p, breed: e.target.value as Batch["breed"] }))}>
                <option value="ross">Ross</option>
                <option value="cobb">Cobb</option>
                <option value="hubbard">Hubbard</option>
              </select>
            </div>
            {/* Assigned House */}
            <div>
              <FieldLabel>Assigned House</FieldLabel>
              <input className="form-input" value={form.assignedHouse} onChange={e => setForm(p => ({ ...p, assignedHouse: e.target.value }))} />
            </div>
            {/* Target Weight */}
            <div>
              <FieldLabel>Target Sell Weight (kg)</FieldLabel>
              <input type="number" step="0.01" className="form-input" value={form.targetSellingWeight} onChange={e => setForm(p => ({ ...p, targetSellingWeight: Number(e.target.value) }))} />
            </div>
            {/* Expected Selling Date */}
            <div>
              <FieldLabel>Expected Selling Date</FieldLabel>
              <input type="date" className="form-input" value={form.expectedSellingDate} onChange={e => { setExpectedDateEdited(true); setForm(p => ({ ...p, expectedSellingDate: e.target.value })); }} />
            </div>
            {/* Batch Cost */}
            <div>
              <FieldLabel>Batch Cost (EGP)</FieldLabel>
              <input type="number" className="form-input" value={form.batchCost ?? 0} onChange={e => { setBatchCostEdited(true); setForm(p => ({ ...p, batchCost: Number(e.target.value) })); }} />
            </div>
          </div>

          {/* Preview strip */}
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Cost per chick", value: `EGP ${form.chickPrice}` },
              { label: "Total birds", value: formatNumber(form.initialChickCount) },
              { label: "Batch cost", value: formatCurrency(form.batchCost ?? 0) },
              { label: "Days to market", value: `~${DEFAULT_GROWOUT_DAYS}d` },
            ].map(item => (
              <div key={item.label} style={{ padding: "8px 14px", background: T.brandLight, border: `1px solid #bdd5c8`, borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: T.brandMid, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.brand, fontFamily: T.mono }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <button className="submit-btn" onClick={() => void submit()} disabled={!form.supplierHatchery || !profile}>
              <IconPlus /> Add Batch
            </button>
            {!form.supplierHatchery && (
              <span style={{ marginLeft: 12, fontSize: 12, color: T.textMuted }}>Supplier hatchery name is required</span>
            )}
          </div>
        </Panel>
      )}

      {/* ═══════════════════════ TAB: BATCHES TABLE ═══════════════════════ */}
      {activeTab === "table" && (
        <Panel className="scale-enter" style={{ animationDelay: "0.08s" }}>
          <SectionTitle sub="All batches sorted by arrival date. Click any row for details.">
            Batches Overview
          </SectionTitle>
          <DataTable columns={columns} data={tableRows} searchColumn="batchId" searchPlaceholder="Search batch ID..." />
        </Panel>
      )}

      {/* ═══════════════════════ TAB: BATCH DETAILS ═══════════════════════ */}
      {activeTab === "details" && selectedBatch && (
        <div className="scale-enter" style={{ animationDelay: "0.08s", display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel>
            <SectionTitle
              sub={`Arrival ${selectedBatch.arrivalDate} • ${selectedBatch.breed.toUpperCase()} • ${selectedBatch.assignedHouse}`}
              action={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("table")}
                    style={{
                      border: `1px solid ${T.borderMid}`,
                      background: T.surfaceAlt,
                      color: T.textMid,
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "8px 12px",
                      cursor: "pointer"
                    }}
                  >
                    Back to table
                  </button>
                  <button className="submit-btn" type="button" onClick={() => void exportSelectedBatchPdf()}>
                    <IconDownload /> Export PDF Report
                  </button>
                </div>
              }
            >
              Batch Deep Dive: {selectedBatch.batchId}
            </SectionTitle>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {[
                { label: "Initial Chicks", value: formatNumber(selectedBatch.initialChickCount) },
                { label: "Alive Birds", value: formatNumber(selectedBatch.currentAliveCount) },
                { label: "Sold Birds", value: formatNumber(selectedSoldBirds) },
                { label: "Dead Birds", value: formatNumber(selectedDeadTotal) },
                { label: "Feed Used", value: `${selectedFeedKg.toFixed(2)} kg` },
                { label: "Avg Weight", value: `${selectedAvgWeight.toFixed(3)} kg` },
                { label: "Sales Revenue", value: formatCurrency(selectedSalesRevenue) },
                { label: "Known Cost", value: formatCurrency(selectedKnownCost) },
                { label: "FCR", value: selectedFcr.toFixed(3) },
                { label: "System Profit", value: formatCurrency(selectedSystemProfit) }
              ].map((metric) => (
                <div key={metric.label} className="stat-tile">
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: T.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}
                  >
                    {metric.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{metric.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Panel>
              <SectionTitle sub="Revenue from sales over time">Sales Revenue Trend</SectionTitle>
              {selectedSalesChart.length > 0 ? (
                <AreaTrendChart data={selectedSalesChart} xKey="date" yKey="revenue" color="#1f7a63" />
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>No sales records for this batch yet.</p>
              )}
            </Panel>

            <Panel>
              <SectionTitle sub="Daily/recorded feed quantity">Feed Consumption Trend</SectionTitle>
              {selectedFeedChart.length > 0 ? (
                <BarTrendChart data={selectedFeedChart} xKey="date" yKey="quantityKg" color="#2e6b4e" />
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>No feed logs for this batch yet.</p>
              )}
            </Panel>

            <Panel>
              <SectionTitle sub="Average weight progression">Growth Trend</SectionTitle>
              {selectedGrowthChart.length > 0 ? (
                <LineTrendChart data={selectedGrowthChart} xKey="date" yKey="avgWeightKg" color="#2563eb" />
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>No growth logs for this batch yet.</p>
              )}
            </Panel>

            <Panel>
              <SectionTitle sub="Combined mortality logs + dead/loss adjustments">Deaths Trend</SectionTitle>
              {selectedMortalityChart.length > 0 ? (
                <BarTrendChart data={selectedMortalityChart} xKey="date" yKey="deadBirds" color="#b91c1c" />
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>No death/loss records for this batch yet.</p>
              )}
            </Panel>

            <Panel>
              <SectionTitle sub="Where money was spent">Expense by Category</SectionTitle>
              {selectedExpenseCategoryChart.length > 0 ? (
                <BarTrendChart data={selectedExpenseCategoryChart} xKey="category" yKey="amount" color="#d97706" />
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>No expense records linked to this batch yet.</p>
              )}
            </Panel>
          </div>

          <Panel>
            <SectionTitle sub="All events for this batch sorted by date and time">Batch Timeline</SectionTitle>
            <Table>
              <TableHead>
                <tr>
                  <TH>Date</TH>
                  <TH>Event</TH>
                  <TH>Birds</TH>
                  <TH>Amount</TH>
                  <TH>Details</TH>
                </tr>
              </TableHead>
              <TableBody>
                {selectedEventRows.map((row) => (
                  <tr key={row.id}>
                    <TD>{row.date}</TD>
                    <TD style={{ fontFamily: T.mono }}>{row.event}</TD>
                    <TD>{typeof row.birds === "number" ? formatNumber(row.birds) : "-"}</TD>
                    <TD>{typeof row.amount === "number" ? formatCurrency(row.amount) : "-"}</TD>
                    <TD>{row.note}</TD>
                  </tr>
                ))}
                {selectedEventRows.length === 0 ? (
                  <tr>
                    <TD colSpan={5} style={{ color: T.textMuted }}>
                      No events found for this batch.
                    </TD>
                  </tr>
                ) : null}
              </TableBody>
            </Table>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            <Panel>
              <SectionTitle sub="Every sale linked to this batch">Sales Ledger</SectionTitle>
              <Table>
                <TableHead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Buyer</TH>
                    <TH>Birds</TH>
                    <TH>Avg Weight (kg)</TH>
                    <TH>Price/Kg</TH>
                    <TH>Revenue</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {selectedSalesRows.map((row) => (
                    <tr key={row.id ?? `${row.saleDate}-${row.buyerName}`}>
                      <TD>{row.saleDate}</TD>
                      <TD>{row.buyerName}</TD>
                      <TD>{formatNumber(row.birdCount)}</TD>
                      <TD>{row.averageWeightKg.toFixed(2)}</TD>
                      <TD>{formatCurrency(row.pricePerKg)}</TD>
                      <TD>{formatCurrency(row.totalRevenue)}</TD>
                    </tr>
                  ))}
                  {selectedSalesRows.length === 0 ? (
                    <tr>
                      <TD colSpan={6} style={{ color: T.textMuted }}>
                        No sales records found for this batch.
                      </TD>
                    </tr>
                  ) : null}
                </TableBody>
              </Table>
            </Panel>

            <Panel>
              <SectionTitle sub="All expenses paid for this batch">Expense Ledger</SectionTitle>
              <Table>
                <TableHead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Category</TH>
                    <TH>Description</TH>
                    <TH>Amount</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {selectedExpenseRows.map((row) => (
                    <tr key={row.id ?? `${row.expenseDate}-${row.description}`}>
                      <TD>{row.expenseDate}</TD>
                      <TD style={{ textTransform: "capitalize" }}>{row.category}</TD>
                      <TD>{row.description}</TD>
                      <TD>{formatCurrency(row.amount)}</TD>
                    </tr>
                  ))}
                  {selectedExpenseRows.length === 0 ? (
                    <tr>
                      <TD colSpan={4} style={{ color: T.textMuted }}>
                        No expenses linked to this batch.
                      </TD>
                    </tr>
                  ) : null}
                </TableBody>
              </Table>
            </Panel>

            <Panel>
              <SectionTitle sub="Feed purchase and usage records">Feed Ledger</SectionTitle>
              <Table>
                <TableHead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Type</TH>
                    <TH>Supplier</TH>
                    <TH>Qty (kg)</TH>
                    <TH>Price/Ton</TH>
                    <TH>Estimated Cost</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {selectedFeedRows.map((row) => (
                    <tr key={row.id ?? `${row.recordDate}-${row.batchId}`}>
                      <TD>{row.recordDate}</TD>
                      <TD style={{ textTransform: "capitalize" }}>{row.type}</TD>
                      <TD>{row.supplier}</TD>
                      <TD>{row.quantityKg.toFixed(2)}</TD>
                      <TD>{formatCurrency(row.pricePerTon)}</TD>
                      <TD>{formatCurrency((row.pricePerTon / 1000) * row.quantityKg)}</TD>
                    </tr>
                  ))}
                  {selectedFeedRows.length === 0 ? (
                    <tr>
                      <TD colSpan={6} style={{ color: T.textMuted }}>
                        No feed records linked to this batch.
                      </TD>
                    </tr>
                  ) : null}
                </TableBody>
              </Table>
            </Panel>

            <Panel>
              <SectionTitle sub="Where dead chicks are recorded for this batch">Mortality & Dead/Loss Ledger</SectionTitle>
              <Table>
                <TableHead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Logged At</TH>
                    <TH>Source</TH>
                    <TH>Birds</TH>
                    <TH>Note / Cause</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {selectedDeathLedgerRows.map((row) => (
                    <tr key={row.id}>
                      <TD>{row.date}</TD>
                      <TD>{formatDateTimeLocal(row.recordedAt)}</TD>
                      <TD style={{ fontFamily: T.mono }}>{row.source}</TD>
                      <TD>{formatNumber(row.birds)}</TD>
                      <TD>{row.note}</TD>
                    </tr>
                  ))}
                  {selectedDeathLedgerRows.length === 0 ? (
                    <tr>
                      <TD colSpan={5} style={{ color: T.textMuted }}>
                        No mortality/dead-loss logs for this batch.
                      </TD>
                    </tr>
                  ) : null}
                </TableBody>
              </Table>
            </Panel>

            <Panel>
              <SectionTitle sub="Weight sample updates for this batch">Growth Ledger</SectionTitle>
              <Table>
                <TableHead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Average Weight (kg)</TH>
                    <TH>Sample Size</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {selectedGrowthRows.map((row) => (
                    <tr key={row.id ?? `${row.recordDate}-${row.batchId}`}>
                      <TD>{row.recordDate}</TD>
                      <TD>{row.averageWeightKg.toFixed(3)}</TD>
                      <TD>{formatNumber(row.sampleSize)}</TD>
                    </tr>
                  ))}
                  {selectedGrowthRows.length === 0 ? (
                    <tr>
                      <TD colSpan={3} style={{ color: T.textMuted }}>
                        No growth updates for this batch.
                      </TD>
                    </tr>
                  ) : null}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </div>
      )}

      {/* ═══════════════════════ TAB: RECOMMENDATIONS ═══════════════════════ */}
      {activeTab === "recommendations" && (
        <div className="scale-enter" style={{ animationDelay: "0.08s", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "10px 16px", background: T.warnBg, border: `1px solid ${T.warnBorder}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlert />
            <p style={{ margin: 0, fontSize: 12, color: T.warn, fontWeight: 500 }}>
              Confirm all medication and vaccination details with your farm veterinarian before administration.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            <div className="stat-tile">
              <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Feed Needed To Day {STANDARD_GROWOUT_DAY}
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text, fontFamily: T.mono }}>
                {recommendationsTotals.feedRemainingTo42Kg.toFixed(1)} kg
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>
                Remaining across active batches
              </p>
            </div>
            <div className="stat-tile">
              <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Feed Already Logged
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.brand, fontFamily: T.mono }}>
                {recommendationsTotals.feedLoggedKg.toFixed(1)} kg
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>
                Feed consumed/recorded so far
              </p>
            </div>
            <div className="stat-tile">
              <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Available Feed Stock
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.blue, fontFamily: T.mono }}>
                {availableFeedKg.toFixed(1)} kg
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>
                From inventory feed items
              </p>
            </div>
            <div className="stat-tile">
              <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Water To Day {STANDARD_GROWOUT_DAY}
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text, fontFamily: T.mono }}>
                {recommendationsTotals.waterRemainingTo42Liters.toFixed(1)} L
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>
                {trackedWaterAvailableLiters > 0
                  ? `Tracked water stock: ${trackedWaterAvailableLiters.toFixed(1)} L`
                  : "Water stock not tracked in inventory"}
              </p>
            </div>
          </div>
          {totalFeedShortfallKg > 0 ? (
            <div style={{ padding: "10px 16px", background: T.lossBg, border: `1px solid ${T.lossBorder}`, borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: T.loss, fontWeight: 700 }}>
                Feed shortfall to day {STANDARD_GROWOUT_DAY}: {totalFeedShortfallKg.toFixed(1)} kg
              </p>
            </div>
          ) : (
            <div style={{ padding: "10px 16px", background: T.profitBg, border: `1px solid ${T.profitBorder}`, borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: T.profit, fontWeight: 700 }}>
                Feed stock is enough for active batches to day {STANDARD_GROWOUT_DAY}. Surplus: {(availableFeedKg - recommendationsTotals.feedRemainingTo42Kg).toFixed(1)} kg
              </p>
            </div>
          )}

          {activeBatchRecommendations.map(({ batch, plan, cycleTargetTo42FeedKg, cycleTargetTo42WaterLiters, loggedFeedKg, remainingFeedTo42Kg, remainingWaterTo42Liters, feedCoveragePercent, feedShortfallKg }, batchIdx) => {
            const isExpanded = expandedBatch === (batch.id ?? batch.batchId);
            const bKey = batch.id ?? batch.batchId;
            return (
              <div key={bKey} className="batch-card" style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden",
                animationDelay: `${batchIdx * 0.07}s`,
              }}>
                {/* Card header — always visible, clickable to expand */}
                <button
                  onClick={() => setExpandedBatch(isExpanded ? null : bKey)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "18px 22px", textAlign: "left" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: T.brandLight, border: `1px solid #bdd5c8`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IconBird />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{batch.batchId}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted }}>
                          {batch.assignedHouse} · {batch.breed.toUpperCase()} · Age <strong style={{ color: T.brand }}>{plan.ageDays}d</strong> · {formatNumber(plan.birdsAlive)} birds
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Chip color="sage">{plan.stageLabel}</Chip>
                      <Chip color="default">{plan.feedTypeRecommendation.toUpperCase()} feed</Chip>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}`, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Quick stats row — always visible */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
                    {[
                      { label: "Feed today", value: `${plan.dailyFeedKg} kg`, sub: `${plan.feedPerBirdGrams}g/bird`, barVal: plan.dailyFeedKg, barMax: 500, color: T.brand },
                      { label: "Water today", value: `${plan.dailyWaterLiters} L`, sub: `${plan.waterPerBirdMl}ml/bird`, barVal: plan.dailyWaterLiters, barMax: 2000, color: "#2563eb" },
                      { label: `Feed to day ${STANDARD_GROWOUT_DAY}`, value: `${remainingFeedTo42Kg} kg`, sub: `${Math.max(plan.remainingDaysTo42, 0)}d left`, barVal: remainingFeedTo42Kg, barMax: Math.max(cycleTargetTo42FeedKg, 1), color: "#d97706" },
                      { label: "Lighting", value: `${plan.lightHours}h/day`, sub: `${plan.remainingDaysTo42}d to day ${STANDARD_GROWOUT_DAY}`, barVal: plan.lightHours, barMax: 24, color: "#7c3aed" },
                    ].map(item => (
                      <div key={item.label} className="stat-tile">
                        <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{item.value}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>{item.sub}</p>
                        <MiniBar value={item.barVal} max={item.barMax} color={item.color} />
                      </div>
                    ))}
                  </div>
                </button>

                {/* Expanded detail section */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${T.border}`, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, animation: "fadeSlideUp 0.3s cubic-bezier(.22,1,.36,1)" }}>
                    <div style={{ padding: "12px 14px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        Resource Forecast Until Day {STANDARD_GROWOUT_DAY}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                        <div style={{ padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                          <p style={{ margin: 0, fontSize: 10, color: T.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Feed Target (cycle)</p>
                          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, fontFamily: T.mono }}>{cycleTargetTo42FeedKg} kg</p>
                        </div>
                        <div style={{ padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                          <p style={{ margin: 0, fontSize: 10, color: T.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Feed Logged (eaten)</p>
                          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: T.brand, fontFamily: T.mono }}>{loggedFeedKg} kg</p>
                        </div>
                        <div style={{ padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                          <p style={{ margin: 0, fontSize: 10, color: T.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Feed Remaining</p>
                          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{remainingFeedTo42Kg} kg</p>
                        </div>
                        <div style={{ padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                          <p style={{ margin: 0, fontSize: 10, color: T.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Water Remaining</p>
                          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, fontFamily: T.mono }}>{remainingWaterTo42Liters} L</p>
                        </div>
                      </div>
                      <p style={{ margin: "8px 0 0", fontSize: 11, color: T.textMid }}>
                        Feed coverage from available stock: <strong>{Math.min(feedCoveragePercent, 999).toFixed(1)}%</strong>
                        {feedShortfallKg > 0 ? ` • Shortfall: ${feedShortfallKg.toFixed(1)} kg` : " • Sufficient for this batch"}
                        {` • Water target (cycle): ${cycleTargetTo42WaterLiters.toFixed(1)} L`}
                        {trackedWaterAvailableLiters > 0
                          ? ` • Tracked water stock: ${trackedWaterAvailableLiters.toFixed(1)} L`
                          : " • Water stock is not tracked in inventory"}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 10.5, color: T.textMuted }}>
                        Feed remaining is calculated as target-to-day-{STANDARD_GROWOUT_DAY} minus logged feed entries for this batch.
                      </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                    {/* Health Timeline */}
                    <div>
                      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Vaccine & Medication Timeline (Egypt Market Examples)</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {plan.healthActions.map(action => {
                          const { color, icon, label } = resolveHealthStatus(action);
                          return (
                            <div key={action.id} className="health-row" style={{
                              padding: "11px 14px", borderRadius: 10,
                              background: T.surfaceAlt, border: `1px solid ${T.border}`,
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{action.title}</p>
                                <Chip color={color}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{icon} {label}</span>
                                </Chip>
                              </div>
                              <p style={{ margin: "3px 0 6px", fontSize: 11, color: T.textMuted }}>Day {action.dayStart}–{action.dayEnd}</p>
                              <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc" }}>
                                {action.details.map(d => (
                                  <li key={`${action.id}-${d}`} style={{ fontSize: 11.5, color: T.textMid, lineHeight: 1.6 }}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Checklist + Equipment */}
                    <div>
                      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Daily Feeding & Watering Program</p>
                      <div style={{ marginBottom: 12, padding: "12px 14px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div style={{ padding: "7px 9px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Feedings / day</p>
                            <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{plan.feedingsPerDay}</p>
                          </div>
                          <div style={{ padding: "7px 9px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Water checks / day</p>
                            <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{plan.waterChecksPerDay}</p>
                          </div>
                        </div>
                        <p style={{ margin: "10px 0 0", fontSize: 11, color: T.textMid }}>
                          <strong>Feed times:</strong> {plan.feedingTimes.join(" · ")}
                        </p>
                        <p style={{ margin: "5px 0 0", fontSize: 11, color: T.textMid }}>
                          <strong>Water check times:</strong> {plan.waterCheckTimes.join(" · ")}
                        </p>
                        <p style={{ margin: "5px 0 0", fontSize: 11, color: T.textMid }}>
                          <strong>Line flush times:</strong> {plan.waterLineFlushTimes.join(" · ")}
                        </p>
                        <p style={{ margin: "7px 0 0", fontSize: 10.5, color: T.textMuted, lineHeight: 1.45 }}>
                          Use cool clean water, avoid chlorination during vaccine windows, and verify all birds have equal drinker access after every feed cycle.
                        </p>
                      </div>

                      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Daily Management Checklist</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {plan.managementChecklist.map(item => (
                          <div key={`${bKey}-${item}`} className="checklist-item" style={{ fontSize: 12.5, color: T.textMid }}>
                            <div style={{ marginTop: 2, width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${T.borderMid}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <IconCheck />
                            </div>
                            {item}
                          </div>
                        ))}
                      </div>

                      {/* Equipment baseline */}
                      <div style={{ marginTop: 14, padding: "14px 16px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Equipment Baseline</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {[
                            { label: "Feeders", value: formatNumber(plan.feederCount) },
                            { label: "Bell drinkers", value: formatNumber(plan.bellDrinkerCount) },
                            { label: "Nipples", value: formatNumber(plan.nippleCount) },
                            { label: "Brooders", value: formatNumber(plan.brooderCount) },
                          ].map(eq => (
                            <div key={eq.label} style={{ padding: "6px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7 }}>
                              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>{eq.label}</p>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{eq.value}</p>
                            </div>
                          ))}
                        </div>
                        <p style={{ margin: "10px 0 0", fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
                          Review this plan daily and validate all dosages with your veterinarian.
                        </p>
                      </div>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {activeBatchRecommendations.length === 0 && (
            <Panel style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: T.brandLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <IconBird />
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: T.text }}>No active batches yet</p>
              <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>Create an active batch to see daily feed, water, temperature, lighting, and medication recommendations.</p>
              <button className="submit-btn" style={{ marginTop: 18 }} onClick={() => setActiveTab("form")}>
                <IconPlus /> New Batch
              </button>
            </Panel>
          )}
        </div>
      )}

    </section>
  );
};
