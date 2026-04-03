create table if not exists issue_feed (
  id            uuid primary key default gen_random_uuid(),
  stock_code    text not null,
  stock_name    text not null,
  price_change  numeric not null,
  issue_type    text not null,
  sentiment     text not null,
  emoji         text not null,
  one_line      text not null,
  plain_explain text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

alter table issue_feed enable row level security;

create policy "issue_feed_select" on issue_feed
  for select using (auth.role() = 'authenticated');

create policy "issue_feed_insert" on issue_feed
  for insert with check (true);
