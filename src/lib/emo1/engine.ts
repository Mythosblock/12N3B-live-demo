import {
  AUDIT_GENESIS,
  AUDIT_SCHEMA_VERSION,
  BUILD_CHANNEL,
  CONSENSUS_VERSION,
  POLICY_VERSION,
  REGISTRY_ID,
  REGISTRY_VERSION,
  RUNTIME_ID,
  RUNTIME_VERSION,
  SCHEMA_VERSION,
  artifactMaterial,
  type ArtifactIdentity,
} from "./identity.ts";
import { canonicalHash, newId, redactSecrets, sha256 } from "./hash.ts";
import { transformRequest, canonicalizeInput } from "./transform.ts";
import { runEvaluators } from "./evaluators.ts";
import { decide } from "./consensus.ts";
import { POLICY } from "./policies.ts";
import { DEFAULT_DISCLOSURE_IDS } from "./disclosures.ts";
import { DEPENDENCY_INVENTORY } from "./inventory.ts";
import { EngineError } from "./errors.ts";
import type {
  EvidenceClass,
  EvidenceItem,
  EvaluationRecord,
  ProviderEvent,
} from "./types.ts";

export function buildArtifact(sourceCommit: string, artifactId: string): ArtifactIdentity {
  return {
    artifact_id: artifactId,
    runtime_id: RUNTIME_ID,
    runtime_version: RUNTIME_VERSION,
    registry_id: REGISTRY_ID,
    registry_version: REGISTRY_VERSION,
    schema_version: SCHEMA_VERSION,
    policy_version: POLICY_VERSION,
    consensus_version: CONSENSUS_VERSION,
    threshold_version: POLICY.threshold_version,
    audit_schema_version: AUDIT_SCHEMA_VERSION,
    build_channel: BUILD_CHANNEL,
    source_commit: sourceCommit,
    environment: "demonstration",
  };
}

export function artifactIdOf(): string {
  return `art_${sha256(artifactMaterial()).slice(0, 16)}`;
}

function evidenceFrom(structured: ReturnType<typeof transformRequest>, nowIso: string): EvidenceItem[] {
  const f = structured.features;
  if (!f.cites_evidence) {
    return [
      {
        id: "evd_none",
        source_identity: "none",
        acquisition_time: nowIso,
        freshness_limit_days: POLICY.evidence_fresh_days,
        validation_status: "missing",
        provenance: "No source identity was extracted from the request.",
        confidence: 0,
        content_hash: sha256("none"),
        classification: structured.evidence_class,
        excerpt: "",
        supports_ship: false,
      },
    ];
  }
  return f.evidence_phrases.map((phrase, i) => {
    const validation =
      f.freshness === "fresh"
        ? "validated"
        : f.freshness === "stale"
          ? "stale"
          : f.freshness === "unknown"
            ? "unverifiable"
            : "unvalidated";
    return {
      id: `evd_${i + 1}`,
      source_identity: phrase,
      acquisition_time: nowIso,
      freshness_limit_days: POLICY.evidence_fresh_days,
      validation_status: validation,
      provenance: "Extracted from submitter text. Not independently retrieved.",
      confidence: validation === "validated" ? 0.82 : 0.35,
      content_hash: sha256(phrase),
      classification: structured.evidence_class,
      excerpt: phrase,
      supports_ship: validation === "validated",
    };
  });
}

function providerEvents(requestId: string, executionId: string): ProviderEvent[] {
  return DEPENDENCY_INVENTORY.filter((d) => d.kind === "model-provider" || d.id === "emo1-local-runtime").map((d) => {
    const local = d.id === "emo1-local-runtime";
    return {
      provider_id: d.id,
      adapter_id: local ? "emo1-engine" : null,
      adapter_version: local ? RUNTIME_VERSION : null,
      request_id: requestId,
      execution_id: executionId,
      started_at: local ? new Date().toISOString() : null,
      ended_at: local ? new Date().toISOString() : null,
      status: local ? "completed" : "ignored",
      participation_mode: d.participation,
      credential_present: false,
      adapter_configured: local,
      integration_available: local,
      invoked: local,
      result_used: local,
      endorsement: false,
      decision_relevant: local,
      response_hash: null,
      timeout: false,
      error: null,
      note: d.note,
    };
  });
}

export function idempotencyKey(normalized: string, evidenceClass: EvidenceClass): string {
  return sha256(`${REGISTRY_VERSION}|${POLICY_VERSION}|${evidenceClass}|${normalized}`);
}

export function recordHashMaterial(record: Omit<EvaluationRecord, "audit"> & { audit?: EvaluationRecord["audit"] }): string {
  return canonicalHash({
    request_id: record.request_id,
    execution_id: record.execution_id,
    original_hash: record.original_hash,
    normalized_hash: record.normalized_hash,
    decision: record.decision,
    rule_id: record.decision_lineage.rule_id,
    evaluator_hashes: record.evaluators.map((e) => e.output_hash),
    registry_version: record.registry_version,
    policy_version: record.policy_version,
    artifact_id: record.artifact_id,
  });
}

export function chainHash(prev: string | null, recordHash: string): string {
  return sha256(`${prev ?? AUDIT_GENESIS}|${recordHash}`);
}

export function runEngine(opts: {
  originalText: string;
  evidenceClass: EvidenceClass;
  scenarioId?: string | null;
  nowIso: string;
  prevChainHash: string | null;
  sourceCommit: string;
}): EvaluationRecord {
  const redacted = redactSecrets(opts.originalText);
  if (redacted.length > POLICY.max_input_chars) {
    throw new EngineError("INPUT_TOO_LARGE", `Maximum length is ${POLICY.max_input_chars} characters.`);
  }
  const normalized = canonicalizeInput(redacted);
  const structured = transformRequest({
    original: redacted,
    evidenceClass: opts.evidenceClass,
    scenarioId: opts.scenarioId,
  });
  const requestId = newId("req");
  const executionId = newId("ex");
  const evidence = evidenceFrom(structured, opts.nowIso);
  const evaluators = runEvaluators(structured, evidence).map((row) => ({
    ...row,
    output_hash: canonicalHash({
      id: row.evaluator_id,
      status: row.status,
      score: row.score,
      findings: row.findings,
      veto: row.veto,
    }),
  }));
  const lineage = decide({ evaluators, structured, evidence });
  if (lineage.terminal !== "SHIP" && lineage.terminal !== "HOLD" && lineage.terminal !== "REJECT") {
    throw new EngineError("UNKNOWN_STATE");
  }
  const art = artifactIdOf();
  const providers = providerEvents(requestId, executionId);
  const original_hash = sha256(redacted);
  const normalized_hash = sha256(normalized);

  const draft: Omit<EvaluationRecord, "audit"> = {
    request_id: requestId,
    execution_id: executionId,
    idempotency_key: idempotencyKey(normalized, opts.evidenceClass),
    artifact_id: art,
    runtime_id: RUNTIME_ID,
    runtime_version: RUNTIME_VERSION,
    registry_id: REGISTRY_ID,
    registry_version: REGISTRY_VERSION,
    policy_version: POLICY_VERSION,
    schema_version: SCHEMA_VERSION,
    consensus_version: CONSENSUS_VERSION,
    original_input: redacted,
    original_hash,
    normalized_input: normalized,
    normalized_hash,
    evidence_class: opts.evidenceClass,
    scenario_id: opts.scenarioId ?? null,
    structured,
    decision: lineage.terminal,
    decision_lineage: lineage,
    evaluators,
    banks: lineage.bank_results,
    evidence,
    providers,
    labels: {
      environment: "demonstration",
      decision_data: "authoritative",
      observer_view: "authoritative",
      replay: "projected",
      evidence_class: opts.evidenceClass,
    },
    disclosures: [...DEFAULT_DISCLOSURE_IDS],
    supersedes: null,
  };

  const record_hash = recordHashMaterial(draft);
  const chain_hash = chainHash(opts.prevChainHash, record_hash);

  return {
    ...draft,
    audit: {
      status: "committed",
      schema_version: AUDIT_SCHEMA_VERSION,
      record_hash,
      chain_hash,
      prev_chain_hash: opts.prevChainHash,
      decided_at: opts.nowIso,
      ingested_at: opts.nowIso,
      integrity: "valid",
    },
  };
}

export function verifyRecord(record: EvaluationRecord): { ok: boolean; expected: string; actual: string } {
  const expected = recordHashMaterial(record);
  return { ok: expected === record.audit.record_hash, expected, actual: record.audit.record_hash };
}

export { buildArtifact as manifestShape };
