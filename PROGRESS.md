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

## Phase 8: 로딩 화면 개선 ✅ 완료 (2026-04-07)

- [x] **이모지 단순화**: thinking→disguised 10프레임 → thinking 4프레임만 유지
- [x] **진행률 표시**: 가상 progress 시뮬레이션 (0→90%, 지수 감속, ~8초), 서브메시지에 `분석 중... X%` 인라인
- [x] **세로 센터 보정**: `minHeight: 60vh` → `flex: 1 + paddingBottom: 52px` (헤더 높이 보정)
- [x] **MainPage 패딩 제거**: LOADING step에서 `py-4` 제거 (`isLoadingStep` 조건 추가)

---

## Phase 7: UI 디테일 + 이슈 피드 안정화 ✅ 완료 (2026-04-07)

### AmountInput UX 개선

- [x] **레이아웃**: StockLogo(52px) → 종목명(20px secondary) → 타이틀 세로 스택으로 재구성
- [x] **타이틀 위계 분리**: 종목명 `secondary` 색상, 질문 `primary` — 동일 굵기에서 색상으로 구분
- [x] **타이틀 변경**: "몇 주 살 생각이야?" → "몇 주 구매할꺼야?"
- [x] **서브타이틀 색상**: "현재가" / "수량" 레이블 `tertiary` → `secondary` (칩 텍스트와 통일)
- [x] **현재가 금액**: 크기 22px → 26px, 자간 -1.2px, 색상 primary 유지
- [x] **수량 텍스트**: 크기 22px → 26px
- [x] **placeholder**: "몇 주 살 생각이야?" → "몇 주?"
- [x] **예상금액 공간**: `minHeight` 제거 → 입력 시에만 렌더링 (빈 여백 제거)
- [x] **stockCode 상태 추가** (MainPage): `priceOnly` 응답에서 `stockCode` 추출 → AmountInput에 전달하여 이름 검색 시에도 로고 표시

### SearchScreen 히어로 개편

- [x] **3D 이모지 이미지**: 🤑 텍스트 이모지 → 3D 그리마싱 페이스 PNG (`public/emoji/`)
  - `grimacing-frontal.png` / `grimacing-right.png` / `grimacing-left.png`
- [x] **스티커 스트로크**: `drop-shadow` 8방향 흰색 3px 아웃라인
- [x] **Crossfade 애니메이션**: frontal→right→frontal→left 순환, A/B 레이어 교차 방식으로 깜빡임 제거
  - frontal 900ms → right 400ms → frontal 700ms → left 400ms
- [x] **이모지 크기**: 최종 56px
- [x] **타이틀 크기**: 30px → 34px
- [x] **이모지-타이틀 간격**: 8px
- [x] **이슈 배너 `resolveStockName`**: stock_name이 6자리 코드일 때 로컬 stocks.json에서 이름 조회
- [x] **이슈 배너 클릭**: stock_code + 종목명(displayName) 함께 전달

### 이슈 피드 안정화

- [x] **ETN/ETF 필터링** (issue-feed Edge Function): ETN, ETF, 레버리지, 인버스, 선물, 주요 ETF 브랜드 → 피드에서 제외 (check-stock 분석 불가 종목 차단)
- [x] **캐시 시간 단축**: 2시간 → 30분 (이슈 갱신 주기 개선)
- [x] **issue-feed 재배포** ✅

---

## Phase 6: 분석 고도화 + UX 보완 ✅ 완료 (2026-04-06)

### 분석 엔진 개편 (Option B+C)

**DART 공시 연동 (Option C)**
- [x] `fetchDartData()` 추가 — DART API로 관리종목/투자주의/상장폐지 공시 2년치 조회
- [x] 강제 ban 트리거: 관리종목·투자주의·상장폐지 감지 시 LLM 판정 무관 즉시 ban
- [x] 환경변수 추가: `DART_API_KEY` (opendart.fss.or.kr 무료 등록)

**LLM 직접 판정 (Option B)**
- [x] `analyzeWithLLM()` 전면 교체 — 기존 룰 기반 등급 결정 → LLM이 모든 데이터 보고 직접 판정
- [x] `fetchNewsItems()` 추가 — 키워드 카운팅 대신 뉴스 본문 실제 내용을 LLM에 전달
- [x] 예비 판정 앵커 — 룰 기반 점수로 ban/wait/ok 먼저 계산 후 LLM에 전달 (hold 도망 방지)
- [x] hold 극도 제한 — "데이터 완전 없을 때만, 데이터 있으면 hold 금지" 명시
- [x] fallback도 예비 판정 등급 사용 (기존 hold 고정 → 룰 기반 등급)

### AmountInput 전면 개편

- [x] **플로우 변경**: 바텀시트 → 풀페이지 (AMOUNT step 추가)
- [x] **단위 변경**: 만원 → 주(株) 단위
- [x] **시스템 키보드**: 커스텀 키패드 제거, OS 키보드 사용 (투명 input 오버레이 기법)
- [x] **프리셋 칩**: "1주/5주/10주/50주" 선택 → "+1주/+5주/+10주/+50주" 주수 누적 추가 방식
- [x] **현재가 15초 폴링**: AMOUNT 페이지 체류 중 자동 갱신
- [x] **Liquid Glass CTA**: `blur(28px) saturate(180%)` + 레이어드 섀도 + 스페큘러 하이라이트
- [x] **라인 스타일 칩**: 글래스모피즘 → `border: 1px solid var(--color-border)` 아웃라인
- [x] **타이틀**: "몇 주 살 생각이야?" 30px semibold
- [x] **수량 표시**: `22px → 22px` (입력 없을 때 플레이스홀더), 입력값 + "주" 인라인

### 미국 주식 차단

- [x] `USStockSheet.jsx` 신규 — "🇺🇸 미국 주식은 열심히 준비 중이야" 바텀시트
- [x] `isUSStock()` 감지 함수 — 영문 티커(AAPL 등) + 한글 미국 기업명 목록(애플/테슬라 등)
- [x] API 호출 없이 즉시 시트 노출 (불필요한 Edge Function 호출 방지)

### MainPage 플로우 개선

- [x] `priceOnly` 결과 확인 후 AMOUNT 이동 (기존: 즉시 이동 → 종목 미존재 시 빈 페이지)
- [x] `isSearching` 상태 추가 — 검색 중 스피너 + 중복 검색 방지
- [x] 에러 시 검색 페이지 유지 + 에러 메시지 표시

---

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
