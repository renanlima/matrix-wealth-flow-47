import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "USD" | "BRL";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggle: () => void;
  brlRate: number; // USD -> BRL
  rateUpdatedAt: string | null;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const STORAGE_KEY = "mda.currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === "undefined") return "USD";
    return (localStorage.getItem(STORAGE_KEY) as Currency) || "USD";
  });
  const [brlRate, setBrlRate] = useState(5.0);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, c);
  };

  const toggle = () => setCurrency(currency === "USD" ? "BRL" : "USD");

  useEffect(() => {
    let mounted = true;
    supabase
      .from("fx_rates")
      .select("rate, updated_at")
      .eq("pair", "USD/BRL")
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted || !data) return;
        setBrlRate(Number(data.rate));
        setRateUpdatedAt(data.updated_at);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, toggle, brlRate, rateUpdatedAt }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
