import { useMemo, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Info, Sparkles, TrendingUp, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { compareDateTimeDesc, formatNumber } from "@/lib/utils";
import { createId } from "@/lib/id";
import {
  generateFarmAssistantResponse,
  generateProactiveFarmInsights,
  type AssistantInsight,
  type AssistantResponse,
  type ProactiveFarmInsights,
} from "@/services/aiAssistantService";
import type { Batch, EnvironmentReading, FeedRecord, GrowthRecord, MortalityRecord } from "@/types";

interface ChatTurn {
  id: string;
  question: string;
  response: AssistantResponse;
  createdAt: string;
}

const QUICK_PROMPTS = [
  "Why are birds panting?",
  "My FCR is high, how to improve it?",
  "What's causing high mortality?",
  "What should day-5 chick temperature be?",
];

const SEVERITY_CONFIG = {
  danger: { icon: AlertTriangle, badge: "danger" as const, bg: "insight-card insight-card-danger", label: "Critical" },
  warning: { icon: AlertTriangle, badge: "warning" as const, bg: "insight-card insight-card-warning", label: "Warning" },
  normal: { icon: CheckCircle2, badge: "success" as const, bg: "insight-card insight-card-normal", label: "Normal" },
};

/* ─── Health Score Ring ──────────────────────────────────────────────────── */
const HealthScoreRing = ({ score, label }: { score: number; label: string }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? "#22c55e" : score >= 65 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle className="health-ring-track" cx="55" cy="55" r={radius} />
        <circle
          className="health-ring-progress"
          cx="55" cy="55" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <text x="55" y="51" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">{score}</text>
        <text x="55" y="66" textAnchor="middle" fontSize="10" fill="#94a3b8">/ 100</text>
      </svg>
      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: `${color}22`, color }}>
        {label}
      </span>
    </div>
  );
};

/* ─── Insight Card ───────────────────────────────────────────────────────── */
const InsightCard = ({ insight }: { insight: AssistantInsight }) => {
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;
  return (
    <div className={cfg.bg}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Icon size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{insight.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{insight.detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={cfg.badge} className="text-[10px]">{cfg.label}</Badge>
          {insight.metric && (
            <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
              {insight.actual} vs {insight.target}{insight.unit ? ` ${insight.unit}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Proactive Panel ────────────────────────────────────────────────────── */
const ProactivePanel = ({ data }: { data: ProactiveFarmInsights }) => (
  <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
    <Card className="flex flex-col items-center justify-center gap-3 py-6">
      <p className="text-xs font-semibold text-muted-foreground">Farm Health Score</p>
      <HealthScoreRing score={data.healthScore} label={data.healthLabel} />
      <div className="grid w-full grid-cols-2 gap-2 px-4 text-center text-xs">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="font-bold">{data.activeBatches}</p>
          <p className="text-muted-foreground">Batches</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="font-bold">{formatNumber(data.totalBirds)}</p>
          <p className="text-muted-foreground">Birds</p>
        </div>
      </div>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap size={15} className="text-accent" />
          Proactive Insights
        </CardTitle>
        <CardDescription>Auto-generated from live data — updated every time you open this page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {data.insights.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/6 p-4 text-sm font-medium text-success">
            <CheckCircle2 size={16} />
            All monitored indicators are within normal range.
          </div>
        ) : (
          data.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)
        )}

        {data.actions.length > 0 && (
          <div className="mt-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp size={11} /> Recommended Actions
            </p>
            <ul className="space-y-1.5">
              {data.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);

/* ─── Chat Turn Card ─────────────────────────────────────────────────────── */
const ChatTurnCard = ({ turn }: { turn: ChatTurn }) => (
  <Card className="animate-fade-up">
    <CardHeader className="pb-2">
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="text-sm font-semibold">{turn.question}</CardTitle>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {new Date(turn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <CardDescription className="text-xs">{turn.response.summary}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="space-y-2">
        {turn.response.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <TrendingUp size={11} /> Actions
        </p>
        <ul className="space-y-1">
          {turn.response.actions.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {a}
            </li>
          ))}
        </ul>
      </div>

      {turn.response.references.length > 0 && (
        <div className="rounded-xl border border-info/20 bg-info/6 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-info">
            <Info size={11} /> Knowledge References
          </p>
          <ul className="space-y-0.5">
            {turn.response.references.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {r}</li>
            ))}
          </ul>
        </div>
      )}
    </CardContent>
  </Card>
);

/* ─── Page ───────────────────────────────────────────────────────────────── */
export const AIAssistantPage = () => {
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: readings } = useRealtimeCollection<EnvironmentReading>(COLLECTIONS.environmentReadings);
  const { data: mortality } = useRealtimeCollection<MortalityRecord>(COLLECTIONS.mortalityRecords);
  const { data: feed } = useRealtimeCollection<FeedRecord>(COLLECTIONS.feedRecords);
  const { data: growth } = useRealtimeCollection<GrowthRecord>(COLLECTIONS.growthRecords);

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);

  const latestReading = useMemo(
    () => [...readings].sort((a, b) => compareDateTimeDesc(a.recordedAt, b.recordedAt))[0],
    [readings]
  );

  const proactiveData = useMemo(
    () => generateProactiveFarmInsights({ batches, readings, mortality, feed, growth }),
    [batches, readings, mortality, feed, growth]
  );

  const askAssistant = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const response = generateFarmAssistantResponse({ question: trimmed, batches, readings, mortality, feed, growth });
    setHistory((prev) => [{ id: createId(), question: trimmed, response, createdAt: new Date().toISOString() }, ...prev]);
    setQuestion("");
  };

  const activeBirds = batches.filter((b) => b.status === "active").reduce((s, b) => s + b.currentAliveCount, 0);

  return (
    <section className="page-section">
      <PageHeader
        title="AI Farm Assistant"
        description="Proactive health insights from your live data, plus ask any question about your farm."
        actions={<Badge variant="default" className="gap-1"><Sparkles size={11} />Smart Analysis</Badge>}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Active Batches", value: batches.filter((b) => b.status === "active").length },
          { label: "Live Birds", value: formatNumber(activeBirds) },
          { label: "Temperature", value: latestReading ? `${latestReading.temperatureC.toFixed(1)}°C` : "—" },
          { label: "Ammonia", value: latestReading ? `${latestReading.ammoniaPpm.toFixed(1)} ppm` : "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proactive insights */}
      <ProactivePanel data={proactiveData} />

      {/* Ask */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain size={15} /> Ask the Assistant
          </CardTitle>
          <CardDescription>
            Ask about FCR, temperature, mortality, feed stages, disease symptoms, or any farm topic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAssistant(question); } }}
            placeholder="e.g. Why is Batch B-2024-03 FCR above 2.0?"
            className="min-h-[96px] resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <Button key={p} variant="outline" size="sm" className="text-xs" onClick={() => askAssistant(p)}>
                {p}
              </Button>
            ))}
          </div>
          <Button onClick={() => askAssistant(question)} className="gap-1.5">
            <Sparkles size={13} /> Generate Recommendation
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent Questions</p>
          {history.map((t) => <ChatTurnCard key={t.id} turn={t} />)}
        </div>
      )}
    </section>
  );
};
