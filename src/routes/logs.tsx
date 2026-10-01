import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Btn } from "@/components/AppShell";
import { useMigrator, type LogLevel } from "@/lib/migrator-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Live Rollback Logs — Distributed State Migrator" },
      { name: "description", content: "Streaming migration, failure, and rollback events across every tenant node." },
      { property: "og:title", content: "Live Rollback Logs — Distributed State Migrator" },
      { property: "og:description", content: "Streaming migration, failure, and rollback events across every tenant node." },
    ],
  }),
  component: LogsPage,
});

const TONE: Record<LogLevel, string> = { info: "text-info", warn: "text-warning", error: "text-destructive", success: "text-success" };
const FILTERS = ["all", "info", "success", "warn", "error"] as const;

function LogsPage() {
  const { state, clearLogs } = useMigrator();
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const logs = f === "all" ? state.logs : state.logs.filter((l) => l.level === f);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dsm-logs-v${state.targetVersion}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Rollback Logs</h1>
          <p className="text-sm text-muted-foreground">{state.logs.length} events retained (last 300)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-md border bg-muted p-0.5 text-xs">
            {FILTERS.map((x) => (
              <button key={x} onClick={() => setF(x)} className={cn("rounded px-2.5 py-1 font-mono uppercase", f === x ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground")}>{x}</button>
            ))}
          </div>
          <Btn variant="outline" onClick={exportLogs} disabled={!state.logs.length}>Export JSON</Btn>
          <Btn variant="ghost" onClick={clearLogs} disabled={!state.logs.length}>Clear</Btn>
        </div>
      </div>
      <div className="panel max-h-[70vh] overflow-y-auto p-2 font-mono text-xs">
        {logs.length === 0 && <div className="p-8 text-center text-muted-foreground">No events for this filter.</div>}
        {logs.map((l) => (
          <div key={l.id} className="flex gap-3 rounded px-2 py-1.5 hover:bg-muted">
            <span className="shrink-0 text-muted-foreground">{l.ts ? new Date(l.ts).toLocaleTimeString() : "--:--:--"}</span>
            <span className={cn("w-16 shrink-0 uppercase", TONE[l.level])}>{l.level}</span>
            {l.node && <span className="shrink-0 text-primary">[{l.node}]</span>}
            <span>{l.msg}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
