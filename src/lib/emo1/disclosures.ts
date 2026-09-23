export const DISCLOSURES = [
  {
    id: "d-demo",
    title: "Demonstration environment",
    body: "This instance is a demonstration of the EMO1 runtime and $12N3B registry. It is not a production deployment and is not approved for operational decisions.",
  },
  {
    id: "d-fixtures",
    title: "Fixture boundary",
    body: "Catalog scenarios are static fixtures. They run through the real evaluators and consensus table. They are not live retrieved evidence. Production mode, if enabled later, must not silently substitute fixtures.",
  },
  {
    id: "d-providers",
    title: "Provider non-endorsement",
    body: "Named model providers in the dependency inventory are excluded from this demonstration. Listed, configured, or available does not mean invoked. Invoked does not mean decision-relevant. Nothing here is an endorsement by any provider.",
  },
  {
    id: "d-local",
    title: "Local execution",
    body: "All twelve evaluators execute inside the EMO1 local runtime. No external model is called for scoring. Consensus is deterministic for identical input and configuration.",
  },
  {
    id: "d-evidence",
    title: "Evidence limits",
    body: "Evidence is extracted from the submitted text (citations, dates, source phrases). The runtime does not retrieve documents from the internet. Unsupported claims are marked unsupported. Stale or missing evidence cannot support SHIP.",
  },
  {
    id: "d-uncertainty",
    title: "Uncertainty",
    body: "Confidence is a calibrated deterministic score, not a statistical guarantee. Low confidence and policy ambiguity cannot silently pass.",
  },
  {
    id: "d-observer",
    title: "Observer vs ledger",
    body: "The observer reads the durable audit ledger. Decision records are authoritative. Animated replays of evaluator order are projected visualizations of already-recorded results.",
  },
  {
    id: "d-tenant",
    title: "Shared demonstration ledger",
    body: "This preview shares one demonstration tenant. Do not submit personal, confidential, or regulated data. Secrets and email-like strings are redacted before persistence. There is no per-user sign-in on this surface.",
  },
  {
    id: "d-auth",
    title: "Access boundary",
    body: "Hosted production use requires authentication, tenant isolation, and signed artifacts. This demonstration enforces input size, rate limits, and fail-closed audit writes only.",
  },
] as const;

export const DEFAULT_DISCLOSURE_IDS = DISCLOSURES.map((d) => d.id);
