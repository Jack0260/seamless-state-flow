import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Btn, Stat } from "@/components/AppShell";
import { useMigrator, type NodeStatus } from "@/lib/migrator-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Node Sync Dashboard — Distributed State Migrator" },
      { name: "description", content: "Real-time visual sync of tenant nodes during zero-downtime schema migrations." },
      { property: "og:title", content: "Node Sync Dashboard — Distributed State Migrator" },
      { property: "og:description", content: "Real-time visual sync of tenant nodes during zero-downtime schema migrations." },
    ],
  }),
  component: Dashboard,
});

const TONE: Record<NodeStatus, string> = {
  synced: "text-success", migrating: "text-info", lagging: "text-warning", failed: "text-destructive", rolled_back: "text-muted-foreground",
};
const BAR: Record<NodeStatus, string> = {
  synced: "bg-success", migrating: "bg-info", lagging: "bg-warning", failed: "bg-destructive", rolled_back: "bg-muted-foreground",
};

function Dashboard() {
  const { state, start, pause, rollbackAll, rollbackNode, retryNode, reset, setFaultRate, bumpTarget } = useMigrator();
  const synced = state.nodes.filter((n) => n.version === state.targetVersion && n.status === "synced").length;
  const failed = state.nodes.filter((n) => n.status === "failed").length;
  const avgLat = Math.round(state.nodes.reduce((a, n) => a + n.latency, 0) / state.nodes.length);
  const allDone = synced === state.nodes.length;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Node Sync</h1>
          <p className="text-sm text-muted-foreground">Rolling expand/contract migration to schema <span className="font-mono text-primary">v{state.targetVersion}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.running
            ? <Btn variant="outline" onClick={pause}>Pause</Btn>
            : <Btn onClick={start} disabled={allDone}>Start migration</Btn>}
          <Btn variant="outline" onClick={bumpTarget} disabled={state.running || !allDone}>Bump to v{state.targetVersion + 1}</Btn>
          <Btn variant="danger" onClick={() => confirm("Roll back ALL tenants?") && rollbackAll()}>Rollback all</Btn>
          <Btn variant="ghost" onClick={() => confirm("Reset all simulated state?") && reset()}>Reset</Btn>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Converged" value={`${synced}/${state.nodes.length}`} tone="text-success" />
        <Stat label="Failed" value={failed} tone={failed ? "text-destructive" : undefined} />
        <Stat label="Avg replication lag" value={`${avgLat}ms`} tone={avgLat > 35 ? "text-warning" : undefined} />
        <div className="panel p-4">
          <label htmlFor="fault" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Fault injection · {(state.faultRate * 100).toFixed(0)}%</label>
          <input id="fault" type="range" min={0} max={30} value={Math.round(state.faultRate * 100)}
            onChange={(e) => setFaultRate(Number(e.target.value) / 100)} className="mt-3 w-full accent-primary" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {state.nodes.map((n) => (
          <div key={n.id} className={cn("panel p-4 transition-shadow", n.status === "failed" && "border-destructive/60")}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-sm font-semibold">{n.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{n.region} · {n.latency}ms</div>
              </div>
              <span className={cn("flex items-center gap-1 font-mono text-[10px] uppercase", TONE[n.status])}>
                <span className={cn("h-1.5 w-1.5 rounded-full", BAR[n.status], (n.status === "migrating" || n.status === "lagging") && "pulse-dot")} />
                {n.status.replace("_", " ")}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">v{n.version} → v{state.targetVersion}</span>
              <span>{Math.round(n.progress)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full transition-all duration-500", BAR[n.status])} style={{ width: `${n.progress}%` }} />
            </div>
            <div className="mt-3 flex gap-2">
              {n.status === "failed" && <Btn variant="outline" className="h-7 text-xs" onClick={() => retryNode(n.id)}>Retry</Btn>}
              <Btn variant="ghost" className="h-7 text-xs" disabled={n.status === "rolled_back"} onClick={() => rollbackNode(n.id)}>Rollback</Btn>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
