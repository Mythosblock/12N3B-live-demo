import { getSql } from "@/lib/db";
import { canonicalizeInput } from "./transform.ts";
import { redactSecrets } from "./hash.ts";
import { artifactIdOf, idempotencyKey, runEngine } from "./engine.ts";
import { EngineError } from "./errors.ts";
import { POLICY } from "./policies.ts";
import { SCENARIOS } from "./scenarios.ts";
import { sha256 } from "./hash.ts";
import {
  CONSENSUS_VERSION,
  POLICY_VERSION,
  PROTECTED_PATHS,
  REGISTRY_ID,
  REGISTRY_VERSION,
  RUNTIME_ID,
  RUNTIME_VERSION,
  SCHEMA_VERSION,
  artifactMaterial,
} from "./identity.ts";
import type { EvaluationRecord, EvaluationSummary, EvidenceClass } from "./types.ts";

type EvalRow = {
  request_id: string;
  execution_id: string;
  idempotency_key: string;
  record_json: string;
  decision: string;
  original_input: string;
  evidence_class: string;
  decided_at: string;
  record_hash: string;
  chain_hash: string;
  runtime_version: string;
  registry_version: string;
  rule_id: string;
};

function asIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function parseRecord(json: string): EvaluationRecord {
  return JSON.parse(json) as EvaluationRecord;
}


export async function previousChainHash(): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ chain_hash: string }>`
    select chain_hash from evaluations order by decided_at desc, request_id desc limit 1
  `;
  return rows[0]?.chain_hash ?? null;
}

export async function findByIdempotency(key: string): Promise<EvaluationRecord | null> {
  const sql = await getSql();
  const rows = await sql<EvalRow>`
    select record_json from evaluations where idempotency_key = ${key} limit 1
  `;
  if (!rows[0]) return null;
  return parseRecord(rows[0].record_json);
}

export async function insertRecord(record: EvaluationRecord): Promise<void> {
  const sql = await getSql();
  try {
    await sql`
      insert into evaluations (
        request_id, execution_id, idempotency_key, original_input, original_hash,
        normalized_input, normalized_hash, evidence_class, decision, rule_id,
        record_json, artifact_id, runtime_version, registry_version, policy_version,
        schema_version, record_hash, chain_hash, prev_chain_hash, decided_at
      ) values (
        ${record.request_id},
        ${record.execution_id},
        ${record.idempotency_key},
        ${record.original_input},
        ${record.original_hash},
        ${record.normalized_input},
        ${record.normalized_hash},
        ${record.evidence_class},
        ${record.decision},
        ${record.decision_lineage.rule_id},
        ${JSON.stringify(record)},
        ${record.artifact_id},
        ${record.runtime_version},
        ${record.registry_version},
        ${record.policy_version},
        ${record.schema_version},
        ${record.audit.record_hash},
        ${record.audit.chain_hash},
        ${record.audit.prev_chain_hash},
        ${record.audit.decided_at}
      )
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      const existing = await findByIdempotency(record.idempotency_key);
      if (existing) return;
    }
    throw new EngineError("AUDIT_PERSISTENCE_FAILURE", "Audit write failed. No decision was published.");
  }
}

export async function getRecord(requestId: string): Promise<EvaluationRecord | null> {
  const sql = await getSql();
  const rows = await sql<EvalRow>`
    select record_json from evaluations where request_id = ${requestId} limit 1
  `;
  if (!rows[0]) return null;
  return parseRecord(rows[0].record_json);
}

export async function listRecords(limit = 40): Promise<EvaluationSummary[]> {
  const sql = await getSql();
  const rows = await sql<EvalRow>`
    select request_id, decision, original_input, evidence_class, decided_at,
           record_hash, chain_hash, runtime_version, registry_version, rule_id
    from evaluations
    order by decided_at desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    request_id: r.request_id,
    decision: r.decision as EvaluationSummary["decision"],
    original_input: r.original_input,
    evidence_class: r.evidence_class as EvaluationSummary["evidence_class"],
    decided_at: asIso(r.decided_at),
    record_hash: r.record_hash,
    chain_hash: r.chain_hash,
    rule_id: r.rule_id,
    runtime_version: r.runtime_version,
    registry_version: r.registry_version,
  }));
}

const buckets = new Map<string, number[]>();

export function takeRateToken(key = "demo-public"): boolean {
  const now = Date.now();
  const windowMs = POLICY.rate_limit_window_ms;
  const prev = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= POLICY.rate_limit_max) {
    buckets.set(key, prev);
    return false;
  }
  prev.push(now);
  buckets.set(key, prev);
  return true;
}

export async function executeAndPersist(input: {
  text: string;
  evidenceClass: EvidenceClass;
  scenarioId?: string | null;
}): Promise<EvaluationRecord> {
  if (!takeRateToken()) {
    throw new EngineError("RATE_LIMITED", "Demonstration rate limit reached. Try again in a few minutes.");
  }
  const normalized = canonicalizeInput(redactSecrets(input.text));
  const key = idempotencyKey(normalized, input.evidenceClass);
  const existing = await findByIdempotency(key);
  if (existing) return existing;

  const prev = await previousChainHash();
  const record = runEngine({
    originalText: input.text,
    evidenceClass: input.evidenceClass,
    scenarioId: input.scenarioId,
    nowIso: new Date().toISOString(),
    prevChainHash: prev,
    sourceCommit: "workspace",
  });
  await insertRecord(record);
  const written = await getRecord(record.request_id);
  if (!written) {
    throw new EngineError("AUDIT_PERSISTENCE_FAILURE", "Audit write did not read back. Decision withheld.");
  }
  return written;
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::int as n from evaluations`;
    if ((rows[0]?.n ?? 0) > 0) return;
    for (const s of SCENARIOS) {
      const prev = await previousChainHash();
      const record = runEngine({
        originalText: s.text,
        evidenceClass: s.evidence_class,
        scenarioId: s.id,
        nowIso: new Date().toISOString(),
        prevChainHash: prev,
        sourceCommit: "workspace",
      });
      await insertRecord(record);
    }
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

export function runtimeManifest() {
  return {
    runtime_id: RUNTIME_ID,
    runtime_version: RUNTIME_VERSION,
    registry_id: REGISTRY_ID,
    registry_version: REGISTRY_VERSION,
    policy_version: POLICY_VERSION,
    schema_version: SCHEMA_VERSION,
    consensus_version: CONSENSUS_VERSION,
    artifact_id: artifactIdOf(),
    artifact_material_hash: sha256(artifactMaterial()),
    build_channel: "demonstration" as const,
    protected_paths: [...PROTECTED_PATHS],
    source_commit: "workspace",
    environment: "demonstration" as const,
  };
}
