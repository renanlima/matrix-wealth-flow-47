import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export interface MoneyInputValue {
  display: string;
  numeric: number;
}

interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (display: string, numeric: number) => void;
  decimals?: number;
}

export function maskUsd(input: string, decimals = 2): MoneyInputValue {
  // Keep only digits and dots
  const cleaned = String(input ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return { display: "", numeric: 0 };

  // Keep only the first dot
  const firstDot = cleaned.indexOf(".");
  const intPart =
    firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  const decPartRaw =
    firstDot === -1 ? "" : cleaned.slice(firstDot + 1).replace(/\./g, "");
  const decPart = decPartRaw.slice(0, decimals);

  // Remove leading zeros but keep one
  const intClean = intPart.replace(/^0+(?=\d)/, "") || "0";
  const intFmt = Number(intClean).toLocaleString("en-US");

  const display =
    firstDot === -1 ? intFmt : `${intFmt}.${decPart}`;
  const numeric = Number(`${intClean}.${decPart || "0"}`);
  return { display, numeric };
}

/**
 * USD-masked input. Displays "$ 1,234.56" while letting the user type freely.
 * Stores the formatted string as `value`; emits both formatted and numeric on change.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, decimals = 2, className, ...props }, ref) => {
    return (
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden
        >
          $
        </span>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const { display, numeric } = maskUsd(e.target.value, decimals);
            onValueChange(display, numeric);
          }}
          className={cn("pl-7 font-mono", className)}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
