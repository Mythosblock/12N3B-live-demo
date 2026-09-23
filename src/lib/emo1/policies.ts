import { POLICY_VERSION, THRESHOLD_VERSION } from "./identity.ts";

export const POLICY = {
  version: POLICY_VERSION,
  bank_quorum: 3,
  confidence_threshold: 0.72,
  threshold_version: THRESHOLD_VERSION,
  max_input_chars: 8000,
  evidence_fresh_days: 45,
  ambiguity_hold: 0.45,
  rate_limit_window_ms: 5 * 60 * 1000,
  rate_limit_max: 16,
  veto_evaluators: ["12n3b.ethics.harm", "12n3b.security.injection"] as const,
  prohibited_conditions: [
    "unreviewed production model weights",
    "disable or skip the audit ledger",
    "override or disable safety evaluators",
    "ship without human review when prohibited conditions apply",
  ],
  escalation_conditions: [
    "new customer segment",
    "policy change",
    "production-bound model action",
    "trust-zone expansion",
  ],
  injection_patterns: [
    { id: "inj.ignore-policy", re: /ignore (all )?(previous|prior|the) (instructions|policy|policies)/i, label: "ignore previous policy/instructions" },
    { id: "inj.you-are-now", re: /\byou are now\b/i, label: "role-rewrite ('you are now')" },
    { id: "inj.system-prompt", re: /system prompt/i, label: "system-prompt manipulation" },
    { id: "inj.jailbreak", re: /\bjailbreak\b/i, label: "jailbreak" },
    { id: "inj.override-safety", re: /override (all )?(safety|evaluators?|policy|policies)/i, label: "override safety/evaluators/policy" },
    { id: "inj.disable-controls", re: /disable (the )?(audit|evaluators?|safety)/i, label: "disable audit/evaluators/safety" },
    { id: "inj.skip-review", re: /skip (human )?review/i, label: "skip human review" },
    { id: "inj.set-policy-ver", re: /set policy version/i, label: "policy-version override attempt" },
  ],
} as const;
