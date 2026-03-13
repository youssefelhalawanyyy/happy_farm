import { poultryKnowledgeData } from "@/data/poultryKnowledgeData";
import { calculateFCR, getBatchFeedKg, getBatchAgeInDays, getLatestAverageWeight, getMortalityPercentage } from "@/lib/calculations";
import { SAFE_THRESHOLDS } from "@/lib/constants";
import type { Batch, EnvironmentReading, FeedRecord, GrowthRecord, MortalityRecord } from "@/types";

export type AssistantSeverity = "normal" | "warning" | "danger";

export interface AssistantInsight {
  title: string;
  detail: string;
  severity: AssistantSeverity;
  batchLabel?: string;
  metric?: string;
  actual?: number | string;
  target?: number | string;
  unit?: string;
}

export interface AssistantResponse {
  summary: string;
  insights: AssistantInsight[];
  actions: string[];
  references: string[];
}

export interface AssistantInput {
  question: string;
  batches: Batch[];
  readings: EnvironmentReading[];
  mortality: MortalityRecord[];
  feed: FeedRecord[];
  growth: GrowthRecord[];
}

export interface ProactiveFarmInsights {
  healthScore: number;
  healthLabel: "Excellent" | "Good" | "Fair" | "Critical";
  insights: AssistantInsight[];
  actions: string[];
  activeBatches: number;
  totalBirds: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const normalize = (value: string): string => value.trim().toLowerCase();
const hasToken = (text: string, tokens: string[]): boolean => tokens.some((t) => text.includes(t));

const latestEnv = (readings: EnvironmentReading[]): EnvironmentReading | null =>
  [...readings].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null;

const todayMortalityBirds = (rows: MortalityRecord[]): number => {
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((r) => r.recordDate === today).reduce((s, r) => s + r.birds, 0);
};

const mortalityLast7Days = (batchId: string, rows: MortalityRecord[]): number => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows
    .filter((r) => r.batchId === batchId && r.recordDate >= cutoffStr)
    .reduce((s, r) => s + r.birds, 0);
};

const getKnowledgeReferences = (question: string): string[] => {
  const tokens = normalize(question).split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
  if (!tokens.length) return [];
  const matches: string[] = [];
  poultryKnowledgeData.forEach((section) => {
    section.topics.forEach((topic) => {
      const hay = `${topic.title} ${topic.content}`.toLowerCase();
      if (tokens.some((t) => hay.includes(t))) matches.push(`${section.category}: ${topic.title}`);
    });
  });
  return matches.slice(0, 4);
};

const severityRank: Record<AssistantSeverity, number> = { normal: 0, warning: 1, danger: 2 };

/* ─── Proactive Farm-Wide Analysis ──────────────────────────────────────── */

export const generateProactiveFarmInsights = ({
  batches,
  readings,
  mortality,
  feed,
  growth,
}: Omit<AssistantInput, "question">): ProactiveFarmInsights => {
  const insights: AssistantInsight[] = [];
  const actions: string[] = [];
  const activeBatches = batches.filter((b) => b.status === "active");
  const totalBirds = activeBatches.reduce((s, b) => s + b.currentAliveCount, 0);
  const latest = latestEnv(readings);

  // ── Environment checks ─────────────────────────────────────────────────
  if (latest) {
    if (latest.temperatureC > SAFE_THRESHOLDS.temperatureHigh) {
      insights.push({
        title: "Heat stress risk",
        detail: `Current temperature ${latest.temperatureC.toFixed(1)}°C exceeds safe maximum of ${SAFE_THRESHOLDS.temperatureHigh}°C.`,
        severity: "danger",
        metric: "Temperature",
        actual: latest.temperatureC.toFixed(1),
        target: `≤ ${SAFE_THRESHOLDS.temperatureHigh}`,
        unit: "°C",
      });
      actions.push("Activate all cooling systems and increase ventilation fans immediately.");
    } else if (latest.temperatureC < SAFE_THRESHOLDS.temperatureLow) {
      insights.push({
        title: "Cold stress risk",
        detail: `Temperature ${latest.temperatureC.toFixed(1)}°C is below safe minimum of ${SAFE_THRESHOLDS.temperatureLow}°C.`,
        severity: "warning",
        metric: "Temperature",
        actual: latest.temperatureC.toFixed(1),
        target: `≥ ${SAFE_THRESHOLDS.temperatureLow}`,
        unit: "°C",
      });
      actions.push("Activate brooding heaters and reduce air intake until temperature stabilizes.");
    }

    if (latest.ammoniaPpm > SAFE_THRESHOLDS.ammoniaHigh) {
      insights.push({
        title: "Ammonia elevation",
        detail: `Ammonia at ${latest.ammoniaPpm.toFixed(1)} ppm exceeds safe limit of ${SAFE_THRESHOLDS.ammoniaHigh} ppm.`,
        severity: "warning",
        metric: "Ammonia",
        actual: latest.ammoniaPpm.toFixed(1),
        target: `≤ ${SAFE_THRESHOLDS.ammoniaHigh}`,
        unit: "ppm",
      });
      actions.push("Replace wet litter sections, increase fresh-air exchange rate, and inspect ventilation units.");
    }

    if (latest.humidity > SAFE_THRESHOLDS.humidityHigh) {
      insights.push({
        title: "High humidity",
        detail: `Humidity at ${latest.humidity.toFixed(0)}% is above safe maximum of ${SAFE_THRESHOLDS.humidityHigh}%.`,
        severity: "warning",
        metric: "Humidity",
        actual: latest.humidity.toFixed(0),
        target: `≤ ${SAFE_THRESHOLDS.humidityHigh}`,
        unit: "%",
      });
      actions.push("Improve litter management, increase ventilation, and reduce water spillage.");
    }
  }

  // ── Today's farm-wide mortality ────────────────────────────────────────
  const todayDeaths = todayMortalityBirds(mortality);
  const mortalityRateToday = totalBirds > 0 ? (todayDeaths / totalBirds) * 100 : 0;
  if (mortalityRateToday > SAFE_THRESHOLDS.mortalityPercentDaily) {
    insights.push({
      title: "Farm-wide mortality spike",
      detail: `${todayDeaths} birds lost today (${mortalityRateToday.toFixed(2)}%) — above safe daily limit of ${SAFE_THRESHOLDS.mortalityPercentDaily}%.`,
      severity: "danger",
      metric: "Daily Mortality",
      actual: `${mortalityRateToday.toFixed(2)}%`,
      target: `≤ ${SAFE_THRESHOLDS.mortalityPercentDaily}%`,
    });
    actions.push("Inspect all houses immediately. Audit feed and water, isolate weak birds, and review vaccination logs.");
  }

  // ── Per-batch analysis ─────────────────────────────────────────────────
  for (const batch of activeBatches) {
    const batchLabel = batch.batchId;
    const feedKg = getBatchFeedKg(batch.id ?? "", feed);
    const avgWeight = getLatestAverageWeight(batch.id ?? "", growth) || batch.targetSellingWeight;
    const fcr = calculateFCR(feedKg, batch.currentAliveCount, avgWeight);
    const mortalityPct = getMortalityPercentage(batch);
    const age = getBatchAgeInDays(batch.arrivalDate, batch.chickAgeAtArrivalDays);
    const recent7Mortality = mortalityLast7Days(batch.id ?? "", mortality);
    const recent7Rate = batch.currentAliveCount > 0 ? (recent7Mortality / batch.currentAliveCount) * 100 : 0;

    // FCR check – target varies by age; use 1.80 for young, 2.00 for mature
    const fcrTarget = age < 28 ? 1.80 : 2.00;
    if (fcr > 0 && fcr > fcrTarget) {
      const severity: AssistantSeverity = fcr > fcrTarget + 0.25 ? "danger" : "warning";
      insights.push({
        title: `High FCR – ${batchLabel}`,
        detail: `FCR is ${fcr.toFixed(2)} vs target ≤ ${fcrTarget.toFixed(2)} for age ${age} days. Feed efficiency needs attention.`,
        severity,
        batchLabel,
        metric: "FCR",
        actual: fcr.toFixed(2),
        target: `≤ ${fcrTarget.toFixed(2)}`,
      });
      actions.push(`Review feed stage for Batch ${batchLabel}: verify transition to correct phase (starter/grower/finisher) and check spillage.`);
    }

    // Cumulative mortality > 5%
    if (mortalityPct > 5) {
      const severity: AssistantSeverity = mortalityPct > 10 ? "danger" : "warning";
      insights.push({
        title: `High cumulative mortality – ${batchLabel}`,
        detail: `${mortalityPct.toFixed(1)}% cumulative mortality (${batch.mortalityCount} birds). Investigate root cause.`,
        severity,
        batchLabel,
        metric: "Cumulative Mortality",
        actual: `${mortalityPct.toFixed(1)}%`,
        target: "< 5%",
      });
    }

    // 7-day rolling mortality spike
    if (recent7Rate > 2) {
      insights.push({
        title: `7-day mortality trend – ${batchLabel}`,
        detail: `${recent7Mortality} deaths in last 7 days (${recent7Rate.toFixed(1)}% of current flock). Trend is above normal.`,
        severity: "warning",
        batchLabel,
        metric: "7-day Mortality",
        actual: `${recent7Rate.toFixed(1)}%`,
        target: "< 2%",
      });
    }

    // Weight behind schedule check (rough benchmark: 0.05 kg/day)
    const expectedWeight = age * 0.051;
    if (age > 10 && avgWeight > 0 && avgWeight < expectedWeight * 0.85) {
      insights.push({
        title: `Below target weight – ${batchLabel}`,
        detail: `Current avg weight ${avgWeight.toFixed(2)} kg vs expected ~${expectedWeight.toFixed(2)} kg at day ${age}. Birds are growing slower than benchmark.`,
        severity: "warning",
        batchLabel,
        metric: "Avg Weight",
        actual: `${avgWeight.toFixed(2)} kg`,
        target: `~${expectedWeight.toFixed(2)} kg`,
      });
      actions.push(`Check feed quality and brooding temperature for Batch ${batchLabel}. Ensure correct phase feed is being used.`);
    }
  }

  // ── Remove duplicate action strings ───────────────────────────────────
  const uniqueActions = [...new Set(actions)];

  // ── Health score ──────────────────────────────────────────────────────
  const dangerCount = insights.filter((i) => i.severity === "danger").length;
  const warningCount = insights.filter((i) => i.severity === "warning").length;
  const rawScore = 100 - dangerCount * 22 - warningCount * 8;
  const healthScore = Math.max(0, Math.min(100, rawScore));

  let healthLabel: ProactiveFarmInsights["healthLabel"] = "Excellent";
  if (healthScore < 40) healthLabel = "Critical";
  else if (healthScore < 65) healthLabel = "Fair";
  else if (healthScore < 85) healthLabel = "Good";

  return {
    healthScore,
    healthLabel,
    insights,
    actions: uniqueActions.length ? uniqueActions : ["All monitored indicators are within normal range. Continue routine logging."],
    activeBatches: activeBatches.length,
    totalBirds,
  };
};

/* ─── Chat / Question-Triggered Analysis ────────────────────────────────── */

export const generateFarmAssistantResponse = ({
  question,
  batches,
  readings,
  mortality,
  feed,
  growth,
}: AssistantInput): AssistantResponse => {
  const query = normalize(question);
  const latest = latestEnv(readings);
  const activeBatches = batches.filter((b) => b.status === "active");
  const totalBirds = activeBatches.reduce((s, b) => s + b.currentAliveCount, 0);
  const todayDeaths = todayMortalityBirds(mortality);
  const mortalityRateToday = totalBirds > 0 ? (todayDeaths / totalBirds) * 100 : 0;

  const wantsTemp = hasToken(query, ["temperature", "heat", "hot", "cold", "panting", "chill"]);
  const wantsMortality = hasToken(query, ["mortality", "dying", "dead", "death", "chicks dying", "loss"]);
  const wantsFcr = hasToken(query, ["fcr", "feed conversion", "feed intake", "feed cost", "feed efficiency"]);
  const wantsAmmonia = hasToken(query, ["ammonia", "air quality", "smell", "ventilation", "gas"]);
  const wantsWeight = hasToken(query, ["weight", "growth", "slow growth", "underweight", "gain"]);

  const insights: AssistantInsight[] = [];
  const actions: string[] = [];

  // Environment
  if (latest) {
    if (latest.temperatureC > SAFE_THRESHOLDS.temperatureHigh) {
      insights.push({ title: "Heat stress risk", detail: `Temperature is ${latest.temperatureC.toFixed(1)}°C, above safe max ${SAFE_THRESHOLDS.temperatureHigh}°C.`, severity: "danger" });
      actions.push("Increase ventilation and activate cooling immediately.");
    } else if (latest.temperatureC < SAFE_THRESHOLDS.temperatureLow) {
      insights.push({ title: "Cold stress risk", detail: `Temperature is ${latest.temperatureC.toFixed(1)}°C, below safe min ${SAFE_THRESHOLDS.temperatureLow}°C.`, severity: "warning" });
      actions.push("Check brooding heaters and reduce cold drafts.");
    } else if (wantsTemp) {
      insights.push({ title: "Temperature normal", detail: `Latest reading: ${latest.temperatureC.toFixed(1)}°C (safe range ${SAFE_THRESHOLDS.temperatureLow}–${SAFE_THRESHOLDS.temperatureHigh}°C).`, severity: "normal" });
    }

    if (latest.ammoniaPpm > SAFE_THRESHOLDS.ammoniaHigh) {
      insights.push({ title: "High ammonia", detail: `Ammonia is ${latest.ammoniaPpm.toFixed(1)} ppm (limit: ${SAFE_THRESHOLDS.ammoniaHigh} ppm).`, severity: "warning" });
      actions.push("Replace wet litter and increase fresh-air exchange.");
    } else if (wantsAmmonia) {
      insights.push({ title: "Air quality normal", detail: `Ammonia ${latest.ammoniaPpm.toFixed(1)} ppm, humidity ${latest.humidity.toFixed(0)}% — both within safe range.`, severity: "normal" });
    }
  }

  // Mortality
  if (mortalityRateToday > SAFE_THRESHOLDS.mortalityPercentDaily) {
    insights.push({ title: "Mortality spike today", detail: `${todayDeaths} birds (${mortalityRateToday.toFixed(2)}%) died today — above daily ${SAFE_THRESHOLDS.mortalityPercentDaily}% limit.`, severity: "danger" });
    actions.push("Audit feed/water, isolate weak birds, and review vaccination/medication records.");
  } else if (wantsMortality) {
    insights.push({ title: "Mortality normal", detail: `Today: ${todayDeaths} birds (${mortalityRateToday.toFixed(2)}%) — within safe range.`, severity: "normal" });
  }

  // FCR per batch
  for (const batch of activeBatches) {
    const feedKg = getBatchFeedKg(batch.id ?? "", feed);
    const avgWeight = getLatestAverageWeight(batch.id ?? "", growth) || batch.targetSellingWeight;
    const fcr = calculateFCR(feedKg, batch.currentAliveCount, avgWeight);
    const age = getBatchAgeInDays(batch.arrivalDate, batch.chickAgeAtArrivalDays);
    const fcrTarget = age < 28 ? 1.80 : 2.00;

    if (wantsFcr && fcr > 0) {
      const sev: AssistantSeverity = fcr > fcrTarget ? (fcr > fcrTarget + 0.25 ? "danger" : "warning") : "normal";
      insights.push({
        title: `FCR – ${batch.batchId}`,
        detail: `FCR is ${fcr.toFixed(2)} (target ≤ ${fcrTarget.toFixed(2)} at day ${age}).`,
        severity: sev,
        batchLabel: batch.batchId,
        metric: "FCR",
        actual: fcr.toFixed(2),
        target: `≤ ${fcrTarget.toFixed(2)}`,
      });
    }

    if (wantsWeight) {
      const avgW = getLatestAverageWeight(batch.id ?? "", growth);
      if (avgW > 0) {
        const expected = age * 0.051;
        const sev: AssistantSeverity = avgW < expected * 0.85 ? "warning" : "normal";
        insights.push({
          title: `Weight – ${batch.batchId}`,
          detail: `Average weight ${avgW.toFixed(2)} kg at day ${age} (benchmark ~${expected.toFixed(2)} kg).`,
          severity: sev,
          batchLabel: batch.batchId,
        });
      }
    }
  }

  if (!insights.length) {
    insights.push({
      title: "No critical issues detected",
      detail: "Ask about temperature, FCR, mortality, weight, or ammonia for detailed analysis of your current data.",
      severity: "normal",
    });
  }

  if (!actions.length) {
    actions.push("Continue routine monitoring. Log growth, feed, and mortality data daily for best AI accuracy.");
  }

  const references = getKnowledgeReferences(question);
  const topSeverity = insights.reduce<AssistantSeverity>(
    (top, i) => (severityRank[i.severity] > severityRank[top] ? i.severity : top),
    "normal"
  );

  const summary =
    topSeverity === "danger"
      ? "Critical issue detected. Immediate corrective action is recommended."
      : topSeverity === "warning"
        ? "Performance risk identified. Prompt adjustments recommended."
        : "Current indicators are within acceptable operating range.";

  return { summary, insights, actions, references };
};
