import { BANK_META } from "@/lib/emo1/registry";
import type { BankId, EvaluatorResult } from "@/lib/emo1/types";
import { cn } from "@/lib/utils";

const BANKS: BankId[] = ["ethics", "security", "evidence"];

function statusTone(status: EvaluatorResult["status"]) {
  if (status === "pass") return "text-ship";
  if (status === "fail") return "text-reject";
  if (status === "hold") return "text-hold";
  return "text-muted";
}

export function EvaluatorBoard({
  evaluators,
  animate,
}: {
  evaluators: EvaluatorResult[];
  animate?: boolean;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {BANKS.map((bank) => {
        const rows = evaluators.filter((e) => e.group === bank);
        const meta = BANK_META[bank];
        const pass = rows.filter((r) => r.status === "pass").length;
        return (
          <section key={bank} className="rounded-xl border border-line bg-surface p-4 shadow-panel">
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">{meta.n_of_b}</p>
                <h3 className="mt-1 font-display text-xl text-fg">{meta.name}</h3>
              </div>
              <p className="font-mono text-xs text-muted tabular">{pass}/4</p>
            </header>
            <ul className="space-y-2">
              {rows.map((row, i) => (
                <li
                  key={row.evaluator_id}
                  className={cn("rounded-md border border-line bg-elevated px-3 py-2.5", animate && "replay-item")}
                  style={{ ["--i" as string]: i + (BANKS.indexOf(bank) * 4) }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-fg">{row.name}</p>
                    <span className={cn("font-mono text-[10px] tracking-wider uppercase", statusTone(row.status))}>
                      {row.status}
                      {row.veto ? " · veto" : ""}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-subtle">{row.evaluator_id}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
