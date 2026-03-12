import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-xl border border-border/80 bg-card/90 px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] outline-none transition placeholder:text-muted-foreground/90 focus:border-primary/45 focus:ring-2 focus:ring-primary/20",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
