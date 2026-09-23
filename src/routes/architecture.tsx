import { createFileRoute } from "@tanstack/react-router";
import { ARCHITECTURAL_CLAIMS } from "@/lib/emo1/claims";
import { PROTECTED_PATHS, RUNTIME_ID, RUNTIME_VERSION, REGISTRY_ID, REGISTRY_VERSION } from "@/lib/emo1/identity";
import { DEPENDENCY_INVENTORY } from "@/lib/emo1/inventory";
import { getManifest } from "@/lib/emo1/api";

export const Route = createFileRoute("/architecture")({
  loader: () => getManifest(),
  component: ArchitecturePage,
});

function ArchitecturePage() {
  const m = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">Claims register · immutable core</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-fg sm:text-5xl">Architecture</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        {RUNTIME_ID} {RUNTIME_VERSION} hosts {REGISTRY_ID} {REGISTRY_VERSION}. The customer surface invokes this runtime. Terminal decisions are not rendered from fixtures in the browser.
      </p>

      <section className="mt-8 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl text-fg">Artifact identity</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 font-mono text-xs">
          {[
            ["artifact", m.artifact_id],
            ["runtime", `${m.runtime_id} ${m.runtime_version}`],
            ["registry", `${m.registry_id} ${m.registry_version}`],
            ["policy", m.policy_version],
            ["schema", m.schema_version],
            ["consensus", m.consensus_version],
            ["channel", m.build_channel],
            ["commit", m.source_commit],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-subtle">{k}</dt>
              <dd className="mt-1 break-all text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-fg">Architectural claims</h2>
        <div className="mt-4 grid gap-3">
          {ARCHITECTURAL_CLAIMS.map((c) => (
            <article key={c.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="font-mono text-[11px] text-subtle">
                {c.id} · {c.status}
              </p>
              <h3 className="mt-2 text-sm text-fg">{c.claim}</h3>
              <p className="mt-2 text-sm text-muted">{c.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-fg">Protected paths</h2>
        <p className="mt-2 text-sm text-muted">
          Changes to these components change claimed behavior. Baseline CI reports their identity. Exception process: rationale, risk, review, tests, artifact update, post-change verification.
        </p>
        <ul className="mt-4 space-y-1 font-mono text-xs text-fg">
          {PROTECTED_PATHS.map((p) => (
            <li key={p} className="rounded-md border border-line bg-elevated px-3 py-2">
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-fg">Dependency inventory</h2>
        <p className="mt-2 text-sm text-muted">
          Presence in this list is not participation, invocation, or endorsement.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {DEPENDENCY_INVENTORY.map((d) => (
            <article key={d.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm text-fg">{d.id}</h3>
                <span className="font-mono text-[10px] uppercase text-subtle">{d.participation}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-subtle">
                {d.kind} · invoked {d.invoked_in_demo ? "yes" : "no"} · decision-relevant {d.decision_relevant ? "yes" : "no"}
              </p>
              <p className="mt-2 text-sm text-muted">{d.note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
