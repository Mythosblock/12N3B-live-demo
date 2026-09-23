import { createFileRoute } from "@tanstack/react-router";
import { BANK_META, EVALUATORS, REGISTRY_MANIFEST } from "@/lib/emo1/registry";

export const Route = createFileRoute("/registry")({ component: RegistryPage });

function RegistryPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">
        {REGISTRY_MANIFEST.registry_id} · v{REGISTRY_MANIFEST.registry_version}
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-fg sm:text-5xl">Evaluator registry</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Twelve evaluators, three banks, N-of-B quorum. Every result names the evaluators that ran, their versions, and the local execution location. Composite orchestration lives in consensus, not in a hidden thirteenth evaluator.
      </p>
      <p className="mt-4 font-mono text-xs text-subtle">{REGISTRY_MANIFEST.quorum}</p>

      {(["ethics", "security", "evidence"] as const).map((bank) => (
        <section key={bank} className="mt-10">
          <h2 className="font-display text-3xl text-fg">{BANK_META[bank].name}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{BANK_META[bank].purpose}</p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {EVALUATORS.filter((e) => e.group === bank).map((e) => (
              <article key={e.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base text-fg">{e.name}</h3>
                  <span className="font-mono text-[10px] tracking-wider text-subtle uppercase">
                    {e.type}
                    {e.veto_capable ? " · veto" : ""}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-subtle">{e.id} · v{e.version}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{e.description}</p>
                <p className="mt-3 text-xs leading-relaxed text-subtle">{e.execution_semantics}</p>
                <p className="mt-3 font-mono text-[11px] text-subtle">location {e.execution_location}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
