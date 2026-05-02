import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "demo_mode_enabled";
const SEED_KEY = "demo_mode_seed";

interface DemoContextValue {
  demo: boolean;
  seed: number;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  reseed: () => void;
}

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "1";
  });
  const [seed, setSeed] = useState<number>(() => {
    if (typeof window === "undefined") return 42;
    const s = localStorage.getItem(SEED_KEY);
    return s ? Number(s) : 42;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (demo) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  }, [demo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SEED_KEY, String(seed));
  }, [seed]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setDemo(e.newValue === "1");
      if (e.key === SEED_KEY && e.newValue) setSeed(Number(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <DemoContext.Provider
      value={{
        demo,
        seed,
        enable: () => setDemo(true),
        disable: () => setDemo(false),
        toggle: () => setDemo((v) => !v),
        reseed: () => setSeed(Math.floor(Math.random() * 1_000_000)),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
