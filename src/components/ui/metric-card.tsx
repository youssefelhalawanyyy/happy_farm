import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  icon: LucideIcon;
}

export const MetricCard = ({ label, value, change, icon: Icon }: MetricCardProps) => (
  <Card className="animate-fade-up">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
          <Icon size={16} />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold leading-none">{value}</div>
      {change ? <p className="mt-2 text-xs text-muted-foreground">{change}</p> : null}
    </CardContent>
  </Card>
);
