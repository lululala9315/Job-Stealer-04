# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

```bash
npm run dev      # Vite 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run preview  # 빌드 결과 미리보기
```

Edge Function 배포:
```bash
npx supabase functions deploy check-stock --no-verify-jwt --project-ref nceekggewxufjqythenq
npx supabase functions deploy issue-feed --no-verify-jwt --project-ref nceekggewxufjqythenq
```

## 아키텍처

**stockcheck** — 초간편 주식 판결 & 손실방어 서비스. 종목 검색 → 투자금 입력 → AI 판결(4단계) → 장기 시뮬레이션. FOMO에 눈먼 왕초보를 위한 "그래서 사? 말아?" 한마디에 답하는 앱.

**Tech Stack**: Vite + React 19 + Tailwind CSS v4 + Supabase (Auth/DB/Edge Functions)

### 데이터 흐름

```
[SearchScreen] "오늘은 어떤 종목에 물리고 싶어?"
  └─ 실시간 이슈 배너: useIssueFeed → DB 캐시 우선 → issue-feed Edge Function
       issue-feed: KIS 거래량 상위(FHPST01710000) + 네이버 뉴스 + Claude Haiku → issue_feed 테이블 (2시간 캐시)
  └─ 인기종목 마퀴 (30초 순환)

[검색] → priceOnly 유효성 확인 → AmountInput(풀페이지, 15초 현재가 폴링) → MainPage.handleAmountSubmit()
  → supabase.functions.invoke('check-stock', { query, userId, investAmount })
  → check-stock Edge Function:
      [병렬] KIS API (시세/일별) + Yahoo Finance (VIX/KOSPI/KOSDAQ/DXY)
           + Alternative.me (공포탐욕) + 네이버 뉴스 fetchNewsItems() + DART API (공시 2년치)
      → 룰 기반 스코어링 (종목40 + 시장40 + 뉴스20)으로 예비판정(ban/wait/ok) 계산
      → Claude Haiku API — 예비판정 + 전체 데이터 + 뉴스 내용 + DART 공시 전달 → 직접 판결 결정
      → 강제 ban 적용: DART 관리종목/투자주의/상장폐지 OR VIX≥35
      → check_history 테이블 저장
  → VerdictScreen (판결 히어로 + 이슈 태그 바 + 이유 카드 4개)
  → SimulationScreen (3개월/6개월/1년 + best/worst 밴드)
```

### 디자인 시스템 & 컴포넌트

→ **[docs/design-system.md](docs/design-system.md)** — 색상 토큰, 타이포그래피, 글래스모피즘, 이모지 색상 매핑
→ **[docs/components.md](docs/components.md)** — 컴포넌트별 props, 동작, 주요 구현 패턴
→ **[docs/superpowers/specs/2026-04-01-verdict-service-redesign.md](docs/superpowers/specs/2026-04-01-verdict-service-redesign.md)** — 설계 스펙

### 인증

`useAuth.js` — Supabase Auth 래퍼. `signIn(provider)`로 카카오/구글 OAuth. `App.jsx`의 `ProtectedRoute` / `AuthRoute`로 페이지 접근 제어.

### Edge Function (`supabase/functions/check-stock/index.ts`)

Deno 런타임. 필요한 환경변수 (Supabase Secrets에 등록):
- `KIS_APP_KEY`, `KIS_APP_SECRET` — 한국투자증권 Developers
- `ANTHROPIC_API_KEY` — console.anthropic.com (Claude Haiku 사용)
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` — 네이버 개발자 센터
- `DART_API_KEY` — opendart.fss.or.kr (무료 등록, 공시 API)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — 자동 주입됨

> `GEMINI_API_KEY`는 더 이상 사용하지 않음 (무료 쿼터 소진 + Claude Haiku로 전환)

### 판단 로직 (LLM-first + 룰 기반 앵커)

**Phase 6 (2026-04-06) 전면 개편**: 룰 기반 등급 결정 → LLM이 직접 판결 결정 방식으로 전환.

**흐름:**
1. `scoreStock` + `scoreMarket` + `scoreNews` (100점) → `prelimGrade` (예비판정) 계산
2. `fetchDartData()` — DART API로 관리종목/투자주의/상장폐지 공시 2년치 조회
3. `fetchNewsItems()` — 뉴스 키워드 카운팅 대신 실제 기사 제목/본문 수집
4. `analyzeWithLLM()` — 예비판정 + 전체 데이터 + 뉴스 내용 + DART 결과 전달 → LLM이 grade 직접 결정
5. **강제 ban** (LLM 판정 무관): DART 관리종목/투자주의/상장폐지 OR VIX ≥ 35
6. fallback: LLM 실패 시 `prelimGrade` 사용 (기존 `hold` 고정 → 폐지)

#### 룰 기반 스코어링 (예비판정 앵커용)

100점 만점, 높을수록 위험. LLM에 앵커로 전달 — 뒤집으려면 구체적 근거 필요.

**종목 축 (40점) — KIS API**

| 지표 | 배점 | 기준 |
|------|------|------|
| 가격 위치 | 12점 | 52주 고점 대비 현재가: >=98%→12, >=93%→9, >=85%→6, >=70%→3 |
| PER 밸류 | 10점 | 적자(PER<=0)→5(중간), >=50→10, >=30→7, >=20→4, >=15→2 |
| 거래량 | 10점 | 오늘 vs 20일 평균 배수: >=5배→10, >=3배→7, >=1.5배→4 |
| RSI | 8점 | 14일 RSI 과매수: >=80→8, >=70→5, >=60→2 |
| **동적 조정** | — | 고점>=90% + 거래량>=3배 동시 → 종목 점수 ×1.2 |

> RSI: KIS 일별시세 `changeRate` 14일치로 직접 계산. 기관/외인 수급 API 미완성으로 대체.

**시장 축 (40점) — Yahoo Finance + Alternative.me + 하드코딩**

| 지표 | 배점 | 기준 |
|------|------|------|
| VIX | 10점 | >=35→10, >=25→7, >=20→4, >=15→2 |
| 공포탐욕 | 8점 | >=80(극단탐욕)→8, >=65→6, >=50→3, <=20(극단공포)→2 |
| 지수 위치 | 8점 | 코스피/코스닥 전고점 대비: >=98%→8, >=95%→6, >=90%→4, >=80%→2 |
| 금리 | 8점 | Fed rate: >=5%→8, >=4%→6, >=3%→4, >=2%→2 (현재 4.25% 하드코딩) |
| 달러 DXY | 6점 | >=108→6, >=105→4, >=102→2 |
| **동적 조정** | — | 5축 중 3개 이상 위험 동시 충족 → 시장 점수 ×1.3 |

**뉴스 축 (20점) — 네이버 뉴스 API**

| 지표 | 배점 | 기준 |
|------|------|------|
| 루머 비율 | 12점 | 전체 기사 중 루머 키워드 비율: >=50%→12, >=30%→8, >=15%→4 |
| 선반영 여부 | 8점 | 고점>=90% + 5일누적수익>=10% + 뉴스>=5개 → 8점, 5일>=15%→6, 5일>=8%+뉴스>=3→4 |

**예비판정 임계값 (LLM 앵커)**

| 점수 | 예비판정 | 비고 |
|------|---------|------|
| >= 35 | ban | |
| >= 18 | wait | |
| < 18 | ok | |

> ⚠️ DART 관리종목/투자주의/상장폐지 감지 시 예비판정 무관 즉시 ban

**강제 ban 트리거** (LLM 판정 무관 오버라이드):
- DART: `isAdminStock` OR `isInvestmentWarning` OR `isDelistingRisk`
- VIX >= 35 (공황 수준)

### KIS 토큰 캐시 (`kis_token_cache` 테이블)

KIS API 토큰 1분/1회 발급 제한 대응을 위한 DB 캐시.
- 3티어 캐시: 모듈 변수 → DB `kis_token_cache` → 신규 발급
- Edge Function 콜드 스타트 시 워커 간 토큰 공유
- 마이그레이션: `supabase/migrations/005_kis_token_cache.sql`
- 토큰 만료 자동 복구 (2026-04-03 추가): `isKisTokenError()` 감지 → `clearKisTokenCache()` → 재발급 후 1회 재시도
- 에러 코드: `EGW00123`(만료), `EGW00201`(접근거부), `IGW00109`(요청거부)
- `fetchPriceData`: `data.output` 없으면 `msg1/msg_cd`로 에러 throw (크래시 방지)

### 화면별 노출 정보

#### VerdictScreen
- **히어로**: 판결 이모지(🤬😤😎🫠) + 타이틀 + headlineMent (Claude Haiku 생성, 10~20자 반말)
- **이슈 태그 바**: impactTag (예: "바이오 부정") + priceSignalTag (예: "3일 연속 하락")
- **손실 치환**: lossConversion — LOSS_LABELS 룩업 기반 구어체 (예: "제주도 왕복 두 번이야")
- **이유 카드 4개** (룩업 테이블 기반, LLM이 description 생성):
  - `price`: 52주 고점 대비 현재가 위치 (건물 층 메타포)
  - `value`: PER/적자 여부 (기업 가치)
  - `volume`: 거래량 배수 (거래 분위기)
  - `market`: VIX/공포탐욕/지수 (시장 기분)
- **rawData** (이유 카드 근거용): highRatio(%), per, isDeficit, volMultiple(배), fearGreed(0~100)

#### SimulationScreen
- **단기 (3일)**: 일일 변동성 + best/worst 등락률 범위
- **장기**: 3개월 / 6개월 / 1년 — 기댓값 + bestAmount + worstAmount (±1.28σ 밴드)
- 각 기간: 수익 금액 + GAIN_LABELS 치환 텍스트 + 이모지

### 판결 4단계 (2026-04-03 업데이트)

| 등급 | 이모지 | 타이틀 | LLM 톤 |
|------|--------|--------|--------|
| 절대금지 | 🤬 | 호구 입장 1초 전 | 형이 직접 당한 것처럼 진심으로 말려 |
| 대기 | 😤 | 호구 대기표 뽑는 중 | 선배 톤으로 탐욕 참으라고 |
| 괜찮아 보여 | 😎 | 인정. 가즈아! | 쿨하게, 절대 몰빵 금지 |
| 관망 | 🫠 | 이건 어렵군.. | 솔직하게, 데이터 부족 |

LLM 페르소나: 30대 MZ 직장인 고인물. headlineMent 10~20자 반말. 전문용어 금지.

## 환경변수

프론트 (`.env`):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Edge Function (Supabase Secrets):
```
KIS_APP_KEY
KIS_APP_SECRET
ANTHROPIC_API_KEY
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
DART_API_KEY
```

## DB 스키마

```sql
check_history (
  id uuid PK,
  user_id uuid → auth.users,
  stock_code text,
  stock_name text,
  check_result jsonb,           -- Edge Function 전체 응답
  stock_price_at_check numeric,
  summary text,
  invest_amount numeric,        -- 투자 금액
  verdict_grade text,           -- ban/wait/ok/hold
  verdict_score numeric,        -- 0~100
  created_at timestamptz
)

issue_feed (
  id uuid PK,
  stock_code text,
  stock_name text,
  price_change numeric,         -- 전일 대비 등락률 (%)
  issue_type text,              -- 임상실패 | 수주 | 실적 | 거시경제 | 루머 | 기타
  sentiment text,               -- 위험 | 주의 | 긍정
  emoji text,
  one_line text,                -- 한 줄 이슈 설명
  plain_explain text,           -- 왕초보용 쉬운 설명
  created_at timestamptz,
  expires_at timestamptz        -- created_at + 2시간, DB 캐시 만료 기준
)
```

RLS 활성화. `check_history` — 본인 데이터만 접근. `issue_feed` — 로그인 유저 전체 읽기 가능.

## Edge Function 응답 스키마 (2026-04-03 최신)

```json
{
  "stockName": "삼성전자",
  "stockCode": "005930",
  "investAmount": 1000000,
  "verdict": {
    "grade": "ban | wait | ok | hold",
    "label": "절대금지",
    "emoji": "🚨",
    "score": 78,
    "headlineMent": "지금 사면 기부 천사 등극",
    "lossConversion": "치킨 5마리 날리고 싶나보네"
  },
  "reasons": [
    {
      "cardType": "price | value | volume | market | news",
      "description": "쉬운 설명 2문장 이내"
    }
  ],
  "rawData": {
    "highRatio": 92,
    "per": 18,
    "isDeficit": false,
    "volMultiple": 3.2,
    "fearGreed": 42
  },
  "issueType": "임상실패 | 수주 | 실적 | 거시경제 | 루머 | 기타",
  "sectorImpact": "긍정 | 부정 | 중립",
  "impactTag": "바이오 부정",
  "priceSignalTag": "3일 연속 하락",
  "simulation": {
    "shortTerm": {
      "dailyVolatility": 2.1,
      "threeDayRange": { "bestCase": 4.1, "worstCase": -4.1 }
    },
    "longTerm": {
      "annualReturn": 8,
      "projections": {
        "month3": { "amount": 1020000, "gain": 20000, "bestAmount": 1120000, "worstAmount": 920000, "label": "아메리카노 4잔 벌 수 있어", "emoji": "☕" },
        "month6": { "amount": 1040000, "gain": 40000, "bestAmount": 1190000, "worstAmount": 890000, "label": "치킨 2마리 벌 수 있어", "emoji": "🍗" },
        "year1":  { "amount": 1080000, "gain": 80000, "bestAmount": 1350000, "worstAmount": 810000, "label": "치킨 4마리 벌 수 있어", "emoji": "🍗" }
      }
    }
  },
  "signals": { "stock": {}, "market": {}, "news": {} }
}
```

> ⚠️ 구 스키마(`reasons[].metaphor/detail/dataPoint`, `projections.year5/year10/year20`)는 삭제됨

## 서비스 컨셉 (에이전트 필독)

**stockcheck = FOMO 방지 초간편 주식 판결 서비스**

- **타겟**: 2-30대 주식 왕초보, 숫자가 공포이고 전문 용어가 외계어인 사람
- **핵심 문제**: "그래서 사? 말아?" — 이 하나에 답하는 서비스
- **서비스 정체성**: 종목 추천·수익 예측 앱이 **아님**. "지금 들어가도 되는지" 판결을 내려주는 앱
- **손실/수익 표현**: 숫자 대신 실생활 치환 (치킨, 커피, 맥북, 테슬라 등)
- **근거 표현**: 비유가 메인, 전문 용어는 info 아이콘 탭 시에만 노출
- **디자인**: 토스 플랫 + 판결 영역 iOS 글래스모피즘 + 스티커 이모지 + 이모지 색 블리딩

### 멘트 톤 가이드 (Claude Haiku 프롬프트 필독)
- 손익을 실생활로 치환: LOSS_LABELS/GAIN_LABELS 룩업 테이블 기반
  - 손실 예시: "제주도 왕복 두 번이야", "메타버스에서 집만큼이야"
  - 수익 예시: "아이패드 반 대 살 수 있어", "꿈에서 스테이크 살 수 있어"
  - **"날린다" 표현 절대 금지** — LOSS_LABELS 구어체 사용
- 주식 커뮤니티 용어 자연스럽게: 물타기, 존버, 손절, 풀매수, 떡상, 떡락
- **초성 축약어 금지** (ㄹㅇ, ㅋㅋ, ㅇㅈ 등)
- **없는 용어 창작 금지**
- **"사라"고 하는 것 절대 금지** — "괜찮아 보여"가 최대 긍정
- 판결 등급별 톤 세기 다르게: 절대금지(강하게) → 대기(유머) → 괜찮아(유머) → 관망(중립)

에이전트들은 모든 분석 시 이 컨셉을 기준으로 판단한다.

---

## 핀테크 팀 에이전트 (아이디어·개선 요청 시 사용)

사용자가 아이디어나 개선 요청을 제시하면, 아래 3개 관점으로 **병렬 분석** 후 결과를 취합한다.

### 트리거
"아이디어가 있는데", "이거 어떻게 생각해", "개선하고 싶어", "기능 추가하고 싶어" 등

### 3개 에이전트 페르소나

**PM (프로덕트 매니저)**
- 토스증권·카카오페이 출신 15년 경력
- 분석 포인트: 핵심 사용자 문제 해결 여부 / 우선순위 / 성공 지표 / 리스크 / 금융 규제
- **핵심 관점: 서비스 매력도 — 바이럴 포인트, 감정적 훅, 재방문 동기**
- **각 관점의 구체적 액션 아이템 필수 제시**

**프로덕트 디자이너**
- 토스·카카오페이 출신 15년 경력
- 분석 포인트: 사용자 플로우 / 기존 UX 패턴 충돌 / 모바일 퍼스트 / 한 줄 카피
- **핵심 관점: 비주얼 매력도 — iOS 글래스모피즘 + 스티커 이모지 컨셉 일관성**
- **각 관점의 구체적 액션 아이템 필수 제시**

**개발자**
- 토스·카카오페이 출신 15년 경력
- 분석 포인트: React + Supabase + Edge Function 구현 가능성 / 복잡도 / 성능·보안 / 구현 순서
- **각 관점의 구체적 액션 아이템 필수 제시**

### 출력 형식
```
## PM 관점
[분석 + 구체적 액션 아이템]

## 디자이너 관점
[분석 + 구체적 액션 아이템]

## 개발자 관점
[분석 + 구체적 액션 아이템]

---
**추천 다음 액션:** [세 관점 종합 → 가장 중요한 1가지]
```

---

## 구현 상태 (2026-04-09)

### Phase 1~3 완료
- Phase 1: 의존성 정리, 글래스모피즘 토큰, DB 마이그레이션 ✅
- Phase 2: Edge Function 판단 엔진, Claude Haiku LLM, 시장 데이터 API ✅
- Phase 3: 전 화면 구현, 반응형 640px 레이아웃 ✅

### Phase 4 UX 리디자인 ✅ 완료 (2026-04-03)

스펙: `docs/superpowers/specs/2026-04-03-verdict-ux-redesign.md`
플랜: `docs/superpowers/plans/2026-04-03-verdict-ux-redesign.md`

**Task 1 — SearchScreen 카피** ✅
**Task 2 — Edge Function rawData 추가** ✅
**Task 3 — LLM 프롬프트 전면 개선 (MZ 30대 페르소나)** ✅
**Task 4 — VerdictScreen 히어로 개편 (🤬😤😎🫠, 타이틀 28px)** ✅
**Task 5 — VerdictScreen 이유 카드 재설계 (건물층 메타포, 완전 펼침)** ✅
**Task 6 — 시뮬레이션 스토리 전환 (3개월/6개월/1년, best/worst)** ✅
**Task 7 — 이슈 태그 바 추가** ✅
**Edge Function 배포** ✅ 2026-04-03

> ⚠️ 미완료: 브라우저 실제 검증 (Network 탭 check-stock 응답 확인) — 다음 세션에 진행
> ⚠️ 미완료: git init + GitHub 연결 + Vercel 자동배포 설정 — 다음 세션에 진행

---

### Phase 5 — 실시간 이슈 피드 ✅ 완료 (2026-04-03)

스펙: `docs/superpowers/specs/2026-04-03-phase5-issue-feed.md`
플랜: `docs/superpowers/plans/2026-04-03-phase5-issue-feed.md`

**구현 완료:**

- `supabase/migrations/006_issue_feed.sql` — issue_feed 테이블 (2시간 캐시)
- `supabase/functions/issue-feed/index.ts` — KIS 거래량 상위 + 네이버 뉴스 + Claude Haiku, on-demand + DB 캐시
- `src/hooks/useIssueFeed.js` — DB 캐시 우선 조회, 없으면 Edge Function 호출
- `src/components/SearchScreen.jsx` — 토스증권 AI 스타일 한 줄 배너 (검색창 위, 6초 순환), 마퀴 유지(30초)
- `src/components/LoadingScreen.jsx` — 8개 문구 2.5초 순환, FOMO 표현 제거
- `supabase/functions/check-stock/index.ts` — LOSS_LABELS/GAIN_LABELS 룩업 테이블, "날린다" 제거

**배너 구조:** `✦ 실시간 이슈  [종목명 이슈텍스트]  ›` — 한 줄, 배경 없음, 박스 없음

---

### Phase 11 — 시뮬레이션 고도화 + UX 개선 ✅ 완료 (2026-04-09)

**몬테카를로 GBM 시뮬레이션 (check-stock Edge Function):**
- 기존 선형 비례(`annualReturn × years`) → 1000경로 기하 브라운 운동
- 기간별 드리프트 가중 블렌딩: 3개월(단기5일 70%), 6개월(중기10일 40%), 1년(중기 20%)
- Box-Muller 정규분포 난수, GBM `exp(μdt + σ√dt·Z)` 일별 시뮬레이션
- 중위값(50th) = amount, 90th = bestAmount, 10th = worstAmount
- 기간별로 독립적인 방향 가능 (3개월↓ 6개월↑ 등)
- 클램프 범위 확대: -40% ~ +50% (기존 -20% ~ +30%)

**시뮬레이션 카드 UX:**
- 세로 구분선 추가 (40% 높이, `rgba(0,0,0,0.06)`)
- 칼럼 패딩 8px → 14px
- 치환 라벨 15px 700 (메인) + 금액 12px 500 (보조)

**치환 데이터 전면 교체:**
- 서버+클라이언트 LABELS 통일: 24단계 현실 가격 기반 (5천원 아메리카노 ~ 1.5억 수입차)
- 클라이언트 룩업 우선 (LLM 부정확 라벨 무시)
- 이모지+치환값 항상 같은 소스(LIFE_LABELS)에서 매칭
- ok/hold 기대값 마이너스 시 bestAmount로 자동 전환

**종목 데이터:**
- stocks.json 138개 → 527개 (코스닥 시총 상위 대량 추가)
- 네이버 API(`m.stock.naver.com/api/stock/{code}/basic`)로 전수 검증, 불일치 0개
- Fuse.js threshold 0.35 → 0.4 (오타 허용 확대)

**이모지 시스템 개편:**
- 등급별 랜덤 2종: ban(exploding/screaming), wait(peekingeye/grimacing), ok(cowboy/smiling), hold(thinking/rollingeyes)
- 시퀀스 2사이클+정면마무리 (9프레임): frontal→right→frontal→left→frontal→right→frontal→left→frontal
- 깜빡임 해결: crossfade+opacity → 전 프레임 프리렌더+visibility 토글 (3곳 통일)

---

### Phase 8 — VerdictScreen 리디자인 + LLM 콘텐츠 개선 ✅ 완료 (2026-04-07)

**VerdictScreen 전면 개편:**
- 배경: radial-gradient 제거 → `#F3F4F6` JOMO 그레이 단색
- MainPage: VERDICT 단계 전체 배경 `#F3F4F6`, Header `transparent` prop 추가
- 히어로: Liquid Glass 카드 박스 제거 → 자유롭게 페이지 위
- 이모지 버블: TwEmoji(Twitter CDN) 제거 → 네이티브 텍스트 이모지 (iOS Apple 이모지 렌더링)
- 이모지 버블 스타일: 흰 원형 → Liquid Glass (등급별 컬러 tint + backdropFilter + bubbleGlow)
- 서브텍스트 추가: "만약 네가 [종목명]에 [투자금]을 넣었다면?" (메인 타이틀 위)
- 메인 타이틀: 28px → 22px, 900weight, 고정 텍스트 유지 ("호구 입장 1초 전" 등)
- 이슈 태그: 히어로 외부 → 히어로 내부 하단 중앙 정렬, 11px
- 이유 카드: 개별 Liquid Glass 카드 → 하나의 흰 리스트 카드 (margin 10px 12px, radius 18px)
- 이유 항목: 이모지 19px + 닉네임 13px 800 + 설명 11px tertiary + 구분선 0.5px
- market 카드: 제거 → 재추가 (4개 이유 유지)

**Edge Function 콘텐츠 개선:**
- LOSS_LABELS: 9개 → 17개 (떡볶이, 삼겹살, 헬스장, 치킨5마리, 콘서트, 갤럭시버즈, 닌텐도, 아이폰절반, 맥북, 유럽여행 등)
- GAIN_LABELS: 9개 → 13개
- lossConversion: 서버 룩업 → LLM 생성 문장 (날린다 허용, fallback은 룩업 테이블)
- LLM 프롬프트: 손실 라벨 컨텍스트 전달 → LLM이 판결 톤에 맞는 문장 생성
- "날린다" 표현 금지 해제
- 말투 가이드: 드립 스타일 예시 추가 (사기 전 판단 맥락 명시)

### Phase 7 — UI 디테일 + 이슈 피드 안정화 ✅ 완료 (2026-04-07)

- SearchScreen 히어로: 3D 그리마싱 이모지 PNG crossfade 애니메이션 (`public/emoji/`)
- 타이틀 34px, 이모지 56px, 간격 8px
- AmountInput: stockCode 상태 추가 → 이름 검색 시에도 로고 표시
- AmountInput: 수량/현재가 26px, 서브타이틀 secondary 색상, placeholder "몇 주?"
- 이슈 피드: ETN/ETF/레버리지/인버스 필터링, 캐시 2시간 → 30분, 재배포
- 이슈 배너: stock_name 코드일 때 로컬 stocks.json 조회 + 클릭 시 displayName 전달

### Phase 6 — 분석 고도화 + UX 보완 ✅ 완료 (2026-04-06)

**DART 공시 연동:**
- `fetchDartData(stockCode)` 추가 — corp_code 조회 후 관리종목/투자주의/상장폐지 공시 2년치
- 강제 ban 트리거: DART 위험 공시 감지 시 LLM 판정 무관 즉시 ban + score 75점 이상 강제
- `DART_API_KEY` 환경변수 추가

**LLM 직접 판정 (analyzeWithLLM):**
- 기존 `generateVerdictWithLLM()` → `analyzeWithLLM()` 전면 교체
- LLM이 ban/wait/ok/hold 등급 직접 결정 (기존: 룰 기반 등급 결정 후 LLM은 멘트만)
- `fetchNewsItems()` 추가 — 뉴스 키워드 카운팅 대신 실제 기사 내용 LLM에 전달
- 예비판정 앵커 — 룰 기반 점수로 prelimGrade 먼저 계산 후 LLM에 전달 (hold 도망 방지)
- hold 극도 제한 — 데이터 완전 없을 때만, 데이터 있으면 hold 금지
- fallback: 예비판정 등급 사용 (기존 hold 고정 폐지)

**AmountInput 전면 개편:**
- 플로우: 바텀시트 → 풀페이지 (AMOUNT step 별도 추가)
- 단위: 만원 → 주(株)
- 시스템 키보드 (투명 input 오버레이 기법)
- 프리셋 칩: "+1주/+5주/+10주/+50주" 누적 방식 + 라인 스타일
- 현재가 15초 폴링: AMOUNT 체류 중 자동 갱신
- Liquid Glass CTA: blur(28px) saturate(180%) + 레이어드 섀도

**미국 주식 차단:**
- `USStockSheet.jsx` 신규 — "미국 주식은 열심히 준비 중이야" 바텀시트
- `isUSStock()` 감지 — 영문 티커 + 한글 미국 기업명 목록
- API 호출 없이 즉시 시트 노출

**MainPage 플로우 개선:**
- `priceOnly` 결과 확인 후 AMOUNT 이동 (종목 미존재 시 빈 페이지 방지)
- `isSearching` 상태 — 검색 중 스피너 + 중복 검색 방지
- 에러 시 검색 페이지 유지 + 에러 메시지 표시

### 반응형 레이아웃
- `App.jsx`: 640px wrapper (`max-w-[640px] mx-auto w-full min-h-dvh`)
- `src/index.css` `#root`: `align-items: center` (mx-auto 정상 동작을 위해)

---

# 작업원칙
- **확장성/유연성 검토**: 현재 요구사항을 해결하되, 향후 확장이 막히지 않는 구조 확인
- **기존 코드 재사용**: 새로 만들기 전에 `components/`, `theme.js` 등 기존 리소스를 먼저 탐색
- **커뮤니케이션**: 항상 **개요(왜, 무엇을)** → **상세 구현 계획** 순서로 설명

### 작업 프로세스 (필수!)

> ⛔ **코드 작성 전 반드시 4단계까지 완료하고 사용자 승인을 받을 것.**

#### 1단계: 문제/요청 이해
- 문제 현상을 명확히 기술
- 불분명한 부분이 있으면 사용자에게 질문

#### 2단계: 원인 분석 (문제 해결의 경우)
- 가설 수립 → 가설 검증 → 원인 확정

#### 3단계: 해결책 탐색
- 해결 방안 2-3개 제시, 각 방안의 영향 범위 분석

#### 4단계: 작업 계획 보고 (코드 작성 전 필수!)

```
작업 계획 보고

문제 상황: 어떤 상황에서 어떤 증상이 발생하는지
목표: 이 작업이 완료되면 어떤 상태가 되어야 하는지
원인 분석: 검증된 원인만 기술
변경 예정 파일: 파일 경로 | 변경 내용

이대로 진행해도 될까요?
```

#### 5단계: 작업 실행
#### 6단계: 결과 검증

| # | 확인 항목 |
|---|-----------|
| 1 | 빌드 에러 없음 (`npm run build`) |
| 2 | 헥스 코드 미사용 (CSS 변수 사용) |
| 3 | Tailwind 기본값 미사용 |
| 4 | 기존 컴포넌트 재사용 확인 |
| 5 | 기존 기능 정상 동작 확인 |

#### 7단계: 작업 완료 — 변경 사항 요약 보고

### 금지 사항

| 금지 | 올바른 대안 |
|------|-------------|
| 허락 없이 새 파일 생성 | 사용자에게 먼저 제안 후 승인 |
| 기존 아키텍처 임의 변경 | 변경 필요 시 이유와 함께 제안 |
| 요청 범위 밖 리팩토링 | "이 부분도 개선하면 좋겠는데, 할까요?" |
| 디자인 토큰 없이 스타일링 | 항상 `var(--*)` 또는 Tailwind 커스텀 토큰 사용 |
