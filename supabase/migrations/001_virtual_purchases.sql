-- 가상매수 테이블: 사용자가 "가상매수 맡기기"로 저장한 종목
create table if not exists virtual_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  stock_code text not null,
  stock_name text not null,
  purchase_price numeric not null,
  purchase_amount numeric not null default 1000000,
  created_at timestamptz default now(),
  is_active boolean default true
);

-- RLS 활성화 (본인 데이터만 접근)
alter table virtual_purchases enable row level security;

create policy "사용자 본인 데이터만 조회"
  on virtual_purchases for select
  using (auth.uid() = user_id);

create policy "사용자 본인만 삽입"
  on virtual_purchases for insert
  with check (auth.uid() = user_id);

create policy "사용자 본인만 수정"
  on virtual_purchases for update
  using (auth.uid() = user_id);
