# 개발 진행 상황

## 기획 리빌드 (2026-04-01)

기존 "체크리스트 + 카드 스와이프" 플로우 → "검색 → 금액 → 판결 → 시뮬레이션" 초간편 플로우로 전면 전환.
설계 스펙: `docs/superpowers/specs/2026-04-01-verdict-service-redesign.md`

---

## 재사용 인프라 (기존 완료)

- [x] Vite + React 19 + Tailwind CSS v4 세팅
- [x] Supabase 클라이언트 (`src/lib/supabase.js`)
- [x] 인증 훅 (`src/hooks/useAuth.js`) — 카카오/구글 OAuth
- [x] 라우팅 (`src/App.jsx`) — ProtectedRoute / AuthRoute
- [x] 로그인 페이지 (`src/pages/LoginPage.jsx`)
- [x] Edge Function 기반 (KIS API 토큰 캐시, 종목 코드 해석, 팩트 추출, 시뮬레이션, Gemini 재시도)
- [x] DB check_history 테이블 + RLS
- [x] Vercel 배포 설정

---

## Phase 1: 기반 정리 ✅ 완료 (2026-04-02)

- [x] `framer-motion`, `swiper` 의존성 제거
- [x] 제거 대상 파일 삭제 (ChecklistScreen, ResultCards, VirtualPortfolio, KakaoShare, StockSearch)
- [x] `src/index.css` 글래스모피즘 + 이모지 색상 토큰 추가
- [x] DB 마이그레이션 SQL 작성 (`supabase/migrations/002_verdict_columns.sql`)
- [x] `kis_token_cache` 테이블 생성 (`supabase/migrations/005_kis_token_cache.sql`) — 콜드스타트 토큰 공유용

## Phase 2: Edge Function 판단 엔진 ✅ 완료 (2026-04-02)

- [x] 시장 데이터 API 연동 (`fetchMarketSignals`) — Yahoo Finance (VIX/KOSPI/KOSDAQ/DXY) + Alternative.me (공포탐욕)
  - assetx2 API 비정상 → Yahoo Finance로 교체
  - Fed rate 4.25% 하드코딩 (FRED API 대체)
- [x] 네이버 뉴스 검색 API 연동 (`fetchNewsSignals`)
- [x] 3축 스코어링 엔진 (종목 40 + 시장 40 + 뉴스 20 = 100점)
  - KIS 기관/외인 수급 → RSI 14일 기준으로 대체 (8점, KIS 수급 API 미완성)
- [x] KIS 토큰 3티어 캐시 (모듈 캐시 → DB 캐시 → 신규 발급) — 1분/1회 제한 대응
- [x] LLM 호출 모듈화 `callLLM()` 완료
  - Gemini 2.0 Flash → 무료 쿼터 소진
  - Gemini 1.5 Flash → API 키 오류
  - **Claude Haiku (`claude-haiku-4-5-20251001`)로 전환** — Anthropic API
- [x] 시뮬레이션 확장 (장기 5/10/20년 + 고가 품목 치환)

### 스코어링 임계값 (2026-04-02 조정)
| 점수 | 판결 | 비고 |
|------|------|------|
| >= 45 | 절대금지 (ban) | |
| >= 25 | 대기 (wait) | |
| < 25 | 괜찮아 보여 (ok) | |
| 데이터 부족 | 관망 (hold) | |

> 기존 임계값 (70/45/0)은 실제 데이터 범위와 불일치 → 전종목 'ok' 판정 문제로 조정

## Phase 3: 프론트엔드 화면 ✅ 완료 (2026-04-02)

- [x] `SearchScreen.jsx` — "어떤 주식에 눈 돌아갔어?" + 토스 스타일 검색바 + 인기종목 마퀴
  - 검색바: 회색 배경(var(--color-bg-input)), 돋보기 아이콘(submit), × 클리어 버튼, 별도 버튼 없음
  - 인기종목: 마퀴 무한 스크롤 (StockLogo 칩)
- [x] `AmountInput.jsx` — "얼마나 넣을 생각이야?" + 만원 단위 바텀시트
- [x] `LoadingScreen.jsx` — 랜덤 로딩 메시지
- [x] `VerdictScreen.jsx` — 판결 결과 (글래스모피즘 + 스티커 이모지 + 비유 근거)
- [x] `SimulationScreen.jsx` — 5/10/20년 예측 (치환 텍스트 + SVG 그래프)
- [x] `MainPage.jsx` 재작성 — SEARCH→LOADING→VERDICT→SIMULATION 4단계 (금액입력은 바텀시트)
  - priceOnly 사전 호출 제거 (KIS 토큰 1분 제한 충돌 원인)
  - 에러 처리: `data?.error` 우선 체크 (fnError는 generic 메시지)
- [x] `Header.jsx` 수정 — 뒤로가기 버튼
- [x] `App.jsx` 반응형 레이아웃 — 640px 중앙 정렬 wrapper
- [x] `src/index.css` `#root`에 `align-items: center` 추가 — mx-auto 정상 동작

## Phase 4: UX 전면 리디자인 ✅ 완료 (2026-04-03)

스펙: `docs/superpowers/specs/2026-04-03-verdict-ux-redesign.md`

- [x] SearchScreen 타이틀 개편 — "오늘은 어떤 종목에 물리고 싶어?"
- [x] VerdictScreen 히어로 개편 — GRADE_STYLES 이모지/타이틀 전면 교체 (🤬😤😎🫠)
- [x] VerdictScreen 이유 카드 재설계 — 룩업 테이블 기반 (건물층/기업가치/거래분위기/시장기분)
- [x] 이슈 태그 바 추가 — issueType / impactTag / priceSignalTag
- [x] SimulationScreen 3개월/6개월/1년 + best/worst 범위 밴드
- [x] LLM 페르소나 개편 — 30대 MZ 직장인 고인물, headlineMent 10~20자 반말
- [x] Edge Function rawData 추가 (highRatio, per, isDeficit, volMultiple, fearGreed)
- [x] Edge Function 신규 필드 (issueType, sectorImpact, impactTag, priceSignalTag)
- [x] Edge Function 배포 완료

## Phase 5: 실시간 이슈 피드 + UX 개선 ✅ 완료 (2026-04-03)

스펙: `docs/superpowers/specs/2026-04-03-phase5-issue-feed.md`
플랜: `docs/superpowers/plans/2026-04-03-phase5-issue-feed.md`

- [x] `issue_feed` 테이블 생성 (DB 마이그레이션 006)
- [x] `issue-feed` Edge Function 신규 생성 — KIS 거래량 상위 + 네이버 뉴스 + Claude Haiku, 2시간 캐시
- [x] `useIssueFeed` 훅 — DB 캐시 우선, Edge Function 폴백
- [x] SearchScreen 실시간 이슈 배너 추가 — 토스증권 AI 스타일, 한 줄 인라인, 6초 순환
- [x] LoadingScreen 텍스트 2.5초 순환 개선 — FOMO 표현 제거, 8개 문구
- [x] 손실/수익 표현 개편 — LOSS_LABELS/GAIN_LABELS 룩업 테이블, "날린다" 제거
- [x] 마퀴 속도 조정 — 18초 → 30초
- [x] git 초기화 + 전체 커밋
- [x] Vercel 배포 — https://stockcheck-pi.vercel.app

---

## 기술 스택

- **프론트**: React 19 + Vite + Tailwind CSS v4
- **백엔드**: Supabase (Auth + DB + Edge Functions)
- **AI**: Claude Haiku (`claude-haiku-4-5-20251001`) — Anthropic API
- **주식 데이터**: 한국투자증권 KIS API
- **시장 데이터**: Yahoo Finance (VIX/KOSPI/KOSDAQ/DXY) + Alternative.me (공포탐욕지수)
- **뉴스**: 네이버 뉴스 검색 API
- **배포**: Vercel + Supabase Edge Functions
