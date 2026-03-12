import { BookText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PoultryTopic } from "@/data/poultryKnowledgeData";

interface TopicCardProps {
  topic: PoultryTopic;
}

export const TopicCard = ({ topic }: TopicCardProps) => (
  <Card className="h-full border-border/90 bg-card shadow-sm">
    <CardContent className="space-y-2 pt-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <BookText size={12} />
        Topic
      </div>
      <h4 className="text-sm font-semibold text-foreground">{topic.title}</h4>
      <p className="text-sm leading-relaxed text-muted-foreground">{topic.content}</p>
    </CardContent>
  </Card>
);
