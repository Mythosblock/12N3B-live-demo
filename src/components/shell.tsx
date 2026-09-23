import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { getManifest } from "@/lib/emo1/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Evaluate" },
  { to: "/observer", label: "Observer" },
  { to: "/registry", label: "Registry" },
  { to: "/architecture", label: "Architecture" },
  { to: "/disclosures", label: "Limits" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [artifact, setArtifact] = useState<string>("");

  useEffect(() => {
    let live = true;
    getManifest()
      .then((m) => {
        if (live) setArtifact(m.artifact_id);
      })
      .catch(() => {
        if (live) setArtifact("");
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-baseline justify-between gap-4">
            <Link to="/" className="flex items-baseline gap-3">
              <span className="font-display text-3xl leading-none tracking-tight text-fg">EMO1</span>
              <span className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">$12N3B</span>
            </Link>
            <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] tracking-wider text-subtle uppercase lg:hidden">
              Demo
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:pb-0" aria-label="Primary">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm transition-colors duration-150",
                    active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] tracking-wider text-subtle uppercase">
              Demonstration
            </span>
            {artifact ? (
              <span className="max-w-[14ch] truncate font-mono text-[11px] text-subtle" title={artifact}>
                {artifact}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      <div className="border-b border-line bg-surface/80">
        <p className="mx-auto max-w-6xl px-4 py-2.5 text-xs leading-relaxed text-muted sm:px-6">
          Demonstration environment. Decisions are fail-closed. Fixture and customer-provided text are labeled. Provider names are inventory, not endorsement.
        </p>
      </div>
      <div id="main">{children}</div>
    </div>
  );
}
