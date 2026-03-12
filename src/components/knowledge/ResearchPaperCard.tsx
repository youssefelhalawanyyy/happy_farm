import { FileText, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ResearchPaper } from "@/data/poultryKnowledgeData";

interface ResearchPaperCardProps {
  paper: ResearchPaper;
}

export const ResearchPaperCard = ({ paper }: ResearchPaperCardProps) => (
  <Card className="h-full border-border/90 bg-card shadow-sm">
    <CardHeader className="pb-3">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
        <FileText size={15} />
      </div>
      <CardTitle className="text-base leading-tight">{paper.title}</CardTitle>
      <CardDescription>{paper.description}</CardDescription>
    </CardHeader>
    <CardContent>
      <a href={paper.pdfLink} target="_blank" rel="noreferrer">
        <Button variant="outline" className="w-full">
          Open PDF
          <ExternalLink size={14} className="ml-2" />
        </Button>
      </a>
    </CardContent>
  </Card>
);
