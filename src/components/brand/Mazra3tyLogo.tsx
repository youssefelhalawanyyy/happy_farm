import { cn } from "@/lib/utils";

type Variant = "primary" | "horizontal" | "icon";

interface Mazra3tyLogoProps {
  variant?: Variant;
  className?: string;
}

const BRAND_LOGO_SRC = "/mazra3ty-logo.png";
const BRAND_ICON_SRC = "/mazra3ty-logo.png";

export const Mazra3tyLogo = ({ variant = "horizontal", className }: Mazra3tyLogoProps) => {
  if (variant === "icon") {
    return (
      <img
        src={BRAND_ICON_SRC}
        alt="Mazra3ty"
        className={cn("h-9 w-9 rounded-lg object-cover", className)}
      />
    );
  }

  if (variant === "horizontal") {
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        <img src={BRAND_LOGO_SRC} alt="Mazra3ty logo" className="h-10 w-10 rounded-lg object-cover shadow-sm" />
        <div>
          <p className="text-lg font-bold tracking-tight">Mazra3ty</p>
          <p className="text-[11px] leading-tight text-muted-foreground">Smart Farms Start Here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <img src={BRAND_LOGO_SRC} alt="Mazra3ty logo" className="h-12 w-12 rounded-xl object-cover shadow-sm" />
      <div>
        <p className="text-2xl font-bold tracking-tight">MAZRA3TY</p>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Smart Farms Start Here</p>
      </div>
    </div>
  );
};
