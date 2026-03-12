import { useMemo, useState } from "react";
import { Brain, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { compareDateTimeDesc, formatNumber } from "@/lib/utils";
import { createId } from "@/lib/id";
import { generateFarmAssistantResponse, type AssistantResponse } from "@/services/aiAssistantService";
import type { Batch, EnvironmentReading, FeedRecord, GrowthRecord, MortalityRecord } from "@/types";

interface ChatTurn {
  id: string;
  question: string;
  response: AssistantResponse;
  createdAt: string;
}

const quickPrompts = [
  "Why are birds panting?",
  "My chicks are dying, what should I check first?",
  "What should day 5 chick temperature be?",
  "My FCR is high, how can I improve it?"
];

const severityToBadge: Record<string, "success" | "warning" | "danger" | "muted"> = {
  normal: "success",
  warning: "warning",
  danger: "danger"
};

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
  const activeBirds = useMemo(
    () => batches.filter((batch) => batch.status === "active").reduce((sum, batch) => sum + batch.currentAliveCount, 0),
    [batches]
  );

  const askAssistant = (prompt: string): void => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }

    const response = generateFarmAssistantResponse({
      question: trimmed,
      batches,
      readings,
      mortality,
      feed,
      growth
    });

    setHistory((prev) => [
      {
        id: createId(),
        question: trimmed,
        response,
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);
    setQuestion("");
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="AI Farm Assistant"
        description="Ask farm questions and get data-aware recommendations from your live farm records, sensor telemetry, and poultry knowledge base."
        actions={<Badge variant="default">Beta</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Birds</p>
            <p className="mt-1 text-2xl font-semibold">{formatNumber(activeBirds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Latest Temperature</p>
            <p className="mt-1 text-2xl font-semibold">
              {latestReading ? `${latestReading.temperatureC.toFixed(1)}°C` : "No data"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Latest Ammonia</p>
            <p className="mt-1 text-2xl font-semibold">{latestReading ? `${latestReading.ammoniaPpm.toFixed(1)} ppm` : "No data"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain size={16} />
            Ask Assistant
          </CardTitle>
          <CardDescription>Example: Why are my chicks panting? Why is my FCR high?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Type your farm question..."
            className="min-h-[110px]"
          />
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <Button key={prompt} variant="outline" size="sm" onClick={() => askAssistant(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>
          <Button onClick={() => askAssistant(question)}>
            <Sparkles size={14} className="mr-2" />
            Generate Recommendation
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {history.map((turn) => (
          <Card key={turn.id}>
            <CardHeader>
              <CardTitle className="text-base">{turn.question}</CardTitle>
              <CardDescription>{new Date(turn.createdAt).toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
                <p className="font-medium">Summary</p>
                <p className="mt-1 text-muted-foreground">{turn.response.summary}</p>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Detected Insights</p>
                {turn.response.insights.map((insight, index) => (
                  <div key={`${turn.id}-insight-${index}`} className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{insight.title}</p>
                      <Badge variant={severityToBadge[insight.severity] ?? "muted"}>{insight.severity}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{insight.detail}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="font-medium">Recommended Actions</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {turn.response.actions.map((action, index) => (
                    <li key={`${turn.id}-action-${index}`}>{action}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Knowledge References</p>
                {turn.response.references.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {turn.response.references.map((reference, index) => (
                      <li key={`${turn.id}-ref-${index}`}>{reference}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No direct knowledge article match for this question.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
