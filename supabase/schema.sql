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

-- Saved answers (20 Nov 2026): answers a person or the paper's own key vouched for, reused on repeated questions.
-- Deploy the app first, then run this. The app works without it (saved answers stay off).
create table if not exists verified_answers (
  fingerprint text primary key,
  answer_text text not null,
  rank integer not null,
  from_title text,
  confirmations integer not null default 1,
  changes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table verified_answers enable row level security;

create or replace function save_verified_answer(p_fp text, p_text text, p_rank integer, p_from text)
returns void language plpgsql as $$
begin
  insert into verified_answers as v (fingerprint, answer_text, rank, from_title)
  values (p_fp, p_text, p_rank, p_from)
  on conflict (fingerprint) do update set
    answer_text = case when excluded.rank >= v.rank then excluded.answer_text else v.answer_text end,
    from_title = case when excluded.rank >= v.rank then excluded.from_title else v.from_title end,
    rank = greatest(v.rank, excluded.rank),
    changes = v.changes + case when excluded.rank >= v.rank and excluded.answer_text <> v.answer_text then 1 else 0 end,
    confirmations = v.confirmations + case when excluded.answer_text = v.answer_text then 1 else 0 end,
    updated_at = now();
end $$;
