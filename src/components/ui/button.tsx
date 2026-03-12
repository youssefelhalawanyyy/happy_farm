import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl border font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "border-primary/55 bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08),0_10px_22px_rgba(31,122,99,0.22)] hover:bg-[#176a56]",
        secondary: "border-border/80 bg-card text-foreground shadow-sm hover:bg-muted/55",
        ghost: "border-transparent bg-transparent text-foreground/85 hover:bg-muted/70 hover:text-foreground",
        destructive: "border-danger/50 bg-danger text-white shadow-sm hover:brightness-95",
        outline: "border-border/80 bg-card/80 text-foreground shadow-sm hover:bg-muted/55"
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-sm",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
));

Button.displayName = "Button";
