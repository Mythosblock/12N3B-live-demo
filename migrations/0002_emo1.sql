create table if not exists evaluations (
  request_id         text primary key,
  execution_id       text not null unique,
  idempotency_key    text not null unique,
  original_input     text not null,
  original_hash      text not null,
  normalized_input   text not null,
  normalized_hash    text not null,
  evidence_class     text not null,
  decision           text not null,
  rule_id            text not null,
  record_json        text not null,
  artifact_id        text not null,
  runtime_version    text not null,
  registry_version   text not null,
  policy_version     text not null,
  schema_version     text not null,
  record_hash        text not null,
  chain_hash         text not null,
  prev_chain_hash    text,
  decided_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists evaluations_decided_at_idx on evaluations (decided_at desc);
create index if not exists evaluations_decision_idx on evaluations (decision);
