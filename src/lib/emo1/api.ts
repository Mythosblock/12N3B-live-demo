import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EngineError } from "./errors.ts";
import type { EvaluationRecord, EvaluationSummary, EvidenceClass } from "./types.ts";

const SubmitSchema = z.object({
  text: z.string().min(1).max(8000),
  evidenceClass: z.enum(["synthetic", "static_fixture", "customer_provided", "live_retrieved"]),
  scenarioId: z.string().max(80).nullable().optional(),
});

const IdSchema = z.object({
  requestId: z.string().min(3).max(80),
});

export type RuntimeManifestDTO = {
  runtime_id: string;
  runtime_version: string;
  registry_id: string;
  registry_version: string;
  policy_version: string;
  schema_version: string;
  consensus_version: string;
  artifact_id: string;
  artifact_material_hash: string;
  build_channel: "demonstration";
  protected_paths: string[];
  source_commit: string;
  environment: "demonstration";
};

function asError(err: unknown) {
  if (err instanceof EngineError) return { ok: false as const, error: err.toJSON() };
  return {
    ok: false as const,
    error: {
      code: "UNKNOWN_STATE" as const,
      message: err instanceof Error ? err.message : "Unspecified runtime failure.",
      retryable: false,
      terminal: false,
    },
  };
}

export const getManifest = createServerFn({ method: "GET" }).handler(async () => {
  const { runtimeManifest, ensureSeeded } = await import("./persist.server.ts");
  await ensureSeeded();
  return runtimeManifest();
});

export const submitEvaluation = createServerFn({ method: "POST" })
  .validator((data) => SubmitSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; record: EvaluationRecord } | ReturnType<typeof asError>> => {
    try {
      const { executeAndPersist, ensureSeeded } = await import("./persist.server.ts");
      await ensureSeeded();
      const record = await executeAndPersist({
        text: data.text,
        evidenceClass: data.evidenceClass as EvidenceClass,
        scenarioId: data.scenarioId,
      });
      return { ok: true, record };
    } catch (err) {
      return asError(err);
    }
  });

export const getEvaluation = createServerFn({ method: "POST" })
  .validator((data) => IdSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; record: EvaluationRecord } | ReturnType<typeof asError>> => {
    try {
      const { getRecord, ensureSeeded } = await import("./persist.server.ts");
      await ensureSeeded();
      const record = await getRecord(data.requestId);
      if (!record) throw new EngineError("NOT_FOUND", "No audit record for that request id.");
      return { ok: true, record };
    } catch (err) {
      return asError(err);
    }
  });

export const listEvaluations = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; rows: EvaluationSummary[]; manifest: RuntimeManifestDTO }> => {
    const { listRecords, ensureSeeded, runtimeManifest } = await import("./persist.server.ts");
    await ensureSeeded();
    const rows = await listRecords();
    return { ok: true, rows, manifest: runtimeManifest() };
  },
);

export const verifyEvaluation = createServerFn({ method: "POST" })
  .validator((data) => IdSchema.parse(data))
  .handler(async ({ data }) => {
    const { getRecord, ensureSeeded } = await import("./persist.server.ts");
    const { verifyRecord, runEngine } = await import("./engine.ts");
    await ensureSeeded();
    const record = await getRecord(data.requestId);
    if (!record) return { ok: false as const, error: new EngineError("NOT_FOUND").toJSON() };
    const integrity = verifyRecord(record);
    const replay = runEngine({
      originalText: record.original_input,
      evidenceClass: record.evidence_class,
      scenarioId: record.scenario_id,
      nowIso: record.audit.decided_at,
      prevChainHash: record.audit.prev_chain_hash,
      sourceCommit: "workspace",
    });
    const decisionMatch = replay.decision === record.decision && replay.decision_lineage.rule_id === record.decision_lineage.rule_id;
    return {
      ok: true as const,
      integrity,
      replay: {
        match: decisionMatch,
        stored_decision: record.decision,
        replayed_decision: replay.decision,
        stored_rule: record.decision_lineage.rule_id,
        replayed_rule: replay.decision_lineage.rule_id,
        note: "Replay uses recorded original input and current engine. Evaluator output hashes may differ by timestamp; terminal mapping should match.",
      },
    };
  });

export const exportEvaluation = createServerFn({ method: "POST" })
  .validator((data) => IdSchema.parse(data))
  .handler(async ({ data }) => {
    const { getRecord, ensureSeeded, runtimeManifest } = await import("./persist.server.ts");
    const { verifyRecord } = await import("./engine.ts");
    await ensureSeeded();
    const record = await getRecord(data.requestId);
    if (!record) return { ok: false as const, error: new EngineError("NOT_FOUND").toJSON() };
    return {
      ok: true as const,
      package: {
        export_version: "emo1-export-1.0.0",
        exported_at: new Date().toISOString(),
        manifest: runtimeManifest(),
        integrity: verifyRecord(record),
        record,
        how_to_verify: [
          "Recompute record_hash from request_id, execution_id, original_hash, normalized_hash, decision, rule_id, evaluator output hashes, registry_version, policy_version, artifact_id.",
          "Recompute chain_hash = sha256(prev_chain_hash || emo1-audit-genesis-v1 | record_hash).",
          "Replay original_input through EMO1 $12N3B 1.0.0 and compare terminal state.",
        ],
      },
    };
  });
