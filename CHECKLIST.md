# stockcheck 리빌드 체크리스트

> 기획 완료일: 2026-04-01 | 상태: 구현 대기
> 플랜 파일: `.claude/plans/eager-growing-fairy.md`
> 설계 스펙: `docs/superpowers/specs/2026-04-01-verdict-service-redesign.md`

---

## 1단계: 기획 ✅ 완료

- [x] 서비스 컨셉 확정 — "그래서 사? 말아?" 초간편 판결 서비스
- [x] 플로우 확정 — 검색 → 금액 입력 → 판결 → 시뮬레이션
- [x] 판결 4단계 확정 — 절대금지🚨 / 대기🤔 / 괜찮아 보여👀 / 관망🫥
- [x] 판단 로직 설계 — 3축 100점 스코어링 (종목40 + 시장40 + 뉴스20)
- [x] 데이터 소스 확정 — KIS API + assetx2 API + 네이버 뉴스 검색 API
- [x] 시뮬레이션 방식 확정 — 과거 수익률 기반 단일 예측 (5/10/20년), 치환 메인
- [x] 투자금 입력 방식 확정 — 유저 입력 (기본값 100만원, 만원 단위)
- [x] 디자인 방향 확정 — 토스 플랫 + 판결 영역 iOS 글래스모피즘 + 스티커 이모지
- [x] 제거 기능 확정 — 체크리스트, Swiper, 가상매수, 카카오 공유
- [x] AI 모델 확정 — Gemini API (추후 Claude 교체 대비 모듈화)
- [x] 버튼명 결정 보류 — "그래도 사면?" (추후 확정)
- [x] 설계 스펙 문서 저장
- [x] CLAUDE.md / PROGRESS.md / docs/ 전체 업데이트

---

## 2단계: 디자인

### 디자인 토큰
- [x] 글래스모피즘 CSS 변수 `src/index.css`에 추가
  - `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`
- [x] 판결 등급 색상 토큰 추가 (`--color-verdict-ban/wait/ok/hold` + glow + glass)
- [x] 치환 이모지 블리딩 색상 토큰 추가 (🍗☕🚗💻🎧✈️)
- [x] 스티커 이모지 CSS 추가 (`text-shadow` + `drop-shadow` + `emojiFloat` 키프레임)
- [x] 글래스 유틸 클래스 `.glass-card` 추가
- [x] `questionIn` 진입 애니메이션 기존 유지 확인

### 화면별 디자인 검토
- [ ] **검색 화면** — "어떤 주식에 눈 돌아갔어?" 타이틀 + 검색창 + 인기종목 칩 레이아웃
- [ ] **금액 입력 화면** — 타이틀 + 인풋 + 만원 단위 표시 + 건너뛰기 링크
- [ ] **로딩 화면** — 스피너 + 로딩 메시지
- [ ] **판결 결과 화면** — 글래스 히어로 + 스티커 이모지 + 치환 텍스트 + 근거 + CTA
- [ ] **시뮬레이션 화면** — 치환 메인 + 금액 서브 + SVG 라인 차트
- [ ] **히스토리 목록** — 판결 이모지 + 종목명 + 한줄 멘트 + 날짜
- [ ] **절대금지 재확인 모달** — "그래도 볼 거야? 진짜?" 레이아웃
- [ ] **빈 히스토리 상태** — 첫 사용 유도 카피

### UX 세부사항
- [ ] 인기종목 칩 최대 5개 제한 확인
- [ ] 금액 입력 `inputmode="numeric"` 네이티브 키패드 테스트 (iOS/Android)
- [ ] ℹ️ 인포 아이콘 탭 영역 최소 40×40px 확인
- [ ] 뒤로가기 버튼 표시 조건 (검색 외 step) 확인
- [ ] 디스클레이머 문구 확정
  - 판결 화면: "본 서비스는 투자 참고 정보만 제공하며, 투자 판단의 책임은 본인에게 있습니다."
  - 시뮬레이션: "과거 연평균 수익률 기준 추정. 미래 수익을 보장하지 않습니다."

---

## 3단계: 개발

### Phase 1 — 기반 정리

- [x] `framer-motion` 의존성 제거 (`npm uninstall framer-motion`)
- [x] `swiper` 의존성 제거 (`npm uninstall swiper`)
- [x] `npm install` 후 빌드 에러 없음 확인
- [x] 파일 삭제
  - [x] `src/components/ChecklistScreen.jsx`
  - [x] `src/components/ResultCards.jsx`
  - [x] `src/components/VirtualPortfolio.jsx`
  - [x] `src/components/KakaoShare.jsx`
  - [x] `src/components/StockSearch.jsx`
- [x] `src/index.css` — 글래스모피즘 + 이모지 색상 토큰 추가
- [x] `supabase/migrations/004_verdict_columns.sql` 작성
  ```sql
  ALTER TABLE check_history
    ADD COLUMN invest_amount numeric DEFAULT 1000000,
    ADD COLUMN verdict_grade text,
    ADD COLUMN verdict_score numeric;
  ```
- [ ] Supabase 대시보드에서 마이그레이션 SQL 실행
- [x] `npm run build` 에러 없음 확인

### Phase 2 — Edge Function 판단 엔진

**새 API 연동**
- [ ] `fetchMarketSignals()` 함수 작성
  - [ ] `assetx2-dashboard.vercel.app/api/yahoo` — VIX, 공포탐욕, 코스피/코스닥 drawdown
  - [ ] `assetx2-dashboard.vercel.app/api/fred` — 금리 방향
  - [ ] `assetx2-dashboard.vercel.app/api/dxy` — 달러 인덱스
  - [ ] 3개 병렬 호출 (`Promise.all`) 구현
  - [ ] API 실패 시 시장 점수 0 처리 (서비스 중단 방지)
- [ ] `fetchNewsSignals(stockName)` 함수 작성
  - [ ] 네이버 뉴스 검색 API 연동
  - [ ] 키워드 매칭 카테고리 분류 (실적/공시/루머/분석/일반)
  - [ ] `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` Supabase Secrets 등록
- [ ] `fetchInstitutionalData(stockCode)` 함수 작성
  - [ ] KIS API tr_id: FHKST01010900
  - [ ] 최근 5일 기관/외인 순매수 합계

**3축 스코어링 엔진**
- [ ] `scoreStock(priceData, dailyData, institutionalData)` 함수 작성
  - [ ] 가격 위치 (52주 고점 대비, 12점)
  - [ ] PER 밸류에이션 (업종 대비, 10점)
  - [ ] 거래량 (20일 평균 대비, 10점)
  - [ ] 기관/외인 수급 (5일 순매수, 8점)
  - [ ] 동적 조정: 고점(>=90%) + 과열(>=3배) 동시 → *1.2
- [ ] `scoreMarket(marketSignals)` 함수 작성
  - [ ] VIX (10점)
  - [ ] 공포탐욕지수 (8점)
  - [ ] 코스피/코스닥 지수 위치 (8점)
  - [ ] 금리 방향 (8점)
  - [ ] 달러/유동성 (6점)
  - [ ] 동적 조정: 5축 중 3개+ 동시 위험 → *1.3
- [ ] `scoreNews(newsSignals, priceData)` 함수 작성
  - [ ] 루머 비율 (12점)
  - [ ] 주가 반영 여부 (8점)
- [ ] `combineVerdict(stockScore, marketScore, newsScore)` 함수 작성
  - [ ] >= 70: 절대금지, >= 45: 대기, < 45: 괜찮아 보여, 데이터 부족: 관망
  - [ ] 강제 트리거: 52주 고점 98%+ AND 거래량 5배+ → 무조건 절대금지
  - [ ] 강제 트리거: VIX >= 35 → 무조건 절대금지
  - [ ] 강제 트리거: 기관+외인 5일 연속 동시 순매도 → 무조건 절대금지

**Gemini 프롬프트 & 응답 스키마**
- [ ] `callLLM(context)` 어댑터 함수로 모듈화 (추후 Claude 교체 대비)
- [ ] 새 Gemini 프롬프트 작성 (판결 4단계 톤 테이블 포함)
- [ ] 응답 스키마 정의 (`VerdictResponse` JSON)
  - [ ] `verdict.grade/label/emoji/score/headlineMent/lossConversion`
  - [ ] `reasons[]` (metaphor + detail + dataPoint)
  - [ ] `simulation.longTerm.projections.year5/10/20`
- [ ] 응답 파서 + 검증 로직

**시뮬레이션 확장**
- [ ] `buildLongTermSimulation(dailyData, investAmount)` 작성
  - [ ] 과거 연평균 수익률 계산
  - [ ] 5/10/20년 복리 계산: `투자금 * (1 + r)^N`
- [ ] `getRelatableUnits()` 고가 품목 추가
  - [ ] 에어팟 프로 🎧 (359,000원)
  - [ ] 아이패드 📱 (599,000원)
  - [ ] 맥북 에어 💻 (1,590,000원)
  - [ ] 제주도 여행 🏝️ (800,000원)
  - [ ] 테슬라 모델3 🚗 (52,990,000원)

**새 응답 스키마로 DB 저장**
- [ ] `check_history` 저장 시 `invest_amount`, `verdict_grade`, `verdict_score` 추가
- [ ] Mock 모드 새 스키마로 업데이트 (API 키 없이 개발 테스트용)

### Phase 3 — 프론트엔드 ✅ 완료

**MainPage 재작성**
- [x] `src/pages/MainPage.jsx` 전면 재작성
  - [x] STEPS: `SEARCH → AMOUNT → LOADING → VERDICT → SIMULATION`
  - [x] 상태: `step`, `query`, `stockName`, `investAmount`, `result`, `error`, `historyRefresh`
  - [x] Edge Function 호출 body: `{ query, userId, investAmount }`
  - [x] `onBack` 핸들러 — 각 step에서 이전 step으로

**SearchScreen**
- [x] `src/components/SearchScreen.jsx` 신규 작성
  - [x] 타이틀: "어떤 주식에 눈 돌아갔어?"
  - [x] 검색창 (기존 StockSearch input 로직 재활용)
  - [x] 인기종목 칩 (최대 5개, 탭 → 즉시 `onSearch` 호출)
  - [x] Enter / 버튼으로 `onSearch` 호출

**AmountInput**
- [x] `src/components/AmountInput.jsx` 신규 작성
  - [x] 타이틀: "얼마나 넣을 생각이야?"
  - [x] 서브텍스트: "{stockName}에"
  - [x] `inputmode="numeric"` 숫자 입력
  - [x] 실시간 만원 → 원 단위 변환 표시 ("= 1,000,000원")
  - [x] 기본값 100 (만원)
  - [x] "건너뛰기" → `onSubmit(1000000)`
  - [x] "다음" → `onSubmit(입력값 * 10000)`

**LoadingScreen**
- [x] `src/components/LoadingScreen.jsx` 신규 작성
  - [x] 스피너
  - [x] 로딩 메시지 5개 중 랜덤 ("충동 억제 AI 가동 중..." 등)
  - [x] `questionIn` 진입 애니메이션

**VerdictScreen (핵심)**
- [x] `src/components/VerdictScreen.jsx` 신규 작성
  - [x] **섹션 A — 판결 히어로** (글래스모피즘)
    - [x] 글래스 카드: `backdrop-filter: blur(20px)` + 등급별 glass 색상
    - [x] 이모지 블리딩: `radial-gradient` 배경 번짐
    - [x] 스티커 이모지: `text-shadow` + `drop-shadow` + `emojiFloat` 애니메이션
    - [x] 판결 한줄 멘트
    - [x] 판결 등급 라벨 + 이모지
  - [x] **섹션 B — 손실/수익 치환**
    - [x] 치환 텍스트 메인
    - [x] 실제 금액 서브
  - [x] **섹션 C — 초보용 근거**
    - [x] 3~4개 근거 항목
    - [x] 비유 텍스트 메인
    - [x] ℹ️ 아이콘 탭 → 용어 설명 토글
    - [x] 데이터 수치 서브 (연한 텍스트)
  - [x] **섹션 D — 하단 CTA**
    - [x] "그래도 사면?" 버튼
    - [x] 절대금지: 재확인 모달 "그래도 볼 거야? 진짜?"
    - [x] 디스클레이머 고정

**SimulationScreen**
- [x] `src/components/SimulationScreen.jsx` 신규 작성
  - [x] 치환 텍스트 메인 + 금액 서브
  - [x] 5년 / 10년 / 20년 각 시점 블록
  - [x] SVG 미니 라인 차트 (라이브러리 없이, 4포인트)
  - [x] "다시 검색" 버튼
  - [x] 시뮬레이션 디스클레이머

**기존 파일 수정**
- [x] `src/components/Header.jsx` — `onBack` prop 추가, 프로필 드롭다운(로그아웃)
- [x] `src/components/HistoryList.jsx` — 판결 이모지 + 한줄 멘트 + 날짜 표시로 UI 변경

---

## 4단계: QA

### 빌드 검증
- [ ] `npm run lint` 에러 없음
- [ ] `npm run build` 에러/경고 없음
- [ ] 번들 사이즈 이전 대비 감소 확인 (framer-motion, swiper 제거 효과)

### 플로우 테스트 (Mock 모드)
- [ ] API 키 없이 Mock 모드로 전체 플로우 완주 가능 확인
- [ ] 검색 → 금액 입력 → 로딩 → 판결 → 시뮬레이션 → 다시 검색
- [ ] 뒤로가기 버튼 각 step에서 정상 동작
- [ ] "건너뛰기" 클릭 시 기본값 100만원 적용 확인

### 실제 API 연동 테스트
- [ ] 삼성전자(005930) 검색 → 정상 판결 반환
- [ ] 에코프로 검색 → 정상 판결 반환
- [ ] HLB 검색 → 정상 판결 반환
- [ ] 존재하지 않는 종목 검색 → 에러 처리 확인
- [ ] assetx2 API 실패 시 → 시장 점수 0 처리 후 정상 판결 확인
- [ ] 네이버 뉴스 API 실패 시 → 뉴스 점수 0 처리 후 정상 판결 확인

### 판결 밸런스 검증
- [ ] 삼성전자 → 예상 등급 확인
- [ ] 에코프로 → 예상 등급 확인 (변동성 큰 종목)
- [ ] HLB → 예상 등급 확인 (바이오)
- [ ] KODEX 200 ETF → 예상 등급 확인 (안정적 종목)
- [ ] 절대금지가 전체 판결의 50% 이상 차지하면 임계값 재조정 필요
- [ ] 괜찮아 보여가 전혀 안 나오면 임계값 재조정 필요

### 디자인 QA
- [ ] 글래스모피즘 효과 iOS Safari 정상 동작 (`-webkit-backdrop-filter` 확인)
- [ ] 스티커 이모지 float 애니메이션 iOS/Android 정상 동작
- [ ] 이모지 색 블리딩 각 판결 등급별 확인 (🚨🤔👀🫥)
- [ ] 치환 이모지 블리딩 색상 확인 (🍗☕🚗💻🎧)
- [ ] ℹ️ 탭 시 용어 설명 토글 정상 동작
- [ ] 절대금지 재확인 모달 정상 노출
- [ ] 시뮬레이션 SVG 차트 데이터 반영 확인
- [ ] 히스토리 목록 판결 이모지 + 멘트 정상 표시

### 반응형 & 접근성
- [ ] 모바일 (375px, 390px, 430px) 레이아웃 확인
- [ ] 데스크탑 480px 중앙 컬럼 정상 표시
- [ ] 인풋 포커스 시 소프트 키보드 올라올 때 레이아웃 깨지지 않음
- [ ] 최소 히트 영역 40×40px 확인 (ℹ️ 아이콘 포함)

### 보안 & 성능
- [ ] API 키 하드코딩 없음 확인 (환경변수 사용)
- [ ] Edge Function 3개 API 병렬 호출 (`Promise.all`) 확인
- [ ] 로딩 시간 10초 이내 확인 (병렬 호출로 단축)
- [ ] Supabase RLS 본인 데이터만 접근 가능 확인

### 엣지 케이스
- [ ] 투자금 0 입력 시 처리
- [ ] 투자금 매우 큰 숫자 (999억) 입력 시 처리
- [ ] 네트워크 오프라인 시 에러 메시지 표시
- [ ] Edge Function 타임아웃 (30초) 시 에러 처리
- [ ] 로그인 세션 만료 시 자동 로그인 페이지 이동

---

## 5단계: 배포

- [ ] Supabase Secrets 등록 확인
  - [ ] `KIS_APP_KEY`, `KIS_APP_SECRET`
  - [ ] `GEMINI_API_KEY`
  - [ ] `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- [ ] Edge Function 배포
  ```bash
  npx supabase functions deploy check-stock --no-verify-jwt --project-ref nceekggewxufjqythenq
  ```
- [ ] Vercel 환경변수 확인 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Vercel 재배포 후 https://stockcheck-pi.vercel.app 정상 동작 확인
- [ ] 카카오 OAuth redirect URI 확인 (Vercel 도메인 등록)
- [ ] Google OAuth redirect URI 확인

---

## v2 백로그 (MVP 이후)

- [ ] 카카오톡 공유 — 판결 결과 공유 카드
- [ ] 가상매수 추적 — "안 샀다면 어땠을지" 3일 후 추적
- [ ] 인기종목 칩 — KIS 거래량 상위 실시간 연동 (현재 하드코딩)
- [ ] 미국 주식 지원 — Yahoo Finance API 연동
- [ ] 유료 전환 — 3회 무료 → 유료 플랜
- [ ] Claude API 교체 — Gemini → Claude Haiku (멘트 퀄리티 향상)
- [ ] 푸시 알림 — 관심 종목 급등/급락 알림
- [ ] 버튼명 최종 확정 — "그래도 사면?" 검토
