import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronRight, Factory, ShieldCheck, Wheat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

interface Step {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
  href: string;
}

const SETUP_STEPS: Step[] = [
  {
    id: "batch",
    icon: Factory,
    title: "Create your first batch",
    description: "Add a poultry batch with arrival date, bird count, breed and assigned house.",
    action: "Add Batch",
    href: "/batches",
  },
  {
    id: "feed",
    icon: Wheat,
    title: "Log your first feed record",
    description: "Record daily feed consumption to enable FCR tracking and cost analysis.",
    action: "Log Feed",
    href: "/feed",
  },
  {
    id: "vax",
    icon: ShieldCheck,
    title: "Generate a vaccination schedule",
    description: "Auto-generate the standard broiler vaccination program for your batch.",
    action: "Set Up Vaccinations",
    href: "/vaccinations",
  },
];

export const OnboardingBanner = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="animate-fade-up relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 via-card to-accent/6 p-6">
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground/60 transition hover:bg-muted hover:text-muted-foreground"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐣</span>
          <div>
            <h2 className="text-base font-bold">
              Welcome to Mazra3ty{profile?.displayName ? `, ${profile.displayName.split(" ")[0]}` : ""}!
            </h2>
            <p className="text-sm text-muted-foreground">
              Complete these steps to get your farm dashboard fully running.
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-3 sm:grid-cols-3">
        {SETUP_STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className="onboarding-step onboarding-step-pending group cursor-pointer"
              onClick={() => navigate(step.href)}
            >
              {/* Step number */}
              <div className="onboarding-number onboarding-number-pending text-muted-foreground">{idx + 1}</div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className="shrink-0 text-primary" />
                  <p className="text-sm font-semibold">{step.title}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                <button className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary transition group-hover:gap-1.5">
                  {step.action} <ArrowRight size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="mt-5 flex items-center gap-3">
        <Button size="sm" className="gap-1.5" onClick={() => navigate("/batches")}>
          <Factory size={13} />
          Create First Batch
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDismissed(true)}>
          I'll do this later
        </Button>
      </div>
    </div>
  );
};
