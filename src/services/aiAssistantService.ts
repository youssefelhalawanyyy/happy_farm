import { poultryKnowledgeData } from "@/data/poultryKnowledgeData";
import { calculateFCR, getBatchFeedKg, getLatestAverageWeight } from "@/lib/calculations";
import { SAFE_THRESHOLDS } from "@/lib/constants";
import type { Batch, EnvironmentReading, FeedRecord, GrowthRecord, MortalityRecord } from "@/types";

export type AssistantSeverity = "normal" | "warning" | "danger";

export interface AssistantInsight {
  title: string;
  detail: string;
  severity: AssistantSeverity;
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

const normalize = (value: string): string => value.trim().toLowerCase();

const hasQueryToken = (text: string, tokens: string[]): boolean => tokens.some((token) => text.includes(token));

const latestEnvironment = (rows: EnvironmentReading[]): EnvironmentReading | null =>
  [...rows].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null;

const averageFcr = (batches: Batch[], feed: FeedRecord[], growth: GrowthRecord[]): number => {
  const active = batches.filter((batch) => batch.status === "active");
  if (active.length === 0) {
    return 0;
  }

  const values = active
    .map((batch) => {
      const feedKg = getBatchFeedKg(batch.id ?? "", feed);
      const avgWeight = getLatestAverageWeight(batch.id ?? "", growth) || batch.targetSellingWeight;
      return calculateFCR(feedKg, batch.currentAliveCount, avgWeight);
    })
    .filter((value) => value > 0);

  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const todayMortality = (rows: MortalityRecord[]): number => {
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((row) => row.recordDate === today).reduce((sum, row) => sum + row.birds, 0);
};

const getKnowledgeReferences = (question: string): string[] => {
  const tokens = normalize(question)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  if (tokens.length === 0) {
    return [];
  }

  const matches: string[] = [];
  poultryKnowledgeData.forEach((section) => {
    section.topics.forEach((topic) => {
      const haystack = `${topic.title} ${topic.content}`.toLowerCase();
      if (tokens.some((token) => haystack.includes(token))) {
        matches.push(`${section.category}: ${topic.title}`);
      }
    });
  });

  return matches.slice(0, 4);
};

const severityRank: Record<AssistantSeverity, number> = {
  normal: 0,
  warning: 1,
  danger: 2
};

export const generateFarmAssistantResponse = ({
  question,
  batches,
  readings,
  mortality,
  feed,
  growth
}: AssistantInput): AssistantResponse => {
  const query = normalize(question);
  const latest = latestEnvironment(readings);
  const avgFcr = averageFcr(batches, feed, growth);
  const mortalityCountToday = todayMortality(mortality);
  const totalBirds = batches
    .filter((batch) => batch.status === "active")
    .reduce((sum, batch) => sum + batch.currentAliveCount, 0);
  const mortalityRateToday = totalBirds > 0 ? (mortalityCountToday / totalBirds) * 100 : 0;

  const wantsTemperature = hasQueryToken(query, ["temperature", "heat", "hot", "cold", "panting"]);
  const wantsMortality = hasQueryToken(query, ["mortality", "dying", "dead", "death", "chicks dying"]);
  const wantsFcr = hasQueryToken(query, ["fcr", "feed conversion", "feed intake", "feed cost"]);
  const wantsAmmonia = hasQueryToken(query, ["ammonia", "air", "smell", "ventilation"]);

  const insights: AssistantInsight[] = [];
  const actions: string[] = [];

  if (latest) {
    if (latest.temperatureC > SAFE_THRESHOLDS.temperatureHigh) {
      insights.push({
        title: "Heat stress risk",
        detail: `Current temperature is ${latest.temperatureC.toFixed(1)}°C, above safe max ${SAFE_THRESHOLDS.temperatureHigh}°C.`,
        severity: "danger"
      });
      actions.push("Increase ventilation and activate cooling immediately in affected houses.");
    } else if (latest.temperatureC < SAFE_THRESHOLDS.temperatureLow) {
      insights.push({
        title: "Low temperature risk",
        detail: `Current temperature is ${latest.temperatureC.toFixed(1)}°C, below safe min ${SAFE_THRESHOLDS.temperatureLow}°C.`,
        severity: "warning"
      });
      actions.push("Check brooding heaters and reduce drafts until temperature returns to safe range.");
    } else if (wantsTemperature) {
      insights.push({
        title: "Temperature in safe range",
        detail: `Latest reading is ${latest.temperatureC.toFixed(1)}°C, within ${SAFE_THRESHOLDS.temperatureLow}-${SAFE_THRESHOLDS.temperatureHigh}°C.`,
        severity: "normal"
      });
    }

    if (latest.ammoniaPpm > SAFE_THRESHOLDS.ammoniaHigh) {
      insights.push({
        title: "Ammonia elevation",
        detail: `Ammonia is ${latest.ammoniaPpm.toFixed(1)} ppm, above recommended ${SAFE_THRESHOLDS.ammoniaHigh} ppm.`,
        severity: "warning"
      });
      actions.push("Replace wet litter, increase fresh-air exchange, and inspect ventilation units.");
    } else if (wantsAmmonia) {
      insights.push({
        title: "Air quality check",
        detail: `Ammonia is ${latest.ammoniaPpm.toFixed(1)} ppm and humidity is ${latest.humidity.toFixed(1)}%.`,
        severity: "normal"
      });
    }
  }

  if (mortalityRateToday > SAFE_THRESHOLDS.mortalityPercentDaily) {
    insights.push({
      title: "Mortality spike",
      detail: `Today's mortality is ${mortalityCountToday} birds (${mortalityRateToday.toFixed(2)}%), above ${SAFE_THRESHOLDS.mortalityPercentDaily}%.`,
      severity: "danger"
    });
    actions.push("Audit feed/water availability, isolate weak birds, and review vaccination/medication logs.");
  } else if (wantsMortality) {
    insights.push({
      title: "Mortality status",
      detail: `Today's mortality is ${mortalityCountToday} birds (${mortalityRateToday.toFixed(2)}%).`,
      severity: "normal"
    });
  }

  if (avgFcr > 1.95) {
    insights.push({
      title: "High FCR detected",
      detail: `Average active-batch FCR is ${avgFcr.toFixed(2)} (target usually <= 1.90).`,
      severity: "warning"
    });
    actions.push("Review feed stage transitions, weigh samples weekly, and check temperature consistency.");
  } else if (wantsFcr && avgFcr > 0) {
    insights.push({
      title: "FCR status",
      detail: `Average active-batch FCR is ${avgFcr.toFixed(2)}.`,
      severity: "normal"
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "No critical issue detected from current data",
      detail: "Ask about temperature, mortality, FCR, ventilation, or chick behavior for targeted guidance.",
      severity: "normal"
    });
  }

  if (actions.length === 0) {
    actions.push("Continue routine monitoring and keep logging growth, feed, and mortality data daily.");
  }

  const references = getKnowledgeReferences(question);
  const topSeverity = insights.reduce<AssistantSeverity>((level, insight) => {
    return severityRank[insight.severity] > severityRank[level] ? insight.severity : level;
  }, "normal");

  const summary =
    topSeverity === "danger"
      ? "Potential high-risk issue detected. Immediate corrective action is recommended."
      : topSeverity === "warning"
        ? "Performance risk detected. Prompt adjustments are recommended."
        : "Current indicators are mostly within acceptable operating range.";

  return {
    summary,
    insights,
    actions,
    references
  };
};
