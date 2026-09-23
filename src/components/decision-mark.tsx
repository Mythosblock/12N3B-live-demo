import { cn } from "@/lib/utils";
import type { TerminalState } from "@/lib/emo1/types";

export function decisionTone(state: TerminalState) {
  if (state === "SHIP") return "text-ship";
  if (state === "HOLD") return "text-hold";
  return "text-reject";
}

export function DecisionMark({
  state,
  rule,
  size = "lg",
}: {
  state: TerminalState;
  rule?: string;
  size?: "lg" | "sm";
}) {
  return (
    <div className={cn("flex flex-col", size === "lg" ? "gap-2" : "gap-1")}>
      <p
        className={cn(
          "font-display leading-none tracking-tight",
          decisionTone(state),
          size === "lg" ? "text-5xl sm:text-6xl" : "text-2xl",
        )}
      >
        {state}
      </p>
      {rule ? (
        <p className="font-mono text-xs tracking-wide text-subtle uppercase">
          {rule}
        </p>
      ) : null}
    </div>
  );
}

export function DecisionChip({ state }: { state: TerminalState }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 font-mono text-[11px] tracking-wider uppercase",
        state === "SHIP" && "border-ship/40 text-ship",
        state === "HOLD" && "border-hold/40 text-hold",
        state === "REJECT" && "border-reject/40 text-reject",
      )}
    >
      {state}
    </span>
  );
}
