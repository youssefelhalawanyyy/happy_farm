import { useMemo, useState } from "react";
import { Award, BarChart2, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { calculateFCR, getBatchAgeInDays, getBatchFeedKg, getLatestAverageWeight, getMortalityPercentage, calculateBatchCost } from "@/lib/calculations";
import { formatCurrency, formatNumber, toFixedNumber } from "@/lib/utils";
import type { Batch, FeedRecord, GrowthRecord, SaleRecord, ExpenseRecord, BatchPerformanceSummary } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const buildSummaries = (
  batches: Batch[],
  feed: FeedRecord[],
  growth: GrowthRecord[],
  sales: SaleRecord[],
  expenses: ExpenseRecord[]
): BatchPerformanceSummary[] =>
  batches.map((batch) => {
    const feedKg = getBatchFeedKg(batch.id ?? "", feed);
    const avgWeight = getLatestAverageWeight(batch.id ?? "", growth) || batch.targetSellingWeight;
    const fcr = calculateFCR(feedKg, batch.currentAliveCount, avgWeight);
    const mortalityPct = getMortalityPercentage(batch);
    const daysInProduction = getBatchAgeInDays(batch.arrivalDate, batch.chickAgeAtArrivalDays);
    const totalRevenue = sales.filter((s) => s.batchId === batch.id).reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalCost = calculateBatchCost(batch, feed, expenses);
    const profitEGP = toFixedNumber(totalRevenue - totalCost);
    const totalSoldKg = sales.filter((s) => s.batchId === batch.id).reduce((sum, s) => sum + s.birdCount * s.averageWeightKg, 0);
    const profitPerKg = totalSoldKg > 0 ? toFixedNumber(profitEGP / totalSoldKg) : 0;

    return {
      batchId: batch.id ?? batch.batchId,
      batchLabel: batch.batchId,
      breed: batch.breed,
      supplier: batch.supplierHatchery,
      arrivalDate: batch.arrivalDate,
      daysInProduction,
      initialCount: batch.initialChickCount,
      mortalityCount: batch.mortalityCount,
      mortalityPct,
      survivalPct: toFixedNumber(100 - mortalityPct),
      fcr,
      avgWeightKg: avgWeight,
      feedKg,
      totalRevenue,
      totalCost,
      profitEGP,
      profitPerKg,
      status: batch.status,
    };
  });

const CHART_GREEN = "#1f7a63";
const CHART_AMBER = "#f4b942";
const CHART_RED = "#ef4444";
const CHART_BLUE = "#3b82f6";

const fcrColor = (v: number) => (v === 0 ? "#94a3b8" : v <= 1.8 ? CHART_GREEN : v <= 2.1 ? CHART_AMBER : CHART_RED);
const mortalityColor = (v: number) => (v <= 2 ? CHART_GREEN : v <= 5 ? CHART_AMBER : CHART_RED);
const profitColor = (v: number) => (v >= 0 ? CHART_GREEN : CHART_RED);

/* ─── Small metric chip ──────────────────────────────────────────────────── */
const Chip = ({ value, good }: { value: string; good: boolean }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-success" : "text-danger"}`}>
    {good ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
    {value}
  </span>
);

/* ─── Chart Section ──────────────────────────────────────────────────────── */
const SummaryChart = ({
  data,
  dataKey,
  label,
  colorFn,
  unit,
}: {
  data: BatchPerformanceSummary[];
  dataKey: keyof BatchPerformanceSummary;
  label: string;
  colorFn: (v: number) => string;
  unit?: string;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm">{label}</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="batchLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v: number) => [`${v}${unit ?? ""}`, label]}
            contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }}
          />
          <Bar dataKey={dataKey} radius={[5, 5, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={colorFn(Number(entry[dataKey]))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

/* ─── Page ───────────────────────────────────────────────────────────────── */
type FilterStatus = "all" | "active" | "sold" | "closed";

export const BatchComparisonPage = () => {
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: feed } = useRealtimeCollection<FeedRecord>(COLLECTIONS.feedRecords);
  const { data: growth } = useRealtimeCollection<GrowthRecord>(COLLECTIONS.growthRecords);
  const { data: sales } = useRealtimeCollection<SaleRecord>(COLLECTIONS.sales);
  const { data: expenses } = useRealtimeCollection<ExpenseRecord>(COLLECTIONS.expenses);

  const [filter, setFilter] = useState<FilterStatus>("all");

  const allSummaries = useMemo(
    () => buildSummaries(batches, feed, growth, sales, expenses),
    [batches, feed, growth, sales, expenses]
  );

  const summaries = useMemo(
    () => (filter === "all" ? allSummaries : allSummaries.filter((s) => s.status === filter)),
    [allSummaries, filter]
  );

  const completedSummaries = useMemo(() => allSummaries.filter((s) => s.status === "sold"), [allSummaries]);

  // Best/worst picks (sold batches only)
  const bestFCR = completedSummaries.filter((s) => s.fcr > 0).sort((a, b) => a.fcr - b.fcr)[0];
  const bestSurvival = [...completedSummaries].sort((a, b) => b.survivalPct - a.survivalPct)[0];
  const bestProfit = [...completedSummaries].sort((a, b) => b.profitEGP - a.profitEGP)[0];

  const statusCounts: Record<FilterStatus, number> = {
    all: allSummaries.length,
    active: allSummaries.filter((s) => s.status === "active").length,
    sold: allSummaries.filter((s) => s.status === "sold").length,
    closed: allSummaries.filter((s) => s.status === "closed").length,
  };

  return (
    <section className="page-section">
      <PageHeader
        title="Batch Comparison"
        description="Benchmark performance across all batches — FCR, survival rate, profit, and more."
        actions={<Badge variant="muted" className="gap-1"><BarChart2 size={11} />{allSummaries.length} batches</Badge>}
      />

      {/* Best performers */}
      {completedSummaries.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: "Best FCR", batch: bestFCR, value: bestFCR ? `${bestFCR.fcr.toFixed(2)}` : "—", desc: "Feed efficiency champion", color: "text-success" },
            { label: "Best Survival", batch: bestSurvival, value: bestSurvival ? `${bestSurvival.survivalPct.toFixed(1)}%` : "—", desc: "Lowest mortality rate", color: "text-info" },
            { label: "Most Profitable", batch: bestProfit, value: bestProfit ? formatCurrency(bestProfit.profitEGP) : "—", desc: "Highest net profit", color: "text-accent-foreground" },
          ].map(({ label, batch, value, desc, color }) => (
            <Card key={label} className="kpi-card kpi-card-glow-green">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                    {batch && <p className="mt-1.5 text-[11px] font-medium text-primary">{batch.batchLabel}</p>}
                  </div>
                  <Award size={20} className="mt-0.5 shrink-0 text-accent" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {summaries.length > 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          <SummaryChart data={summaries} dataKey="fcr" label="FCR by Batch" colorFn={fcrColor} />
          <SummaryChart data={summaries} dataKey="mortalityPct" label="Mortality % by Batch" colorFn={mortalityColor} unit="%" />
          <SummaryChart data={summaries} dataKey="avgWeightKg" label="Avg Weight (kg) by Batch" colorFn={() => CHART_BLUE} unit=" kg" />
          <SummaryChart data={summaries} dataKey="profitEGP" label="Net Profit (EGP) by Batch" colorFn={profitColor} />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "sold", "closed"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === s
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Batches</CardTitle>
          <CardDescription>{summaries.length} batch{summaries.length !== 1 ? "es" : ""} shown</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {summaries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No batches to compare.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="comparison-table w-full">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Breed / Supplier</th>
                    <th>Age (days)</th>
                    <th>Birds</th>
                    <th>Mortality</th>
                    <th>Survival</th>
                    <th>FCR</th>
                    <th>Avg Wt (kg)</th>
                    <th>Feed (kg)</th>
                    <th>Revenue</th>
                    <th>Cost</th>
                    <th>Profit</th>
                    <th>Profit/kg</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.batchId}>
                      <td className="font-semibold">{s.batchLabel}</td>
                      <td>
                        <p className="text-xs capitalize">{s.breed}</p>
                        <p className="text-[11px] text-muted-foreground">{s.supplier}</p>
                      </td>
                      <td>{s.daysInProduction}</td>
                      <td>{formatNumber(s.initialCount)}</td>
                      <td>
                        <Chip value={`${s.mortalityPct.toFixed(1)}%`} good={s.mortalityPct <= 5} />
                      </td>
                      <td>
                        <Chip value={`${s.survivalPct.toFixed(1)}%`} good={s.survivalPct >= 95} />
                      </td>
                      <td>
                        {s.fcr > 0 ? (
                          <Chip value={s.fcr.toFixed(2)} good={s.fcr <= 2.0} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td>{s.avgWeightKg > 0 ? `${s.avgWeightKg.toFixed(2)} kg` : "—"}</td>
                      <td>{s.feedKg > 0 ? `${formatNumber(s.feedKg)} kg` : "—"}</td>
                      <td>{s.totalRevenue > 0 ? formatCurrency(s.totalRevenue) : "—"}</td>
                      <td>{formatCurrency(s.totalCost)}</td>
                      <td>
                        {s.totalRevenue > 0 ? (
                          <Chip value={formatCurrency(s.profitEGP)} good={s.profitEGP >= 0} />
                        ) : "—"}
                      </td>
                      <td>
                        {s.profitPerKg !== 0 ? (
                          <Chip value={`${s.profitPerKg.toFixed(1)} EGP`} good={s.profitPerKg >= 0} />
                        ) : "—"}
                      </td>
                      <td>
                        <Badge
                          variant={s.status === "active" ? "success" : s.status === "sold" ? "default" : "muted"}
                          className="text-[10px] capitalize"
                        >
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier ranking */}
      {completedSummaries.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Supplier Performance</CardTitle>
            <CardDescription>Average FCR and survival rate by hatchery supplier (sold batches)</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const supplierMap: Record<string, { fcrs: number[]; survivals: number[] }> = {};
              for (const s of completedSummaries) {
                if (!supplierMap[s.supplier]) supplierMap[s.supplier] = { fcrs: [], survivals: [] };
                if (s.fcr > 0) supplierMap[s.supplier].fcrs.push(s.fcr);
                supplierMap[s.supplier].survivals.push(s.survivalPct);
              }
              const rows = Object.entries(supplierMap).map(([supplier, d]) => ({
                supplier,
                avgFcr: d.fcrs.length ? toFixedNumber(d.fcrs.reduce((a, b) => a + b) / d.fcrs.length, 2) : 0,
                avgSurvival: toFixedNumber(d.survivals.reduce((a, b) => a + b) / d.survivals.length, 1),
                batchCount: completedSummaries.filter((s) => s.supplier === supplier).length,
              })).sort((a, b) => a.avgFcr - b.avgFcr || b.avgSurvival - a.avgSurvival);

              return (
                <div className="overflow-x-auto">
                  <table className="comparison-table w-full">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Batches</th>
                        <th>Avg FCR</th>
                        <th>Avg Survival</th>
                        <th>Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.supplier}>
                          <td className="font-semibold">{r.supplier}</td>
                          <td>{r.batchCount}</td>
                          <td><Chip value={r.avgFcr.toFixed(2)} good={r.avgFcr <= 2.0} /></td>
                          <td><Chip value={`${r.avgSurvival.toFixed(1)}%`} good={r.avgSurvival >= 95} /></td>
                          <td>
                            {i === 0 ? (
                              <span className="best-badge">
                                <Award size={10} /> Best
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">#{i + 1}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </section>
  );
};
