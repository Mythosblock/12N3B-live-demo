import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DecisionMark } from "@/components/decision-mark";
import { EvaluatorBoard } from "@/components/evaluator-board";
import { Button } from "@/components/ui/button";
import { exportEvaluation, getEvaluation, verifyEvaluation } from "@/lib/emo1/api";
import { DISCLOSURES } from "@/lib/emo1/disclosures";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/evaluations/$requestId")({
  loader: async ({ params }) => getEvaluation({ data: { requestId: params.requestId } }),
  component: RecordPage,
});

const TABS = ["Lineage", "Evaluators", "Evidence", "Provenance", "Audit"] as const;

function RecordPage() {
  const data = Route.useLoaderData();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Lineage");
  const [verify, setVerify] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data.ok) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl text-fg">Record not available</h1>
        <p className="mt-3 text-sm text-muted">
          {data.error.code}: {data.error.message}
        </p>
        <Link to="/observer" className="mt-6 inline-flex min-h-11 items-center text-sm text-accent">
          Return to observer
        </Link>
      </main>
    );
  }

  const rec = data.record;

  async function onVerify() {
    setBusy(true);
    const res = await verifyEvaluation({ data: { requestId: rec.request_id } });
    setBusy(false);
    if (!res.ok) {
      setVerify(res.error.message);
      return;
    }
    setVerify(
      `Integrity ${res.integrity.ok ? "valid" : "mismatch"}. Replay ${res.replay.match ? "matches" : "diverges"} (${res.replay.stored_decision}/${res.replay.replayed_decision}).`,
    );
  }

  async function onExport() {
    const res = await exportEvaluation({ data: { requestId: rec.request_id } });
    if (!res.ok) return;
    const blob = new Blob([JSON.stringify(res.package, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rec.request_id}.emo1.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">
        Authoritative audit record · {rec.labels.evidence_class.replace("_", " ")}
      </p>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <DecisionMark state={rec.decision} rule={rec.decision_lineage.rule_id} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onVerify} disabled={busy}>
            Verify
          </Button>
          <Button type="button" variant="secondary" onClick={onExport}>
            Export
          </Button>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{rec.decision_lineage.summary}</p>
      {verify ? <p className="mt-3 text-sm text-accent">{verify}</p> : null}

      <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Request", rec.request_id],
          ["Execution", rec.execution_id],
          ["Artifact", rec.artifact_id],
          ["Decided", rec.audit.decided_at],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-surface px-4 py-3">
            <dt className="font-mono text-[10px] tracking-wider text-subtle uppercase">{k}</dt>
            <dd className="mt-1 truncate font-mono text-xs text-fg">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "min-h-11 shrink-0 px-4 text-sm",
              tab === t ? "border-b border-accent text-fg" : "text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Lineage" ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display text-2xl text-fg">Original input</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{rec.original_input}</p>
            <p className="mt-4 font-mono text-[11px] text-subtle">hash {rec.original_hash.slice(0, 24)}</p>
          </article>
          <article className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display text-2xl text-fg">Normalized request</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{rec.normalized_input}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-subtle">Intent</dt>
                <dd className="text-fg">{rec.structured.intent}</dd>
              </div>
              <div>
                <dt className="text-subtle">Audience</dt>
                <dd className="text-fg">{rec.structured.audience}</dd>
              </div>
              <div>
                <dt className="text-subtle">Urgency</dt>
                <dd className="text-fg">{rec.structured.urgency}</dd>
              </div>
              <div>
                <dt className="text-subtle">Ambiguity</dt>
                <dd className="text-fg">{rec.structured.ambiguity_score.toFixed(2)}</dd>
              </div>
            </dl>
          </article>
          <article className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
            <h2 className="font-display text-2xl text-fg">Reasons</h2>
            <ul className="mt-3 space-y-2">
              {rec.decision_lineage.reasons.map((r) => (
                <li key={r} className="border-l border-line-strong pl-3 text-sm text-muted">
                  {r}
                </li>
              ))}
            </ul>
            {rec.decision_lineage.vetoes.length ? (
              <p className="mt-4 font-mono text-xs text-reject">
                Vetoes: {rec.decision_lineage.vetoes.join(", ")}
              </p>
            ) : (
              <p className="mt-4 font-mono text-xs text-subtle">No veto fired.</p>
            )}
          </article>
        </section>
      ) : null}

      {tab === "Evaluators" ? (
        <section className="mt-6">
          <p className="mb-3 font-mono text-[11px] text-subtle uppercase">
            Projected layout of recorded results · source is the audit record
          </p>
          <EvaluatorBoard evaluators={rec.evaluators} />
          <ul className="mt-6 space-y-3">
            {rec.evaluators.map((e) => (
              <li key={e.evaluator_id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm text-fg">
                    {e.name}{" "}
                    <span className="font-mono text-[11px] text-subtle">{e.evaluator_id}</span>
                  </h3>
                  <span className="font-mono text-[11px] uppercase text-muted">
                    {e.status} · score {e.score.toFixed(2)} · conf {e.confidence.toFixed(2)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {e.findings.map((f) => (
                    <li key={f} className="text-sm text-muted">
                      {f}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "Evidence" ? (
        <section className="mt-6 grid gap-3">
          {rec.evidence.map((item) => (
            <article key={item.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="font-mono text-[11px] text-subtle uppercase">
                {item.classification} · {item.validation_status}
              </p>
              <h3 className="mt-2 text-sm text-fg">{item.source_identity}</h3>
              <p className="mt-2 text-sm text-muted">{item.provenance}</p>
              {item.excerpt ? <p className="mt-2 font-mono text-xs text-fg">{item.excerpt}</p> : null}
              <p className="mt-3 font-mono text-[11px] text-subtle">
                supports SHIP: {item.supports_ship ? "yes" : "no"} · hash {item.content_hash.slice(0, 16)}
              </p>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "Provenance" ? (
        <section className="mt-6 grid gap-3">
          <p className="text-sm text-muted">
            Listed, configured, or available does not mean invoked. Invoked does not mean decision-relevant. Nothing here is a provider endorsement.
          </p>
          {rec.providers.map((p) => (
            <article key={p.provider_id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-xl text-fg">{p.provider_id}</h3>
                <span className="font-mono text-[11px] uppercase text-muted">{p.status}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-subtle">Mode</dt>
                  <dd>{p.participation_mode}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Invoked</dt>
                  <dd>{p.invoked ? "yes" : "no"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Decision-relevant</dt>
                  <dd>{p.decision_relevant ? "yes" : "no"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Result used</dt>
                  <dd>{p.result_used ? "yes" : "no"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Endorsement</dt>
                  <dd>false</dd>
                </div>
                <div>
                  <dt className="text-subtle">Credentials</dt>
                  <dd>{p.credential_present ? "present" : "none"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-muted">{p.note}</p>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "Audit" ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display text-2xl text-fg">Integrity</h2>
            <dl className="mt-4 space-y-2 font-mono text-xs">
              <div>
                <dt className="text-subtle">record_hash</dt>
                <dd className="break-all text-fg">{rec.audit.record_hash}</dd>
              </div>
              <div>
                <dt className="text-subtle">chain_hash</dt>
                <dd className="break-all text-fg">{rec.audit.chain_hash}</dd>
              </div>
              <div>
                <dt className="text-subtle">prev</dt>
                <dd className="break-all text-fg">{rec.audit.prev_chain_hash ?? "GENESIS"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted">
              Runtime {rec.runtime_version} · registry {rec.registry_version} · policy {rec.policy_version}
            </p>
          </article>
          <article className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display text-2xl text-fg">Disclosures on this record</h2>
            <ul className="mt-3 space-y-2">
              {rec.disclosures.map((id) => {
                const d = DISCLOSURES.find((x) => x.id === id);
                return (
                  <li key={id} className="text-sm text-muted">
                    {d?.title ?? id}
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      ) : null}
    </main>
  );
}
