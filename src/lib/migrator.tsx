import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MigratorContext, type Api, type LogEntry, type LogLevel, type MigratorState, type NodeStatus, type TxStatus } from "./migrator-store";

const KEY = "dsm-state-v1";
const REGIONS = ["us-east-1", "us-west-2", "eu-central-1", "ap-south-1", "ap-northeast-1", "sa-east-1"];
const NAMES = ["acme", "globex", "initech", "umbrella", "hooli", "stark", "wayne", "tyrell", "cyberdyne", "soylent", "aperture", "wonka"];
const OPS = ["ALTER TABLE ADD COLUMN", "CREATE INDEX CONCURRENTLY", "BACKFILL batch", "UPDATE tenant_cfg", "INSERT audit_row", "DROP shadow_col"];

let seq = 0;
function pick<T>(arr: readonly T[], i?: number): T {
  return arr[(i ?? Math.floor(Math.random() * arr.length)) % arr.length] as T;
}
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function seedState(): MigratorState {
  return {
    targetVersion: 42, running: false, faultRate: 0.02, committed: 0, conflicts: 0,
    nodes: NAMES.map((n, i) => ({
      id: `node-${i + 1}`, name: `tenant_${n}`, region: pick(REGIONS, i),
      version: 41, status: "synced", progress: 100, latency: 12 + ((i * 7) % 30),
    })),
    queue: [],
    logs: [{ id: "seed", ts: 0, level: "info", msg: "Cluster initialized at schema v41. Awaiting migration to v42." }],
  };
}

function isValid(s: unknown): s is MigratorState {
  const x = s as MigratorState;
  return !!x && Array.isArray(x.nodes) && Array.isArray(x.queue) && Array.isArray(x.logs) && typeof x.targetVersion === "number";
}

export function MigratorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MigratorState>(seedState);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) setState({ ...parsed, running: false });
      }
    } catch (e) {
      console.warn("Corrupt migrator state, resetting", e);
      localStorage.removeItem(KEY);
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const log = (s: MigratorState, level: LogLevel, msg: string, node?: string): LogEntry[] =>
    [{ id: uid("log"), ts: Date.now(), level, msg, node }, ...s.logs].slice(0, 300);

  // Simulation tick
  useEffect(() => {
    if (!state.running) return;
    const iv = setInterval(() => {
      setState((s) => {
        let logs = s.logs;
        let committed = s.committed, conflicts = s.conflicts;
        const nodes = s.nodes.map((n) => {
          const latency = Math.max(4, Math.round(n.latency + (Math.random() - 0.5) * 8));
          if (n.status === "migrating" || n.status === "lagging") {
            if (Math.random() < s.faultRate) {
              logs = log({ ...s, logs }, "error", `Migration v${s.targetVersion} failed at ${Math.round(n.progress)}% — lock timeout guard tripped`, n.name);
              return { ...n, latency, status: "failed" as NodeStatus };
            }
            const lag = latency > 38;
            const progress = Math.min(100, n.progress + (lag ? 3 : 6 + Math.random() * 10));
            if (progress >= 100) {
              logs = log({ ...s, logs }, "success", `Cut-over complete → v${s.targetVersion} (shadow table swapped)`, n.name);
              return { ...n, latency, progress: 100, version: s.targetVersion, status: "synced" as NodeStatus };
            }
            return { ...n, latency, progress, status: (lag ? "lagging" : "migrating") as NodeStatus };
          }
          return { ...n, latency };
        });

        // Lock-free queue: optimistic CAS processing
        const queue = s.queue.map((t) => {
          if (t.status === "pending" && Math.random() < 0.7) return { ...t, status: "applying" as TxStatus };
          if (t.status === "applying") {
            if (Math.random() < 0.12) {
              conflicts++;
              if (t.attempts >= 3) {
                logs = log({ ...s, logs }, "warn", `TX ${t.id.slice(-6)} aborted after 3 CAS retries`, t.tenant);
                return { ...t, status: "aborted" as TxStatus };
              }
              return { ...t, status: "conflict" as TxStatus, attempts: t.attempts + 1 };
            }
            committed++;
            return { ...t, status: "committed" as TxStatus };
          }
          if (t.status === "conflict") return { ...t, status: "pending" as TxStatus };
          return t;
        }).slice(-200);

        // Background traffic
        if (Math.random() < 0.6) {
          const n = pick(nodes);
          queue.push({ id: uid("tx"), tenant: n.name, op: pick(OPS), status: "pending", attempts: 0, ts: Date.now() });
        }

        let running = s.running;
        if (nodes.every((n) => n.status === "synced" || n.status === "failed" || n.status === "rolled_back")) {
          running = false;
          const failed = nodes.filter((n) => n.status === "failed").length;
          logs = log({ ...s, logs }, failed ? "warn" : "success",
            failed ? `Migration wave finished with ${failed} failed node(s). Rollback or retry required.` : `All tenants converged on v${s.targetVersion}. Zero downtime.`);
        }
        return { ...s, nodes, queue, logs, committed, conflicts, running };
      });
    }, 700);
    return () => clearInterval(iv);
  }, [state.running]);

  const start = useCallback(() => setState((s) => {
    const pending = s.nodes.some((n) => n.version < s.targetVersion);
    if (!pending) return { ...s, logs: log(s, "info", `Nothing to migrate — all nodes at v${s.targetVersion}. Bump target first.`) };
    return {
      ...s, running: true,
      nodes: s.nodes.map((n) => n.version < s.targetVersion && n.status !== "failed" ? { ...n, status: "migrating", progress: 0 } : n),
      logs: log(s, "info", `Rolling migration v${s.targetVersion} started (expand → backfill → contract)`),
    };
  }), []);

  const api: Api = {
    state, start,
    pause: () => setState((s) => ({ ...s, running: false, logs: log(s, "warn", "Migration paused by operator") })),
    reset: () => { localStorage.removeItem(KEY); setState(seedState()); },
    rollbackNode: (id) => setState((s) => {
      const n = s.nodes.find((x) => x.id === id);
      if (!n) return s;
      const prev = Math.min(n.version, s.targetVersion - 1);
      return {
        ...s,
        nodes: s.nodes.map((x) => x.id === id ? { ...x, version: prev, status: "rolled_back", progress: 100 } : x),
        logs: log(s, "warn", `Rollback executed → v${prev}. Shadow tables dropped, writes replayed.`, n.name),
      };
    }),
    rollbackAll: () => setState((s) => ({
      ...s, running: false,
      nodes: s.nodes.map((x) => ({ ...x, version: s.targetVersion - 1, status: "rolled_back", progress: 100 })),
      logs: log(s, "error", `Global rollback to v${s.targetVersion - 1} across ${s.nodes.length} tenants`),
    })),
    retryNode: (id) => setState((s) => {
      const n = s.nodes.find((x) => x.id === id);
      if (!n) return s;
      return {
        ...s, running: true,
        nodes: s.nodes.map((x) => x.id === id ? { ...x, status: "migrating", progress: 0 } : x),
        logs: log(s, "info", `Retrying migration v${s.targetVersion}`, n.name),
      };
    }),
    enqueue: (count = 10) => setState((s) => ({
      ...s,
      queue: [...s.queue, ...Array.from({ length: count }, () => {
        const n = pick(s.nodes);
        return { id: uid("tx"), tenant: n.name, op: pick(OPS), status: "pending" as TxStatus, attempts: 0, ts: Date.now() };
      })].slice(-200),
      running: s.running,
      logs: log(s, "info", `Injected ${count} synthetic transactions into queue`),
    })),
    clearCommitted: () => setState((s) => ({ ...s, queue: s.queue.filter((t) => t.status !== "committed" && t.status !== "aborted") })),
    clearLogs: () => setState((s) => ({ ...s, logs: [] })),
    setFaultRate: (r) => setState((s) => ({ ...s, faultRate: Math.max(0, Math.min(0.3, r)) })),
    bumpTarget: () => setState((s) => ({
      ...s, targetVersion: s.targetVersion + 1,
      nodes: s.nodes.map((n) => n.status === "rolled_back" ? { ...n, status: "synced" } : n),
      logs: log(s, "info", `Target schema bumped to v${s.targetVersion + 1}`),
    })),
  };

  return <MigratorContext.Provider value={api}>{children}</MigratorContext.Provider>;
}

