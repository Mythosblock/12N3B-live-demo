export const ARCHITECTURAL_CLAIMS = [
  {
    id: "C1",
    claim: "The EMO1 runtime exists and is the evaluator host.",
    evidence: "src/lib/emo1/engine.ts emits runtime_id EMO1 and runtime_version on every record.",
    status: "implemented",
  },
  {
    id: "C2",
    claim: "The $12N3B evaluator registry exists: 12 evaluators, 3 banks, N-of-B quorum.",
    evidence: "src/lib/emo1/registry.ts. Runtime responses include registry_id $12N3B and per-evaluator IDs.",
    status: "implemented",
  },
  {
    id: "C3",
    claim: "The customer API invokes the claimed runtime — not a mock decision table in the UI.",
    evidence: "src/lib/emo1/api.ts createServerFn handlers call engine + durable persist. UI only renders returned records.",
    status: "implemented",
  },
  {
    id: "C4",
    claim: "The runtime produces an auditable terminal decision: SHIP, HOLD, or REJECT.",
    evidence: "consensus.ts decision table; persist.server.ts transactional write; no terminal response without committed audit.",
    status: "implemented",
  },
  {
    id: "C5",
    claim: "The observer displays authoritative ledger data, with projected replay explicitly labeled.",
    evidence: "Observer reads evaluations table. Replay animation labeled projected. Integrity verification recomputes hashes.",
    status: "implemented",
  },
  {
    id: "C6",
    claim: "Untrusted input cannot alter policy, evaluator instructions, consensus logic, or audit metadata.",
    evidence: "Injection evaluator veto; policy version is server constant; original text stored as data only.",
    status: "implemented",
  },
  {
    id: "C7",
    claim: "Provider participation is attributable and is not endorsement.",
    evidence: "inventory.ts + per-request provider events. Excluded providers have invoked=false, endorsement=false.",
    status: "implemented",
  },
  {
    id: "C8",
    claim: "Immutable-core paths are named and detectable.",
    evidence: "identity.ts PROTECTED_PATHS; scripts/emo1-baseline.mjs reports them on every baseline run.",
    status: "implemented",
  },
] as const;
