import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTheme, type ThemePref } from "@/lib/theme";
import { useMigrator } from "@/lib/migrator";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Node Sync" },
  { to: "/queue", label: "Tx Queue" },
  { to: "/logs", label: "Rollback Logs" },
] as const;

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const opts: { v: ThemePref; l: string }[] = [{ v: "light", l: "Light" }, { v: "dark", l: "Dark" }, { v: "system", l: "System" }];
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-md border bg-muted p-0.5 text-xs">
      {opts.map((o) => (
        <button key={o.v} role="radio" aria-checked={theme === o.v} onClick={() => setTheme(o.v)}
          className={cn("rounded px-2.5 py-1 font-mono transition-colors",
            theme === o.v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useMigrator();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">DSM</span>
            <span className="leading-tight">
              <span className="block font-semibold">Distributed State Migrator</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">zero-downtime · multi-tenant</span>
            </span>
          </Link>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", state.running ? "bg-success pulse-dot" : "bg-muted-foreground")} />
              {state.running ? "LIVE" : "IDLE"} · v{state.targetVersion}
            </span>
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}

export function Btn({ variant = "default", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "danger" | "ghost" }) {
  const v = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border bg-card hover:bg-muted",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
    ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
  }[variant];
  return <button {...p} className={cn("inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40", v, className)} />;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string | undefined }) {
  return (
    <div className="panel p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold", tone)}>{value}</div>
    </div>
  );
}
