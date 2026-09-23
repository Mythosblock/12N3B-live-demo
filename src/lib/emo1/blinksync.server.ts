/**
 * BLINKSYNC adapter / facade layer.
 *
 * Exposes the existing EMO1 engine (three banks — ethics / security / evidence,
 * 12 evaluators) through the BLINKSYNC three-brain interface contract WITHOUT
 * refactoring the core engine. Banks are the functional evaluation logic;
 * brains are a cognitive-routing view over the same authoritative output.
 *
 *   Deterministic brain  <- Security bank   (boolean pass/fail, hard-reject gate)
 *   Probabilistic brain  <- Evidence bank   (confidence score vs threshold)
 *   Semantic brain       <- Ethics bank     (intent / policy alignment)
 *
 * `executionState` is the engine's real terminal decision (SHIP | HOLD |
 * REJECT), not a re-derivation — the facade must never diverge from the audited
 * verdict. The three-brain block is a partitioned view of the same result.
 */
import { runEngine } from "./engine.ts";
import { EngineError } from "./errors.ts";
import type { BankResult, EvaluationRecord, EvidenceClass, TerminalState } from "./types.ts";

export type DeterministicBrain = {
  source: "security";
  state: "PASS" | "FAIL";
  passed: boolean;
  vetoes: string[];
  details: BankResult | null;
};

export type ProbabilisticBrain = {
  source: "evidence";
  state: "HIGH_CONFIDENCE" | "LOW_CONFIDENCE";
  score: number;
  threshold: number;
  details: BankResult | null;
};

export type SemanticBrain = {
  source: "ethics";
  state: "ALIGNED" | "MISALIGNED";
  aligned: boolean;
  details: BankResult | null;
};

export type BlinksyncResponse = {
  ok: true;
  executionState: TerminalState;
  requestId: string;
  timestamp: string;
  brains: {
    deterministic: DeterministicBrain;
    probabilistic: ProbabilisticBrain;
    semantic: SemanticBrain;
  };
  lineage: {
    rule_id: string;
    summary: string;
    reasons: string[];
    fail_closed: boolean;
  };
  audit: {
    record_hash: string;
    chain_hash: string;
    schema_version: string;
  };
};

export type EvaluateInput = {
  text: string;
  evidenceClass?: EvidenceClass;
  scenarioId?: string | null;
};

const VALID_EVIDENCE: EvidenceClass[] = ["synthetic", "static_fixture", "customer_provided", "live_retrieved"];

function bankOf(record: EvaluationRecord, id: BankResult["bank_id"]): BankResult | null {
  return record.banks.find((b) => b.bank_id === id) ?? null;
}

export function mapRecordToBrains(record: EvaluationRecord): BlinksyncResponse {
  const lineage = record.decision_lineage;
  const security = bankOf(record, "security");
  const evidence = bankOf(record, "evidence");
  const ethics = bankOf(record, "ethics");

  const deterministicPassed = security?.outcome === "pass";
  const score = lineage.confidence;
  const threshold = lineage.confidence_threshold;
  const semanticAligned = ethics?.outcome === "pass";

  return {
    ok: true,
    executionState: record.decision,
    requestId: record.request_id,
    timestamp: record.audit.decided_at,
    brains: {
      deterministic: {
        source: "security",
        state: deterministicPassed ? "PASS" : "FAIL",
        passed: deterministicPassed,
        vetoes: lineage.vetoes,
        details: security,
      },
      probabilistic: {
        source: "evidence",
        state: score >= threshold ? "HIGH_CONFIDENCE" : "LOW_CONFIDENCE",
        score,
        threshold,
        details: evidence,
      },
      semantic: {
        source: "ethics",
        state: semanticAligned ? "ALIGNED" : "MISALIGNED",
        aligned: semanticAligned,
        details: ethics,
      },
    },
    lineage: {
      rule_id: lineage.rule_id,
      summary: lineage.summary,
      reasons: lineage.reasons,
      fail_closed: lineage.fail_closed,
    },
    audit: {
      record_hash: record.audit.record_hash,
      chain_hash: record.audit.chain_hash,
      schema_version: record.audit.schema_version,
    },
  };
}

/**
 * Stateless evaluation facade: runs the core engine and returns the three-brain
 * view. Does not persist — the adapter is a read-through interface over the
 * deterministic engine, so identical input yields an identical verdict.
 */
export function evaluateToBrains(input: EvaluateInput): BlinksyncResponse {
  if (typeof input?.text !== "string" || input.text.trim().length === 0) {
    throw new EngineError("INVALID_INPUT", "Field 'text' is required and must be a non-empty string.");
  }
  const evidenceClass: EvidenceClass =
    input.evidenceClass && VALID_EVIDENCE.includes(input.evidenceClass) ? input.evidenceClass : "synthetic";

  const record = runEngine({
    originalText: input.text,
    evidenceClass,
    scenarioId: input.scenarioId ?? null,
    nowIso: new Date().toISOString(),
    prevChainHash: null,
    sourceCommit: "blinksync-adapter",
  });

  return mapRecordToBrains(record);
}
