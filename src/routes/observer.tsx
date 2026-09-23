import { createFileRoute, Link } from "@tanstack/react-router";
import { DecisionChip } from "@/components/decision-mark";
import { listEvaluations } from "@/lib/emo1/api";

export const Route = createFileRoute("/observer")({
  loader: () => listEvaluations(),
  component: ObserverPage,
});

function ObserverPage() {
  const data = Route.useLoaderData();
  const rows = data.rows;

  const counts = {
    SHIP: rows.filter((r) => r.decision === "SHIP").length,
    HOLD: rows.filter((r) => r.decision === "HOLD").length,
    REJECT: rows.filter((r) => r.decision === "REJECT").length,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">
        Authoritative observer · source: audit ledger
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-fg sm:text-5xl">Observer</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        This view reads committed evaluation records. Counts below are derived aggregations. Animated evaluator grids on other pages are projected replays, not a second source of truth.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {(["SHIP", "HOLD", "REJECT"] as const).map((k) => (
          <div key={k} className="rounded-xl border border-line bg-surface px-5 py-5">
            <p className="font-mono text-[10px] tracking-wider text-subtle uppercase">Derived count</p>
            <p className="mt-2 font-display text-4xl text-fg tabular">{counts[k]}</p>
            <p className="mt-1 text-sm text-muted">{k}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface font-mono text-[10px] tracking-wider text-subtle uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Decision</th>
              <th className="px-4 py-3 font-medium">Request</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Class</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Rule</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.request_id} className="border-t border-line">
                <td className="px-4 py-3">
                  <DecisionChip state={row.decision} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    to="/evaluations/$requestId"
                    params={{ requestId: row.request_id }}
                    className="block max-w-[42ch] truncate text-fg hover:text-accent"
                  >
                    {row.original_input}
                  </Link>
                  <p className="mt-1 font-mono text-[10px] text-subtle">{row.request_id}</p>
                </td>
                <td className="hidden px-4 py-3 font-mono text-[11px] text-muted sm:table-cell">
                  {row.evidence_class}
                </td>
                <td className="hidden px-4 py-3 font-mono text-[11px] text-muted md:table-cell">{row.rule_id}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted">
                  {row.decided_at.replace("T", " ").slice(0, 19)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 font-mono text-[11px] text-subtle">
        Freshness: as of last committed write · environment {data.manifest.environment} · artifact {data.manifest.artifact_id}
      </p>
    </main>
  );
}
