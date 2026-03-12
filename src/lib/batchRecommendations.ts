import type { Batch } from "@/types";
import { getBatchAgeInDays } from "@/lib/calculations";
import { clamp, toFixedNumber } from "@/lib/utils";

type RecommendationStage = "pre-starter" | "starter" | "grower" | "finisher";
type HealthActionStatus = "completed" | "due_now" | "upcoming";

interface CurvePoint {
  day: number;
  value: number;
}

interface HealthTemplate {
  id: string;
  title: string;
  dayStart: number;
  dayEnd: number;
  details: string[];
}

export interface BatchHealthAction {
  id: string;
  title: string;
  dayStart: number;
  dayEnd: number;
  details: string[];
  status: HealthActionStatus;
  daysUntil: number;
}

export interface BatchDailyRecommendation {
  ageDays: number;
  birdsAlive: number;
  stage: RecommendationStage;
  stageLabel: string;
  feedTypeRecommendation: "starter" | "grower" | "finisher";
  feedPerBirdGrams: number;
  waterPerBirdMl: number;
  dailyFeedKg: number;
  weeklyFeedKg: number;
  toMarketFeedKg: number;
  dailyWaterLiters: number;
  weeklyWaterLiters: number;
  toMarketWaterLiters: number;
  temperatureMinC: number;
  temperatureMaxC: number;
  humidityMin: number;
  humidityMax: number;
  lightHours: number;
  lightsOn: string;
  lightsOff: string;
  feedingsPerDay: number;
  feedingTimes: string[];
  waterChecksPerDay: number;
  waterCheckTimes: string[];
  waterLineFlushTimes: string[];
  remainingDaysToMarket: number;
  remainingDaysTo42: number;
  toDay42FeedKg: number;
  toDay42WaterLiters: number;
  feederCount: number;
  bellDrinkerCount: number;
  nippleCount: number;
  brooderCount: number;
  managementChecklist: string[];
  healthActions: BatchHealthAction[];
}

export interface ProjectedResourceTotals {
  feedKg: number;
  waterLiters: number;
}

export const STANDARD_GROWOUT_DAY = 42;

const FEED_CURVE_G_PER_BIRD: CurvePoint[] = [
  { day: 0, value: 14 },
  { day: 7, value: 32 },
  { day: 14, value: 55 },
  { day: 21, value: 82 },
  { day: 28, value: 110 },
  { day: 35, value: 135 },
  { day: 42, value: 155 }
];

const WATER_CURVE_ML_PER_BIRD: CurvePoint[] = [
  { day: 0, value: 35 },
  { day: 7, value: 70 },
  { day: 14, value: 120 },
  { day: 21, value: 170 },
  { day: 28, value: 220 },
  { day: 35, value: 270 },
  { day: 42, value: 320 }
];

const TEMPERATURE_CURVE_C: CurvePoint[] = [
  { day: 0, value: 33 },
  { day: 7, value: 31 },
  { day: 14, value: 29 },
  { day: 21, value: 27 },
  { day: 28, value: 24 },
  { day: 35, value: 22 },
  { day: 42, value: 21 }
];

const HEALTH_TEMPLATES: HealthTemplate[] = [
  {
    id: "arrival-support",
    title: "Arrival support pack",
    dayStart: 1,
    dayEnd: 3,
    details: [
      "Electrolytes + glucose in drinking water for first 6-8 hours after placement.",
      "Use vitamin AD3E or multivitamin support for 2-3 days."
    ]
  },
  {
    id: "nd-ib-first",
    title: "Newcastle + IB first dose",
    dayStart: 5,
    dayEnd: 7,
    details: [
      "Egypt market examples: Nobilis Ma5 + Clone 30 (MSD Egypt) or Nobilis ND Clone 30 (MSD Egypt).",
      "Administration: coarse spray, oculo-nasal drop, or drinking water as directed by your veterinarian.",
      "If given in drinking water, stop chlorine/disinfectants in lines 12 hours before dosing and ensure full uptake within 2 hours."
    ]
  },
  {
    id: "gumboro-first",
    title: "Gumboro (IBD) first dose",
    dayStart: 10,
    dayEnd: 12,
    details: [
      "Egypt market examples: Nobilis Gumboro 228E (MSD Egypt) or CEVAC IBD L (Ceva Egypt).",
      "Administration is usually via drinking water; keep cold chain and prepare only immediate-use volume.",
      "Follow flock MDA profile and veterinarian timing guidance for first application."
    ]
  },
  {
    id: "gumboro-booster",
    title: "Gumboro booster",
    dayStart: 16,
    dayEnd: 18,
    details: [
      "Use the same vaccine family approved by your veterinarian for the first IBD dose.",
      "Provide uniform access to vaccine water and avoid interruptions until all medicated water is consumed.",
      "Booster timing depends on maternal antibody profile and local challenge pressure."
    ]
  },
  {
    id: "newcastle-booster",
    title: "Newcastle (LaSota) booster",
    dayStart: 21,
    dayEnd: 24,
    details: [
      "Egypt market examples: Nobilis ND Clone 30 (MSD Egypt); in some programs ND can be combined with IB products under vet direction.",
      "Administration: spray, oculo-nasal, or drinking water according to product leaflet and veterinarian protocol.",
      "Record post-vaccination reaction, water intake, and flock uniformity in the daily sheet."
    ]
  },
  {
    id: "coccidiosis-program",
    title: "Coccidiosis prevention program",
    dayStart: 1,
    dayEnd: 28,
    details: [
      "Egypt market example: IMMUCOX 1 (Ceva Egypt) live oral oocyst vaccine, typically applied early in life/hatchery program.",
      "Use either vaccine or coccidiostat strategy as planned by your veterinarian; avoid incompatible overlaps.",
      "Rotate coccidiostat families between cycles when non-vaccine programs are used to reduce resistance pressure."
    ]
  }
];

const interpolateCurve = (curve: CurvePoint[], day: number): number => {
  if (curve.length === 0) {
    return 0;
  }

  if (day <= curve[0].day) {
    return curve[0].value;
  }

  for (let i = 1; i < curve.length; i += 1) {
    if (day <= curve[i].day) {
      const previous = curve[i - 1];
      const next = curve[i];
      const distance = next.day - previous.day;
      if (distance <= 0) {
        return next.value;
      }

      const ratio = (day - previous.day) / distance;
      return previous.value + (next.value - previous.value) * ratio;
    }
  }

  return curve[curve.length - 1].value;
};

const resolveStage = (ageDays: number): RecommendationStage => {
  if (ageDays <= 4) {
    return "pre-starter";
  }
  if (ageDays <= 10) {
    return "starter";
  }
  if (ageDays <= 24) {
    return "grower";
  }
  return "finisher";
};

const resolveFeedType = (ageDays: number): "starter" | "grower" | "finisher" => {
  if (ageDays <= 10) {
    return "starter";
  }
  if (ageDays <= 24) {
    return "grower";
  }
  return "finisher";
};

const resolveLightHours = (ageDays: number): number => {
  if (ageDays <= 3) {
    return 23;
  }
  if (ageDays <= 7) {
    return 20;
  }
  if (ageDays <= 14) {
    return 18;
  }
  if (ageDays <= 21) {
    return 16;
  }
  return 14;
};

const formatClockHour = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

const resolveLightingWindow = (lightHours: number, lightsOnHour = 5): { lightsOn: string; lightsOff: string } => {
  const safeHours = clamp(Math.round(lightHours), 0, 24);
  const safeOnHour = ((lightsOnHour % 24) + 24) % 24;
  const offHour = (safeOnHour + safeHours) % 24;
  return {
    lightsOn: formatClockHour(safeOnHour),
    lightsOff: formatClockHour(offHour)
  };
};

const resolveHumidityRange = (ageDays: number): { humidityMin: number; humidityMax: number } => {
  if (ageDays <= 14) {
    return { humidityMin: 55, humidityMax: 70 };
  }
  if (ageDays <= 28) {
    return { humidityMin: 50, humidityMax: 65 };
  }
  return { humidityMin: 50, humidityMax: 60 };
};

const parseClock = (value: string): number => {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const safeHour = Number.isFinite(hour) ? hour : 0;
  const safeMinute = Number.isFinite(minute) ? minute : 0;
  return safeHour + safeMinute / 60;
};

const formatTime = (value: number): string => {
  const normalized = ((value % 24) + 24) % 24;
  let hour = Math.floor(normalized);
  let minute = Math.round((normalized - hour) * 60);
  if (minute >= 60) {
    minute = 0;
    hour = (hour + 1) % 24;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const buildEvenlySpacedTimes = (startHour: number, durationHours: number, slots: number): string[] => {
  if (slots <= 0) {
    return [];
  }
  if (slots === 1) {
    return [formatTime(startHour)];
  }

  const safeDuration = Math.max(durationHours, 1);
  const step = safeDuration / (slots - 1);
  const rows: string[] = [];
  for (let i = 0; i < slots; i += 1) {
    rows.push(formatTime(startHour + step * i));
  }
  return rows;
};

const resolveDailySchedule = (
  ageDays: number,
  lightsOn: string,
  lightHours: number
): {
  feedingsPerDay: number;
  feedingTimes: string[];
  waterChecksPerDay: number;
  waterCheckTimes: string[];
  waterLineFlushTimes: string[];
} => {
  const feedingsPerDay = ageDays <= 7 ? 6 : ageDays <= 14 ? 5 : 4;
  const waterChecksPerDay = ageDays <= 7 ? 8 : ageDays <= 14 ? 7 : ageDays <= 24 ? 6 : 5;
  const flushCount = ageDays <= 10 ? 3 : 2;

  const startHour = parseClock(lightsOn);
  const feedingTimes = buildEvenlySpacedTimes(startHour, lightHours, feedingsPerDay);
  const waterCheckTimes = buildEvenlySpacedTimes(startHour, lightHours, waterChecksPerDay);
  const flushStart = startHour + 1;
  const flushDuration = Math.max(lightHours - 2, 1);
  const waterLineFlushTimes = buildEvenlySpacedTimes(flushStart, flushDuration, flushCount);

  return {
    feedingsPerDay,
    feedingTimes,
    waterChecksPerDay,
    waterCheckTimes,
    waterLineFlushTimes
  };
};

const resolveManagementChecklist = (ageDays: number): string[] => {
  const common = [
    "Record feed intake, water intake, mortality, and house temperature every day.",
    "Keep litter dry and friable; remove wet caking immediately around drinkers.",
    "Adjust feeder and drinker height daily to bird back height."
  ];

  if (ageDays <= 10) {
    return [
      "Check crop fill at 2, 8, and 24 hours after placement to confirm chick start quality.",
      "Maintain uniform brooding ring temperature and avoid floor drafts.",
      "Use fresh starter feed on paper trays multiple times daily.",
      ...common
    ];
  }

  if (ageDays <= 24) {
    return [
      "Increase ventilation gradually to keep ammonia low and oxygen high.",
      "Transition feed phase only when bodyweight and flock uniformity are on target.",
      "Sample body weight at least twice weekly for feed program correction.",
      ...common
    ];
  }

  return [
    "Prioritize heat-stress prevention with airflow, cool water, and midday monitoring.",
    "Keep finisher feed available evenly to reduce weight variation before sale.",
    "Plan catch and transport logistics at least 3-4 days before market date.",
    ...common
  ];
};

const resolveHealthActions = (ageDays: number): BatchHealthAction[] =>
  HEALTH_TEMPLATES.map((template) => {
    let status: HealthActionStatus = "upcoming";
    if (ageDays > template.dayEnd) {
      status = "completed";
    } else if (ageDays >= template.dayStart) {
      status = "due_now";
    }

    return {
      ...template,
      status,
      daysUntil: Math.max(template.dayStart - ageDays, 0)
    };
  }).sort((a, b) => {
    const weight = (status: HealthActionStatus): number =>
      status === "due_now" ? 0 : status === "upcoming" ? 1 : 2;
    return weight(a.status) - weight(b.status) || a.dayStart - b.dayStart;
  });

const resolveRemainingDays = (expectedSellingDate: string): number => {
  if (!expectedSellingDate) {
    return 0;
  }

  const target = new Date(expectedSellingDate);
  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.max(Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 0);
};

export const projectBatchResourceRange = (
  birdsAlive: number,
  startAgeDays: number,
  endAgeDays: number
): ProjectedResourceTotals => {
  const safeBirds = Math.max(birdsAlive, 0);
  const startAge = Math.max(Math.floor(startAgeDays), 0);
  const endAge = Math.max(Math.floor(endAgeDays), startAge);
  const horizon = clamp(endAge - startAge, 0, 90);
  let feedKg = 0;
  let waterLiters = 0;

  for (let dayOffset = 0; dayOffset <= horizon; dayOffset += 1) {
    const age = startAge + dayOffset;
    const feedPerBird = interpolateCurve(FEED_CURVE_G_PER_BIRD, age);
    const waterPerBird = Math.max(interpolateCurve(WATER_CURVE_ML_PER_BIRD, age), feedPerBird * 1.8);
    feedKg += (feedPerBird * safeBirds) / 1000;
    waterLiters += (waterPerBird * safeBirds) / 1000;
  }

  return {
    feedKg: toFixedNumber(feedKg, 1),
    waterLiters: toFixedNumber(waterLiters, 1)
  };
};

const projectResourceToMarket = (birdsAlive: number, currentAgeDays: number, remainingDays: number) => {
  const targetAge = currentAgeDays + clamp(remainingDays, 0, 90);
  return projectBatchResourceRange(birdsAlive, currentAgeDays, targetAge);
};

export const getBatchDailyRecommendation = (
  batch: Pick<Batch, "arrivalDate" | "chickAgeAtArrivalDays" | "currentAliveCount" | "expectedSellingDate">
): BatchDailyRecommendation => {
  const ageDays = getBatchAgeInDays(batch.arrivalDate, batch.chickAgeAtArrivalDays ?? 0);
  const birdsAlive = Math.max(batch.currentAliveCount ?? 0, 0);
  const stage = resolveStage(ageDays);
  const stageLabel =
    stage === "pre-starter" ? "Pre-starter (Day 0-4)" : stage === "starter" ? "Starter (Day 5-10)" : stage === "grower" ? "Grower (Day 11-24)" : "Finisher (Day 25+)";

  const feedPerBirdGrams = toFixedNumber(interpolateCurve(FEED_CURVE_G_PER_BIRD, ageDays), 1);
  const waterPerBirdMl = Math.round(
    Math.max(interpolateCurve(WATER_CURVE_ML_PER_BIRD, ageDays), feedPerBirdGrams * 1.8)
  );

  const dailyFeedKg = toFixedNumber((feedPerBirdGrams * birdsAlive) / 1000, 1);
  const weeklyFeedKg = toFixedNumber(dailyFeedKg * 7, 1);
  const dailyWaterLiters = toFixedNumber((waterPerBirdMl * birdsAlive) / 1000, 1);
  const weeklyWaterLiters = toFixedNumber(dailyWaterLiters * 7, 1);

  const temperatureCenter = interpolateCurve(TEMPERATURE_CURVE_C, ageDays);
  const temperatureMinC = toFixedNumber(Math.max(temperatureCenter - 1, 20), 1);
  const temperatureMaxC = toFixedNumber(Math.min(temperatureCenter + 1, 34), 1);
  const { humidityMin, humidityMax } = resolveHumidityRange(ageDays);

  const lightHours = resolveLightHours(ageDays);
  const { lightsOn, lightsOff } = resolveLightingWindow(lightHours, 5);
  const schedule = resolveDailySchedule(ageDays, lightsOn, lightHours);

  const remainingDaysToMarket = resolveRemainingDays(batch.expectedSellingDate);
  const projected = projectResourceToMarket(birdsAlive, ageDays, remainingDaysToMarket);
  const remainingDaysTo42 = Math.max(STANDARD_GROWOUT_DAY - ageDays, 0);
  const projectedToDay42 = projectBatchResourceRange(birdsAlive, ageDays, STANDARD_GROWOUT_DAY);

  const feederCount = Math.ceil(birdsAlive / (ageDays <= 10 ? 50 : 65));
  const bellDrinkerCount = Math.ceil(birdsAlive / 80);
  const nippleCount = Math.ceil(birdsAlive / 12);
  const brooderCount = ageDays <= 14 ? Math.ceil(birdsAlive / 1000) : 0;

  return {
    ageDays,
    birdsAlive,
    stage,
    stageLabel,
    feedTypeRecommendation: resolveFeedType(ageDays),
    feedPerBirdGrams,
    waterPerBirdMl,
    dailyFeedKg,
    weeklyFeedKg,
    toMarketFeedKg: projected.feedKg,
    dailyWaterLiters,
    weeklyWaterLiters,
    toMarketWaterLiters: projected.waterLiters,
    temperatureMinC,
    temperatureMaxC,
    humidityMin,
    humidityMax,
    lightHours,
    lightsOn,
    lightsOff,
    feedingsPerDay: schedule.feedingsPerDay,
    feedingTimes: schedule.feedingTimes,
    waterChecksPerDay: schedule.waterChecksPerDay,
    waterCheckTimes: schedule.waterCheckTimes,
    waterLineFlushTimes: schedule.waterLineFlushTimes,
    remainingDaysToMarket,
    remainingDaysTo42,
    toDay42FeedKg: projectedToDay42.feedKg,
    toDay42WaterLiters: projectedToDay42.waterLiters,
    feederCount,
    bellDrinkerCount,
    nippleCount,
    brooderCount,
    managementChecklist: resolveManagementChecklist(ageDays),
    healthActions: resolveHealthActions(ageDays)
  };
};
