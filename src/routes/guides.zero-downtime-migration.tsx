import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

const TITLE = "Zero Downtime Database Migration: Expand-Contract Guide";
const DESC =
  "A practical guide to zero downtime database migration for multi-tenant systems: expand-contract, shadow table swaps, batched backfills, and safe rollbacks.";

export const Route = createFileRoute("/guides/zero-downtime-migration")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://seamless-state-flow.lovable.app/guides/zero-downtime-migration" },
    ],
    links: [{ rel: "canonical", href: "https://seamless-state-flow.lovable.app/guides/zero-downtime-migration" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: TITLE,
          description: DESC,
        }),
      },
    ],
  }),
  component: Guide,
});

function Code({ children }: { children: string }) {
  return <pre className="panel my-4 overflow-x-auto p-4 font-mono text-xs leading-relaxed">{children}</pre>;
}

function Guide() {
  return (
    <AppShell>
      <article className="mx-auto max-w-3xl space-y-4 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Guide</p>
        <h1 className="text-3xl font-semibold tracking-tight">Zero downtime database migration: a practical guide</h1>
        <p>
          A zero downtime database migration changes your schema while the application keeps serving reads and
          writes. Instead of one big locking <code className="font-mono">ALTER</code>, you split the change into
          small, reversible, backwards-compatible steps. This is the approach the{" "}
          <Link to="/" className="text-primary underline">Node Sync dashboard</Link> simulates across tenants.
        </p>

        <h2>1. The expand-contract pattern</h2>
        <p>Every breaking change becomes three phases, each deployable on its own:</p>
        <ol className="list-decimal space-y-1 pl-6">
          <li><strong className="text-foreground">Expand:</strong> add new columns or tables without removing anything. Old and new code both work.</li>
          <li><strong className="text-foreground">Migrate:</strong> backfill data and switch the application to read and write the new shape.</li>
          <li><strong className="text-foreground">Contract:</strong> once nothing uses the old shape, drop it.</li>
        </ol>
        <Code>{`-- expand
ALTER TABLE users ADD COLUMN full_name text;           -- nullable, no default rewrite
-- app writes both name + full_name (dual write)
-- migrate: backfill (see below), then read from full_name
-- contract
ALTER TABLE users DROP COLUMN name;`}</Code>

        <h2>2. Shadow tables and atomic swaps</h2>
        <p>
          When a change would rewrite the whole table (type changes, re-partitioning), build a shadow copy, keep it in
          sync with triggers or change data capture, then swap names in one short transaction.
        </p>
        <Code>{`CREATE TABLE orders_new (LIKE orders INCLUDING ALL);
-- alter orders_new freely; sync writes via trigger
BEGIN;
  SET LOCAL lock_timeout = '2s';
  ALTER TABLE orders RENAME TO orders_old;
  ALTER TABLE orders_new RENAME TO orders;
COMMIT;`}</Code>
        <p>A strict <code className="font-mono">lock_timeout</code> means a busy table aborts the swap rather than queueing every query behind it, so you can retry safely.</p>

        <h2>3. Batched backfills</h2>
        <p>Never update millions of rows in one statement. Walk the primary key in small batches so locks stay short and replicas keep up.</p>
        <Code>{`UPDATE users SET full_name = name
WHERE id > $last_id AND id <= $last_id + 5000
  AND full_name IS NULL;
-- sleep briefly, check replication lag, repeat`}</Code>

        <h2>4. Lock-free writes during the migration</h2>
        <p>
          Application writes keep flowing. Optimistic concurrency (compare-and-swap on a version column) avoids holding
          row locks; conflicting transactions retry a bounded number of times and are aborted cleanly. See it in the{" "}
          <Link to="/queue" className="text-primary underline">transaction queue simulator</Link>.
        </p>

        <h2>5. Multi-tenant rollout and rollback</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Migrate tenants in waves (canary first), watching replication lag and error rates.</li>
          <li>Keep every step reversible until contract: rolling back is just pointing the app at the old shape.</li>
          <li>Log every cut-over and rollback per tenant. Browse a live example in the <Link to="/logs" className="text-primary underline">rollback logs</Link>.</li>
        </ul>

        <h2>Checklist</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>New columns are nullable or have cheap defaults.</li>
          <li>Indexes are built concurrently.</li>
          <li>Every DDL statement has a lock timeout.</li>
          <li>Backfills are batched and resumable.</li>
          <li>Old code and new code both run against every intermediate schema.</li>
        </ul>
      </article>
    </AppShell>
  );
}
