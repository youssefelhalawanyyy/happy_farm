import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Batch, ExpenseRecord, FeedRecord, GrowthRecord, SaleRecord } from "@/types";
import { toFixedNumber } from "@/lib/utils";

export const getBatchAgeInDays = (arrivalDate: string, chickAgeAtArrivalDays = 0): number => {
  try {
    return Math.max(differenceInCalendarDays(new Date(), parseISO(arrivalDate)) + Math.max(chickAgeAtArrivalDays, 0), 0);
  } catch {
    return 0;
  }
};

export const getMortalityPercentage = (batch: Batch): number => {
  if (batch.initialChickCount <= 0) {
    return 0;
  }

  return toFixedNumber((batch.mortalityCount / batch.initialChickCount) * 100);
};

export const getBatchFeedKg = (batchId: string, feed: FeedRecord[]): number =>
  feed.filter((row) => row.batchId === batchId).reduce((sum, row) => sum + row.quantityKg, 0);

export const getLatestAverageWeight = (batchId: string, growth: GrowthRecord[]): number => {
  const rows = growth
    .filter((row) => row.batchId === batchId)
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate));

  return rows[0]?.averageWeightKg ?? 0;
};

export const calculateFCR = (feedKg: number, birdCount: number, avgWeightKg: number): number => {
  const liveWeight = birdCount * avgWeightKg;
  if (liveWeight <= 0) {
    return 0;
  }

  return toFixedNumber(feedKg / liveWeight, 3);
};

export const calculateBatchProfit = (
  batchId: string,
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
  chicksCost = 0
): number => {
  const revenue = sales.filter((sale) => sale.batchId === batchId).reduce((sum, sale) => sum + sale.totalRevenue, 0);
  const costs =
    expenses.filter((expense) => expense.batchId === batchId).reduce((sum, expense) => sum + expense.amount, 0) + chicksCost;

  return toFixedNumber(revenue - costs);
};

export const calculateExpectedProfit = (
  batch: Batch,
  marketPrice: number,
  feedRecords: FeedRecord[],
  expenses: ExpenseRecord[],
  growth: GrowthRecord[]
): number => {
  const avgWeight = getLatestAverageWeight(batch.id ?? "", growth) || batch.targetSellingWeight;
  const expectedRevenue = batch.currentAliveCount * avgWeight * marketPrice;

  const feedCost = feedRecords
    .filter((feed) => feed.batchId === batch.id)
    .reduce((sum, feed) => sum + (feed.pricePerTon / 1000) * feed.quantityKg, 0);

  const operatingCost = expenses
    .filter((expense) => expense.batchId === batch.id)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const baseBatchCost = batch.batchCost ?? batch.initialChickCount * batch.chickPrice;
  return toFixedNumber(expectedRevenue - feedCost - operatingCost - baseBatchCost);
};

export const calculateBatchCost = (batch: Batch, feedRecords: FeedRecord[], expenses: ExpenseRecord[]): number => {
  const chicksCost = batch.batchCost ?? batch.initialChickCount * batch.chickPrice;
  const feedCost = feedRecords
    .filter((feed) => feed.batchId === batch.id)
    .reduce((sum, feed) => sum + (feed.pricePerTon / 1000) * feed.quantityKg, 0);
  const operatingCost = expenses
    .filter((expense) => expense.batchId === batch.id)
    .reduce((sum, expense) => sum + expense.amount, 0);
  return toFixedNumber(chicksCost + feedCost + operatingCost);
};
