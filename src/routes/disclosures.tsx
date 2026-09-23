import { createFileRoute } from "@tanstack/react-router";
import { DISCLOSURES } from "@/lib/emo1/disclosures";

export const Route = createFileRoute("/disclosures")({ component: DisclosuresPage });

function DisclosuresPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">Operating boundaries</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-fg sm:text-5xl">Limits</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Customer-facing claims are limited to what this runtime actually does. Disclosures are attached to every audit record. They do not compensate for missing controls — they name the controls that are and are not present on this demonstration surface.
      </p>
      <div className="mt-8 space-y-4">
        {DISCLOSURES.map((d) => (
          <article key={d.id} className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display text-2xl text-fg">{d.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{d.body}</p>
            <p className="mt-3 font-mono text-[11px] text-subtle">{d.id}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
