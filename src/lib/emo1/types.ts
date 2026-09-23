export type TerminalState = "SHIP" | "HOLD" | "REJECT";

export type EvidenceClass =
  | "synthetic"
  | "static_fixture"
  | "customer_provided"
  | "live_retrieved";

export type EvaluatorType =
  | "atomic"
  | "composite"
  | "policy-based"
  | "model-based"
  | "orchestration";

export type EvaluatorStatus =
  | "pass"
  | "hold"
  | "fail"
  | "unavailable"
  | "timeout"
  | "malformed";

export type BankId = "ethics" | "security" | "evidence";

export type ParticipationMode =
  | "excluded"
  | "informational"
  | "advisory"
  | "voting"
  | "veto-capable";

export type ProviderStatus =
  | "configured"
  | "ignored"
  | "invocation_attempted"
  | "completed"
  | "timed_out"
  | "failed";

export type Freshness = "fresh" | "stale" | "unknown" | "none";

export type DataLabel =
  | "authoritative"
  | "projected"
  | "delayed"
  | "incomplete"
  | "derived"
  | "sampled";

export type StructuredRequest = {
  original_text: string;
  normalized_text: string;
  intent: string;
  action_verbs: string[];
  assets: string[];
  audience: "internal" | "customer" | "public" | "unknown";
  claimed_evidence: string[];
  risk_markers: string[];
  injection_markers: string[];
  prohibited_markers: string[];
  urgency: "routine" | "expedited" | "immediate";
  ambiguity_score: number;
  evidence_class: EvidenceClass;
  scenario_id: string | null;
  features: FeatureSet;
};

export type FeatureSet = {
  injection: boolean;
  injection_hits: string[];
  prohibited: boolean;
  prohibited_hits: string[];
  override_policy: boolean;
  skip_audit: boolean;
  skip_review: boolean;
  unreviewed_weights: boolean;
  production_urgency: boolean;
  new_segment: boolean;
  boundary_change: boolean;
  access_grant: boolean;
  public_audience: boolean;
  internal_audience: boolean;
  documentation: boolean;
  already_released: boolean;
  cites_evidence: boolean;
  evidence_phrases: string[];
  freshness: Freshness;
  ambiguity: number;
  deception: boolean;
  harm_language: boolean;
  isolation_risk: boolean;
  policy_change: boolean;
  inquiry_only: boolean;
};

export type EvaluatorDef = {
  id: string;
  name: string;
  group: BankId;
  type: EvaluatorType;
  version: string;
  execution_location: "local-runtime";
  veto_capable: boolean;
  description: string;
  input_schema: string;
  output_schema: string;
  dependencies: string[];
  execution_semantics: string;
};

export type EvaluatorResult = {
  evaluator_id: string;
  name: string;
  group: BankId;
  type: EvaluatorType;
  version: string;
  status: EvaluatorStatus;
  score: number;
  confidence: number;
  uncertainty: number;
  veto: boolean;
  findings: string[];
  evidence_refs: string[];
  execution_location: "local-runtime";
  duration_ms: number;
  output_hash: string;
  policy_version: string;
};

export type BankResult = {
  bank_id: BankId;
  name: string;
  quorum_required: number;
  pass_count: number;
  hold_count: number;
  fail_count: number;
  outcome: "pass" | "hold" | "fail";
  notes: string;
};

export type DecisionLineage = {
  terminal: TerminalState;
  rule_id: string;
  summary: string;
  reasons: string[];
  fail_closed: boolean;
  vetoes: string[];
  bank_results: BankResult[];
  confidence: number;
  confidence_threshold: number;
  threshold_version: string;
  mapping: string;
};

export type EvidenceItem = {
  id: string;
  source_identity: string;
  acquisition_time: string;
  freshness_limit_days: number;
  validation_status: "validated" | "unvalidated" | "stale" | "missing" | "unverifiable";
  provenance: string;
  confidence: number;
  content_hash: string;
  classification: EvidenceClass;
  excerpt: string;
  supports_ship: boolean;
};

export type ProviderEvent = {
  provider_id: string;
  adapter_id: string | null;
  adapter_version: string | null;
  request_id: string;
  execution_id: string;
  started_at: string | null;
  ended_at: string | null;
  status: ProviderStatus;
  participation_mode: ParticipationMode;
  credential_present: boolean;
  adapter_configured: boolean;
  integration_available: boolean;
  invoked: boolean;
  result_used: boolean;
  endorsement: false;
  decision_relevant: boolean;
  response_hash: string | null;
  timeout: boolean;
  error: string | null;
  note: string;
};

export type AuditBlock = {
  status: "committed";
  schema_version: string;
  record_hash: string;
  chain_hash: string;
  prev_chain_hash: string | null;
  decided_at: string;
  ingested_at: string;
  integrity: "valid" | "mismatch";
};

export type EvaluationRecord = {
  request_id: string;
  execution_id: string;
  idempotency_key: string;
  artifact_id: string;
  runtime_id: string;
  runtime_version: string;
  registry_id: string;
  registry_version: string;
  policy_version: string;
  schema_version: string;
  consensus_version: string;
  original_input: string;
  original_hash: string;
  normalized_input: string;
  normalized_hash: string;
  evidence_class: EvidenceClass;
  scenario_id: string | null;
  structured: StructuredRequest;
  decision: TerminalState;
  decision_lineage: DecisionLineage;
  evaluators: EvaluatorResult[];
  banks: BankResult[];
  evidence: EvidenceItem[];
  providers: ProviderEvent[];
  audit: AuditBlock;
  labels: {
    environment: "demonstration";
    decision_data: "authoritative";
    observer_view: "authoritative";
    replay: "projected";
    evidence_class: EvidenceClass;
  };
  disclosures: string[];
  supersedes: string | null;
};

export type EvaluationSummary = {
  request_id: string;
  decision: TerminalState;
  original_input: string;
  evidence_class: EvidenceClass;
  decided_at: string;
  record_hash: string;
  chain_hash: string;
  rule_id: string;
  runtime_version: string;
  registry_version: string;
};

export type EngineErrorCode =
  | "INVALID_INPUT"
  | "INPUT_TOO_LARGE"
  | "RATE_LIMITED"
  | "AUDIT_PERSISTENCE_FAILURE"
  | "NOT_FOUND"
  | "UNKNOWN_STATE";
