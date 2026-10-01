import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Btn, Stat } from "@/components/AppShell";
import { useMigrator, type TxStatus } from "@/lib/migrator-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Lock-free Transaction Queue — Distributed State Migrator" },
      { name: "description", content: "Simulated lock-free optimistic CAS transaction queue running alongside live migrations." },
      { property: "og:title", content: "Lock-free Transaction Queue — Distributed State Migrator" },
      { property: "og:description", content: "Simulated lock-free optimistic CAS transaction queue running alongside live migrations." },
    ],
  }),
  component: QueuePage,
});

const TONE: Record<TxStatus, string> = {
  pending: "text-muted-foreground", applying: "text-info", committed: "text-success", conflict: "text-warning", aborted: "text-destructive",
};

function QueuePage() {
  const { state, enqueue, clearCommitted, start, pause } = useMigrator();
  const count = (s: TxStatus) => state.queue.filter((t) => t.status === s).length;
  const rows = [...state.queue].reverse().slice(0, 80);
  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lock-free Transaction Queue</h1>
          <p className="text-sm text-muted-foreground">Optimistic compare-and-swap with bounded retries. No table locks held during migration.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => enqueue(10)}>Inject 10 tx</Btn>
          <Btn variant="outline" onClick={() => enqueue(50)}>Burst 50</Btn>
          <Btn variant="outline" onClick={state.running ? pause : start}>{state.running ? "Pause" : "Resume processing"}</Btn>
          <Btn variant="ghost" onClick={clearCommitted}>Clear finished</Btn>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Pending" value={count("pending")} />
        <Stat label="Applying" value={count("applying")} tone="text-info" />
        <Stat label="Committed (total)" value={state.committed} tone="text-success" />
        <Stat label="CAS conflicts" value={state.conflicts} tone="text-warning" />
        <Stat label="Aborted" value={count("aborted")} tone="text-destructive" />
      </div>
      {!state.running && count("pending") > 0 && (
        <p className="mb-3 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">Processor is idle — resume processing to drain the queue.</p>
      )}
      <div className="panel overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead className="border-b text-left text-muted-foreground">
            <tr><th className="p-3">TX</th><th className="p-3">Tenant</th><th className="p-3">Operation</th><th className="p-3">Retries</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Queue empty. Inject transactions to begin.</td></tr>}
            {rows.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="p-3">{t.id.slice(-8)}</td>
                <td className="p-3">{t.tenant}</td>
                <td className="p-3 text-muted-foreground">{t.op}</td>
                <td className="p-3">{t.attempts}</td>
                <td className={cn("p-3 uppercase", TONE[t.status])}>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
