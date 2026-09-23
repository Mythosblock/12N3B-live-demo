#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const PROTECTED = [
  "src/lib/emo1/registry.ts",
  "src/lib/emo1/evaluators.ts",
  "src/lib/emo1/consensus.ts",
  "src/lib/emo1/policies.ts",
  "src/lib/emo1/engine.ts",
  "src/lib/emo1/transform.ts",
  "src/lib/emo1/identity.ts",
  "src/lib/emo1/persist.server.ts",
];

function sha(file) {
  if (!existsSync(file)) return null;
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

let commit = "unavailable";
try {
  commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  commit = "not-a-git-worktree";
}

const lock = existsSync("package-lock.json")
  ? createHash("sha256").update(readFileSync("package-lock.json")).digest("hex")
  : null;

const report = {
  commit,
  lockfile_sha256: lock,
  runtime_id: "EMO1",
  runtime_version: "1.0.0",
  registry_id: "$12N3B",
  registry_version: "1.0.0",
  schema_version: "emo1-api-1.0.0",
  policy_version: "emo1-policy-1.0.0",
  protected_paths: PROTECTED.map((path) => ({ path, sha256: sha(path), present: existsSync(path) })),
  generated_at: new Date().toISOString(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.protected_paths.some((p) => !p.present)) process.exit(1);
