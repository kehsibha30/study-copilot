-- Study copilot database (Supabase project "Study copilot", ap-south-1).
-- Applied on 15 Nov 2026 as migration study_copilot_initial. Run again safely: every statement is idempotent.
-- One family's data. Only the app's server (secret key) reads or writes.
-- RLS is on with no policies, so the public (publishable) key can read nothing.

create table if not exists papers (
  id text primary key,
  data jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  file_hash text
);

create table if not exists self_tests (
  id text primary key,
  data jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists topic_doubts (
  id bigint generated always as identity primary key,
  subject text not null,
  topic text not null,
  q text not null,
  a text not null,
  at text not null,
  flagged boolean not null default false
);
create index if not exists topic_doubts_topic on topic_doubts (subject, topic);

-- Every paid AI call, with its cost.
create table if not exists usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  paper_id text,
  step text,
  model text,
  usd numeric,
  row jsonb not null
);
create index if not exists usage_paper on usage (paper_id);

alter table papers enable row level security;
alter table self_tests enable row level security;
alter table topic_doubts enable row level security;
alter table usage enable row level security;

-- Private bucket for uploaded paper pages.
insert into storage.buckets (id, name, public, file_size_limit)
values ('papers', 'papers', false, 20971520)
on conflict (id) do nothing;
