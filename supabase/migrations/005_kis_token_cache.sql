-- KIS API 토큰 캐시 테이블
-- Edge Function 콜드 스타트 시 워커 간 토큰 공유용
CREATE TABLE IF NOT EXISTS kis_token_cache (
  id text PRIMARY KEY DEFAULT 'singleton',
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- service_role만 접근 (Edge Function에서 service role key로 호출)
ALTER TABLE kis_token_cache ENABLE ROW LEVEL SECURITY;
