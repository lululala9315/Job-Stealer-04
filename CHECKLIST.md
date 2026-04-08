# stockcheck 리빌드 체크리스트

> 최종 업데이트: 2026-04-07 | 상태: Phase 7 완료, 디자인 방향 재정립 중
> 설계 스펙: `docs/superpowers/specs/2026-04-01-verdict-service-redesign.md`
> 배포 URL: https://stockcheck-pi.vercel.app

---

## 1단계: 기획 ✅ 완료

- [x] 서비스 컨셉 확정 — "그래서 사? 말아?" 초간편 판결 서비스
- [x] 플로우 확정 — 검색 → 금액 입력 → 판결 → 시뮬레이션
- [x] 판결 4단계 확정 — 절대금지🚨 / 대기🤔 / 괜찮아 보여👀 / 관망🫥
- [x] 판단 로직 설계 — 3축 100점 스코어링 (종목40 + 시장40 + 뉴스20)
- [x] 데이터 소스 확정 — KIS API + assetx2 API + 네이버 뉴스 검색 API
- [x] 시뮬레이션 방식 확정 — 과거 수익률 기반 단일 예측 (5/10/20년), 치환 메인
- [x] 투자금 입력 방식 확정 — 유저 입력 (기본값 100만원, 만원 단위)
- [x] 디자인 방향 확정 → **iOS Liquid Glass로 재정립 (2026-04-07)**
  - 기존: 토스 플랫 + 판결 영역 iOS 글래스모피즘 + 스티커 이모지
  - 변경: iOS 26 스타일 Liquid Glass — deeper blur, specular highlight, layered shadow, "wet glass" 질감
- [x] 제거 기능 확정 — 체크리스트, Swiper, 가상매수, 카카오 공유
- [x] AI 모델 확정 — Gemini API (추후 Claude 교체 대비 모듈화)
- [x] 버튼명 결정 보류 — "그래도 사면?" (추후 확정)
- [x] 설계 스펙 문서 저장
- [x] CLAUDE.md / PROGRESS.md / docs/ 전체 업데이트

---

## 2단계: 디자인

### 디자인 토큰 (현재 상태)
- [x] 판결 등급 색상 토큰 (`--color-verdict-ban/wait/ok/hold` + glow + glass)
- [x] 치환 이모지 블리딩 색상 토큰 (🍗☕🚗💻🎧✈️)
- [x] 스티커 이모지 CSS (`text-shadow` + `drop-shadow` + `emojiFloat` 키프레임)
- [x] 기존 글래스모피즘 CSS 변수 (`--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`)
- [x] Liquid Glass CTA 구현 (AmountInput) — `blur(28px) saturate(180%)` + 레이어드 섀도 + 스페큘러 하이라이트
- [ ] **iOS Liquid Glass 디자인 토큰 전면 재정의 (Phase 8)**
  - [ ] `--liquid-blur`: 40px+ (기존 glassmorphism보다 훨씬 깊은 블러)
  - [ ] `--liquid-specular`: 상단 흰색 하이라이트 레이어
  - [ ] `--liquid-shadow`: 3레이어 그림자 시스템
  - [ ] `--liquid-tint`: 반투명 색조 (각 등급별)
  - [ ] `--liquid-border`: 내부 발광 테두리

### 화면별 디자인 검토
- [x] **검색 화면** — "오늘은 어떤 종목에 물리고 싶어?" + 3D 그리마싱 이모지 + 검색창 + 이슈 배너 + 인기종목 마퀴 ✅ (Phase 7)
- [x] **금액 입력 화면** — 풀페이지, StockLogo + 종목명 + 타이틀 세로 스택, 주 단위, Liquid Glass CTA ✅ (Phase 6~7)
- [x] **로딩 화면** — thinking 이모지 4프레임 + 진행률 시뮬레이션(분석 중...X%) + 세로 센터 보정 ✅ (Phase 8)
- [ ] **판결 결과 화면** — iOS Liquid Glass 히어로 재작업 필요 (Phase 8)
- [ ] **시뮬레이션 화면** — iOS Liquid Glass 적용 필요 (Phase 8)
- [ ] **히스토리 목록** — 판결 이모지 + 종목명 + 한줄 멘트 + 날짜
- [ ] **절대금지 재확인 모달** — "그래도 볼 거야? 진짜?" 레이아웃

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

### Phase 6 — 분석 고도화 + UX 보완 ✅ 완료 (2026-04-06)

**DART 공시 연동**
- [x] `fetchDartData(stockCode)` — DART API corp_code 조회 + 관리종목/투자주의/상장폐지 공시 2년치
- [x] 강제 ban 트리거: DART 위험 공시 감지 시 LLM 판정 무관 즉시 ban
- [x] `DART_API_KEY` 환경변수 추가 (Supabase Secrets 등록 필요)

**LLM 직접 판정 전환**
- [x] `analyzeWithLLM()` 전면 교체 — LLM이 ban/wait/ok/hold 직접 결정
- [x] `fetchNewsItems()` 추가 — 실제 기사 제목/본문을 LLM에 전달 (키워드 카운팅 대체)
- [x] 예비판정 앵커 — 룰 기반 점수(prelimGrade) LLM에 전달, hold 극도 제한
- [x] fallback: LLM 실패 시 prelimGrade 사용 (기존 hold 고정 폐지)

**AmountInput 전면 개편**
- [x] 플로우: 바텀시트 → 풀페이지 (AMOUNT step 별도)
- [x] 단위: 만원 → 주(株)
- [x] 시스템 키보드 (투명 input 오버레이 기법)
- [x] 프리셋 칩: "+1주/+5주/+10주/+50주" 누적 방식 + 라인 스타일
- [x] 현재가 15초 폴링 (AMOUNT 체류 중 자동 갱신)
- [x] Liquid Glass CTA: `blur(28px) saturate(180%)` + 레이어드 섀도

**미국 주식 차단**
- [x] `USStockSheet.jsx` 신규 — "🇺🇸 미국 주식은 열심히 준비 중이야" 바텀시트
- [x] `isUSStock()` 감지 함수 — 영문 티커 + 한글 미국 기업명 목록
- [x] API 호출 없이 즉시 시트 노출

**MainPage 플로우 개선**
- [x] `priceOnly` 결과 확인 후 AMOUNT 이동 (종목 미존재 시 빈 페이지 방지)
- [x] `isSearching` 상태 — 검색 중 스피너 + 중복 검색 방지
- [x] 에러 시 검색 페이지 유지 + 에러 메시지 표시

### Phase 7 — UI 디테일 + 이슈 피드 안정화 ✅ 완료 (2026-04-07)

**SearchScreen 히어로 개편**
- [x] 3D 그리마싱 이모지 PNG 교체 (`public/emoji/grimacing-*.png` 3종)
- [x] A/B crossfade 애니메이션 — frontal(900ms)→right(400ms)→frontal(700ms)→left(400ms) 순환, 깜빡임 없음
- [x] 이모지 56px, 타이틀 34px, 이모지-타이틀 간격 8px
- [x] 드롭섀도 스트로크 적용 (8방향 흰색 3px 아웃라인)

**AmountInput UX 개선**
- [x] StockLogo(52px) → 종목명(20px secondary) → 타이틀 세로 스택
- [x] 현재가 금액 26px / 자간 -1.2px / primary 색상
- [x] 수량 텍스트 26px
- [x] 현재가/수량 서브타이틀 secondary 색상
- [x] 타이틀 "몇 주 구매할꺼야?", placeholder "몇 주?"
- [x] 예상금액 conditional render (shares > 0일 때만, minHeight 제거)

**MainPage stockCode 상태 추가**
- [x] `stockCode` 상태 추가 — priceOnly 응답에서 추출
- [x] AmountInput에 `stockCode` 전달 → 이름 검색 시에도 로고 정상 표시

**이슈 피드 안정화**
- [x] ETN/ETF/레버리지/인버스/선물/주요 ETF 브랜드 필터링 (issue-feed Edge Function)
- [x] 캐시 2시간 → 30분으로 단축
- [x] `resolveStockName()` — stock_name이 6자리 코드이면 stocks.json에서 이름 조회
- [x] 이슈 배너 클릭 시 stock_code + displayName 함께 전달
- [x] 이슈 배너에서 StockLogo 제거
- [x] issue-feed 재배포 ✅

### Phase 4 — UX 전면 리디자인 ✅ 완료 (2026-04-03)

- [x] SearchScreen 타이틀 → "오늘은 어떤 종목에 물리고 싶어?"
- [x] VerdictScreen 히어로 — 🤬호구 입장 1초 전 / 😤호구 대기표 / 😎인정 가즈아 / 🫠이건 어렵군
- [x] 이유 카드 룩업 테이블 기반 재설계 (price/value/volume/market/news)
- [x] 이슈 태그 바 (impactTag / priceSignalTag)
- [x] 시뮬레이션 3개월/6개월/1년 + best/worst 범위 밴드
- [x] LLM 페르소나 — 30대 MZ 직장인 고인물, 반말
- [x] Edge Function rawData + 이슈 필드 추가, 배포 완료

### Phase 5 — 실시간 이슈 피드 + UX 개선 ✅ 완료 (2026-04-03)

- [x] `issue_feed` 테이블 생성 (마이그레이션 006)
- [x] `issue-feed` Edge Function — KIS 거래량 상위 + 네이버 뉴스 + Claude Haiku, 2시간 캐시
- [x] `useIssueFeed` 훅 — DB 캐시 우선, Edge Function 폴백
- [x] SearchScreen 실시간 이슈 배너 — 토스증권 AI 스타일, 한 줄, 6초 순환
- [x] LoadingScreen 텍스트 2.5초 순환, FOMO 표현 제거
- [x] 손실/수익 표현 — LOSS_LABELS/GAIN_LABELS 룩업 ("날린다" → "제주도 왕복 두 번이야")
- [x] 마퀴 속도 30초로 조정
- [x] git 초기화 + Vercel 배포

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

- [x] Supabase Secrets 등록 확인
  - [x] `KIS_APP_KEY`, `KIS_APP_SECRET`
  - [x] `ANTHROPIC_API_KEY` (GEMINI_API_KEY 대체 — Claude Haiku 사용)
  - [x] `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- [x] Edge Function 배포 (`check-stock`, `issue-feed`)
  ```bash
  npx supabase functions deploy check-stock --no-verify-jwt --project-ref nceekggewxufjqythenq
  npx supabase functions deploy issue-feed --no-verify-jwt --project-ref nceekggewxufjqythenq
  ```
- [x] Vercel 환경변수 확인 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [x] Vercel 배포 완료 — https://stockcheck-pi.vercel.app
- [ ] 카카오 OAuth redirect URI 확인 (Vercel 도메인 등록)
- [ ] Google OAuth redirect URI 확인

---

## Phase 8: iOS Liquid Glass 디자인 전면 적용 (예정)

### 디자인 방향 정립
- [ ] iOS Liquid Glass 디자인 토큰 정의 (`src/index.css`)
  - [ ] `--liquid-blur`: 40px+ (기존 glassmorphism 20px 대비 2배+)
  - [ ] `--liquid-specular`: 상단 흰색 반사광 레이어
  - [ ] `--liquid-shadow-1/2/3`: 3단 그림자 시스템 (ambient/cast/glow)
  - [ ] `--liquid-tint-ban/wait/ok/hold`: 등급별 색조
  - [ ] `--liquid-border`: 내부 발광 테두리 (inset box-shadow)
- [ ] 기존 `.glass-card` → `.liquid-glass` 유틸 클래스 전환
- [ ] 레퍼런스: iOS 26 Control Center, Dynamic Island, Sheet 컴포넌트 스타일

### 컴포넌트 적용
- [ ] **VerdictScreen 히어로 카드** — 가장 핵심, 판결 등급별 Liquid Glass 글로우
- [ ] **VerdictScreen 이유 카드** — 서브 Liquid Glass (히어로보다 subtle)
- [ ] **SimulationScreen 기간 카드** — 3개월/6개월/1년 각 카드
- [ ] **AmountInput CTA 버튼** — 이미 Liquid Glass 적용 (재검토)
- [ ] `src/index.css` 기존 glassmorphism 변수 정리 (Liquid Glass로 교체)

## Phase 6(인증): 인증 UX 개선 + 디자인 디벨롭 (2026-04-04~05)

### 인증 UX 개선 ✅ 완료
- [x] `ProtectedRoute` 제거 — 비로그인도 SearchScreen 진입 가능
- [x] `LoginBottomSheet.jsx` 신규 — 검색 시도 시 로그인 유도 바텀시트
- [x] `useAuth.js` — `deleteUser()` 추가 (`supabase.rpc('delete_user')`)
- [x] `Header.jsx` 전면 개편 — 좌우 20px 패딩, 뒤로가기(좌) + 타이틀(중앙) + `···` 메뉴(우)
- [x] `···` 메뉴 — 로그아웃 / 회원탈퇴 (탈퇴 1회 확인)
- [x] `vercel.json` SPA 리라이트 규칙 추가 (카카오 OAuth 404 수정)
- [x] `check-stock` mock 모드 조건 버그 수정 (`GEMINI_API_KEY` → `ANTHROPIC_API_KEY`)

### SearchScreen 디자인 디벨롭 (진행 중 → 제미나이 인계)
- [x] 타이틀 2줄 처리 ("오늘은 / 어떤 종목에 물리고 싶어?")
- [x] 이모지 원형 글래스 사이즈 축소
- [x] 실시간 이슈 배너 → 검색바 하단 센터 정렬으로 이동
- [x] 인기종목 구분선 + 섹션 헤더 ("🔥 지금 뜨고 있는 종목 · 5개")
- [x] 히어로 이미지 교체 — `hero-fishing.png` (낚시 스티커)
- [x] 글래스모피즘 원형 컨테이너 + 이미지 JOMO 스타일 적용
- [ ] SearchScreen 디자인 최종 완성 (제미나이 작업 중)

---

## 6단계: 다음 작업

### 즉시 해야 할 것 (Phase 8)
- [ ] iOS Liquid Glass 디자인 토큰 정의 → VerdictScreen 히어로 카드 우선 적용
- [ ] 브라우저에서 실제 판결 플로우 검증 (장중 09:00~15:30)

### 브라우저 실제 검증
- [ ] 장중 시간(09:00~15:30)에 앱 접속 → 실시간 이슈 배너 데이터 확인
  - Network 탭 → `issue-feed` Edge Function 호출 및 응답 확인
  - DB 캐시 적중 시 Edge Function 호출 없음 확인 (30분 이내 재접속)
- [ ] 종목 검색 후 VerdictScreen 전체 필드 정상 출력 확인
  - `headlineMent`, `lossConversion`, 이유 카드 4개, 이슈 태그 바
  - 시뮬레이션 3개월/6개월/1년 + best/worst 밴드
- [ ] DART_API_KEY Supabase Secrets 등록 확인

### GitHub 연결 + Vercel 자동배포
- [ ] GitHub 원격 저장소 생성 (private)
  ```bash
  git remote add origin https://github.com/<username>/stockcheck.git
  git push -u origin master
  ```
- [ ] Vercel → GitHub 연결 (자동배포 설정)
  - Vercel Dashboard → Settings → Git → Connect Repository
  - main 브랜치 push 시 자동 배포

---

## v2 백로그 (MVP 이후)

- [ ] 카카오톡 공유 — 판결 결과 공유 카드
- [ ] 가상매수 추적 — "안 샀다면 어땠을지" 3일 후 추적
- [x] 인기종목 칩 — KIS 거래량 상위 실시간 연동 (`issue-feed` Edge Function으로 대체 완료)
- [ ] 미국 주식 지원 — Yahoo Finance API 연동
- [ ] 유료 전환 — 3회 무료 → 유료 플랜
- [x] Claude API 교체 — Gemini → Claude Haiku (Phase 2에서 완료)
- [ ] 푸시 알림 — 관심 종목 급등/급락 알림
- [ ] 버튼명 최종 확정 — "그래도 사면?" 검토
