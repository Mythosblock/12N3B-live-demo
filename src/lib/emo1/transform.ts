import { POLICY } from "./policies.ts";
import type { EvidenceClass, FeatureSet, Freshness, StructuredRequest } from "./types.ts";

const VERB_RE =
  /\b(publish|release|ship|deploy|expand|allow|deny|override|skip|disable|grant|revoke|open|close|consider|cite|document)\b/gi;

const ASSET_RE =
  /\b(changelog|api|model(?:\s+weights)?|weights|evaluator(?:s)?|policy|audit|production|customer(?:\s+segment)?|release notes|prompt|runtime|ledger)\b/gi;

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map((s) => s.toLowerCase()))];
}

function hits(
  text: string,
  patterns: readonly { id: string; re: RegExp; label: string }[],
): { ids: string[]; labels: string[] } {
  const ids: string[] = [];
  const labels: string[] = [];
  for (const p of patterns) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) {
      ids.push(p.id);
      labels.push(p.label);
    }
  }
  return { ids, labels };
}

function freshnessOf(text: string, cites: boolean): Freshness {
  if (!cites) return "none";
  if (/\b(last|past)\s+\d+\s+days?\b/i.test(text) || /\b(this (week|month)|today|yesterday|last week)\b/i.test(text)) {
    const m = text.match(/\b(?:last|past)\s+(\d+)\s+days?\b/i);
    if (m) {
      const n = Number(m[1]);
      if (n > POLICY.evidence_fresh_days) return "stale";
    }
    return "fresh";
  }
  if (/\b(last quarter|last year|historical|years ago)\b/i.test(text)) return "stale";
  return "unknown";
}

function intentOf(text: string, f: FeatureSet): string {
  if (f.injection || f.override_policy) return "override";
  if (/\b(publish|release|changelog)\b/i.test(text) && f.documentation) return "release";
  if (/\bdeploy|ship\b/i.test(text)) return "deployment";
  if (f.new_segment || /\bexpand\b/i.test(text)) return "access";
  if (f.policy_change) return "policy_change";
  if (/\b(should we|consider|what if)\b/i.test(text)) return "inquiry";
  return "unknown";
}

export function canonicalizeInput(raw: string): string {
  return raw.replace(/\u0000/g, "").normalize("NFC").replace(/\s+/g, " ").trim();
}

export function extractFeatures(text: string): FeatureSet {
  const inj = hits(text, POLICY.injection_patterns);
  const evidencePhrases = [
    ...text.matchAll(/\b(?:citing|cited|based on|according to|documented in)\s+([^,.]+)/gi),
  ].map((m) => m[0].trim());
  const cites = evidencePhrases.length > 0 || /\bsigned release notes\b/i.test(text);
  if (cites && evidencePhrases.length === 0) evidencePhrases.push("signed release notes");

  let ambiguity = 0;
  if (/\b(consider|maybe|unclear|incomplete|limited|what if)\b/i.test(text)) ambiguity += 0.28;
  if (/\bnew customer segment\b/i.test(text)) ambiguity += 0.2;
  if (/\bpolicy fit is unclear\b/i.test(text)) ambiguity += 0.22;
  if (inj.ids.length) ambiguity += 0.15;
  ambiguity = Math.min(1, ambiguity);

  const prohibitedHits: string[] = [];
  if (/\bunreviewed (model )?weights\b/i.test(text)) prohibitedHits.push("unreviewed production model weights");
  if (/\baudit disabled\b/i.test(text) || /\bno audit\b/i.test(text) || /\bdisable (the )?audit\b/i.test(text)) {
    prohibitedHits.push("disable or skip the audit ledger");
  }
  if (/\boverride (all )?(safety|evaluators?)\b/i.test(text)) {
    prohibitedHits.push("override or disable safety evaluators");
  }
  if (/\bno human review\b/i.test(text) || /\bskip (human )?review\b/i.test(text)) {
    prohibitedHits.push("ship without human review when prohibited conditions apply");
  }

  const productionUrgency = /\b(production|prod)\b/i.test(text) && /\b(tonight|immediately|asap|now)\b/i.test(text);

  return {
    injection: inj.ids.length > 0,
    injection_hits: inj.labels,
    prohibited: prohibitedHits.length > 0,
    prohibited_hits: prohibitedHits,
    override_policy: /\boverride\b/i.test(text) && /\b(policy|evaluators?|safety)\b/i.test(text),
    skip_audit: /\b(disable|skip).{0,24}audit|audit disabled|no audit\b/i.test(text),
    skip_review: /\b(skip|no) (human )?review\b/i.test(text),
    unreviewed_weights: /\bunreviewed (model )?weights\b/i.test(text),
    production_urgency: productionUrgency,
    new_segment: /\bnew customer segment\b/i.test(text),
    boundary_change:
      /\b(production|trust[- ]zone|expand(?:ing)? the evaluation api)\b/i.test(text) &&
      !/\balready-released\b/i.test(text),
    access_grant: /\b(grant|open access|unrestricted)\b/i.test(text),
    public_audience: /\bpublic\b/i.test(text) && !/\binternal\b/i.test(text),
    internal_audience: /\binternal\b/i.test(text),
    documentation: /\b(changelog|release notes|document(?:ing|ation)?)\b/i.test(text),
    already_released: /\balready-released\b/i.test(text),
    cites_evidence: cites,
    evidence_phrases: uniq(evidencePhrases),
    freshness: freshnessOf(text, cites),
    ambiguity,
    deception: /\b(hidden|secret deploy|cover up|mislead)\b/i.test(text),
    harm_language: /\b(harm|exploit|weapon|surveil(?:l)? without)\b/i.test(text),
    isolation_risk: /\b(cross-tenant|unrestricted access|disable isolation)\b/i.test(text),
    policy_change: /\b(policy change|change the policy|set policy version)\b/i.test(text),
    inquiry_only: /\b(should we|consider)\b/i.test(text) && !/\b(ship|deploy|publish)\b/i.test(text),
  };
}

export function transformRequest(opts: {
  original: string;
  evidenceClass: EvidenceClass;
  scenarioId?: string | null;
}): StructuredRequest {
  const normalized = canonicalizeInput(opts.original);
  const features = extractFeatures(normalized);
  const verbs = uniq(normalized.match(VERB_RE) ?? []);
  const assets = uniq(normalized.match(ASSET_RE) ?? []);
  const audience = features.internal_audience
    ? "internal"
    : features.public_audience
      ? "public"
      : /\bcustomer\b/i.test(normalized)
        ? "customer"
        : "unknown";

  let urgency: StructuredRequest["urgency"] = "routine";
  if (features.production_urgency || /\btonight|immediately|asap\b/i.test(normalized)) urgency = "immediate";
  else if (/\bexpedite|urgent\b/i.test(normalized)) urgency = "expedited";

  return {
    original_text: opts.original,
    normalized_text: normalized,
    intent: intentOf(normalized, features),
    action_verbs: verbs,
    assets,
    audience,
    claimed_evidence: features.evidence_phrases,
    risk_markers: [
      ...features.injection_hits,
      ...features.prohibited_hits,
      ...(features.new_segment ? ["new customer segment"] : []),
      ...(features.boundary_change ? ["boundary change"] : []),
    ],
    injection_markers: features.injection_hits,
    prohibited_markers: features.prohibited_hits,
    urgency,
    ambiguity_score: features.ambiguity,
    evidence_class: opts.evidenceClass,
    scenario_id: opts.scenarioId ?? null,
    features,
  };
}
