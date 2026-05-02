import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useDemo } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { LogOut, DollarSign, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import matrixLogo from "@/assets/matrix-logo.png";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AppShellProps {
  navItems: NavItem[];
  basePath: string;
  children: React.ReactNode;
  title: string;
}

export function AppShell({ navItems, basePath, children, title }: AppShellProps) {
  const { profile, signOut } = useAuth();
  const { currency, toggle } = useCurrency();
  const { demo, disable: disableDemo } = useDemo();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar">
        <div className="flex flex-col items-center gap-1 px-4 py-4 border-b border-sidebar-border">
          <img
            src={matrixLogo}
            alt="Matrix Digital Assets"
            className="h-12 w-auto object-contain"
          />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to !== basePath && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary glow-cyan"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <div className="px-2 pb-2 text-muted-foreground truncate">
            {profile?.full_name || profile?.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-border/60 bg-background/60 backdrop-blur px-4 md:px-6 py-3">
          <div className="md:hidden flex items-center gap-2">
            <img src={matrixLogo} alt="Matrix Digital Assets" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex-1" />
          {demo && profile?.role === "admin" && (
            <button
              type="button"
              onClick={() => {
                disableDemo();
              }}
              title="Desativar modo demo"
              className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-mono text-warning hover:bg-warning/20 transition-colors animate-pulse"
            >
              <Sparkles className="h-3 w-3" />
              MODO DEMO
            </button>
          )}
          {profile?.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem("admin_onboarding_dismissed");
                window.dispatchEvent(new CustomEvent("reopen-onboarding"));
                if (location.pathname !== "/admin") navigate({ to: "/admin" });
              }}
              aria-label="Abrir guia inicial"
              title="Guia inicial"
              className="gap-1.5"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Guia</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={toggle}
            className="font-mono text-xs gap-1.5 border-primary/30"
          >
            <DollarSign className="h-3.5 w-3.5" />
            {currency}
          </Button>
        </header>

        {/* Mobile nav */}
        <nav className="md:hidden flex gap-1 overflow-x-auto border-b border-border/60 px-2 py-2">
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to !== basePath && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
