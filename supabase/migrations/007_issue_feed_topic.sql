-- 토픽 기반 이슈 피드 (Phase 10)
-- 기존 종목 단위 → 토픽(거시경제 이벤트) 단위로 전환

-- 토픽/영향 컬럼 추가
ALTER TABLE issue_feed ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE issue_feed ADD COLUMN IF NOT EXISTS impact text;

-- 기존 NOT NULL 제약 완화 (토픽 기반에서는 일부 필드가 null일 수 있음)
ALTER TABLE issue_feed ALTER COLUMN price_change DROP NOT NULL;
ALTER TABLE issue_feed ALTER COLUMN issue_type DROP NOT NULL;
ALTER TABLE issue_feed ALTER COLUMN plain_explain DROP NOT NULL;
