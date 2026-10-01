import { createContext, useContext, type Context } from "react";

export type NodeStatus = "synced" | "migrating" | "lagging" | "failed" | "rolled_back";
export interface TenantNode {
  id: string; name: string; region: string; version: number;
  status: NodeStatus; progress: number; latency: number;
}
export type TxStatus = "pending" | "applying" | "committed" | "conflict" | "aborted";
export interface Tx { id: string; tenant: string; op: string; status: TxStatus; attempts: number; ts: number }
export type LogLevel = "info" | "warn" | "error" | "success";
export interface LogEntry { id: string; ts: number; level: LogLevel; node?: string | undefined; msg: string }

export interface MigratorState {
  targetVersion: number; running: boolean; faultRate: number;
  nodes: TenantNode[]; queue: Tx[]; logs: LogEntry[]; committed: number; conflicts: number;
}

export interface Api {
  state: MigratorState;
  start: () => void; pause: () => void; reset: () => void;
  rollbackNode: (id: string) => void; rollbackAll: () => void; retryNode: (id: string) => void;
  enqueue: (n?: number) => void; clearCommitted: () => void; clearLogs: () => void;
  setFaultRate: (r: number) => void; bumpTarget: () => void;
}

const g = globalThis as unknown as { __dsmCtx?: Context<Api | null> };
export const MigratorContext: Context<Api | null> = g.__dsmCtx ?? (g.__dsmCtx = createContext<Api | null>(null));

export function useMigrator() {
  const c = useContext(MigratorContext);
  if (!c) throw new Error("useMigrator must be used inside MigratorProvider");
  return c;
}
