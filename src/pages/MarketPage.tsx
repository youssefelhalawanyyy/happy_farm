import { useMemo, useState } from "react";
import { ExternalLink, RefreshCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { compareDateTimeAsc, compareDateTimeDesc, formatCurrency, formatDateTimeLocal, formatTimeHHMM } from "@/lib/utils";
import { triggerMarketSync } from "@/services/adminService";
import { useAuth } from "@/context/AuthContext";
import type { MarketPriceSnapshot } from "@/types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  pageBg:       "#f4f6f0",
  surface:      "#ffffff",
  surfaceAlt:   "#f9faf6",
  surfaceHover: "#f1f5ee",
  border:       "#e3e8dc",
  borderMid:    "#cdd5c4",
  text:         "#1c2117",
  textMid:      "#48523f",
  textMuted:    "#7a8870",
  brand:        "#2e6b4e",
  brandDark:    "#1d4a35",
  brandLight:   "#e6f0eb",
  brandMid:     "#4a9068",
  profit:       "#15803d",
  profitBg:     "#dcfce7",
  profitBorder: "#bbf7d0",
  loss:         "#b91c1c",
  lossBg:       "#fee2e2",
  lossBorder:   "#fecaca",
  warn:         "#92400e",
  warnBg:       "#fef3c7",
  warnBorder:   "#fde68a",
  cyan:         "#0e7490",
  cyanBg:       "#cffafe",
  cyanBorder:   "#a5f3fc",
  blue:         "#1e40af",
  blueBg:       "#dbeafe",
  blueBorder:   "#93c5fd",
  purple:       "#6d28d9",
  purpleBg:     "#ede9fe",
  purpleBorder: "#c4b5fd",
  mono:         "'JetBrains Mono','Fira Code','Courier New',monospace",
  sans:         "'DM Sans','Trebuchet MS',system-ui,sans-serif",
};

// ── Inject styles ─────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500&display=swap');

@keyframes fadeIn        { from{opacity:0} to{opacity:1} }
@keyframes fadeSlideUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeSlideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
@keyframes scaleIn       { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
@keyframes slideRight    { from{width:0} to{width:100%} }
@keyframes tickerPulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
@keyframes spinSlow      { to{transform:rotate(360deg)} }
@keyframes numberPop     { 0%{opacity:0;transform:translateY(8px) scale(0.95)} 60%{transform:translateY(-2px) scale(1.02)} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes shimmerLine   { 0%{background-position:-200% center} 100%{background-position:200% center} }
@keyframes dotBlink      { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.6)} }
@keyframes rowSlide      { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }

.mp-page      { animation: fadeIn 0.3s ease both; }
.mp-panel     { animation: fadeSlideUp 0.45s cubic-bezier(.22,1,.36,1) both; }
.mp-scale     { animation: scaleIn 0.35s cubic-bezier(.22,1,.36,1) both; }
.mp-number    { animation: numberPop 0.55s cubic-bezier(.22,1,.36,1) both; }
.mp-row       { animation: rowSlide 0.3s ease both; }

.mp-kpi-card {
  position: relative;
  background: ${T.surface};
  border: 1px solid ${T.border};
  border-radius: 14px;
  padding: 20px 22px;
  overflow: hidden;
  cursor: default;
  transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}
.mp-kpi-card:hover {
  box-shadow: 0 6px 24px rgba(0,0,0,0.07);
  transform: translateY(-3px);
  border-color: ${T.borderMid};
}
.mp-kpi-card::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  background: linear-gradient(135deg, transparent 60%, rgba(46,107,78,0.04) 100%);
  transition: opacity 0.25s;
}
.mp-kpi-card:hover::after { opacity: 1; }

.mp-sync-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px;
  background: ${T.brand}; color: #fff;
  border: none; border-radius: 10px;
  font-size: 13px; font-weight: 700; font-family: ${T.sans};
  cursor: pointer; letter-spacing: 0.01em;
  box-shadow: 0 2px 10px rgba(46,107,78,0.25);
  transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
}
.mp-sync-btn:hover:not(:disabled) {
  background: ${T.brandDark};
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(46,107,78,0.30);
}
.mp-sync-btn:active:not(:disabled) { transform: translateY(0); }
.mp-sync-btn:disabled {
  background: ${T.surfaceAlt}; color: ${T.textMuted};
  border: 1.5px solid ${T.border}; box-shadow: none; cursor: not-allowed;
}

.mp-table-row {
  border-bottom: 1px solid ${T.border};
  transition: background 0.15s;
}
.mp-table-row:last-child { border-bottom: none; }
.mp-table-row:hover { background: ${T.surfaceHover}; }

.mp-source-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600; font-family: ${T.sans};
  background: ${T.surfaceAlt}; color: ${T.textMid}; border: 1px solid ${T.border};
  max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.mp-live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: ${T.brand};
  animation: dotBlink 2s ease-in-out infinite;
  flex-shrink: 0;
}

.mp-spinning { animation: spinSlow 1s linear infinite; }

.mp-ticker-item {
  display: flex; align-items: center; gap: 6px;
  padding: 0 20px;
  white-space: nowrap;
}
.mp-ticker-track {
  display: flex; overflow: hidden;
  border-top: 1px solid ${T.border};
  border-bottom: 1px solid ${T.border};
  background: ${T.surfaceAlt};
  padding: 10px 0;
}

.mp-sparkline-track {
  height: 3px; background: ${T.border}; border-radius: 4px; overflow: hidden; margin-top: 6px;
}
.mp-sparkline-fill {
  height: 100%; border-radius: 4px;
  transition: width 1.1s cubic-bezier(.22,1,.36,1);
}

.mp-link {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 600; color: ${T.brand};
  text-decoration: none; padding: 3px 8px;
  border-radius: 6px; transition: background 0.15s;
}
.mp-link:hover { background: ${T.brandLight}; }
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
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 3, height: 16, background: T.brand, borderRadius: 2 }} />
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.015em", fontFamily: T.sans }}>{children}</h2>
    </div>
    {sub && <p style={{ margin: "4px 0 0 12px", fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{sub}</p>}
  </div>
);

const Panel = ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) => (
  <div className={`mp-panel ${className ?? ""}`} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "22px 24px", ...style }}>
    {children}
  </div>
);

// price change direction indicator
const PriceChange = ({ current, previous }: { current: number; previous?: number }) => {
  if (!previous || previous === 0 || current === previous) return null;
  const up = current > previous;
  const pct = Math.abs(((current - previous) / previous) * 100).toFixed(1);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: up ? T.lossBg : T.profitBg,
      color: up ? T.loss : T.profit,
      border: `1px solid ${up ? T.lossBorder : T.profitBorder}`,
      marginLeft: 6,
    }}>
      {up ? "▲" : "▼"} {pct}%
    </span>
  );
};

// ── Commodity config ─────────────────────────────────────────────────────────
type CommodityKey = "feedPricePerTon" | "dayOldChickPrice" | "liveBroilerPricePerKg" | "cornPricePerTon" | "soybeanMealPricePerTon";

const COMMODITIES: { key: CommodityKey; label: string; unit: string; topColor: string; valueColor: string; icon: string }[] = [
  { key: "feedPricePerTon",         label: "Feed Price",        unit: "/ ton",  topColor: T.brand,  valueColor: T.brand,  icon: "🌾" },
  { key: "dayOldChickPrice",        label: "Day-old Chick",     unit: "/ chick",topColor: T.warn,   valueColor: T.warn,   icon: "🐣" },
  { key: "liveBroilerPricePerKg",   label: "Live Broiler",      unit: "/ kg",   topColor: T.profit, valueColor: T.profit, icon: "🐓" },
  { key: "cornPricePerTon",         label: "Corn",              unit: "/ ton",  topColor: "#d97706",valueColor: "#d97706", icon: "🌽" },
  { key: "soybeanMealPricePerTon",  label: "Soybean Meal",      unit: "/ ton",  topColor: T.blue,   valueColor: T.blue,   icon: "🫘" },
];

// ─────────────────────────────────────────────────────────────────────────────
export const MarketPage = () => {
  injectStyles();

  const { profile, user } = useAuth();
  const { data: market } = useRealtimeCollection<MarketPriceSnapshot>(COLLECTIONS.marketPrices);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState<"overview" | "history">("overview");

  const configuredProviderUrl =
    (import.meta.env.VITE_MARKET_PRICE_PROVIDER_URL as string | undefined) ??
    (import.meta.env.VITE_MARKET_SOURCE_URL as string | undefined);

  const sorted = useMemo(() => [...market].sort((a, b) => compareDateTimeDesc(a.capturedAt, b.capturedAt)), [market]);
  const latest  = sorted[0];
  const previous = sorted[1];

  const trend = useMemo(
    () => [...market].sort((a, b) => compareDateTimeAsc(a.capturedAt, b.capturedAt)).slice(-60).map(row => ({
      time: formatTimeHHMM(row.capturedAt),
      price: row.liveBroilerPricePerKg,
    })),
    [market]
  );

  // min/max for sparkline context
  const broilerPrices = useMemo(() => market.map(r => r.liveBroilerPricePerKg).filter(Boolean), [market]);
  const broilerMin = broilerPrices.length ? Math.min(...broilerPrices) : 0;
  const broilerMax = broilerPrices.length ? Math.max(...broilerPrices) : 1;
  const latestNormalized = latest ? ((latest.liveBroilerPricePerKg - broilerMin) / (broilerMax - broilerMin || 1)) * 100 : 0;

  const syncNow = async () => {
    try {
      setSyncing(true);
      const response = await triggerMarketSync(profile?.uid ?? user?.uid, latest);
      toast.success(response.source === "cloud-function" ? "Market sync completed" : "Cloud sync unavailable. Saved a local fallback snapshot.");
    } catch (error) {
      console.error(error);
      const text = String(error);
      if (text.includes("permission-denied"))   toast.error("Sync failed: permission denied.");
      else if (text.includes("unauthenticated")) toast.error("Sync failed: please sign in again.");
      else toast.error("Sync failed: Cloud Functions unavailable.");
    } finally {
      setSyncing(false);
    }
  };

  const resolveSourceUrl = (row: MarketPriceSnapshot): string | null => {
    if (row.sourceUrl && /^https?:\/\//i.test(row.sourceUrl)) return row.sourceUrl;
    if (/^https?:\/\//i.test(row.source)) return row.source;
    if (row.source === "configured-provider" && configuredProviderUrl && /^https?:\/\//i.test(configuredProviderUrl)) return configuredProviderUrl;
    return null;
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <section className="mp-page" style={{ background: T.pageBg, minHeight: "100vh", padding: "24px 28px", fontFamily: T.sans, color: T.text }}>

      {/* ── Header ── */}
      <div className="mp-panel" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.brand, textTransform: "uppercase", letterSpacing: "0.12em" }}>Egypt Poultry Commodities</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.025em", lineHeight: 1.1 }}>Market Price Monitor</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: T.textMuted }}>Synced every 10 minutes via Cloud Functions. Live broiler, feed, and input commodity prices.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {latest && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", background: T.brandLight, border: `1px solid #bdd5c8`, borderRadius: 10 }}>
              <div className="mp-live-dot" />
              <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>Last sync:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{formatTimeHHMM(latest.capturedAt)}</span>
            </div>
          )}
          <button className="mp-sync-btn" onClick={() => void syncNow()} disabled={syncing}>
            <RefreshCcw size={13} className={syncing ? "mp-spinning" : ""} />
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </div>

      {/* ── No data state ── */}
      {!latest && (
        <div className="mp-panel" style={{ textAlign: "center", padding: "52px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: T.text }}>No market snapshots yet</p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: T.textMuted }}>Click Sync Now to fetch the latest Egypt poultry commodity prices.</p>
          <button className="mp-sync-btn" onClick={() => void syncNow()} disabled={syncing}>
            <RefreshCcw size={13} />Sync Now
          </button>
        </div>
      )}

      {latest && (
        <>
          {/* ── Price ticker strip ── */}
          <div className="mp-panel" style={{ animationDelay: "0.04s", padding: 0, overflow: "hidden", marginBottom: 20 }}>
            <div className="mp-ticker-track">
              {[...COMMODITIES, ...COMMODITIES].map((c, i) => (
                <div key={`${c.key}-${i}`} className="mp-ticker-item">
                  <span style={{ fontSize: 14 }}>{c.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textMid }}>{c.label}:</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: c.valueColor, fontFamily: T.mono }}>
                    {formatCurrency((latest as any)[c.key])}
                  </span>
                  <PriceChange current={(latest as any)[c.key]} previous={previous ? (previous as any)[c.key] : undefined} />
                  <span style={{ marginLeft: 16, color: T.border, fontSize: 16 }}>·</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="mp-panel" style={{ animationDelay: "0.07s", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 20 }}>
            {COMMODITIES.map((c, i) => {
              const value = (latest as any)[c.key] as number;
              const prevValue = previous ? (previous as any)[c.key] as number : undefined;
              return (
                <div key={c.key} className="mp-kpi-card mp-number" style={{ animationDelay: `${0.09 + i * 0.05}s`, borderTop: `3px solid ${c.topColor}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</span>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
                  </div>
                  <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, color: c.valueColor, fontFamily: T.mono, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {formatCurrency(value)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{c.unit}</span>
                    <PriceChange current={value} previous={prevValue} />
                  </div>
                  {/* Mini context bar */}
                  {c.key === "liveBroilerPricePerKg" && broilerPrices.length > 1 && (
                    <div className="mp-sparkline-track">
                      <div className="mp-sparkline-fill" style={{ width: `${latestNormalized}%`, background: c.topColor }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Source bar ── */}
          <div className="mp-panel" style={{ animationDelay: "0.12s", padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Latest source:</span>
            <span className="mp-source-badge">{latest.source}</span>
            {resolveSourceUrl(latest) ? (
              <a href={resolveSourceUrl(latest) as string} target="_blank" rel="noreferrer" className="mp-link">
                Open source <ExternalLink size={12} />
              </a>
            ) : (
              <span style={{ fontSize: 12, color: T.textMuted }}>No source URL for this snapshot.</span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted, fontFamily: T.mono }}>{formatDateTimeLocal(latest.capturedAt)}</span>
          </div>

          {/* ── View toggle ── */}
          <div className="mp-panel" style={{ animationDelay: "0.14s", display: "flex", gap: 5, marginBottom: 20, padding: "5px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, width: "fit-content" }}>
            {[
              { id: "overview" as const, label: "Price Trend" },
              { id: "history"  as const, label: `Snapshot History (${market.length})` },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                style={{
                  padding: "7px 18px", borderRadius: 8,
                  border: activeView === v.id ? `1.5px solid ${T.brand}` : "1.5px solid transparent",
                  background: activeView === v.id ? T.brand : "transparent",
                  color: activeView === v.id ? "#fff" : T.textMuted,
                  fontSize: 13, fontWeight: 600, fontFamily: T.sans, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* ── Trend chart ── */}
          {activeView === "overview" && (
            <Panel className="mp-scale" style={{ animationDelay: "0.16s", marginBottom: 0 }}>
              <SectionTitle sub="Last 60 market snapshots — live broiler price per kg over time.">Live Broiler Price Trend</SectionTitle>

              {/* Range context */}
              {broilerPrices.length > 1 && (
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "Current",  value: formatCurrency(latest.liveBroilerPricePerKg), color: T.profit,  bg: T.profitBg,  border: T.profitBorder },
                    { label: "60-snap High", value: formatCurrency(Math.max(...broilerPrices)), color: T.loss,   bg: T.lossBg,    border: T.lossBorder },
                    { label: "60-snap Low",  value: formatCurrency(Math.min(...broilerPrices)), color: T.blue,   bg: T.blueBg,    border: T.blueBorder },
                    { label: "Snapshots",   value: `${broilerPrices.length}`,                  color: T.textMid, bg: T.surfaceAlt, border: T.border },
                  ].map(item => (
                    <div key={item.label} style={{ padding: "10px 16px", background: item.bg, border: `1px solid ${item.border}`, borderRadius: 10 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: item.color, fontFamily: T.mono }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <LineTrendChart data={trend} xKey="time" yKey="price" color={T.brand} />
            </Panel>
          )}

          {/* ── Snapshot history ── */}
          {activeView === "history" && (
            <Panel className="mp-scale" style={{ animationDelay: "0.16s", padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 16px" }}>
                <SectionTitle sub="All captured market price snapshots, newest first.">Snapshot History</SectionTitle>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
                      {["Date & Time", "Feed / Ton", "Day-old Chick", "Live Broiler / kg", "Corn / Ton", "Soybean / Ton", "Source", "Link"].map(h => (
                        <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => {
                      const srcUrl = resolveSourceUrl(row);
                      const isLatest = i === 0;
                      return (
                        <tr key={row.id} className="mp-table-row mp-row" style={{ animationDelay: `${i * 0.025}s`, background: isLatest ? T.brandLight : "transparent" }}>
                          <td style={{ padding: "11px 16px", fontFamily: T.mono, fontSize: 12, color: T.textMid, whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              {isLatest && <div className="mp-live-dot" style={{ width: 6, height: 6 }} />}
                              {formatDateTimeLocal(row.capturedAt)}
                            </div>
                          </td>
                          <td style={{ padding: "11px 16px", fontFamily: T.mono, fontWeight: 600, color: T.brand }}>{formatCurrency(row.feedPricePerTon)}</td>
                          <td style={{ padding: "11px 16px", fontFamily: T.mono, color: T.warn }}>{formatCurrency(row.dayOldChickPrice)}</td>
                          <td style={{ padding: "11px 16px" }}>
                            <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.profit }}>{formatCurrency(row.liveBroilerPricePerKg)}</span>
                            {i > 0 && sorted[i - 1] && (
                              <PriceChange current={row.liveBroilerPricePerKg} previous={sorted[i - 1]?.liveBroilerPricePerKg} />
                            )}
                          </td>
                          <td style={{ padding: "11px 16px", fontFamily: T.mono, color: "#d97706" }}>{formatCurrency(row.cornPricePerTon)}</td>
                          <td style={{ padding: "11px 16px", fontFamily: T.mono, color: T.blue }}>{formatCurrency(row.soybeanMealPricePerTon)}</td>
                          <td style={{ padding: "11px 16px" }}>
                            <span className="mp-source-badge" style={{ fontSize: 10.5 }}>{row.source}</span>
                          </td>
                          <td style={{ padding: "11px 16px" }}>
                            {srcUrl ? (
                              <a href={srcUrl} target="_blank" rel="noreferrer" className="mp-link">
                                Open <ExternalLink size={11} />
                              </a>
                            ) : (
                              <span style={{ color: T.textMuted, fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </section>
  );
};