import { useMemo, useState } from "react";
import { BookMarked, Filter, Microscope } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/knowledge/SearchBar";
import { CategoryAccordion } from "@/components/knowledge/CategoryAccordion";
import { ResearchPaperCard } from "@/components/knowledge/ResearchPaperCard";
import { poultryKnowledgeData, poultryResearchPapers } from "@/data/poultryKnowledgeData";

const ALL = "All Categories";

export const KnowledgeCenterPage = () => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL);

  const categories = useMemo(() => [ALL, ...poultryKnowledgeData.map((entry) => entry.category)], []);

  const filteredKnowledge = useMemo(() => {
    const query = search.trim().toLowerCase();

    return poultryKnowledgeData
      .filter((entry) => selectedCategory === ALL || entry.category === selectedCategory)
      .map((entry) => {
        if (!query) {
          return entry;
        }

        const topics = entry.topics.filter((topic) => {
          const categoryMatch = entry.category.toLowerCase().includes(query);
          const titleMatch = topic.title.toLowerCase().includes(query);
          const contentMatch = topic.content.toLowerCase().includes(query);
          return categoryMatch || titleMatch || contentMatch;
        });

        return {
          ...entry,
          topics
        };
      })
      .filter((entry) => entry.topics.length > 0);
  }, [search, selectedCategory]);

  const totalTopics = filteredKnowledge.reduce((sum, entry) => sum + entry.topics.length, 0);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Mazra3ty Poultry Knowledge Center"
        description="Learn the best scientific practices for raising broiler chickens."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SearchBar value={search} onChange={setSearch} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <Filter size={12} />
              Topic Filters
            </div>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{filteredKnowledge.length} sections</Badge>
            <Badge variant="muted">{totalTopics} matching topics</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookMarked size={16} className="text-primary" />
          Knowledge Library
        </div>

        {filteredKnowledge.length > 0 ? (
          <div className="space-y-4">
            {filteredKnowledge.map((entry, index) => (
              <CategoryAccordion key={entry.category} category={entry} defaultOpen={index === 0} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No topics matched your search. Try another keyword or filter.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Microscope size={16} className="text-info" />
          Scientific Research
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {poultryResearchPapers.map((paper) => (
            <ResearchPaperCard key={paper.title} paper={paper} />
          ))}
        </div>
      </div>
    </section>
  );
};
