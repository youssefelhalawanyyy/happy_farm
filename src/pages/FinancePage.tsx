import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "@/lib/toast";
import { BarTrendChart } from "@/components/charts/BarTrendChart";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { DataTable } from "@/components/ui/data-table";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useAuth } from "@/context/AuthContext";
import { COLLECTIONS } from "@/lib/constants";
import { compareDateTimeDesc, formatCurrency, isoToday, toMonthKey } from "@/lib/utils";
import { getLatestAverageWeight } from "@/lib/calculations";
import { createExpense, recordSale, updateSale } from "@/services/farmService";
import type {
  Batch,
  ExpenseCategory,
  ExpenseRecord,
  FeedRecord,
  GrowthRecord,
  MarketPriceSnapshot,
  Quotation,
  SaleRecord
} from "@/types";

const expenseOptions: ExpenseCategory[] = [
  "utilities",
  "payment",
  "maintenance",
  "fuel",
  "rent",
  "insurance",
  "feed",
  "chicks",
  "medicine",
  "labor",
  "electricity",
  "transport",
  "other"
];

type ExpenseRow = {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  batch: string;
  amount: string;
};

type BatchProfitRow = {
  batchId: string;
  birdsAlive: number;
  avgWeightKg: number;
  marketPricePerKg: number;
  chicksCost: number;
  feedCost: number;
  medicineCost: number;
  additionalCosts: number;
  totalCost: number;
  estimatedRevenue: number;
  realizedRevenue: number;
  estimatedProfit: number;
  realizedProfit: number;
};

type FinanceTransactionRow = {
  id: string;
  date: string;
  flow: "income" | "expense";
  source: "sale" | "quotation" | "expense";
  reference: string;
  party: string;
  batch: string;
  category: string;
  description: string;
  amount: number;
};

const COGS_CATEGORIES: ExpenseCategory[] = ["feed", "chicks", "medicine"];
const UTILITY_CATEGORIES: ExpenseCategory[] = ["utilities", "electricity", "fuel", "rent", "insurance"];
const PAYMENT_CATEGORIES: ExpenseCategory[] = ["payment"];

const nextMonthKey = (monthKey: string): string => {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const isoDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const T = {
  pageBg: "#f4f6f0",
  surface: "#ffffff",
  surfaceAlt: "#f9faf6",
  border: "#e3e8dc",
  text: "#1c2117",
  textMid: "#48523f",
  textMuted: "#7a8870",
  brand: "#2e6b4e",
  brandLight: "#e6f0eb",
  profit: "#15803d",
  profitBg: "#dcfce7",
  profitBorder: "#bbf7d0",
  loss: "#b91c1c",
  lossBg: "#fee2e2",
  lossBorder: "#fecaca",
  amber: "#92400e",
  blue: "#1e3a8a",
  blueBg: "#dbeafe",
  mono: "'JetBrains Mono','Fira Code','Courier New',monospace"
};

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconDot = ({ color }: { color: string }) => (
  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "22px 24px",
      ...style
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 3, height: 15, background: T.brand, borderRadius: 2 }} />
      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>{children}</h2>
    </div>
    {sub ? <p style={{ margin: "4px 0 0 12px", fontSize: 12, color: T.textMuted }}>{sub}</p> : null}
  </div>
);

type KpiProps = {
  label: string;
  value: string;
  sub?: string;
  topColor: string;
  valueColor?: string;
};

const KpiCard = ({ label, value, sub, topColor, valueColor }: KpiProps) => (
  <div
    style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "17px 19px",
      borderTop: `3px solid ${topColor}`
    }}
  >
    <p
      style={{
        margin: "0 0 8px",
        fontSize: 11,
        fontWeight: 600,
        color: T.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.07em"
      }}
    >
      {label}
    </p>
    <p
      style={{
        margin: "0 0 4px",
        fontSize: 20,
        fontWeight: 800,
        color: valueColor ?? T.text,
        fontFamily: T.mono,
        letterSpacing: "-0.02em"
      }}
    >
      {value}
    </p>
    {sub ? <p style={{ margin: 0, fontSize: 11, color: T.textMuted }}>{sub}</p> : null}
  </div>
);

const catStyle: Record<string, { bg: string; color: string }> = {
  feed: { bg: "#dcfce7", color: "#15803d" },
  chicks: { bg: "#dbeafe", color: "#1d4ed8" },
  medicine: { bg: "#ede9fe", color: "#6d28d9" },
  utilities: { bg: "#fef3c7", color: "#92400e" },
  electricity: { bg: "#ffedd5", color: "#c2410c" },
  fuel: { bg: "#fee2e2", color: "#b91c1c" },
  rent: { bg: "#cffafe", color: "#0e7490" },
  insurance: { bg: "#e0e7ff", color: "#3730a3" },
  payment: { bg: "#fce7f3", color: "#9d174d" },
  labor: { bg: "#ccfbf1", color: "#0f766e" },
  transport: { bg: "#fef9c3", color: "#713f12" },
  maintenance: { bg: "#f1f5f9", color: "#475569" },
  other: { bg: "#f1f5f9", color: "#475569" }
};

const CategoryBadge = ({ cat }: { cat: string }) => {
  const style = catStyle[cat] ?? { bg: "#f1f5f9", color: "#475569" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        textTransform: "capitalize"
      }}
    >
      {cat}
    </span>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: T.textMid }}>{label}</label>
    {children}
  </div>
);

const inputCss: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  background: T.surfaceAlt,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 13,
  color: T.text,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit"
};

const ctaButton = (enabled: boolean): CSSProperties => ({
  marginTop: 17,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "10px 20px",
  background: enabled ? T.brand : T.surfaceAlt,
  color: enabled ? "#fff" : T.textMuted,
  border: `1px solid ${enabled ? T.brand : T.border}`,
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 700,
  cursor: enabled ? "pointer" : "not-allowed"
});

const secondaryButton = (enabled: boolean): CSSProperties => ({
  marginTop: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 16px",
  background: enabled ? T.blueBg : T.surfaceAlt,
  color: enabled ? T.blue : T.textMuted,
  border: `1px solid ${enabled ? "#bfdbfe" : T.border}`,
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: enabled ? "pointer" : "not-allowed"
});

export const FinancePage = () => {
  const { profile } = useAuth();
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: sales } = useRealtimeCollection<SaleRecord>(COLLECTIONS.sales);
  const { data: quotations } = useRealtimeCollection<Quotation>(COLLECTIONS.quotations);
  const { data: expenses } = useRealtimeCollection<ExpenseRecord>(COLLECTIONS.expenses);
  const { data: feed } = useRealtimeCollection<FeedRecord>(COLLECTIONS.feedRecords);
  const { data: growth } = useRealtimeCollection<GrowthRecord>(COLLECTIONS.growthRecords);
  const { data: market } = useRealtimeCollection<MarketPriceSnapshot>(COLLECTIONS.marketPrices);

  const [form, setForm] = useState<ExpenseRecord>({
    category: "utilities",
    amount: 0,
    description: "",
    expenseDate: isoToday(),
    batchId: ""
  });

  const [saleForm, setSaleForm] = useState<SaleRecord>({
    buyerName: "",
    batchId: "",
    birdCount: 500,
    averageWeightKg: 2.1,
    pricePerKg: 93,
    totalRevenue: 0,
    saleDate: isoToday()
  });
  const [saleEditId, setSaleEditId] = useState("");
  const [saleEditPricePerKg, setSaleEditPricePerKg] = useState(0);
  const [transactionPreset, setTransactionPreset] = useState<
    "this_month" | "last_30" | "last_90" | "this_year" | "all_time" | "custom"
  >("this_month");
  const [transactionFrom, setTransactionFrom] = useState(() => `${isoToday().slice(0, 7)}-01`);
  const [transactionTo, setTransactionTo] = useState(() => isoToday());
  const [transactionFlow, setTransactionFlow] = useState<"all" | "income" | "expense">("all");

  const batchLabelById = useMemo(
    () =>
      batches.reduce<Record<string, string>>((acc, batch) => {
        if (batch.id) {
          acc[batch.id] = batch.batchId;
        }
        return acc;
      }, {}),
    [batches]
  );

  const salesIncome = useMemo(() => sales.reduce((sum, row) => sum + row.totalRevenue, 0), [sales]);
  const paidQuotationIncome = useMemo(
    () =>
      quotations.reduce((sum, quotation) => {
        if (quotation.paymentStatus !== "paid") {
          return sum;
        }
        const amount = quotation.paidAmount && quotation.paidAmount > 0 ? quotation.paidAmount : quotation.total;
        return sum + amount;
      }, 0),
    [quotations]
  );
  const totalIncome = salesIncome + paidQuotationIncome;

  const unpaidQuotationTotal = useMemo(
    () =>
      quotations.reduce((sum, quotation) => {
        if (quotation.paymentStatus === "paid") {
          return sum;
        }
        return sum + quotation.total;
      }, 0),
    [quotations]
  );
  const paidQuotationCount = useMemo(
    () => quotations.filter((quotation) => quotation.paymentStatus === "paid").length,
    [quotations]
  );
  const unpaidQuotationCount = quotations.length - paidQuotationCount;

  const totalExpenses = expenses.reduce((sum, row) => sum + row.amount, 0);
  const costOfGoodsSold = expenses
    .filter((entry) => COGS_CATEGORIES.includes(entry.category))
    .reduce((sum, row) => sum + row.amount, 0);
  const utilityExpenses = expenses
    .filter((entry) => UTILITY_CATEGORIES.includes(entry.category))
    .reduce((sum, row) => sum + row.amount, 0);
  const payments = expenses
    .filter((entry) => PAYMENT_CATEGORIES.includes(entry.category))
    .reduce((sum, row) => sum + row.amount, 0);
  const grossProfit = totalIncome - costOfGoodsSold;
  const operatingExpenses = totalExpenses - costOfGoodsSold;
  const netProfit = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const latestMarket = useMemo(
    () => [...market].sort((a, b) => compareDateTimeDesc(a.capturedAt, b.capturedAt))[0],
    [market]
  );
  const liveMarketPrice = latestMarket?.liveBroilerPricePerKg ?? 0;

  const batchProfitRows = useMemo<BatchProfitRow[]>(() => {
    const rows = batches.filter((batch) => batch.status === "active" || sales.some((sale) => sale.batchId === batch.id));
    if (!rows.length) {
      return [];
    }

    const sharedExpenses = expenses.filter((expense) => !expense.batchId);
    const sharedExpenseTotal = sharedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalBirdsForAllocation = rows.reduce((sum, batch) => sum + Math.max(batch.currentAliveCount, 0), 0);

    return rows.map((batch) => {
      const batchId = batch.id ?? "";
      const perBatchExpenses = expenses.filter((expense) => expense.batchId === batchId);
      const batchFeedFromRecords = feed
        .filter((entry) => entry.batchId === batchId)
        .reduce((sum, entry) => sum + (entry.pricePerTon / 1000) * entry.quantityKg, 0);
      const batchFeedFromExpenses = perBatchExpenses
        .filter((expense) => expense.category === "feed")
        .reduce((sum, expense) => sum + expense.amount, 0);
      const feedCost = batchFeedFromRecords > 0 ? batchFeedFromRecords : batchFeedFromExpenses;
      const chicksCost =
        perBatchExpenses.filter((expense) => expense.category === "chicks").reduce((sum, expense) => sum + expense.amount, 0) ||
        batch.batchCost ||
        batch.initialChickCount * batch.chickPrice;
      const medicineCost = perBatchExpenses
        .filter((expense) => expense.category === "medicine")
        .reduce((sum, expense) => sum + expense.amount, 0);
      const batchAdditionalCosts = perBatchExpenses
        .filter((expense) => !["chicks", "feed", "medicine"].includes(expense.category))
        .reduce((sum, expense) => sum + expense.amount, 0);
      const allocatedSharedCost =
        totalBirdsForAllocation > 0
          ? (Math.max(batch.currentAliveCount, 0) / totalBirdsForAllocation) * sharedExpenseTotal
          : sharedExpenseTotal / rows.length;
      const additionalCosts = batchAdditionalCosts + allocatedSharedCost;
      const totalCost = chicksCost + feedCost + medicineCost + additionalCosts;
      const avgWeightKg = getLatestAverageWeight(batchId, growth) || batch.targetSellingWeight;
      const estimatedRevenue = Math.max(batch.currentAliveCount, 0) * avgWeightKg * liveMarketPrice;
      const realizedRevenue = sales
        .filter((sale) => sale.batchId === batchId)
        .reduce((sum, sale) => sum + sale.totalRevenue, 0);

      return {
        batchId: batch.batchId,
        birdsAlive: Math.max(batch.currentAliveCount, 0),
        avgWeightKg,
        marketPricePerKg: liveMarketPrice,
        chicksCost,
        feedCost,
        medicineCost,
        additionalCosts,
        totalCost,
        estimatedRevenue,
        realizedRevenue,
        estimatedProfit: estimatedRevenue - totalCost,
        realizedProfit: realizedRevenue - totalCost
      };
    });
  }, [batches, sales, expenses, feed, growth, liveMarketPrice]);

  const batchProfitTotals = useMemo(
    () =>
      batchProfitRows.reduce(
        (acc, row) => ({
          totalCost: acc.totalCost + row.totalCost,
          estimatedRevenue: acc.estimatedRevenue + row.estimatedRevenue,
          estimatedProfit: acc.estimatedProfit + row.estimatedProfit
        }),
        { totalCost: 0, estimatedRevenue: 0, estimatedProfit: 0 }
      ),
    [batchProfitRows]
  );

  const saleCalculatedTotal = useMemo(
    () => Number((saleForm.birdCount * saleForm.averageWeightKg * saleForm.pricePerKg).toFixed(2)),
    [saleForm.averageWeightKg, saleForm.birdCount, saleForm.pricePerKg]
  );

  const salesSorted = useMemo(
    () => [...sales].sort((a, b) => compareDateTimeDesc(a.saleDate, b.saleDate)),
    [sales]
  );
  const selectedSale = useMemo(() => sales.find((sale) => sale.id === saleEditId), [saleEditId, sales]);

  useEffect(() => {
    if (!selectedSale) {
      return;
    }
    setSaleEditPricePerKg(selectedSale.pricePerKg);
  }, [selectedSale]);

  useEffect(() => {
    const today = isoToday();
    if (transactionPreset === "custom") {
      return;
    }
    if (transactionPreset === "all_time") {
      setTransactionFrom("");
      setTransactionTo("");
      return;
    }
    if (transactionPreset === "this_month") {
      setTransactionFrom(`${today.slice(0, 7)}-01`);
      setTransactionTo(today);
      return;
    }
    if (transactionPreset === "last_30") {
      setTransactionFrom(isoDaysAgo(29));
      setTransactionTo(today);
      return;
    }
    if (transactionPreset === "last_90") {
      setTransactionFrom(isoDaysAgo(89));
      setTransactionTo(today);
      return;
    }
    setTransactionFrom(`${today.slice(0, 4)}-01-01`);
    setTransactionTo(today);
  }, [transactionPreset]);

  const saleEditTotalRevenue = useMemo(() => {
    if (!selectedSale) {
      return 0;
    }
    return Number((selectedSale.birdCount * selectedSale.averageWeightKg * saleEditPricePerKg).toFixed(2));
  }, [saleEditPricePerKg, selectedSale]);

  const submitExpense = async (): Promise<void> => {
    if (!profile || !form.description || form.amount <= 0) {
      return;
    }

    try {
      await createExpense(form, profile.uid);
      toast.success("Finance entry saved");
      setForm((prev) => ({ ...prev, amount: 0, description: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to save finance entry");
    }
  };

  const submitSale = async (): Promise<void> => {
    if (!profile || !saleForm.batchId || !saleForm.buyerName) {
      return;
    }
    if (saleForm.birdCount <= 0 || saleForm.averageWeightKg <= 0 || saleForm.pricePerKg <= 0) {
      toast.error("Enter valid sale values");
      return;
    }

    try {
      await recordSale({ ...saleForm, totalRevenue: saleCalculatedTotal }, profile.uid);
      toast.success("Sale saved and added to income");
      setSaleForm((prev) => ({ ...prev, buyerName: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to save sale");
    }
  };

  const updateSaleIncome = async (): Promise<void> => {
    if (!profile || !selectedSale?.id) {
      return;
    }
    if (saleEditPricePerKg <= 0) {
      toast.error("Price per kg must be greater than zero");
      return;
    }

    try {
      await updateSale(
        selectedSale.id,
        { pricePerKg: saleEditPricePerKg, totalRevenue: saleEditTotalRevenue },
        profile.uid
      );
      toast.success("Sale income updated");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update sale");
    }
  };

  const categorySeries = useMemo(() => {
    const grouped = expenses.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] ?? 0) + row.amount;
      return acc;
    }, {});

    return Object.entries(grouped).map(([category, amount]) => ({ category, amount }));
  }, [expenses]);

  const cashflowSeries = useMemo(() => {
    const grouped = new Map<string, { income: number; expense: number }>();

    sales.forEach((sale) => {
      const month = toMonthKey(sale.saleDate);
      const current = grouped.get(month) ?? { income: 0, expense: 0 };
      current.income += sale.totalRevenue;
      grouped.set(month, current);
    });

    quotations.forEach((quotation) => {
      if (quotation.paymentStatus !== "paid") {
        return;
      }
      const paidAmount = quotation.paidAmount && quotation.paidAmount > 0 ? quotation.paidAmount : quotation.total;
      const month = toMonthKey(quotation.paidAt || quotation.validUntil);
      const current = grouped.get(month) ?? { income: 0, expense: 0 };
      current.income += paidAmount;
      grouped.set(month, current);
    });

    expenses.forEach((expense) => {
      const month = toMonthKey(expense.expenseDate);
      const current = grouped.get(month) ?? { income: 0, expense: 0 };
      current.expense += expense.amount;
      grouped.set(month, current);
    });

    const sorted = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        income: Number(values.income.toFixed(2)),
        expense: Number(values.expense.toFixed(2)),
        net: Number((values.income - values.expense).toFixed(2))
      }));

    let running = 0;
    return sorted.map((row) => {
      running += row.net;
      return { ...row, balance: Number(running.toFixed(2)) };
    });
  }, [expenses, quotations, sales]);

  const closingBalance = cashflowSeries[cashflowSeries.length - 1]?.balance ?? 0;

  const forecastSeries = useMemo(() => {
    if (!cashflowSeries.length) {
      return [];
    }

    const recent = cashflowSeries.slice(-3);
    const avgIncome = recent.reduce((sum, row) => sum + row.income, 0) / recent.length;
    const avgExpense = recent.reduce((sum, row) => sum + row.expense, 0) / recent.length;

    let cursor = cashflowSeries[cashflowSeries.length - 1].month;
    return Array.from({ length: 3 }, () => {
      cursor = nextMonthKey(cursor);
      return { month: cursor, projectedNet: Number((avgIncome - avgExpense).toFixed(2)) };
    });
  }, [cashflowSeries]);

  const expenseRows = useMemo<ExpenseRow[]>(
    () =>
      [...expenses]
        .sort((a, b) => compareDateTimeDesc(a.expenseDate, b.expenseDate))
        .map((expense) => ({
          id: expense.id ?? `${expense.expenseDate}-${expense.description}`,
          date: expense.expenseDate,
          category: expense.category,
          description: expense.description,
          batch: (expense.batchId && batchLabelById[expense.batchId]) || "-",
          amount: formatCurrency(expense.amount)
        })),
    [batchLabelById, expenses]
  );

  const transactionRows = useMemo<FinanceTransactionRow[]>(
    () => [
      ...expenses.map((expense) => ({
        id: `expense-${expense.id ?? `${expense.expenseDate}-${expense.description}`}`,
        date: expense.expenseDate,
        flow: "expense" as const,
        source: "expense" as const,
        reference: expense.id ?? "-",
        party: "-",
        batch: (expense.batchId && batchLabelById[expense.batchId]) || "-",
        category: expense.category,
        description: expense.description,
        amount: expense.amount
      })),
      ...sales.map((sale) => ({
        id: `sale-${sale.id ?? `${sale.saleDate}-${sale.buyerName}`}`,
        date: sale.saleDate,
        flow: "income" as const,
        source: "sale" as const,
        reference: sale.id ?? "-",
        party: sale.buyerName,
        batch: (sale.batchId && batchLabelById[sale.batchId]) || "-",
        category: "sales",
        description: `Sale to ${sale.buyerName}`,
        amount: sale.totalRevenue
      })),
      ...quotations
        .filter((quotation) => quotation.paymentStatus === "paid")
        .map((quotation) => {
          const amount = quotation.paidAmount && quotation.paidAmount > 0 ? quotation.paidAmount : quotation.total;
          const paidDate = quotation.paidAt || quotation.validUntil;
          return {
            id: `quotation-${quotation.id ?? quotation.quotationNumber}`,
            date: paidDate,
            flow: "income" as const,
            source: "quotation" as const,
            reference: quotation.quotationNumber,
            party: quotation.customerName,
            batch: "-",
            category: "quotation collection",
            description: `Quotation payment ${quotation.quotationNumber}`,
            amount
          };
        })
    ].sort((a, b) => compareDateTimeDesc(a.date, b.date)),
    [batchLabelById, expenses, quotations, sales]
  );

  const filteredTransactionRows = useMemo(
    () =>
      transactionRows.filter((row) => {
        const withinFrom = !transactionFrom || row.date >= transactionFrom;
        const withinTo = !transactionTo || row.date <= transactionTo;
        const withinFlow = transactionFlow === "all" || row.flow === transactionFlow;
        return withinFrom && withinTo && withinFlow;
      }),
    [transactionFlow, transactionFrom, transactionRows, transactionTo]
  );

  const filteredTransactionIncome = useMemo(
    () => filteredTransactionRows.filter((row) => row.flow === "income").reduce((sum, row) => sum + row.amount, 0),
    [filteredTransactionRows]
  );
  const filteredTransactionExpense = useMemo(
    () => filteredTransactionRows.filter((row) => row.flow === "expense").reduce((sum, row) => sum + row.amount, 0),
    [filteredTransactionRows]
  );
  const filteredTransactionNet = filteredTransactionIncome - filteredTransactionExpense;

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      { accessorKey: "category", header: "Type", cell: ({ row }) => <CategoryBadge cat={row.original.category} /> },
      { accessorKey: "description", header: "Description" },
      { accessorKey: "batch", header: "Batch" },
      { accessorKey: "amount", header: "Amount" }
    ],
    []
  );

  const transactionColumns = useMemo<ColumnDef<FinanceTransactionRow>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      {
        accessorKey: "flow",
        header: "Flow",
        cell: ({ row }) => (
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: 18,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              background: row.original.flow === "income" ? T.profitBg : T.lossBg,
              color: row.original.flow === "income" ? T.profit : T.loss
            }}
          >
            {row.original.flow}
          </span>
        )
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <span style={{ textTransform: "capitalize", fontSize: 12 }}>
            {row.original.source === "quotation" ? "quotation" : row.original.source}
          </span>
        )
      },
      { accessorKey: "reference", header: "Reference" },
      { accessorKey: "party", header: "Party" },
      { accessorKey: "batch", header: "Batch" },
      { accessorKey: "category", header: "Category", cell: ({ row }) => <CategoryBadge cat={row.original.category} /> },
      { accessorKey: "description", header: "Description" },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span
            style={{
              fontFamily: T.mono,
              fontWeight: 700,
              color: row.original.flow === "income" ? T.profit : T.loss
            }}
          >
            {row.original.flow === "income" ? "+" : "-"}
            {formatCurrency(row.original.amount)}
          </span>
        )
      }
    ],
    []
  );

  const quotationRows = useMemo(
    () => [...quotations].sort((a, b) => compareDateTimeDesc(a.validUntil, b.validUntil)).slice(0, 8),
    [quotations]
  );

  const activeBatches = useMemo(() => batches.filter((batch) => batch.status === "active"), [batches]);

  const th: CSSProperties = {
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 10.5,
    fontWeight: 700,
    color: T.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap"
  };

  const td = (i: number): CSSProperties => ({
    padding: "11px 14px",
    background: i % 2 === 0 ? T.surface : T.surfaceAlt,
    borderBottom: `1px solid ${T.border}`
  });

  return (
    <section
      style={{
        background: T.pageBg,
        minHeight: "100vh",
        padding: "24px 28px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: T.text
      }}
    >
      <div
        style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, color: T.text, letterSpacing: "-0.025em" }}>Finance Manager</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
            Company-level financial control: income, quotations collections, payments, cashflow, P&L, and forecasting.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveMarketPrice > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: T.brandLight,
                border: `1px solid ${T.border}`,
                borderRadius: 10
              }}
            >
              <IconDot color={T.brand} />
              <span style={{ fontSize: 12, color: T.textMid }}>Live market:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.brand, fontFamily: T.mono }}>{formatCurrency(liveMarketPrice)}/kg</span>
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: "#fff7ed",
              border: `1px solid ${T.border}`,
              borderRadius: 10
            }}
          >
            <IconDot color="#d97706" />
            <span style={{ fontSize: 12, color: T.textMid }}>Outstanding quotations:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309", fontFamily: T.mono }}>{formatCurrency(unpaidQuotationTotal)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Sales Income" value={formatCurrency(salesIncome)} topColor={T.brand} valueColor={T.profit} />
        <KpiCard
          label="Quotation Collections"
          value={formatCurrency(paidQuotationIncome)}
          sub={`${paidQuotationCount} paid`}
          topColor="#2563eb"
          valueColor={T.blue}
        />
        <KpiCard label="Total Income" value={formatCurrency(totalIncome)} topColor={T.brand} valueColor={T.profit} />
        <KpiCard label="Cost of Goods Sold" value={formatCurrency(costOfGoodsSold)} topColor="#dc2626" valueColor={T.loss} />
        <KpiCard
          label="Gross Profit"
          value={formatCurrency(grossProfit)}
          topColor={grossProfit >= 0 ? T.brand : "#dc2626"}
          valueColor={grossProfit >= 0 ? T.profit : T.loss}
        />
        <KpiCard label="Operating Expenses" value={formatCurrency(operatingExpenses)} topColor="#d97706" valueColor={T.amber} />
        <KpiCard label="Utilities + Payments" value={formatCurrency(utilityExpenses + payments)} topColor="#2563eb" valueColor={T.blue} />
        <KpiCard
          label="Closing Cash Balance"
          value={formatCurrency(closingBalance)}
          sub="Running total"
          topColor={closingBalance >= 0 ? T.brand : "#dc2626"}
          valueColor={closingBalance >= 0 ? T.profit : T.loss}
        />
      </div>

      <Panel style={{ marginBottom: 20 }}>
        <SectionTitle>P&L Statement</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { label: "Revenue", value: formatCurrency(totalIncome), note: "Sales + paid quotations", pos: true, neg: false },
            { label: "Cost of Goods Sold", value: `−${formatCurrency(costOfGoodsSold)}`, note: "Feed · Chicks · Medicine", pos: false, neg: true },
            { label: "Gross Profit", value: formatCurrency(grossProfit), note: "Revenue − COGS", pos: grossProfit >= 0, neg: grossProfit < 0 },
            { label: "Net Profit", value: formatCurrency(netProfit), note: `Margin: ${margin.toFixed(1)}%`, pos: netProfit >= 0, neg: netProfit < 0 }
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "15px 17px",
                borderRadius: 10,
                background: item.pos ? T.profitBg : item.neg ? T.lossBg : T.surfaceAlt,
                border: `1px solid ${item.pos ? T.profitBorder : item.neg ? T.lossBorder : T.border}`
              }}
            >
              <p
                style={{
                  margin: "0 0 7px",
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: T.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em"
                }}
              >
                {item.label}
              </p>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 19,
                  fontWeight: 800,
                  fontFamily: T.mono,
                  color: item.pos ? T.profit : item.neg ? T.loss : T.text
                }}
              >
                {item.value}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: T.textMuted }}>{item.note}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel style={{ marginBottom: 20 }}>
        <SectionTitle sub="Auto-calculated from chick cost, feed records, medicine, and live market price. Shared expenses are distributed by bird count.">
          Profit Calculator by Batch
        </SectionTitle>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
          {[
            { label: "Est. Revenue (All Batches)", value: formatCurrency(batchProfitTotals.estimatedRevenue), color: T.profit, bg: T.surfaceAlt, border: T.border },
            { label: "Total Cost (All Batches)", value: formatCurrency(batchProfitTotals.totalCost), color: T.loss, bg: T.surfaceAlt, border: T.border },
            {
              label: "Est. Profit (All Batches)",
              value: formatCurrency(batchProfitTotals.estimatedProfit),
              color: batchProfitTotals.estimatedProfit >= 0 ? T.profit : T.loss,
              bg: batchProfitTotals.estimatedProfit >= 0 ? T.profitBg : T.lossBg,
              border: batchProfitTotals.estimatedProfit >= 0 ? T.profitBorder : T.lossBorder
            }
          ].map((item) => (
            <div key={item.label} style={{ padding: "14px 17px", background: item.bg, border: `1px solid ${item.border}`, borderRadius: 10 }}>
              <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {item.label}
              </p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: item.color, fontFamily: T.mono }}>{item.value}</p>
            </div>
          ))}
        </div>

        <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${T.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
                {["Batch", "Birds Alive", "Avg Weight", "Market Price", "Chicks Cost", "Feed Cost", "Medicine", "Rent+Other", "Total Cost", "Est. Revenue", "Est. Profit"].map((header) => (
                  <th key={header} style={th}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batchProfitRows.map((row, index) => (
                <tr key={row.batchId}>
                  <td style={{ ...td(index), fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{row.batchId}</td>
                  <td style={td(index)}>{row.birdsAlive.toLocaleString()}</td>
                  <td style={td(index)}>{row.avgWeightKg.toFixed(2)} kg</td>
                  <td style={{ ...td(index), fontFamily: T.mono }}>{formatCurrency(row.marketPricePerKg)}</td>
                  <td style={{ ...td(index), color: T.textMid, fontFamily: T.mono }}>{formatCurrency(row.chicksCost)}</td>
                  <td style={{ ...td(index), color: T.textMid, fontFamily: T.mono }}>{formatCurrency(row.feedCost)}</td>
                  <td style={{ ...td(index), color: T.textMid, fontFamily: T.mono }}>{formatCurrency(row.medicineCost)}</td>
                  <td style={{ ...td(index), color: T.textMid, fontFamily: T.mono }}>{formatCurrency(row.additionalCosts)}</td>
                  <td style={{ ...td(index), fontWeight: 600, fontFamily: T.mono }}>{formatCurrency(row.totalCost)}</td>
                  <td style={{ ...td(index), color: T.profit, fontFamily: T.mono }}>{formatCurrency(row.estimatedRevenue)}</td>
                  <td style={{ ...td(index), fontWeight: 700, fontFamily: T.mono, color: row.estimatedProfit >= 0 ? T.profit : T.loss }}>
                    {formatCurrency(row.estimatedProfit)}
                  </td>
                </tr>
              ))}
              {batchProfitRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 32, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
                    No batch data yet. Add batches, feed logs, expenses, and market price snapshots.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: T.textMuted }}>
          Tip: link rent/utilities/labor to a batch for exact profitability. Unlinked shared costs are auto-distributed by live bird count.
        </p>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Panel>
          <SectionTitle>Record Finance Entry</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))}
                style={{ ...inputCss, cursor: "pointer" }}
              >
                {expenseOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (EGP)">
              <input type="number" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))} style={inputCss} />
            </Field>
            <Field label="Linked Batch (optional)">
              <select value={form.batchId} onChange={(event) => setForm((prev) => ({ ...prev, batchId: event.target.value }))} style={{ ...inputCss, cursor: "pointer" }}>
                <option value="">No batch link</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchId}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={form.expenseDate} onChange={(event) => setForm((prev) => ({ ...prev, expenseDate: event.target.value }))} style={inputCss} />
            </Field>
            <div style={{ gridColumn: "span 2" }}>
              <Field label="Description">
                <input
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="e.g. Monthly electricity bill..."
                  style={inputCss}
                />
              </Field>
            </div>
          </div>
          <button onClick={() => void submitExpense()} disabled={!profile || !form.description || form.amount <= 0} style={ctaButton(Boolean(profile && form.description && form.amount > 0))}>
            <IconPlus /> Save Finance Entry
          </button>
        </Panel>

        <Panel>
          <SectionTitle sub="Record new sales and update sale income corrections directly from finance.">Sales Income Manager</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            <Field label="Buyer Name">
              <input value={saleForm.buyerName} onChange={(event) => setSaleForm((prev) => ({ ...prev, buyerName: event.target.value }))} style={inputCss} />
            </Field>
            <Field label="Batch">
              <select value={saleForm.batchId} onChange={(event) => setSaleForm((prev) => ({ ...prev, batchId: event.target.value }))} style={{ ...inputCss, cursor: "pointer" }}>
                <option value="">Select batch</option>
                {activeBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchId}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bird Count">
              <input type="number" value={saleForm.birdCount} onChange={(event) => setSaleForm((prev) => ({ ...prev, birdCount: Number(event.target.value) }))} style={inputCss} />
            </Field>
            <Field label="Average Weight (kg)">
              <input
                type="number"
                step="0.01"
                value={saleForm.averageWeightKg}
                onChange={(event) => setSaleForm((prev) => ({ ...prev, averageWeightKg: Number(event.target.value) }))}
                style={inputCss}
              />
            </Field>
            <Field label="Price per kg (EGP)">
              <input type="number" value={saleForm.pricePerKg} onChange={(event) => setSaleForm((prev) => ({ ...prev, pricePerKg: Number(event.target.value) }))} style={inputCss} />
            </Field>
            <Field label="Sale Date">
              <input type="date" value={saleForm.saleDate} onChange={(event) => setSaleForm((prev) => ({ ...prev, saleDate: event.target.value }))} style={inputCss} />
            </Field>
          </div>

          <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceAlt, padding: "10px 12px" }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, color: T.textMuted }}>Calculated sale revenue</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.profit, fontFamily: T.mono }}>{formatCurrency(saleCalculatedTotal)}</p>
          </div>

          <button onClick={() => void submitSale()} disabled={!profile || !saleForm.batchId || !saleForm.buyerName} style={ctaButton(Boolean(profile && saleForm.batchId && saleForm.buyerName))}>
            <IconPlus /> Save Sale
          </button>

          <div style={{ margin: "16px 0", borderTop: `1px dashed ${T.border}` }} />
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: T.textMid }}>Update Existing Sale Income</p>
          <Field label="Select Sale">
            <select value={saleEditId} onChange={(event) => setSaleEditId(event.target.value)} style={{ ...inputCss, cursor: "pointer" }}>
              <option value="">Select recorded sale</option>
              {salesSorted.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.saleDate} - {sale.buyerName} - {formatCurrency(sale.totalRevenue)}
                </option>
              ))}
            </select>
          </Field>

          {selectedSale ? (
            <div style={{ marginTop: 10, borderRadius: 10, border: `1px solid ${T.border}`, background: "#f8fafc", padding: "10px 12px", fontSize: 12, color: T.textMid }}>
              <p style={{ margin: 0 }}>
                Batch: <strong>{batchLabelById[selectedSale.batchId] ?? selectedSale.batchId}</strong> | Birds: <strong>{selectedSale.birdCount.toLocaleString()}</strong>
              </p>
              <p style={{ margin: "4px 0 0" }}>
                Current price/kg: <strong>{formatCurrency(selectedSale.pricePerKg)}</strong> | Current revenue: <strong>{formatCurrency(selectedSale.totalRevenue)}</strong>
              </p>
            </div>
          ) : null}

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            <Field label="New Price per kg (EGP)">
              <input
                type="number"
                value={saleEditPricePerKg}
                onChange={(event) => setSaleEditPricePerKg(Number(event.target.value))}
                style={inputCss}
                disabled={!selectedSale}
              />
            </Field>
            <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceAlt, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, color: T.textMuted }}>Updated revenue</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: T.mono, color: selectedSale ? T.blue : T.textMuted }}>
                {formatCurrency(saleEditTotalRevenue)}
              </p>
            </div>
          </div>

          <button onClick={() => void updateSaleIncome()} disabled={!profile || !selectedSale} style={secondaryButton(Boolean(profile && selectedSale))}>
            Update Sale Income
          </button>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Panel>
          <SectionTitle>Expense Breakdown by Category</SectionTitle>
          <BarTrendChart data={categorySeries} xKey="category" yKey="amount" color={T.brand} />
        </Panel>

        <Panel>
          <SectionTitle sub="Only paid quotations are recognized as income.">Quotation Collections</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
            <div style={{ border: `1px solid ${T.border}`, background: T.surfaceAlt, borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Paid Quotations</p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.profit, fontFamily: T.mono }}>{paidQuotationCount}</p>
            </div>
            <div style={{ border: `1px solid ${T.border}`, background: T.profitBg, borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Collected Income</p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.profit, fontFamily: T.mono }}>{formatCurrency(paidQuotationIncome)}</p>
            </div>
            <div style={{ border: `1px solid ${T.border}`, background: T.surfaceAlt, borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Unpaid Quotations</p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#b45309", fontFamily: T.mono }}>{unpaidQuotationCount}</p>
            </div>
            <div style={{ border: `1px solid ${T.border}`, background: "#fff7ed", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Outstanding Amount</p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#b45309", fontFamily: T.mono }}>{formatCurrency(unpaidQuotationTotal)}</p>
            </div>
          </div>

          <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${T.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
                  {["Number", "Customer", "Payment", "Amount"].map((header) => (
                    <th key={header} style={th}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotationRows.map((quotation, index) => {
                  const isPaid = quotation.paymentStatus === "paid";
                  const amount = isPaid
                    ? quotation.paidAmount && quotation.paidAmount > 0
                      ? quotation.paidAmount
                      : quotation.total
                    : quotation.total;
                  return (
                    <tr key={quotation.id}>
                      <td style={{ ...td(index), fontFamily: T.mono }}>{quotation.quotationNumber}</td>
                      <td style={td(index)}>{quotation.customerName}</td>
                      <td style={td(index)}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: isPaid ? T.profitBg : "#fff7ed",
                            color: isPaid ? T.profit : "#b45309"
                          }}
                        >
                          {isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td style={{ ...td(index), fontFamily: T.mono, color: isPaid ? T.profit : "#b45309" }}>{formatCurrency(amount)}</td>
                    </tr>
                  );
                })}
                {quotationRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: T.textMuted }}>
                      No quotations found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Panel>
          <SectionTitle>Cashflow — Income vs Expense</SectionTitle>
          <AreaTrendChart data={cashflowSeries} xKey="month" yKey="income" color={T.brand} />
          <div style={{ marginTop: 14 }}>
            <LineTrendChart data={cashflowSeries} xKey="month" yKey="expense" color="#dc2626" />
          </div>
        </Panel>
        <Panel>
          <SectionTitle sub="Projected from 3-month rolling average">Net Forecast — Next 3 Months</SectionTitle>
          <LineTrendChart data={forecastSeries} xKey="month" yKey="projectedNet" color="#2563eb" />
        </Panel>
      </div>

      <Panel style={{ marginBottom: 20 }}>
        <SectionTitle sub="Combined ledger: expenses + sales income + paid quotation collections.">
          Financial Transactions Ledger
        </SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 14
          }}
        >
          <Field label="Time Filter">
            <select
              value={transactionPreset}
              onChange={(event) =>
                setTransactionPreset(
                  event.target.value as "this_month" | "last_30" | "last_90" | "this_year" | "all_time" | "custom"
                )
              }
              style={{ ...inputCss, cursor: "pointer" }}
            >
              <option value="this_month">This month</option>
              <option value="last_30">Last 30 days</option>
              <option value="last_90">Last 90 days</option>
              <option value="this_year">This year</option>
              <option value="all_time">All time</option>
              <option value="custom">Custom range</option>
            </select>
          </Field>

          <Field label="Date From">
            <input
              type="date"
              value={transactionFrom}
              onChange={(event) => {
                setTransactionPreset("custom");
                setTransactionFrom(event.target.value);
              }}
              style={inputCss}
            />
          </Field>

          <Field label="Date To">
            <input
              type="date"
              value={transactionTo}
              onChange={(event) => {
                setTransactionPreset("custom");
                setTransactionTo(event.target.value);
              }}
              style={inputCss}
            />
          </Field>

          <Field label="Flow Type">
            <select
              value={transactionFlow}
              onChange={(event) => setTransactionFlow(event.target.value as "all" | "income" | "expense")}
              style={{ ...inputCss, cursor: "pointer" }}
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div style={{ border: `1px solid ${T.border}`, background: T.profitBg, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Filtered Income</p>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.profit, fontFamily: T.mono }}>
              {formatCurrency(filteredTransactionIncome)}
            </p>
          </div>
          <div style={{ border: `1px solid ${T.border}`, background: T.lossBg, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Filtered Expense</p>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.loss, fontFamily: T.mono }}>
              {formatCurrency(filteredTransactionExpense)}
            </p>
          </div>
          <div
            style={{
              border: `1px solid ${filteredTransactionNet >= 0 ? T.profitBorder : T.lossBorder}`,
              background: filteredTransactionNet >= 0 ? T.profitBg : T.lossBg,
              borderRadius: 10,
              padding: "10px 12px"
            }}
          >
            <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Filtered Net</p>
            <p
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 800,
                color: filteredTransactionNet >= 0 ? T.profit : T.loss,
                fontFamily: T.mono
              }}
            >
              {formatCurrency(filteredTransactionNet)}
            </p>
          </div>
          <div style={{ border: `1px solid ${T.border}`, background: T.surfaceAlt, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted }}>Transactions Count</p>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, fontFamily: T.mono }}>
              {filteredTransactionRows.length.toLocaleString()}
            </p>
          </div>
        </div>

        <DataTable
          columns={transactionColumns}
          data={filteredTransactionRows}
          searchColumn="description"
          searchPlaceholder="Search all transactions..."
        />
      </Panel>

      <Panel style={{ marginBottom: 20 }}>
        <SectionTitle>Monthly Cash Ledger</SectionTitle>
        <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${T.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
                {["Month", "Income", "Expense", "Net", "Running Balance"].map((header) => (
                  <th key={header} style={th}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashflowSeries.map((row, index) => (
                <tr key={row.month}>
                  <td style={{ ...td(index), fontWeight: 600, color: T.textMid, fontFamily: T.mono }}>{row.month}</td>
                  <td style={{ ...td(index), color: T.profit, fontFamily: T.mono }}>{formatCurrency(row.income)}</td>
                  <td style={{ ...td(index), color: T.loss, fontFamily: T.mono }}>{formatCurrency(row.expense)}</td>
                  <td style={{ ...td(index), fontWeight: 600, fontFamily: T.mono, color: row.net >= 0 ? T.profit : T.loss }}>
                    {formatCurrency(row.net)}
                  </td>
                  <td style={{ ...td(index), fontWeight: 700, fontFamily: T.mono, color: row.balance >= 0 ? T.brand : T.loss }}>
                    {formatCurrency(row.balance)}
                  </td>
                </tr>
              ))}
              {cashflowSeries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                    No cashflow data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <SectionTitle>P&L Ledger</SectionTitle>
        <DataTable columns={columns} data={expenseRows} searchColumn="description" searchPlaceholder="Search finance records..." />
      </Panel>
    </section>
  );
};
