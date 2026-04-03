# Phase 5 스펙: 이슈 피드 + 로딩 개선 + 표현 개편

**작성일:** 2026-04-03  
**대상 파일:** SearchScreen.jsx, LoadingScreen.jsx, supabase/functions/issue-feed/index.ts, supabase/functions/check-stock/index.ts, supabase/migrations/006_issue_feed.sql

---

## 1. 배경 및 목적

- 현재 SearchScreen 하단의 마퀴(가로 스크롤 인기종목)는 정적 데이터로 구성되어 실질적 가치가 없음
- 교체 목표: 실시간 이슈 기반 카드 피드 — "왕초보가 지금 뭘 사고 싶어하는지" 선제적으로 잡아주는 FOMO 차단 훅
- 로딩 화면과 손실/수익 표현도 이번 Phase에 함께 개선

---

## 2. Phase 5 — 이슈 피드

### 2-1. 아키텍처

**데이터 흐름 (On-demand + 2시간 캐시):**

```
SearchScreen 마운트
  → supabase DB issue_feed 테이블 조회 (expires_at > now())
  → 유효 데이터 있으면 → 즉시 렌더링
  → 없으면 → issue-feed Edge Function 호출
      → KIS API: 거래량 상위 20종목 중 거래량 2배+ or 가격 ±3%+ 필터 → 5~8개
      → 네이버 뉴스 API: 각 종목 헤드라인 3개 수집
      → Claude Haiku: issueType / sentiment / emoji / one_line / plain_explain 생성
      → issue_feed 테이블 저장 (expires_at = now() + 2시간)
      → 결과 반환
  → 카드 렌더링
```

**캐시 전략:**
- Supabase DB가 캐시 저장소 역할 (별도 Redis 불필요)
- 2시간마다 만료 → 다음 사용자가 최초 진입 시 갱신
- Edge Function 응답 시간이 느릴 수 있으므로 스켈레톤 카드로 대응

### 2-2. DB 스키마

```sql
-- supabase/migrations/006_issue_feed.sql
create table if not exists issue_feed (
  id          uuid primary key default gen_random_uuid(),
  stock_code  text not null,
  stock_name  text not null,
  price_change numeric not null,  -- % 변화율 (양수=상승, 음수=하락)
  issue_type  text not null,      -- 임상실패 | 수주 | 실적 | 거시경제 | 루머 | 기타
  sentiment   text not null,      -- 위험 | 주의 | 긍정
  emoji       text not null,
  one_line    text not null,      -- 10자 이내 핵심 한 줄
  plain_explain text not null,    -- 2문장 이내 쉬운 설명
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- RLS: 읽기는 인증된 사용자 모두 허용
alter table issue_feed enable row level security;
create policy "issue_feed_read" on issue_feed
  for select using (auth.role() = 'authenticated');
create policy "issue_feed_insert" on issue_feed
  for insert with check (true);  -- Edge Function service role로 삽입
```

### 2-3. Edge Function (`issue-feed/index.ts`)

**입력:** 없음 (GET 요청)

**처리 순서:**
1. DB에서 유효한 캐시 조회 (`expires_at > now()`)
2. 캐시 있으면 즉시 반환
3. 없으면:
   a. KIS API `uapi/domestic-stock/v1/quotations/volume-rank` — 거래량 상위 20 조회
   b. 필터: 거래량배율 >= 2 OR 등락율 절대값 >= 3
   c. 상위 5~8개 종목
   d. 각 종목 네이버 뉴스 3개 수집 (기존 check-stock의 네이버 뉴스 로직 재사용)
   e. Claude Haiku 일괄 호출 (종목 전체를 한 번에 → 비용 최소화)
   f. 파싱 후 issue_feed 테이블 INSERT
   g. 결과 반환

> **KIS 토큰 공유:** issue-feed는 별도 Edge Function이므로 check-stock의 KIS 토큰 캐시 로직(`getKisToken`, `clearKisTokenCache`, `isKisTokenError`)을 그대로 복사해서 사용. 향후 공통 모듈화는 이번 스코프 밖.

**Claude Haiku 프롬프트:**
```
아래 종목들의 뉴스와 가격 데이터를 보고 JSON 배열로 응답해.
각 항목: { stock_code, sentiment("위험"|"주의"|"긍정"), emoji, one_line(10자 이내), plain_explain(2문장 이내, 반말, 전문용어 금지) }
sentiment 기준: 하락+부정뉴스=위험, 상승+긍정뉴스=긍정, 그 외=주의
```

**응답 스키마:**
```json
[
  {
    "stock_code": "028300",
    "stock_name": "HLB",
    "price_change": -11.7,
    "issue_type": "임상실패",
    "sentiment": "위험",
    "emoji": "💉",
    "one_line": "임상 또 실패",
    "plain_explain": "미국 FDA에서 신약 허가를 안 해줬어. 이런 경우 주가가 크게 흔들리는 게 보통이야."
  }
]
```

### 2-4. SearchScreen UI

**레이아웃 (토스증권 AI 배너 스타일):**
```
┌──────────────────────────────────────┐
│ ⚡ 실시간 이슈  반도체 대형주 급등 → │  ← 배너 (검색창 위)
└──────────────────────────────────────┘
[검색창]
[마퀴 자리 — 제거]
```

**배너 컴포넌트 (`IssueBanner`):**
- 검색창 바로 위, 히어로 섹션 아래에 위치
- 높이 고정 `44px` — 데이터 없으면 `display:none` (레이아웃 점프 없음)
- 배경: `var(--color-bg-input)` (연회색), 둥근 모서리 `12px`
- 왼쪽: `⚡ 실시간 이슈` 라벨 (고정, 13px bold, `var(--color-accent)`)
- 오른쪽: 이슈 텍스트 — `3초마다 다음 이슈로 fade 전환`
  - 예) "반도체 대형주 급등", "임상 3상 실패 급락", "미국 수주 소식"
  - `one_line` 필드 사용 (10자 이내)
- 탭 → 현재 표시 중인 이슈의 `stock_code`로 `onSearch()` 호출

**상태별 렌더링:**
- 로딩 중: 배너 자리에 스켈레톤 (44px 고정 높이, 회색 펄스)
- 에러 / 빈 데이터: 배너 숨김 (`display:none`) — 검색창 위치 변화 없음
- 정상: 이슈 3~5개 순환 (sentiment 기준 정렬: 위험 → 주의 → 긍정)

**마퀴 유지:** 기존 `POPULAR_STOCKS` 마퀴는 검색창 아래 그대로 유지. 이슈 배너와 역할이 다름 (배너=실시간 이슈, 마퀴=인기종목 빠른 탭).

---

## 3. 로딩 텍스트 사이클링

### 3-1. 현재 → 변경

| 항목 | 현재 | 변경 |
|------|------|------|
| 메시지 수 | 5개 (랜덤 1개 고정) | 8개 (2.5초마다 순환) |
| 전환 방식 | 없음 | opacity fade 0.3s |
| FOMO 단어 | "FOMO 방지벽 세우는 중..." 포함 | 전부 교체 |

### 3-2. 새 메시지 목록

```js
const LOADING_MESSAGES = [
  '충동이 올라오고 있어...',
  '지금 이 종목 진짜 괜찮은지 보는 중...',
  '팩트 몇 개 긁어오는 중...',
  '뇌동매매 감지 레이더 켜는 중...',
  '무릎인지 어깨인지 파악 중...',
  '지금 사면 어떻게 될지 시뮬 중...',
  '남들도 다 사는지 확인 중...',
  '이미 늦은 건지 확인 중...',
]
```

### 3-3. 구현 방식

```jsx
// useState + useEffect + setInterval
const [idx, setIdx] = useState(0)
useEffect(() => {
  const id = setInterval(() => setIdx(i => (i + 1) % LOADING_MESSAGES.length), 2500)
  return () => clearInterval(id)
}, [])
```

텍스트 전환 시 `key={idx}` 로 React 재마운트 → CSS `loadingFadeIn` 애니메이션 자동 재생.

---

## 4. 손실/수익 표현 개편

### 4-1. 방향

"날린다"는 표현 제거 → 엉뚱하고 구체적인 실생활 치환으로 교체.

| 방향 | 기존 | 변경 |
|------|------|------|
| 손실 | "치킨 5마리 날리고 싶나보네" | "제주도 왕복 두 번 갈 수 있었는데" |
| 수익 | "치킨 4마리 벌 수 있어" | "꿈에서 스테이크 먹는 수준이야" |

### 4-2. 금액별 룩업 테이블 (Edge Function 내 추가)

손실 표현 (lossConversion용):
```ts
const LOSS_LABELS = [
  { max: 10000,   text: '편의점 야식 한 번이야', emoji: '🍜' },
  { max: 30000,   text: '택시비 한 번이야', emoji: '🚕' },
  { max: 50000,   text: '치킨 한 마리인데', emoji: '🍗' },
  { max: 100000,  text: '디즈니플러스 5개월치야', emoji: '🎬' },
  { max: 200000,  text: '제주도 편도야', emoji: '✈️' },
  { max: 500000,  text: '제주도 왕복 두 번이야', emoji: '🏝️' },
  { max: 1000000, text: '메타버스에서 집 살 수 있었어', emoji: '🏠' },
  { max: 3000000, text: '한강뷰 원룸에서 한 달 살 수 있었어', emoji: '🌆' },
  { max: Infinity, text: '꿈에서만 살 수 있는 금액이야', emoji: '💭' },
]
```

수익 표현 (simulation label용):
```ts
const GAIN_LABELS = [
  { max: 10000,   text: '아메리카노 한 잔 수준이야', emoji: '☕' },
  { max: 30000,   text: '편의점 간식 한 세트야', emoji: '🍫' },
  { max: 50000,   text: '치킨 한 마리 뽑아', emoji: '🍗' },
  { max: 100000,  text: '소고기 한 팩 살 수 있어', emoji: '🥩' },
  { max: 200000,  text: '에어팟 케이블 새 걸로 바꿀 수 있어', emoji: '🎧' },
  { max: 500000,  text: '아이패드 반 대야', emoji: '📱' },
  { max: 1000000, text: '꿈에서 스테이크 먹는 수준이야', emoji: '🥩' },
  { max: 3000000, text: '국내 여행 한 번 풀코스야', emoji: '🗺️' },
  { max: Infinity, text: '꿈에서 차 한 대 뽑을 수 있어', emoji: '🚗' },
]
```

### 4-3. 적용 범위

- `lossConversion`: 판결 화면 손실 치환 텍스트 — LLM 프롬프트 가이드라인 업데이트
- `simulation.month3/6/year1.label`: 시뮬레이션 화면 수익 라벨 — 룩업 테이블로 서버에서 직접 생성 (LLM 불필요)

---

## 5. 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `supabase/migrations/006_issue_feed.sql` | issue_feed 테이블 신규 생성 |
| `supabase/functions/issue-feed/index.ts` | 이슈 피드 Edge Function 신규 생성 |
| `src/components/SearchScreen.jsx` | 이슈 배너(`IssueBanner`) 검색창 위에 추가, 마퀴 유지 |
| `src/components/LoadingScreen.jsx` | 메시지 사이클링 + 문구 교체 |
| `supabase/functions/check-stock/index.ts` | 손실/수익 룩업 테이블 추가, LLM 프롬프트 lossConversion 가이드 업데이트 |

---

## 6. 미포함 항목 (이번 스코프 밖)

- Supabase Cron 설정 (Free 플랜 제약, on-demand 캐시로 대체)
- 이슈 피드 관리자 UI
- 종목별 이슈 상세 페이지
