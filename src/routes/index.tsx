import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DecisionMark } from "@/components/decision-mark";
import { EvaluatorBoard } from "@/components/evaluator-board";
import { submitEvaluation } from "@/lib/emo1/api";
import { SCENARIOS } from "@/lib/emo1/scenarios";
import type { EvaluationRecord, EvidenceClass } from "@/lib/emo1/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [evidenceClass, setEvidenceClass] = useState<EvidenceClass>("customer_provided");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<EvaluationRecord | null>(null);

  const remaining = 8000 - text.length;
  const canSubmit = text.trim().length > 0 && !busy;

  const classes = useMemo(
    () =>
      [
        ["customer_provided", "Customer-provided"],
        ["static_fixture", "Static fixture"],
        ["synthetic", "Synthetic"],
      ] as const,
    [],
  );

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await submitEvaluation({
      data: {
        text,
        evidenceClass,
        scenarioId,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(`${res.error.code}: ${res.error.message}`);
      return;
    }
    setRecord(res.record);
  }

  function applyScenario(id: string) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    setText(s.text);
    setEvidenceClass(s.evidence_class);
    setScenarioId(s.id);
    setRecord(null);
    setError(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="max-w-3xl">
        <p className="font-mono text-[11px] tracking-[0.22em] text-subtle uppercase">EMO1 runtime · $12N3B registry</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.1] tracking-tight text-fg sm:text-5xl">
          Submit a decision for structured evaluation.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Plain-English proposals are preserved, normalized, and scored by twelve local evaluators in three banks. Consensus is fail-closed: SHIP, HOLD, or REJECT. No terminal state leaves this console without a durable audit record.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-xl border border-line bg-surface p-4 shadow-panel sm:p-6">
          <label htmlFor="proposal" className="text-sm font-medium text-fg">
            Proposal
          </label>
          <textarea
            id="proposal"
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 8000));
              setScenarioId(null);
              setEvidenceClass("customer_provided");
            }}
            placeholder="Describe a release, access change, or production action. Original wording is retained as data, never as a control instruction."
            className="mt-3 min-h-40 w-full resize-y rounded-lg border border-line bg-elevated px-3 py-3 text-sm leading-relaxed text-fg outline-none placeholder:text-subtle focus:border-accent/50"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className={cn("font-mono text-[11px] tabular", remaining < 200 ? "text-hold" : "text-subtle")}>
              {remaining} left
            </p>
            <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
              {busy ? "Evaluating" : "Evaluate"}
            </Button>
          </div>
          {error ? <p className="mt-3 text-sm text-reject">{error}</p> : null}
        </section>

        <aside className="rounded-xl border border-line bg-surface p-4 sm:p-6">
          <p className="text-sm font-medium text-fg">Evidence class</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Production mode is not enabled. Live retrieval is not performed. Classification is stored on the audit record.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {classes.map(([value, label]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3">
                <input
                  type="radio"
                  name="evidence-class"
                  checked={evidenceClass === value}
                  onChange={() => {
                    setEvidenceClass(value);
                    if (value !== "static_fixture") setScenarioId(null);
                  }}
                  className="accent-accent"
                />
                <span className="text-sm text-fg">{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-6 text-sm font-medium text-fg">Static fixtures</p>
          <div className="mt-3 flex flex-col gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applyScenario(s.id)}
                className={cn(
                  "rounded-md border px-3 py-3 text-left transition-colors duration-150",
                  scenarioId === s.id ? "border-accent/50 bg-elevated" : "border-line hover:border-line-strong",
                )}
              >
                <p className="text-sm text-fg">{s.title}</p>
                <p className="mt-1 text-xs text-muted">{s.blurb}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {record ? (
        <section className="mt-10">
          <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
            <div>
              <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">Authoritative decision</p>
              <div className="mt-3">
                <DecisionMark state={record.decision} rule={record.decision_lineage.rule_id} />
              </div>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{record.decision_lineage.summary}</p>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-subtle">
              <p>request {record.request_id}</p>
              <p>audit {record.audit.status}</p>
              <p className="truncate">hash {record.audit.record_hash.slice(0, 16)}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate({ to: "/evaluations/$requestId", params: { requestId: record.request_id } })}
              >
                Open record
              </Button>
            </div>
          </div>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-subtle uppercase">
            Projected replay of recorded evaluator execution
          </p>
          <div className="mt-3">
            <EvaluatorBoard evaluators={record.evaluators} animate />
          </div>
        </section>
      ) : (
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { k: "12", v: "Evaluators", d: "Canonical $12N3B registry, versioned and local." },
            { k: "3", v: "Banks", d: "Ethics, security, evidence. Quorum is 3 of 4." },
            { k: "0", v: "Silent SHIP", d: "Missing evidence, ambiguity, and vetoes cannot pass." },
          ].map((item) => (
            <div key={item.v} className="rounded-xl border border-line bg-surface px-5 py-6">
              <p className="font-display text-4xl text-fg">{item.k}</p>
              <p className="mt-2 text-sm text-fg">{item.v}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{item.d}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
