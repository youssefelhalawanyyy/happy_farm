import { useState } from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PoultryKnowledgeCategory } from "@/data/poultryKnowledgeData";
import { TopicCard } from "@/components/knowledge/TopicCard";
import { cn } from "@/lib/utils";

interface CategoryAccordionProps {
  category: PoultryKnowledgeCategory;
  defaultOpen?: boolean;
}

export const CategoryAccordion = ({ category, defaultOpen = false }: CategoryAccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-primary" />
          <h3 className="text-base font-semibold">{category.category}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {category.topics.length} topics
          </span>
        </div>
        <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <CardContent className="grid gap-4 border-t border-border/80 bg-background/40 pt-5 md:grid-cols-2 xl:grid-cols-3">
          {category.topics.map((topic) => (
            <TopicCard key={topic.title} topic={topic} />
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
};
