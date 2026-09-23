import { CONSENSUS_VERSION, THRESHOLD_VERSION } from "./identity.ts";
import { POLICY } from "./policies.ts";
import { BANK_META } from "./registry.ts";
import type {
  BankId,
  BankResult,
  DecisionLineage,
  EvidenceItem,
  EvaluatorResult,
  StructuredRequest,
  TerminalState,
} from "./types.ts";

export const DECISION_TABLE_ID = CONSENSUS_VERSION;

const BANKS: BankId[] = ["ethics", "security", "evidence"];

function bankResult(bank: BankId, rows: EvaluatorResult[]): BankResult {
  const mine = rows.filter((r) => r.group === bank);
  const pass_count = mine.filter((r) => r.status === "pass").length;
  const hold_count = mine.filter((r) => r.status === "hold").length;
  const fail_count = mine.filter((r) => r.status === "fail" || r.status === "unavailable" || r.status === "timeout" || r.status === "malformed").length;
  let outcome: BankResult["outcome"] = "hold";
  if (fail_count > 0 && pass_count < POLICY.bank_quorum) outcome = fail_count >= 2 ? "fail" : "hold";
  if (pass_count >= POLICY.bank_quorum && fail_count === 0) outcome = "pass";
  if (pass_count >= POLICY.bank_quorum && fail_count > 0) outcome = "hold";
  if (pass_count < POLICY.bank_quorum) outcome = fail_count >= 2 ? "fail" : "hold";
  const notes =
    outcome === "pass"
      ? `${pass_count} of 4 pass; quorum met.`
      : `${pass_count} pass / ${hold_count} hold / ${fail_count} fail; quorum is ${POLICY.bank_quorum} of 4 with zero fails.`;
  return {
    bank_id: bank,
    name: BANK_META[bank].name,
    quorum_required: POLICY.bank_quorum,
    pass_count,
    hold_count,
    fail_count,
    outcome,
    notes,
  };
}

export function decide(opts: {
  evaluators: EvaluatorResult[];
  structured: StructuredRequest;
  evidence: EvidenceItem[];
}): DecisionLineage {
  const { evaluators, structured, evidence } = opts;
  const bank_results = BANKS.map((b) => bankResult(b, evaluators));
  const vetoes = evaluators.filter((e) => e.veto && e.status === "fail").map((e) => e.evaluator_id);
  const minConf = evaluators.reduce((m, e) => Math.min(m, e.confidence), 1);
  const reasons: string[] = [];

  const unavailable = evaluators.filter((e) =>
    e.status === "unavailable" || e.status === "timeout" || e.status === "malformed",
  );

  let terminal: TerminalState = "HOLD";
  let rule_id = "H0";
  let mapping = "Fail-closed default HOLD.";
  let fail_closed = true;

  if (vetoes.includes("12n3b.security.injection")) {
    terminal = "REJECT";
    rule_id = "R2";
    mapping = "Injection veto (SEC.INJECTION FAIL) → REJECT.";
    reasons.push("Instruction-override / injection veto fired.");
    fail_closed = true;
  } else if (vetoes.includes("12n3b.ethics.harm")) {
    terminal = "REJECT";
    rule_id = "R3";
    mapping = "Harm/prohibited veto (ETH.HARM FAIL) → REJECT.";
    reasons.push("Prohibited-condition veto fired.");
    fail_closed = true;
  } else if (evaluators.find((e) => e.evaluator_id === "12n3b.evidence.policy" && e.status === "fail") && structured.features.override_policy) {
    terminal = "REJECT";
    rule_id = "R4";
    mapping = "Policy-override FAIL → REJECT.";
    reasons.push("Untrusted input attempted to change governance logic.");
    fail_closed = true;
  } else if (unavailable.length) {
    terminal = "HOLD";
    rule_id = "H1";
    mapping = "Unavailable, timeout, or malformed evaluator → HOLD. Cannot SHIP.";
    reasons.push(...unavailable.map((e) => `${e.evaluator_id} status ${e.status}.`));
  } else {
    const unmet = bank_results.filter((b) => b.outcome !== "pass");
    const lowConf = evaluators.find((e) => e.evaluator_id === "12n3b.evidence.confidence" && e.status !== "pass");
    const evidenceHold = evaluators.filter((e) =>
      (e.evaluator_id === "12n3b.evidence.sufficiency" || e.evaluator_id === "12n3b.evidence.freshness") &&
      e.status !== "pass",
    );
    const amb = evaluators.find((e) => e.evaluator_id === "12n3b.ethics.ambiguity" && e.status === "hold");
    const esc = evaluators.find((e) => e.evaluator_id === "12n3b.ethics.escalation" && e.status === "hold");

    if (unmet.length) {
      terminal = "HOLD";
      rule_id = "H2";
      mapping = "Bank N-of-B not met → HOLD. All three banks must pass for SHIP.";
      reasons.push(...unmet.map((b) => `${b.name}: ${b.notes}`));
    }
    if (lowConf) {
      terminal = "HOLD";
      if (rule_id === "H2") rule_id = "H2+H3";
      else rule_id = "H3";
      mapping = "Low-confidence cannot silently pass → HOLD.";
      reasons.push(`Confidence below ${POLICY.confidence_threshold} (${THRESHOLD_VERSION}).`);
    }
    if (evidenceHold.length) {
      terminal = "HOLD";
      if (!rule_id.startsWith("H")) rule_id = "H4";
      else if (!rule_id.includes("H4")) rule_id = `${rule_id}+H4`;
      mapping = "Missing, stale, or unverifiable evidence cannot support SHIP → HOLD.";
      reasons.push(...evidenceHold.map((e) => e.findings[0] ?? e.evaluator_id));
    }
    if (amb) {
      terminal = "HOLD";
      if (!String(rule_id).includes("H5")) rule_id = rule_id === "H0" ? "H5" : `${rule_id}+H5`;
      reasons.push("Policy ambiguity cannot silently pass.");
    }
    if (esc) {
      terminal = "HOLD";
      if (!String(rule_id).includes("H6")) rule_id = rule_id === "H0" ? "H6" : `${rule_id}+H6`;
      reasons.push("Escalation / human-review condition fired.");
    }

    const allBanksPass = bank_results.every((b) => b.outcome === "pass");
    const evidenceOk = evidence.some((e) => e.supports_ship && e.validation_status === "validated");
    const confOk = !lowConf;
    if (allBanksPass && evidenceOk && confOk && vetoes.length === 0 && unavailable.length === 0) {
      terminal = "SHIP";
      rule_id = "S1";
      mapping = "All three banks pass, no veto, evidence sufficient and fresh, confidence ≥ threshold → SHIP.";
      reasons.length = 0;
      reasons.push("N-of-B met in ethics, security, and evidence.");
      reasons.push("No veto-capable evaluator failed.");
      reasons.push("Evidence is identified, validated, and within freshness.");
      fail_closed = false;
    } else {
      terminal = "HOLD";
      fail_closed = true;
      if (rule_id === "H0") {
        rule_id = "H7";
        mapping = "Disagreement or incomplete pass set → HOLD.";
      }
    }
  }

  const summary = `${terminal} — ${mapping}`;

  return {
    terminal,
    rule_id,
    summary,
    reasons: reasons.length ? reasons : [mapping],
    fail_closed,
    vetoes,
    bank_results,
    confidence: Number(minConf.toFixed(4)),
    confidence_threshold: POLICY.confidence_threshold,
    threshold_version: THRESHOLD_VERSION,
    mapping,
  };
}
