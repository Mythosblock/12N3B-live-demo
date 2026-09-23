import { POLICY_VERSION } from "./identity.ts";
import { POLICY } from "./policies.ts";
import { EVALUATORS, evaluatorById } from "./registry.ts";
import type { EvidenceItem, EvaluatorResult, EvaluatorStatus, StructuredRequest } from "./types.ts";

function result(
  id: string,
  status: EvaluatorStatus,
  score: number,
  confidence: number,
  findings: string[],
  extra?: Partial<Pick<EvaluatorResult, "veto" | "evidence_refs" | "uncertainty">>,
): EvaluatorResult {
  const def = evaluatorById(id);
  if (!def) throw new Error(`unknown evaluator ${id}`);
  const clamped = Math.max(0, Math.min(1, score));
  return {
    evaluator_id: def.id,
    name: def.name,
    group: def.group,
    type: def.type,
    version: def.version,
    status,
    score: clamped,
    confidence: Math.max(0, Math.min(1, confidence)),
    uncertainty: extra?.uncertainty ?? Math.max(0, Math.min(1, 1 - confidence)),
    veto: extra?.veto ?? false,
    findings,
    evidence_refs: extra?.evidence_refs ?? [],
    execution_location: "local-runtime",
    duration_ms: 0,
    output_hash: "",
    policy_version: POLICY_VERSION,
  };
}

function semantic(s: StructuredRequest): EvaluatorResult {
  const f = s.features;
  if (f.deception || f.harm_language) {
    return result("12n3b.ethics.semantic", "fail", 0.12, 0.86, [
      f.deception ? "Deceptive or hidden-action language is present." : "Harm-coded language is present.",
      "Ethics policy does not allow a silent pass on this class of request.",
    ]);
  }
  if (f.injection) {
    return result("12n3b.ethics.semantic", "hold", 0.28, 0.8, [
      "Instruction-like override language is treated as untrusted content, not as a policy change.",
      `Markers: ${f.injection_hits.join("; ")}.`,
    ]);
  }
  if (s.audience === "public" && (f.boundary_change || f.unreviewed_weights)) {
    return result("12n3b.ethics.semantic", "hold", 0.4, 0.7, [
      "Public-audience high-impact action without a completed ethics review.",
    ]);
  }
  if (f.documentation && f.already_released && f.internal_audience) {
    return result("12n3b.ethics.semantic", "pass", 0.91, 0.88, [
      "Routine internal documentation of already-released features. No deception or audience-sensitive harm markers.",
    ]);
  }
  return result("12n3b.ethics.semantic", "pass", 0.78, 0.74, [
    "No deception or prohibited harm language detected in the structured request.",
  ]);
}

function harm(s: StructuredRequest): EvaluatorResult {
  const f = s.features;
  if (f.prohibited || f.unreviewed_weights || (f.skip_audit && f.production_urgency)) {
    return result(
      "12n3b.ethics.harm",
      "fail",
      0.02,
      0.95,
      [
        "Prohibited condition matched.",
        ...f.prohibited_hits.map((h) => `Policy hit: ${h}.`),
        "This evaluator is veto-capable. A FAIL here cannot be outvoted.",
      ],
      { veto: true },
    );
  }
  return result("12n3b.ethics.harm", "pass", 0.93, 0.9, ["No prohibited-condition hits."]);
}

function escalation(s: StructuredRequest): EvaluatorResult {
  const f = s.features;
  const reasons: string[] = [];
  if (f.new_segment) reasons.push("New customer segment requires human review.");
  if (f.policy_change) reasons.push("Policy-change intent requires review.");
  if (f.unreviewed_weights || (f.boundary_change && f.production_urgency)) {
    reasons.push("Production-bound model or boundary action requires review.");
  }
  if (f.skip_review) reasons.push("Request attempts to skip human review.");
  if (reasons.length) {
    return result("12n3b.ethics.escalation", "hold", 0.34, 0.82, reasons);
  }
  return result("12n3b.ethics.escalation", "pass", 0.86, 0.84, [
    "No escalation condition fired. Routine path may proceed without additional review.",
  ]);
}

function ambiguity(s: StructuredRequest): EvaluatorResult {
  if (s.ambiguity_score > POLICY.ambiguity_hold) {
    return result("12n3b.ethics.ambiguity", "hold", 0.38, 0.8, [
      `Ambiguity score ${s.ambiguity_score.toFixed(2)} exceeds ${POLICY.ambiguity_hold}.`,
      "Policy-ambiguous results cannot silently pass.",
    ]);
  }
  return result("12n3b.ethics.ambiguity", "pass", 0.84, 0.83, [
    `Ambiguity score ${s.ambiguity_score.toFixed(2)} is within the pass band.`,
  ]);
}

function boundary(s: StructuredRequest): EvaluatorResult {
  const f = s.features;
  if (f.unreviewed_weights && f.production_urgency) {
    return result("12n3b.security.boundary", "fail", 0.08, 0.93, [
      "Unreviewed weights crossing into production is a boundary FAIL.",
    ]);
  }
  if (f.new_segment || (f.boundary_change && !f.already_released && !f.documentation)) {
    return result("12n3b.security.boundary", "hold", 0.42, 0.78, [
      "Trust-zone or API-surface expansion without a completed boundary review.",
    ]);
  }
  return result("12n3b.security.boundary", "pass", 0.88, 0.85, ["No security-boundary movement detected."]);
}

function injection(s: StructuredRequest): EvaluatorResult {
  const f = s.features;
  if (f.injection) {
    return result(
      "12n3b.security.injection",
      "fail",
      0.0,
      0.97,
      [
        "Untrusted input contains instruction-like override language.",
        ...f.injection_hits.map((h) => `Pattern: ${h}.`),
        "This is scored as an attack on the control plane, not as a configuration change.",
        "Original wording is retained as data. Policy version is unchanged.",
      ],
      { veto: true },
    );
  }
  return result("12n3b.security.injection", "pass", 0.96, 0.94, [
    "No injection or evaluator-instruction manipulation markers.",
  ]);
}

function provenance(s: StructuredRequest, evidence: EvidenceItem[]): EvaluatorResult {
  const usable = evidence.filter((e) => e.validation_status === "validated");
  if (!s.features.cites_evidence || usable.length === 0) {
    return result("12n3b.security.provenance", "hold", 0.3, 0.8, [
      "Material claims are not backed by attributable, validated sources.",
      "Unsupported claims cannot silently support SHIP.",
    ]);
  }
  return result(
    "12n3b.security.provenance",
    "pass",
    0.87,
    0.84,
    [`${usable.length} validated evidence item(s) with source identity.`],
    { evidence_refs: usable.map((e) => e.id) },
  );
}

function isolation(s: StructuredRequest): EvaluatorResult {
  if (s.features.isolation_risk || s.features.access_grant) {
    return result("12n3b.security.isolation", "hold", 0.33, 0.81, [
      "Isolation-weakening or unrestricted-access language is present.",
    ]);
  }
  return result("12n3b.security.isolation", "pass", 0.9, 0.86, ["No isolation or cross-tenant weakening language."]);
}

function sufficiency(s: StructuredRequest, evidence: EvidenceItem[]): EvaluatorResult {
  const usable = evidence.filter((e) => e.supports_ship && e.validation_status === "validated");
  if (usable.length === 0) {
    return result("12n3b.evidence.sufficiency", "hold", 0.22, 0.86, [
      "No validated evidence item is sufficient to support SHIP.",
      "Missing evidence is fail-closed.",
    ]);
  }
  return result(
    "12n3b.evidence.sufficiency",
    "pass",
    0.86,
    0.85,
    [`Sufficient evidence: ${usable.map((e) => e.source_identity).join(", ")}.`],
    { evidence_refs: usable.map((e) => e.id) },
  );
}

function freshness(s: StructuredRequest, evidence: EvidenceItem[]): EvaluatorResult {
  if (s.features.freshness === "none" || evidence.length === 0) {
    return result("12n3b.evidence.freshness", "hold", 0.24, 0.84, [
      "No dated evidence source. Freshness cannot be established.",
    ]);
  }
  if (s.features.freshness === "stale" || evidence.some((e) => e.validation_status === "stale")) {
    return result("12n3b.evidence.freshness", "hold", 0.31, 0.83, [
      `Evidence is outside the ${POLICY.evidence_fresh_days}-day freshness window.`,
      "Stale evidence cannot silently support SHIP.",
    ]);
  }
  if (s.features.freshness === "unknown" || evidence.some((e) => e.validation_status === "unverifiable")) {
    return result("12n3b.evidence.freshness", "hold", 0.4, 0.76, [
      "Evidence source time is unverifiable.",
    ]);
  }
  return result("12n3b.evidence.freshness", "pass", 0.89, 0.86, [
    `Evidence is within the ${POLICY.evidence_fresh_days}-day freshness window.`,
  ]);
}

function confidence(s: StructuredRequest, evidence: EvidenceItem[]): EvaluatorResult {
  const f = s.features;
  let score = 0.62;
  if (f.cites_evidence) score += 0.14;
  if (f.freshness === "fresh") score += 0.1;
  if (f.internal_audience) score += 0.04;
  if (f.documentation && f.already_released) score += 0.08;
  if (f.ambiguity > 0.2) score -= f.ambiguity * 0.35;
  if (f.injection) score -= 0.35;
  if (f.prohibited) score -= 0.4;
  if (evidence.every((e) => e.validation_status !== "validated")) score -= 0.18;
  score = Math.max(0.02, Math.min(0.98, score));
  const conf = Math.max(0.55, Math.min(0.96, 0.7 + (f.cites_evidence ? 0.1 : 0) - f.ambiguity * 0.2));
  if (score < POLICY.confidence_threshold) {
    return result("12n3b.evidence.confidence", "hold", score, conf, [
      `Calibrated score ${score.toFixed(2)} is below ${POLICY.threshold_version} threshold ${POLICY.confidence_threshold}.`,
      "Low-confidence results cannot silently pass.",
    ]);
  }
  return result("12n3b.evidence.confidence", "pass", score, conf, [
    `Calibrated score ${score.toFixed(2)} meets ${POLICY.threshold_version}.`,
  ]);
}

function policyConformance(s: StructuredRequest): EvaluatorResult {
  const f = s.features;
  if (f.override_policy || f.policy_change || f.injection_hits.some((h) => h.includes("policy"))) {
    return result("12n3b.evidence.policy", "fail", 0.05, 0.94, [
      "Request attempts to alter policy, evaluator instructions, or consensus logic.",
      `Authoritative policy version remains ${POLICY_VERSION}. User text is not a control channel.`,
    ]);
  }
  return result("12n3b.evidence.policy", "pass", 0.92, 0.9, [
    `Policy version ${POLICY_VERSION} is server-side and unchanged by this request.`,
  ]);
}

const RUNNERS: Record<string, (s: StructuredRequest, e: EvidenceItem[]) => EvaluatorResult> = {
  "12n3b.ethics.semantic": (s) => semantic(s),
  "12n3b.ethics.harm": (s) => harm(s),
  "12n3b.ethics.escalation": (s) => escalation(s),
  "12n3b.ethics.ambiguity": (s) => ambiguity(s),
  "12n3b.security.boundary": (s) => boundary(s),
  "12n3b.security.injection": (s) => injection(s),
  "12n3b.security.provenance": (s, e) => provenance(s, e),
  "12n3b.security.isolation": (s) => isolation(s),
  "12n3b.evidence.sufficiency": (s, e) => sufficiency(s, e),
  "12n3b.evidence.freshness": (s, e) => freshness(s, e),
  "12n3b.evidence.confidence": (s, e) => confidence(s, e),
  "12n3b.evidence.policy": (s) => policyConformance(s),
};

export function runEvaluators(s: StructuredRequest, evidence: EvidenceItem[]): EvaluatorResult[] {
  return EVALUATORS.map((def) => {
    const started = Date.now();
    const runner = RUNNERS[def.id];
    if (!runner) {
      return result(def.id, "unavailable", 0, 0, ["Evaluator runner is not registered. Fail-closed."]);
    }
    const out = runner(s, evidence);
    out.duration_ms = Math.max(0, Date.now() - started);
    return out;
  });
}
