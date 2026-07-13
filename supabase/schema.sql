-- Run this once in the Supabase SQL editor for your project.

create table if not exists leads (
  id bigint generated always as identity primary key,
  trade text not null,
  name text not null,
  address text,
  city text not null,
  phone text,
  rating numeric default 0,
  reviews integer default 0,
  website text,
  hours jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (name, city, trade)
);

create index if not exists leads_created_at_idx on leads (created_at desc);

-- RLS is enabled with no policies, so only the service-role key (used
-- server-side by the api/ functions) can read/write. The anon key,
-- if it were ever exposed, would get nothing.
alter table leads enable row level security;
