import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto rounded-2xl border border-border/75 bg-card/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <table className={cn("w-full border-collapse text-sm", className)} {...props} />
  </div>
);

export const TableHead = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead
    className={cn(
      "border-b border-border/70 bg-gradient-to-r from-muted/45 via-muted/30 to-muted/20",
      className
    )}
    {...props}
  />
);

export const TableBody = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("divide-y divide-border/60 [&_tr]:transition-colors [&_tr:hover]:bg-muted/35", className)} {...props} />
);

export const TH = ({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground",
      className
    )}
    {...props}
  />
);

export const TD = ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-3 py-3 align-middle", className)} {...props} />
);
