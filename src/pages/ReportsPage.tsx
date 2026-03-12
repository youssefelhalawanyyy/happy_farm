import { useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { calculateBatchProfit, calculateFCR, getBatchFeedKg, getLatestAverageWeight, getMortalityPercentage } from "@/lib/calculations";
import {
  compareDateTimeDesc,
  formatCurrency,
  formatDateTimeLocal,
  formatNumber,
  isoToday,
  toIsoDateTime,
  toMonthKey
} from "@/lib/utils";
import { exportExcelWorkbook, exportSystemReportPdf, type PdfReportSection } from "@/services/reportExport";
import type {
  Alert,
  Batch,
  EnvironmentReading,
  ExpenseCategory,
  ExpenseRecord,
  FeedRecord,
  GrowthRecord,
  InventoryItem,
  LivestockAdjustmentRecord,
  MarketPriceSnapshot,
  MortalityRecord,
  Quotation,
  SaleRecord,
  WorkerProfile,
  WorkerTask
} from "@/types";

type BatchPerformanceRow = {
  batchId: string;
  status: Batch["status"];
  ageDays: number;
  alive: number;
  mortalityPercent: number;
  feedKg: number;
  fcr: number;
  avgWeightKg: number;
  revenue: number;
  expenses: number;
  profit: number;
};

const COGS_CATEGORIES: ExpenseCategory[] = ["feed", "chicks", "medicine"];

const startOfCurrentMonth = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

const toDateKey = (value: unknown): string => {
  const iso = toIsoDateTime(value);
  return iso ? iso.slice(0, 10) : "";
};

const inDateRange = (value: unknown, dateFrom: string, dateTo: string, includeWhenMissingDate = false): boolean => {
  const dateKey = toDateKey(value);
  if (!dateKey) {
    return includeWhenMissingDate;
  }
  if (dateFrom && dateKey < dateFrom) {
    return false;
  }
  if (dateTo && dateKey > dateTo) {
    return false;
  }
  return true;
};

const toExcelDateLabel = (value: unknown): string => {
  const iso = toIsoDateTime(value);
  return iso ? formatDateTimeLocal(iso) : "-";
};

export const ReportsPage = () => {
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: feed } = useRealtimeCollection<FeedRecord>(COLLECTIONS.feedRecords);
  const { data: growth } = useRealtimeCollection<GrowthRecord>(COLLECTIONS.growthRecords);
  const { data: sales } = useRealtimeCollection<SaleRecord>(COLLECTIONS.sales);
  const { data: expenses } = useRealtimeCollection<ExpenseRecord>(COLLECTIONS.expenses);
  const { data: mortality } = useRealtimeCollection<MortalityRecord>(COLLECTIONS.mortalityRecords);
  const { data: inventory } = useRealtimeCollection<InventoryItem>(COLLECTIONS.inventory);
  const { data: quotations } = useRealtimeCollection<Quotation>(COLLECTIONS.quotations);
  const { data: alerts } = useRealtimeCollection<Alert>(COLLECTIONS.alerts);
  const { data: market } = useRealtimeCollection<MarketPriceSnapshot>(COLLECTIONS.marketPrices);
  const { data: environment } = useRealtimeCollection<EnvironmentReading>(COLLECTIONS.environmentReadings);
  const { data: livestockAdjustments } = useRealtimeCollection<LivestockAdjustmentRecord>(COLLECTIONS.livestockAdjustments);
  const { data: workers } = useRealtimeCollection<WorkerProfile>(COLLECTIONS.workers);
  const { data: tasks } = useRealtimeCollection<WorkerTask>(COLLECTIONS.tasks);

  const [dateFrom, setDateFrom] = useState<string>(() => startOfCurrentMonth());
  const [dateTo, setDateTo] = useState<string>(() => isoToday());

  const dateRangeLabel = dateFrom || dateTo ? `${dateFrom || "Beginning"} to ${dateTo || "Today"}` : "All dates";

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

  const filteredBatches = useMemo(
    () => batches.filter((row) => inDateRange(row.arrivalDate, dateFrom, dateTo)),
    [batches, dateFrom, dateTo]
  );
  const filteredFeed = useMemo(
    () => feed.filter((row) => inDateRange(row.recordDate, dateFrom, dateTo)),
    [dateFrom, dateTo, feed]
  );
  const filteredGrowth = useMemo(
    () => growth.filter((row) => inDateRange(row.recordDate, dateFrom, dateTo)),
    [dateFrom, dateTo, growth]
  );
  const filteredSales = useMemo(
    () => sales.filter((row) => inDateRange(row.saleDate, dateFrom, dateTo)),
    [dateFrom, dateTo, sales]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((row) => inDateRange(row.expenseDate, dateFrom, dateTo)),
    [dateFrom, dateTo, expenses]
  );
  const filteredMortality = useMemo(
    () => mortality.filter((row) => inDateRange(row.recordDate, dateFrom, dateTo)),
    [dateFrom, dateTo, mortality]
  );
  const filteredLivestockAdjustments = useMemo(
    () => livestockAdjustments.filter((row) => inDateRange(row.adjustedAt || row.createdAt, dateFrom, dateTo)),
    [dateFrom, dateTo, livestockAdjustments]
  );
  const filteredQuotations = useMemo(
    () =>
      quotations.filter((row) =>
        inDateRange(row.paidAt || row.createdAt || row.updatedAt || row.validUntil, dateFrom, dateTo)
      ),
    [dateFrom, dateTo, quotations]
  );
  const filteredAlerts = useMemo(
    () => alerts.filter((row) => inDateRange(row.createdAt || row.updatedAt, dateFrom, dateTo)),
    [alerts, dateFrom, dateTo]
  );
  const filteredMarket = useMemo(
    () => market.filter((row) => inDateRange(row.capturedAt, dateFrom, dateTo)),
    [dateFrom, dateTo, market]
  );
  const filteredEnvironment = useMemo(
    () => environment.filter((row) => inDateRange(row.recordedAt, dateFrom, dateTo)),
    [dateFrom, dateTo, environment]
  );
  const filteredInventory = useMemo(
    () =>
      inventory.filter((row) => inDateRange(row.lastRestockedAt || row.updatedAt || row.createdAt, dateFrom, dateTo, true)),
    [dateFrom, dateTo, inventory]
  );
  const filteredWorkers = useMemo(
    () => workers.filter((row) => inDateRange(row.updatedAt || row.createdAt, dateFrom, dateTo, true)),
    [dateFrom, dateTo, workers]
  );
  const filteredTasks = useMemo(
    () => tasks.filter((row) => inDateRange(row.dueDate || row.updatedAt || row.createdAt, dateFrom, dateTo, true)),
    [dateFrom, dateTo, tasks]
  );

  const salesRevenue = useMemo(
    () => filteredSales.reduce((sum, row) => sum + row.totalRevenue, 0),
    [filteredSales]
  );
  const paidQuotationIncome = useMemo(
    () =>
      filteredQuotations
        .filter((row) => row.paymentStatus === "paid")
        .reduce((sum, row) => sum + (row.paidAmount ?? row.total ?? 0), 0),
    [filteredQuotations]
  );
  const totalIncome = salesRevenue + paidQuotationIncome;
  const totalExpense = useMemo(
    () => filteredExpenses.reduce((sum, row) => sum + row.amount, 0),
    [filteredExpenses]
  );
  const cogs = useMemo(
    () =>
      filteredExpenses
        .filter((row) => COGS_CATEGORIES.includes(row.category))
        .reduce((sum, row) => sum + row.amount, 0),
    [filteredExpenses]
  );
  const grossProfit = totalIncome - cogs;
  const netProfit = totalIncome - totalExpense;
  const marginPercent = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const totalMortalityBirds = useMemo(
    () => filteredMortality.reduce((sum, row) => sum + row.birds, 0),
    [filteredMortality]
  );
  const deadLossBirds = useMemo(
    () =>
      filteredLivestockAdjustments
        .filter((row) => row.reason === "dead_loss")
        .reduce((sum, row) => sum + row.quantity, 0),
    [filteredLivestockAdjustments]
  );
  const manualAdjustmentBirds = useMemo(
    () =>
      filteredLivestockAdjustments
        .filter((row) => row.reason === "manual_correction")
        .reduce((sum, row) => sum + row.quantity, 0),
    [filteredLivestockAdjustments]
  );

  const activeBatches = filteredBatches.filter((row) => row.status === "active").length;
  const liveBirds = filteredBatches.reduce((sum, row) => sum + Math.max(row.currentAliveCount, 0), 0);

  const batchPerformanceRows = useMemo<BatchPerformanceRow[]>(
    () =>
      filteredBatches.map((batch) => {
        const id = batch.id ?? "";
        const batchFeedKg = getBatchFeedKg(id, filteredFeed);
        const avgWeightKg = getLatestAverageWeight(id, filteredGrowth) || batch.targetSellingWeight;
        const fcr = calculateFCR(batchFeedKg, batch.currentAliveCount, avgWeightKg);
        const revenue = filteredSales.filter((sale) => sale.batchId === id).reduce((sum, row) => sum + row.totalRevenue, 0);
        const batchExpenses = filteredExpenses
          .filter((row) => row.batchId === id)
          .reduce((sum, row) => sum + row.amount, 0);
        const chicksCost = batch.initialChickCount * batch.chickPrice;
        const profit = calculateBatchProfit(id, filteredSales, filteredExpenses, chicksCost);

        return {
          batchId: batch.batchId,
          status: batch.status,
          ageDays: batch.chickAgeAtArrivalDays ?? 0,
          alive: batch.currentAliveCount,
          mortalityPercent: getMortalityPercentage(batch),
          feedKg: batchFeedKg,
          fcr,
          avgWeightKg,
          revenue,
          expenses: batchExpenses,
          profit
        };
      }),
    [filteredBatches, filteredExpenses, filteredFeed, filteredGrowth, filteredSales]
  );

  const financialTrend = useMemo(() => {
    const grouped = new Map<string, { income: number; expense: number }>();

    for (const sale of filteredSales) {
      const month = toMonthKey(sale.saleDate);
      const current = grouped.get(month) ?? { income: 0, expense: 0 };
      current.income += sale.totalRevenue;
      grouped.set(month, current);
    }

    for (const q of filteredQuotations) {
      if (q.paymentStatus !== "paid") {
        continue;
      }
      const month = toMonthKey(q.paidAt || q.validUntil);
      const current = grouped.get(month) ?? { income: 0, expense: 0 };
      current.income += q.paidAmount ?? q.total ?? 0;
      grouped.set(month, current);
    }

    for (const expense of filteredExpenses) {
      const month = toMonthKey(expense.expenseDate);
      const current = grouped.get(month) ?? { income: 0, expense: 0 };
      current.expense += expense.amount;
      grouped.set(month, current);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        income: Number(values.income.toFixed(2)),
        expense: Number(values.expense.toFixed(2)),
        net: Number((values.income - values.expense).toFixed(2))
      }));
  }, [filteredExpenses, filteredQuotations, filteredSales]);

  const mortalityAndLossRows = useMemo(() => {
    const mortalityRows = filteredMortality.map((row) => ({
      id: `mortality-${row.id ?? `${row.batchId}-${row.recordDate}`}`,
      date: row.recordDate,
      type: "mortality_log",
      reason: row.cause || "Mortality event",
      batch: batchLabelById[row.batchId] || row.batchId,
      birds: row.birds
    }));

    const adjustmentRows = filteredLivestockAdjustments.map((row) => ({
      id: `adjustment-${row.id ?? row.adjustedAt}`,
      date: row.adjustedAt || toIsoDateTime(row.createdAt),
      type: row.reason,
      reason: row.note || (row.reason === "dead_loss" ? "Dead/loss adjustment" : "Manual correction"),
      batch: "-",
      birds: row.quantity
    }));

    return [...mortalityRows, ...adjustmentRows].sort((a, b) => compareDateTimeDesc(a.date, b.date));
  }, [batchLabelById, filteredLivestockAdjustments, filteredMortality]);

  const exportPdf = async (): Promise<void> => {
    try {
      const summaryRows = [
        { metric: "Date Range", value: dateRangeLabel },
        { metric: "Total Income", value: formatCurrency(totalIncome) },
        { metric: "Sales Revenue", value: formatCurrency(salesRevenue) },
        { metric: "Paid Quotations Income", value: formatCurrency(paidQuotationIncome) },
        { metric: "Total Expenses", value: formatCurrency(totalExpense) },
        { metric: "Gross Profit", value: formatCurrency(grossProfit) },
        { metric: "Net Profit", value: formatCurrency(netProfit) },
        { metric: "Net Margin", value: `${marginPercent.toFixed(2)}%` },
        { metric: "Active Batches", value: formatNumber(activeBatches) },
        { metric: "Live Birds", value: formatNumber(liveBirds) },
        { metric: "Mortality Birds", value: formatNumber(totalMortalityBirds) },
        { metric: "Dead/Loss Adjustments", value: formatNumber(deadLossBirds) }
      ];

      const sections: PdfReportSection[] = [
        {
          title: "Batch Performance",
          columns: ["Batch", "Status", "Alive", "Mortality %", "Feed Kg", "FCR", "Avg Wt", "Revenue", "Profit"],
          rows: batchPerformanceRows.map((row) => [
            row.batchId,
            row.status,
            formatNumber(row.alive),
            `${row.mortalityPercent.toFixed(2)}%`,
            row.feedKg.toFixed(1),
            row.fcr.toFixed(2),
            row.avgWeightKg.toFixed(2),
            formatCurrency(row.revenue),
            formatCurrency(row.profit)
          ])
        },
        {
          title: "Sales Ledger",
          columns: ["Date", "Buyer", "Batch", "Birds", "Avg Wt", "Price/Kg", "Revenue"],
          rows: filteredSales.map((row) => [
            row.saleDate,
            row.buyerName,
            batchLabelById[row.batchId] || row.batchId,
            formatNumber(row.birdCount),
            row.averageWeightKg.toFixed(2),
            formatCurrency(row.pricePerKg),
            formatCurrency(row.totalRevenue)
          ])
        },
        {
          title: "Expense Ledger",
          columns: ["Date", "Category", "Description", "Batch", "Amount"],
          rows: filteredExpenses.map((row) => [
            row.expenseDate,
            row.category,
            row.description,
            row.batchId ? batchLabelById[row.batchId] || row.batchId : "-",
            formatCurrency(row.amount)
          ])
        },
        {
          title: "Mortality & Loss Register",
          columns: ["Date", "Type", "Batch", "Birds", "Reason"],
          rows: mortalityAndLossRows.map((row) => [
            toDateKey(row.date),
            row.type,
            row.batch,
            formatNumber(row.birds),
            row.reason
          ])
        },
        {
          title: "Feed Consumption",
          columns: ["Date", "Batch", "Type", "Qty Kg", "Price/Ton", "Supplier"],
          rows: filteredFeed.map((row) => [
            row.recordDate,
            batchLabelById[row.batchId] || row.batchId,
            row.type,
            row.quantityKg.toFixed(1),
            formatCurrency(row.pricePerTon),
            row.supplier
          ])
        },
        {
          title: "Inventory Snapshot",
          columns: ["Item", "Category", "Qty", "Unit", "Reorder", "Supplier"],
          rows: filteredInventory.map((row) => [
            row.name,
            row.category,
            formatNumber(row.quantity),
            row.unit,
            formatNumber(row.reorderLevel),
            row.supplier || "-"
          ])
        },
        {
          title: "Quotations & Payment",
          columns: ["Quotation #", "Customer", "Status", "Payment", "Amount", "Paid Amount", "Date"],
          rows: filteredQuotations.map((row) => [
            row.quotationNumber,
            row.customerName,
            row.status,
            row.paymentStatus || "unpaid",
            formatCurrency(row.total),
            formatCurrency(row.paidAmount ?? 0),
            row.paidAt || toDateKey(row.createdAt) || row.validUntil
          ])
        },
        {
          title: "Alerts Log",
          columns: ["Date", "Severity", "Type", "Title", "Message"],
          rows: filteredAlerts.map((row) => [
            toDateKey(row.createdAt || row.updatedAt),
            row.severity,
            row.type,
            row.title,
            row.message
          ])
        },
        {
          title: "Market Price History",
          columns: ["Captured At", "Live Broiler", "Feed/Ton", "DOC", "Corn/Ton", "Soybean/Ton", "Source"],
          rows: filteredMarket.map((row) => [
            row.capturedAt,
            formatCurrency(row.liveBroilerPricePerKg),
            formatCurrency(row.feedPricePerTon),
            formatCurrency(row.dayOldChickPrice),
            formatCurrency(row.cornPricePerTon),
            formatCurrency(row.soybeanMealPricePerTon),
            row.source
          ])
        },
        {
          title: "Environment Readings",
          columns: ["Recorded", "House", "Device", "Temp C", "Humidity", "Ammonia ppm", "Fan", "Heater"],
          rows: filteredEnvironment.map((row) => [
            row.recordedAt,
            row.houseId,
            row.deviceId,
            row.temperatureC.toFixed(1),
            row.humidity.toFixed(1),
            row.ammoniaPpm.toFixed(1),
            row.fanStatus ? "On" : "Off",
            row.heaterStatus ? "On" : "Off"
          ])
        },
        {
          title: "Workforce",
          columns: ["Worker", "Role", "Assigned House", "Active", "Contact"],
          rows: filteredWorkers.map((row) => [
            row.name,
            row.role,
            row.assignedHouse || "-",
            row.active ? "Yes" : "No",
            row.contact || "-"
          ])
        },
        {
          title: "Tasks",
          columns: ["Title", "Assigned UID", "House", "Due Date", "Status"],
          rows: filteredTasks.map((row) => [
            row.title,
            row.assignedToUid,
            row.assignedHouse || "-",
            row.dueDate,
            row.status
          ])
        }
      ];

      await exportSystemReportPdf({
        reportTitle: "Mazra3ty Full System Report",
        periodLabel: dateRangeLabel,
        generatedAtLabel: new Date().toLocaleString("en-EG"),
        summaryRows,
        sections,
        fileName: `farm-system-report-${dateFrom || "start"}-${dateTo || "today"}`
      });
      toast.success("Professional PDF report exported");
    } catch (error) {
      console.error(error);
      toast.error("Unable to export professional PDF report");
    }
  };

  const exportExcel = async (): Promise<void> => {
    try {
      await exportExcelWorkbook(
        [
          {
            name: "Summary",
            rows: [
              { Metric: "Date Range", Value: dateRangeLabel },
              { Metric: "Total Income", Value: totalIncome },
              { Metric: "Sales Revenue", Value: salesRevenue },
              { Metric: "Paid Quotations Income", Value: paidQuotationIncome },
              { Metric: "Total Expenses", Value: totalExpense },
              { Metric: "Gross Profit", Value: grossProfit },
              { Metric: "Net Profit", Value: netProfit },
              { Metric: "Net Margin %", Value: Number(marginPercent.toFixed(2)) },
              { Metric: "Active Batches", Value: activeBatches },
              { Metric: "Live Birds", Value: liveBirds },
              { Metric: "Mortality Birds", Value: totalMortalityBirds },
              { Metric: "Dead/Loss Adjustments", Value: deadLossBirds },
              { Metric: "Manual Adjustments", Value: manualAdjustmentBirds }
            ]
          },
          {
            name: "Batch Performance",
            rows: batchPerformanceRows.map((row) => ({
              Batch: row.batchId,
              Status: row.status,
              Alive: row.alive,
              "Mortality %": Number(row.mortalityPercent.toFixed(2)),
              "Feed Kg": Number(row.feedKg.toFixed(1)),
              FCR: Number(row.fcr.toFixed(2)),
              "Avg Weight Kg": Number(row.avgWeightKg.toFixed(2)),
              Revenue: row.revenue,
              Expenses: row.expenses,
              Profit: row.profit
            }))
          },
          {
            name: "Sales",
            rows: filteredSales.map((row) => ({
              Date: row.saleDate,
              Buyer: row.buyerName,
              Batch: batchLabelById[row.batchId] || row.batchId,
              Birds: row.birdCount,
              "Avg Weight Kg": row.averageWeightKg,
              "Price Per Kg": row.pricePerKg,
              Revenue: row.totalRevenue
            }))
          },
          {
            name: "Expenses",
            rows: filteredExpenses.map((row) => ({
              Date: row.expenseDate,
              Category: row.category,
              Description: row.description,
              Batch: row.batchId ? batchLabelById[row.batchId] || row.batchId : "-",
              Amount: row.amount
            }))
          },
          {
            name: "Mortality & Loss",
            rows: mortalityAndLossRows.map((row) => ({
              Date: toDateKey(row.date),
              Type: row.type,
              Batch: row.batch,
              Birds: row.birds,
              Reason: row.reason
            }))
          },
          {
            name: "Feed Logs",
            rows: filteredFeed.map((row) => ({
              Date: row.recordDate,
              Batch: batchLabelById[row.batchId] || row.batchId,
              Type: row.type,
              "Quantity Kg": row.quantityKg,
              "Price Per Ton": row.pricePerTon,
              Supplier: row.supplier
            }))
          },
          {
            name: "Inventory",
            rows: filteredInventory.map((row) => ({
              Item: row.name,
              Category: row.category,
              Quantity: row.quantity,
              Unit: row.unit,
              Reorder: row.reorderLevel,
              Supplier: row.supplier || "-",
              LastRestockedAt: row.lastRestockedAt || toExcelDateLabel(row.updatedAt || row.createdAt)
            }))
          },
          {
            name: "Quotations",
            rows: filteredQuotations.map((row) => ({
              Quotation: row.quotationNumber,
              Customer: row.customerName,
              Status: row.status,
              PaymentStatus: row.paymentStatus || "unpaid",
              Total: row.total,
              PaidAmount: row.paidAmount ?? 0,
              Date: row.paidAt || toDateKey(row.createdAt) || row.validUntil
            }))
          },
          {
            name: "Alerts",
            rows: filteredAlerts.map((row) => ({
              Date: toDateKey(row.createdAt || row.updatedAt),
              Severity: row.severity,
              Type: row.type,
              Title: row.title,
              Message: row.message,
              Read: row.read ? "Yes" : "No"
            }))
          },
          {
            name: "Market Prices",
            rows: filteredMarket.map((row) => ({
              CapturedAt: row.capturedAt,
              LiveBroilerPricePerKg: row.liveBroilerPricePerKg,
              FeedPricePerTon: row.feedPricePerTon,
              DayOldChickPrice: row.dayOldChickPrice,
              CornPricePerTon: row.cornPricePerTon,
              SoybeanMealPricePerTon: row.soybeanMealPricePerTon,
              Source: row.source
            }))
          },
          {
            name: "Environment",
            rows: filteredEnvironment.map((row) => ({
              RecordedAt: row.recordedAt,
              House: row.houseId,
              Device: row.deviceId,
              TemperatureC: row.temperatureC,
              Humidity: row.humidity,
              AmmoniaPpm: row.ammoniaPpm,
              Fan: row.fanStatus ? "On" : "Off",
              Heater: row.heaterStatus ? "On" : "Off"
            }))
          },
          {
            name: "Workers",
            rows: filteredWorkers.map((row) => ({
              Name: row.name,
              Role: row.role,
              AssignedHouse: row.assignedHouse || "-",
              Active: row.active ? "Yes" : "No",
              Contact: row.contact || "-"
            }))
          },
          {
            name: "Tasks",
            rows: filteredTasks.map((row) => ({
              Title: row.title,
              AssignedToUid: row.assignedToUid,
              House: row.assignedHouse || "-",
              DueDate: row.dueDate,
              Status: row.status
            }))
          }
        ],
        `farm-system-report-${dateFrom || "start"}-${dateTo || "today"}`
      );
      toast.success("Excel workbook exported");
    } catch (error) {
      console.error(error);
      toast.error("Unable to export Excel workbook");
    }
  };

  const clearDateFilters = (): void => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Professional Reports & Analytics"
        description="Full farm intelligence report with date filtering across finance, batches, mortality, stock, operations, and compliance."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void exportExcel()}>
              Export Excel Workbook
            </Button>
            <Button onClick={() => void exportPdf()}>Export Full PDF</Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Filter all report sections by date range before exporting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={clearDateFilters}>
                Clear Filters
              </Button>
            </div>
            <div className="flex items-end">
              <Badge variant="default">Range: {dateRangeLabel}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net Profit</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(netProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Live Birds</p>
            <p className="mt-1 text-lg font-semibold">{formatNumber(liveBirds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Mortality Birds</p>
            <p className="mt-1 text-lg font-semibold">{formatNumber(totalMortalityBirds + deadLossBirds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Batches</p>
            <p className="mt-1 text-lg font-semibold">{formatNumber(activeBatches)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Financial Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LineTrendChart data={financialTrend} xKey="month" yKey="net" color="#1F7A63" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Batch Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LineTrendChart data={batchPerformanceRows} xKey="batchId" yKey="profit" color="#2563EB" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Performance Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Batch</TH>
                <TH>Status</TH>
                <TH>Alive</TH>
                <TH>Mortality</TH>
                <TH>Feed</TH>
                <TH>FCR</TH>
                <TH>Avg Weight</TH>
                <TH>Revenue</TH>
                <TH>Expenses</TH>
                <TH>Profit</TH>
              </tr>
            </TableHead>
            <TableBody>
              {batchPerformanceRows.map((row) => (
                <tr key={row.batchId}>
                  <TD>{row.batchId}</TD>
                  <TD className="capitalize">{row.status}</TD>
                  <TD>{formatNumber(row.alive)}</TD>
                  <TD>{row.mortalityPercent.toFixed(2)}%</TD>
                  <TD>{row.feedKg.toFixed(1)} kg</TD>
                  <TD>{row.fcr.toFixed(2)}</TD>
                  <TD>{row.avgWeightKg.toFixed(2)} kg</TD>
                  <TD>{formatCurrency(row.revenue)}</TD>
                  <TD>{formatCurrency(row.expenses)}</TD>
                  <TD>{formatCurrency(row.profit)}</TD>
                </tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mortality & Loss Register</CardTitle>
          <CardDescription>
            Combined mortality logs and livestock dead/loss adjustments for full accountability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Date</TH>
                <TH>Type</TH>
                <TH>Batch</TH>
                <TH>Birds</TH>
                <TH>Reason</TH>
              </tr>
            </TableHead>
            <TableBody>
              {mortalityAndLossRows.map((row) => (
                <tr key={row.id}>
                  <TD>{toDateKey(row.date)}</TD>
                  <TD className="capitalize">{row.type.replace("_", " ")}</TD>
                  <TD>{row.batch}</TD>
                  <TD>{formatNumber(row.birds)}</TD>
                  <TD>{row.reason}</TD>
                </tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Date</TH>
                  <TH>Buyer</TH>
                  <TH>Batch</TH>
                  <TH>Birds</TH>
                  <TH>Revenue</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredSales.map((row) => (
                  <tr key={row.id ?? `${row.saleDate}-${row.batchId}`}>
                    <TD>{row.saleDate}</TD>
                    <TD>{row.buyerName}</TD>
                    <TD>{batchLabelById[row.batchId] || row.batchId}</TD>
                    <TD>{formatNumber(row.birdCount)}</TD>
                    <TD>{formatCurrency(row.totalRevenue)}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Date</TH>
                  <TH>Category</TH>
                  <TH>Description</TH>
                  <TH>Batch</TH>
                  <TH>Amount</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredExpenses.map((row) => (
                  <tr key={row.id ?? `${row.expenseDate}-${row.description}`}>
                    <TD>{row.expenseDate}</TD>
                    <TD className="capitalize">{row.category}</TD>
                    <TD>{row.description}</TD>
                    <TD>{row.batchId ? batchLabelById[row.batchId] || row.batchId : "-"}</TD>
                    <TD>{formatCurrency(row.amount)}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feed Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Date</TH>
                  <TH>Batch</TH>
                  <TH>Type</TH>
                  <TH>Qty</TH>
                  <TH>Price/Ton</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredFeed.map((row) => (
                  <tr key={row.id ?? `${row.batchId}-${row.recordDate}`}>
                    <TD>{row.recordDate}</TD>
                    <TD>{batchLabelById[row.batchId] || row.batchId}</TD>
                    <TD className="capitalize">{row.type}</TD>
                    <TD>{row.quantityKg.toFixed(1)} kg</TD>
                    <TD>{formatCurrency(row.pricePerTon)}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inventory Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Item</TH>
                  <TH>Category</TH>
                  <TH>Quantity</TH>
                  <TH>Reorder</TH>
                  <TH>Status</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredInventory.map((row) => (
                  <tr key={row.id ?? row.name}>
                    <TD>{row.name}</TD>
                    <TD className="capitalize">{row.category}</TD>
                    <TD>
                      {formatNumber(row.quantity)} {row.unit}
                    </TD>
                    <TD>
                      {formatNumber(row.reorderLevel)} {row.unit}
                    </TD>
                    <TD>
                      <Badge variant={row.quantity <= row.reorderLevel ? "danger" : "success"}>
                        {row.quantity <= row.reorderLevel ? "Low stock" : "Healthy"}
                      </Badge>
                    </TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotations & Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Quotation</TH>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH>Payment</TH>
                  <TH>Total</TH>
                  <TH>Paid</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredQuotations.map((row) => (
                  <tr key={row.id ?? row.quotationNumber}>
                    <TD>{row.quotationNumber}</TD>
                    <TD>{row.customerName}</TD>
                    <TD className="capitalize">{row.status}</TD>
                    <TD>
                      <Badge variant={row.paymentStatus === "paid" ? "success" : "warning"}>
                        {row.paymentStatus || "unpaid"}
                      </Badge>
                    </TD>
                    <TD>{formatCurrency(row.total)}</TD>
                    <TD>{formatCurrency(row.paidAmount ?? 0)}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alerts Log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>When</TH>
                  <TH>Severity</TH>
                  <TH>Type</TH>
                  <TH>Title</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredAlerts.map((row) => (
                  <tr key={row.id ?? `${row.title}-${row.message}`}>
                    <TD>{toDateKey(row.createdAt || row.updatedAt)}</TD>
                    <TD className="capitalize">{row.severity}</TD>
                    <TD className="capitalize">{row.type}</TD>
                    <TD>{row.title}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Market Price History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Captured</TH>
                  <TH>Live Broiler</TH>
                  <TH>Feed/Ton</TH>
                  <TH>DOC</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredMarket.map((row) => (
                  <tr key={row.id ?? row.capturedAt}>
                    <TD>{row.capturedAt}</TD>
                    <TD>{formatCurrency(row.liveBroilerPricePerKg)}</TD>
                    <TD>{formatCurrency(row.feedPricePerTon)}</TD>
                    <TD>{formatCurrency(row.dayOldChickPrice)}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Environment Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Recorded</TH>
                  <TH>House</TH>
                  <TH>Temp</TH>
                  <TH>Humidity</TH>
                  <TH>Ammonia</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredEnvironment
                  .slice()
                  .sort((a, b) => compareDateTimeDesc(a.recordedAt, b.recordedAt))
                  .slice(0, 50)
                  .map((row) => (
                    <tr key={row.id ?? `${row.houseId}-${row.recordedAt}`}>
                      <TD>{row.recordedAt}</TD>
                      <TD>{row.houseId}</TD>
                      <TD>{row.temperatureC.toFixed(1)}°C</TD>
                      <TD>{row.humidity.toFixed(1)}%</TD>
                      <TD>{row.ammoniaPpm.toFixed(1)} ppm</TD>
                    </tr>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Name</TH>
                  <TH>Role</TH>
                  <TH>House</TH>
                  <TH>Active</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredWorkers.map((row) => (
                  <tr key={row.id ?? row.uid}>
                    <TD>{row.name}</TD>
                    <TD className="capitalize">{row.role}</TD>
                    <TD>{row.assignedHouse || "-"}</TD>
                    <TD>{row.active ? "Yes" : "No"}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Title</TH>
                  <TH>Assigned UID</TH>
                  <TH>Due</TH>
                  <TH>Status</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredTasks.map((row) => (
                  <tr key={row.id ?? `${row.assignedToUid}-${row.title}`}>
                    <TD>{row.title}</TD>
                    <TD>{row.assignedToUid}</TD>
                    <TD>{row.dueDate}</TD>
                    <TD className="capitalize">{row.status.replace("_", " ")}</TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
