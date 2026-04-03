-- 체크 히스토리 테이블: AI 분석 결과 저장 (HistoryList에서 조회)
create table if not exists check_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  stock_code text not null,
  stock_name text not null,
  check_result jsonb not null,   -- Edge Function 전체 응답
  stock_price_at_check numeric,
  summary text,
  created_at timestamptz default now()
);

-- RLS 활성화 (본인 데이터만 접근)
alter table check_history enable row level security;

create policy "사용자 본인 데이터만 조회"
  on check_history for select
  using (auth.uid() = user_id);

create policy "사용자 본인만 삽입"
  on check_history for insert
  with check (auth.uid() = user_id);

-- 최근 체크 조회 성능을 위한 인덱스
create index if not exists check_history_user_created
  on check_history (user_id, created_at desc);
