import * as React from "react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ClickableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  onActivate: () => void;
}

/**
 * <TableRow> wrapper that becomes a button: full-row click,
 * keyboard activation (Enter/Space), focus ring, and pointer cursor.
 * Inner buttons/links should call e.stopPropagation() to avoid double nav.
 */
export const ClickableRow = React.forwardRef<HTMLTableRowElement, ClickableRowProps>(
  ({ onActivate, className, children, ...props }, ref) => {
    return (
      <TableRow
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        }}
        className={cn(
          "cursor-pointer hover:bg-primary/5 focus-visible:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-primary/40",
          className,
        )}
        {...props}
      >
        {children}
      </TableRow>
    );
  },
);
ClickableRow.displayName = "ClickableRow";
