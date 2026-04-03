-- 판결 서비스 리빌드: check_history 테이블에 판결 관련 컬럼 추가
-- 2026-04-01

ALTER TABLE check_history
  ADD COLUMN IF NOT EXISTS invest_amount numeric DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS verdict_grade text,       -- ban | wait | ok | hold
  ADD COLUMN IF NOT EXISTS verdict_score numeric;    -- 0~100 (높을수록 위험)

-- verdict_grade 값 검증 제약조건
ALTER TABLE check_history
  ADD CONSTRAINT check_verdict_grade
  CHECK (verdict_grade IS NULL OR verdict_grade IN ('ban', 'wait', 'ok', 'hold'));

-- verdict_score 범위 제약조건
ALTER TABLE check_history
  ADD CONSTRAINT check_verdict_score
  CHECK (verdict_score IS NULL OR (verdict_score >= 0 AND verdict_score <= 100));

-- 판결 등급별 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_check_history_verdict_grade
  ON check_history (user_id, verdict_grade, created_at DESC);
