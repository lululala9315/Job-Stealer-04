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
supabase functions deploy check-stock
```

## 아키텍처

**stockcheck** — 초간편 주식 판결 & 손실방어 서비스. 종목 검색 → 투자금 입력 → AI 판결(4단계) → 장기 시뮬레이션. FOMO에 눈먼 왕초보를 위한 "그래서 사? 말아?" 한마디에 답하는 앱.

**Tech Stack**: Vite + React 19 + Tailwind CSS v4 + Supabase (Auth/DB/Edge Functions)

### 데이터 흐름

```
프론트 SearchScreen → AmountInput(바텀시트) → MainPage.handleAmountSubmit()
  → supabase.functions.invoke('check-stock', { query, userId, investAmount })
  → Edge Function:
      [병렬] KIS API (시세/일별) + Yahoo Finance (VIX/KOSPI/KOSDAQ/DXY)
           + Alternative.me (공포탐욕) + 네이버 뉴스 API
      → 3축 스코어링 (종목40 + 시장40 + 뉴스20 = 100점)
      → 판결 등급 결정 (절대금지/대기/괜찮아 보여/관망)
      → Claude Haiku API (판결 멘트 + 비유 근거 + 치환 텍스트 생성)
      → check_history 테이블 저장
  → VerdictScreen (스크롤 뷰: 판결 → 치환 → 근거)
  → SimulationScreen (5/10/20년 예측 + 미니 그래프)
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
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — 자동 주입됨

> `GEMINI_API_KEY`는 더 이상 사용하지 않음 (무료 쿼터 소진 + Claude Haiku로 전환)

### 판단 로직 (3축 스코어링)

100점 만점, 높을수록 위험:

| 축 | 배점 | 데이터 소스 |
|----|------|------------|
| 종목 | 40점 | KIS API (가격 위치 12 + PER 밸류 10 + 거래량 10 + RSI 8) |
| 시장 | 40점 | Yahoo Finance (VIX 10 + 코스피/코스닥 8 + DXY 6) + Alternative.me (공포탐욕 8) + Fed rate 하드코딩 (금리 8) |
| 뉴스 | 20점 | 네이버 뉴스 (루머 비율 12 + 반영 여부 8) |

> RSI는 KIS 일별시세 API의 `changeRate` 14일치로 계산. 기관/외인 수급 API 미완성으로 대체.

판결 등급 임계값:

| 점수 | 등급 |
|------|------|
| >= 45 | 절대금지 (ban) |
| >= 25 | 대기 (wait) |
| < 25 | 괜찮아 보여 (ok) |
| 데이터 부족 | 관망 (hold) |

> 기존 70/45/0 임계값은 실데이터 범위와 불일치 — 전종목 ok 판정 문제로 2026-04-02 조정

### KIS 토큰 캐시 (`kis_token_cache` 테이블)

KIS API 토큰 1분/1회 발급 제한 대응을 위한 DB 캐시.
- 3티어 캐시: 모듈 변수 → DB `kis_token_cache` → 신규 발급
- Edge Function 콜드 스타트 시 워커 간 토큰 공유
- 마이그레이션: `supabase/migrations/005_kis_token_cache.sql`
- 토큰 만료 자동 복구 (2026-04-03 추가): `isKisTokenError()` 감지 → `clearKisTokenCache()` → 재발급 후 1회 재시도
- 에러 코드: `EGW00123`(만료), `EGW00201`(접근거부), `IGW00109`(요청거부)
- `fetchPriceData`: `data.output` 없으면 `msg1/msg_cd`로 에러 throw (크래시 방지)

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
```

RLS 활성화. 본인 데이터만 접근 가능.

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

### 멘트 톤 가이드 (Gemini 프롬프트 필독)
- 손익을 실생활로 치환: "치킨 3마리 태웠다", "커피 20잔 날림"
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

## 구현 상태 (2026-04-03)

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
