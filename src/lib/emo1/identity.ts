export const RUNTIME_ID = "EMO1";
export const RUNTIME_VERSION = "1.0.0";
export const REGISTRY_ID = "$12N3B";
export const REGISTRY_VERSION = "1.0.0";
export const SCHEMA_VERSION = "emo1-api-1.0.0";
export const POLICY_VERSION = "emo1-policy-1.0.0";
export const CONSENSUS_VERSION = "emo1-consensus-1.0.0";
export const THRESHOLD_VERSION = "cnf-threshold-v1";
export const AUDIT_SCHEMA_VERSION = "emo1-audit-1.0.0";
export const BUILD_CHANNEL = "demonstration" as const;
export const TENANT_ID = "demo-public";
export const AUDIT_GENESIS = "emo1-audit-genesis-v1";

export const PROTECTED_PATHS = [
  "src/lib/emo1/registry.ts",
  "src/lib/emo1/evaluators.ts",
  "src/lib/emo1/consensus.ts",
  "src/lib/emo1/policies.ts",
  "src/lib/emo1/engine.ts",
  "src/lib/emo1/transform.ts",
  "src/lib/emo1/identity.ts",
  "src/lib/emo1/persist.server.ts",
] as const;

export function artifactMaterial(): string {
  return [
    RUNTIME_ID,
    RUNTIME_VERSION,
    REGISTRY_ID,
    REGISTRY_VERSION,
    SCHEMA_VERSION,
    POLICY_VERSION,
    CONSENSUS_VERSION,
    THRESHOLD_VERSION,
    AUDIT_SCHEMA_VERSION,
  ].join("|");
}

export type ArtifactIdentity = {
  artifact_id: string;
  runtime_id: typeof RUNTIME_ID;
  runtime_version: typeof RUNTIME_VERSION;
  registry_id: typeof REGISTRY_ID;
  registry_version: typeof REGISTRY_VERSION;
  schema_version: typeof SCHEMA_VERSION;
  policy_version: typeof POLICY_VERSION;
  consensus_version: typeof CONSENSUS_VERSION;
  threshold_version: typeof THRESHOLD_VERSION;
  audit_schema_version: typeof AUDIT_SCHEMA_VERSION;
  build_channel: typeof BUILD_CHANNEL;
  source_commit: string;
  environment: "demonstration";
};
