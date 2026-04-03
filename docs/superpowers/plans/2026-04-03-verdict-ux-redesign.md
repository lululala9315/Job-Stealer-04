# stockcheck UX 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SearchScreen 카피 변경 + VerdictScreen 전면 개편 + 시뮬레이션 스토리 중심 전환

**Architecture:**
1. Edge Function `rawData` 추가 + LLM 프롬프트 전면 개선 (MZ 30대 페르소나, issueType/sectorImpact, 스토리 시뮬레이션)
2. VerdictScreen 히어로 개편 (배지→타이틀, 이모지 강화)
3. VerdictScreen 이슈 태그 바 추가 (글래스카드 아래)
4. VerdictScreen 이유 카드 완전 재설계 (펼침, 룩업 테이블, 전문용어 제거)
5. SimulationScreen 스토리 중심 전환 (3개월/6개월/1년, best/worst case 양방향)

**Tech Stack:** React 19, Vite, Supabase Edge Functions (Deno), Claude Haiku API

**스펙 문서:** `docs/superpowers/specs/2026-04-03-verdict-ux-redesign.md`

---

### Task 1: SearchScreen 카피 변경

**Files:**
- Modify: `src/components/SearchScreen.jsx`

- [x] **Step 1: 타이틀, 서브타이틀, 마퀴 라벨 교체**

`src/components/SearchScreen.jsx` 에서 3곳 변경:

```jsx
// line 113 — 타이틀
어떤 주식에 눈 돌아갔어?
// →
오늘은 어떤 종목에 물리고 싶어?

// line 123 — 서브타이틀
사기 전에 AI한테 먼저 물어봐
// →
물리기 전에 나한테 먼저 물어봐

// line 227 — 마퀴 라벨
🔥 요즘 핫한 종목
// →
🔥 지금 뜨고있는 종목
```

- [x] **Step 2: 빌드 에러 확인**

```bash
cd "/Users/haeunlee/Desktop/claude/04 금융/stockcheck" && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` (에러 없음)

- [x] **Step 3: 커밋**

```bash
git add src/components/SearchScreen.jsx
git commit -m "SearchScreen 카피 변경 — 물리다 반어법으로 서비스 컨셉 강화"
```

---

### Task 2: Edge Function rawData 추가

**Files:**
- Modify: `supabase/functions/check-stock/index.ts`

`highRatio`, `volMultiple`은 현재 `generateVerdictWithLLM` 안에서만 계산됨. 프론트에서 카드 룩업에 필요하므로 응답에 추가.

- [x] **Step 1: generateVerdictWithLLM 반환값에 rawData 추가**

`index.ts`에서 `generateVerdictWithLLM` 함수의 return 부분을 찾아 `rawData` 추가:

```typescript
// generateVerdictWithLLM 함수 내 return 직전에
const rawDataForResponse = {
  highRatio: Math.round(priceData.week52High > 0
    ? (priceData.currentPrice / priceData.week52High) * 100
    : 50),
  per: priceData.per > 0 ? Math.round(priceData.per) : null,
  isDeficit: priceData.per <= 0,
  volMultiple: Math.round(todayVolMultiple * 10) / 10,
  fearGreed: ctx.marketSignals.fearGreed ?? null,
}

return {
  headlineMent: parsed.headlineMent,
  lossConversion: parsed.lossConversion,
  reasons: parsed.reasons || [],
  rawData: rawDataForResponse,  // ← 추가
}
```

- [x] **Step 2: 상위 result 객체에 rawData 포함**

메인 핸들러의 `result` 객체 (line ~214)에 추가:

```typescript
const result: VerdictResult = {
  stockName,
  stockCode,
  investAmount,
  verdict: { ... },        // 기존 그대로
  reasons: llmResult.reasons || [],
  rawData: llmResult.rawData,  // ← 추가
  simulation,
  signals: { ... },        // 기존 그대로
}
```

- [x] **Step 3: TypeScript 타입 추가 (VerdictResult 인터페이스)**

파일 상단 인터페이스 정의 부분에 `rawData` 타입 추가:

```typescript
// VerdictResult 인터페이스에 추가
rawData: {
  highRatio: number        // 52주 고점 대비 현재가 위치 (%)
  per: number | null       // 적자면 null
  isDeficit: boolean
  volMultiple: number      // 거래량 평소 대비 배수
  fearGreed: number | null // 0~100, 없으면 null
}
```

- [x] **Step 4: Edge Function 배포**

```bash
cd "/Users/haeunlee/Desktop/claude/04 금융/stockcheck"
supabase functions deploy check-stock
```

Expected: `Deployed Functions check-stock`

---

### Task 3: Edge Function LLM 프롬프트 개선

**Files:**
- Modify: `supabase/functions/check-stock/index.ts` (line ~975-1012)

- [x] **Step 1: headlineMent 톤 가이드 강화**

기존 (line ~1002):
```typescript
"headlineMent": "판결 한줄 멘트 (20~40자, 공감되는 독설)",
```

변경:
```typescript
"headlineMent": "10~20자. 반말. 주식 커뮤니티 말투. 예시: '지금 사면 기부 천사 등극' / '3일만 참아 진짜로' / '나쁘지 않은데 몰빵은 금지'. 금지: 수치 나열, 보고서 문체, 전문용어(PER/VIX/52주/이평선 등)",
```

- [x] **Step 2: lossConversion snarky 톤 변경**

기존:
```typescript
"lossConversion": "${lossUnit.emoji}${lossUnit.label} ${lossUnit.count}${lossUnit.unit} 날릴 확률 높음" 형식,
```

변경:
```typescript
"lossConversion": "snarky 톤으로. '${lossUnit.emoji}${lossUnit.label} ${lossUnit.count}${lossUnit.unit} 날리고 싶나보네' 또는 '~태울 각이네' 형식",
```

- [x] **Step 3: reasons 형식을 새 카드 구조로 변경**

기존 reasons 응답 형식:
```typescript
"reasons": [
  {
    "metaphor": "...",
    "detail": "...",
    "dataPoint": "..."
  }
]
```

변경 (응답 형식 부분):
```typescript
"reasons": [
  {
    "cardType": "price | value | volume | market | news 중 하나",
    "description": "2문장 이내. 완전 쉬운 말. 중학생도 이해 가능. 전문용어 절대 금지(PER/VIX/52주/이평선 등). 예시: '지금 거의 제일 비쌀 때야. 더 오를 공간이 없어.' / '이 회사가 돈 버는 속도로 따지면 네 투자금 돌려받는 데 50년 걸려.'"
  }
],
- reasons는 데이터가 있는 항목만 포함. 뉴스 없으면 news 제외.
- cardType 설명: price=가격위치, value=기업가치, volume=거래활발도, market=시장분위기, news=최근뉴스
```

- [x] **Step 4: 뉴스 헤드라인 context 주입**

프롬프트 데이터 섹션 (line ~977)에 뉴스 헤드라인 추가:

```typescript
// generateVerdictWithLLM 함수 내 newsSignals 활용
const newsHeadlines = ctx.newsSignals?.items
  ?.slice(0, 3)
  .map((n: { title: string }) => n.title)
  .join(' / ') || '없음'

const prompt = `...
## 종목 & 판결 데이터
...기존 데이터...
- 관련 뉴스: ${newsHeadlines}
...`
```

- [x] **Step 5: Edge Function 배포 및 검증**

```bash
supabase functions deploy check-stock
```

배포 후 브라우저에서 종목 검색 → 개발자 도구 Network 탭 → `check-stock` 응답 확인:
- `verdict.headlineMent`: 20자 이내, 반말, 전문용어 없음
- `verdict.lossConversion`: "날리고 싶나보네" 또는 "태울 각" 스타일
- `reasons[0].cardType`: "price", "value" 등 cardType 형식
- `reasons[0].description`: 쉬운 설명, 전문용어 없음
- `rawData.highRatio`: 숫자 (0~100)

- [x] **Step 6: 커밋**

```bash
git add supabase/functions/check-stock/index.ts
git commit -m "Edge Function rawData 추가 + LLM 프롬프트 왕초보 톤으로 강화"
```

---

### Task 4: VerdictScreen 히어로 섹션 개편

**Files:**
- Modify: `src/components/VerdictScreen.jsx`

- [x] **Step 1: GRADE_STYLES 업데이트**

기존 `GRADE_STYLES` (line ~29) 전체 교체:

```javascript
const GRADE_STYLES = {
  ban:  {
    glassColor: 'var(--color-verdict-ban-glass)',
    glowColor:  'var(--color-verdict-ban-glow)',
    label:  '절대금지',       // Edge Function 호환용 유지
    title:  '호구 입장 1초 전',
    emoji:  '🤬', cp: '1f92c',
    bubbleBg: 'rgba(240,68,82,0.08)',
  },
  wait: {
    glassColor: 'var(--color-verdict-wait-glass)',
    glowColor:  'var(--color-verdict-wait-glow)',
    label:  '대기',
    title:  '호구 대기표 뽑는 중',
    emoji:  '😤', cp: '1f624',
    bubbleBg: 'rgba(245,158,11,0.08)',
  },
  ok:   {
    glassColor: 'var(--color-verdict-ok-glass)',
    glowColor:  'var(--color-verdict-ok-glow)',
    label:  '괜찮아 보여',
    title:  '인정. 가즈아!',
    emoji:  '😎', cp: '1f60e',
    bubbleBg: 'rgba(49,130,246,0.08)',
  },
  hold: {
    glassColor: 'var(--color-verdict-hold-glass)',
    glowColor:  'var(--color-verdict-hold-glow)',
    label:  '관망',
    title:  '이건 어렵군..',
    emoji:  '🫠', cp: '1fae0',
    bubbleBg: '#F2F4F6',
  },
}
```

- [x] **Step 2: 글래스카드 내부 레이아웃 재배치**

글래스카드(섹션 A) 내부에서:

1. **배지 라벨 블록 완전 제거** (display:inline-flex, 배지 스타일 전체 삭제)

2. **headlineMent `<p>` 를 아래 구조로 교체**:

```jsx
{/* 판결 타이틀 — 등급별 고정 텍스트, 크게 */}
<p
  style={{
    fontSize: '28px',
    lineHeight: '36px',
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.5px',
    textWrap: 'balance',
    position: 'relative',
    zIndex: 1,
    marginBottom: '8px',
  }}
>
  {gradeStyle.title}
</p>

{/* AI 멘트 — 작게, 보조 역할 */}
{verdict.headlineMent && (
  <p
    style={{
      fontSize: '14px',
      lineHeight: '21px',
      color: 'var(--color-text-secondary)',
      position: 'relative',
      zIndex: 1,
      marginBottom: '10px',
    }}
  >
    {verdict.headlineMent}
  </p>
)}

{/* 손실 치환 — 카드 하단 */}
{lossConversion && (
  <p
    style={{
      fontSize: '15px',
      fontWeight: 700,
      color: gradeColor,
      position: 'relative',
      zIndex: 1,
    }}
  >
    {lossConversion}
  </p>
)}
```

3. **기존 섹션 B (손실 치환 독립 카드) 완전 제거**

- [x] **Step 3: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` (에러 없음)

- [x] **Step 4: 커밋**

```bash
git add src/components/VerdictScreen.jsx
git commit -m "VerdictScreen 히어로 개편 — 배지→타이틀(28px), 이모지 강화(🤬😤😎🫠)"
```

---

### Task 5: VerdictScreen 이유 카드 완전 재설계

**Files:**
- Modify: `src/components/VerdictScreen.jsx`

- [x] **Step 1: 카드 룩업 함수 추가**

VerdictScreen.jsx 상단 (GRADE_COLORS 아래)에 추가:

```javascript
/** 가격 위치 카드 — highRatio(%) → 건물층 메타포 */
function getPriceCard(highRatio) {
  if (highRatio >= 85) return { emoji: '🗼', title: '지금 가격이 어디야?', nickname: '꼭대기야' }
  if (highRatio >= 65) return { emoji: '🏢', title: '지금 가격이 어디야?', nickname: '고층이야' }
  if (highRatio >= 40) return { emoji: '🪜', title: '지금 가격이 어디야?', nickname: '딱 중간층이야' }
  if (highRatio >= 20) return { emoji: '🏚️', title: '지금 가격이 어디야?', nickname: '폐가 수준이야' }
  return                      { emoji: '⛺', title: '지금 가격이 어디야?', nickname: '텐트야' }
}

/** 기업 가치 카드 — per(배) → 회수 기간 메타포 */
function getValueCard(per, isDeficit) {
  if (isDeficit || per === null) return { emoji: '💸', title: '이 회사 제값이야?', nickname: '돈도 못 버는 회사' }
  if (per >= 60) return { emoji: '🤑', title: '이 회사 제값이야?', nickname: '바가지 씌우는 중' }
  if (per >= 30) return { emoji: '😒', title: '이 회사 제값이야?', nickname: '좀 비싸' }
  if (per >= 15) return { emoji: '👌', title: '이 회사 제값이야?', nickname: '적당해' }
  return                { emoji: '💎', title: '이 회사 제값이야?', nickname: '진짜 싸게 파는 중' }
}

/** 거래 분위기 카드 — volMultiple(배) */
function getVolumeCard(volMultiple) {
  if (volMultiple >= 3)   return { emoji: '🔥', title: '오늘 얼마나 사고 팔아?', nickname: '뭔가 터졌나봐' }
  if (volMultiple >= 1.5) return { emoji: '👀', title: '오늘 얼마나 사고 팔아?', nickname: '좀 활발해' }
  return                         { emoji: '😴', title: '오늘 얼마나 사고 팔아?', nickname: '조용해' }
}

/** 시장 기분 카드 — fearGreed(0~100), null이면 null 반환 → 미노출 */
function getMarketCard(fearGreed) {
  if (fearGreed === null || fearGreed === undefined) return null
  if (fearGreed <= 30) return { emoji: '😱', title: '요즘 주식 시장 기분?', nickname: '다들 겁쟁이 모드' }
  if (fearGreed <= 69) return { emoji: '😐', title: '요즘 주식 시장 기분?', nickname: '평범해' }
  return                      { emoji: '🤪', title: '요즘 주식 시장 기분?', nickname: '다들 흥분 모드' }
}

/**
 * LLM reasons + rawData → 화면 카드 배열 생성
 * cardType별 룩업 테이블에서 emoji/title/nickname, description은 LLM 생성값 사용
 * 데이터 없는 카드 자동 미노출
 */
function buildReasonCards(reasons, rawData) {
  if (!reasons?.length || !rawData) return []

  const lookup = {
    price:  rawData.highRatio != null ? getPriceCard(rawData.highRatio) : null,
    value:  getValueCard(rawData.per, rawData.isDeficit),
    volume: rawData.volMultiple != null ? getVolumeCard(rawData.volMultiple) : null,
    market: getMarketCard(rawData.fearGreed),
    news:   { emoji: '📰', title: '요즘 무슨 얘기 나와?', nickname: null },
  }

  return reasons
    .filter(r => r.cardType && lookup[r.cardType])
    .map(r => ({ ...lookup[r.cardType], description: r.description }))
}
```

- [x] **Step 2: VerdictScreen 컴포넌트 상단에 reasonCards 계산 추가**

```javascript
// 기존 const reasons = result?.reasons || [] 줄 바로 아래에 추가
const reasonCards = buildReasonCards(result?.reasons, result?.rawData)
```

- [x] **Step 3: 섹션 C(이유 카드) 완전 교체**

기존 섹션 C 전체 (토글 포함) 삭제 후 새 카드로 교체:

```jsx
{/* ── 섹션 C: 이유 카드 — 완전 펼침 ── */}
{reasonCards.length > 0 && (
  <div
    style={{
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.16s both',
    }}
  >
    {reasonCards.map((card, i) => (
      <div
        key={i}
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-xl)',
          padding: '16px',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* 상단: 이모지 + 카드 제목 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '22px', lineHeight: 1 }}>{card.emoji}</span>
          <span
            style={{
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
              fontWeight: 600,
            }}
          >
            {card.title}
          </span>
        </div>

        {/* 닉네임 */}
        {card.nickname && (
          <p
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.2px',
              marginBottom: '6px',
            }}
          >
            {card.nickname}
          </p>
        )}

        {/* 설명 */}
        <p
          style={{
            fontSize: '14px',
            lineHeight: '21px',
            color: 'var(--color-text-secondary)',
          }}
        >
          {card.description}
        </p>
      </div>
    ))}
  </div>
)}
```

- [x] **Step 4: 더 이상 사용하지 않는 state 제거**

기존 `const [openReasonIdx, setOpenReasonIdx] = useState(null)` 줄 삭제 (토글 제거로 불필요).

- [x] **Step 5: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` (에러 없음)

- [x] **Step 6: 커밋**

```bash
git add src/components/VerdictScreen.jsx
git commit -m "VerdictScreen 이유 카드 재설계 — 완전 펼침, 건물층 메타포, 전문용어 제거"
```

---

### Task 6: 시뮬레이션 기간 1/5/10년으로 변경

**Files:**
- Modify: `supabase/functions/check-stock/index.ts` (buildSimulation 함수)
- Modify: `src/components/SimulationScreen.jsx`

- [x] **Step 1: Edge Function buildSimulation 함수에서 year1 추가, year20 제거**

`buildSimulation` 함수 내 `longTerm.projections` 부분:

```typescript
// 기존: year5, year10, year20
// 변경: year1, year5, year10

const year1Amount = Math.round(investAmount * Math.pow(1 + annualReturn, 1))
const year5Amount = Math.round(investAmount * Math.pow(1 + annualReturn, 5))
const year10Amount = Math.round(investAmount * Math.pow(1 + annualReturn, 10))

projections: {
  year1:  { amount: year1Amount,  label: getLabel(year1Amount,  investAmount), emoji: getEmoji(year1Amount,  investAmount) },
  year5:  { amount: year5Amount,  label: getLabel(year5Amount,  investAmount), emoji: getEmoji(year5Amount,  investAmount) },
  year10: { amount: year10Amount, label: getLabel(year10Amount, investAmount), emoji: getEmoji(year10Amount, investAmount) },
}
```

- [x] **Step 2: SimulationScreen.jsx 년도 표시 업데이트**

`SimulationScreen.jsx`에서:

```jsx
// 기존
const { year5, year10, year20 } = projections

const chartValues = [
  investAmount || 1_000_000,
  year5?.amount,
  year10?.amount,
  year20?.amount,
].filter(Boolean)

const headline = year5
  ? `5년 뒤, 넌 ${year5.label}이야 ${year5.emoji}`
  : '장기 시뮬레이션'

// 변경
const { year1, year5, year10 } = projections

const chartValues = [
  investAmount || 1_000_000,
  year1?.amount,
  year5?.amount,
  year10?.amount,
].filter(Boolean)

const headline = year1
  ? `1년 뒤, 넌 ${year1.label}이야 ${year1.emoji}`
  : '장기 시뮬레이션'
```

그리고 시점별 블록 배열:

```jsx
// 기존
[
  { key: 'year5',  label: '5년 뒤',  delay: '0s' },
  { key: 'year10', label: '10년 뒤', delay: '0.07s' },
  { key: 'year20', label: '20년 뒤', delay: '0.14s' },
]

// 변경
[
  { key: 'year1',  label: '1년 뒤',  delay: '0s' },
  { key: 'year5',  label: '5년 뒤',  delay: '0.07s' },
  { key: 'year10', label: '10년 뒤', delay: '0.14s' },
]
```

차트 X축 라벨 (`MiniLineChart` 컴포넌트):

```jsx
// 기존
const labels = ['현재', '5년', '10년', '20년']

// 변경
const labels = ['현재', '1년', '5년', '10년']
```

- [x] **Step 3: Edge Function 배포**

```bash
supabase functions deploy check-stock
```

- [x] **Step 4: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in`

- [x] **Step 5: 커밋**

```bash
git add src/components/SimulationScreen.jsx supabase/functions/check-stock/index.ts
git commit -m "시뮬레이션 기간 1/5/10년으로 변경 — 왕초보 타겟 현실적 기간"
```

---

---

### Task 7: VerdictScreen 이슈 태그 바 추가

**Files:**
- Modify: `src/components/VerdictScreen.jsx`

글래스카드 아래, 이유 카드들 위에 이슈 태그 바 추가.
LLM이 반환하는 `issueType`, `sectorImpact`, `impactTag`, `priceSignalTag` 활용.

- [x] **Step 1: 태그 데이터 추출**

VerdictScreen 컴포넌트 상단에 추가:

```javascript
// result에서 태그 데이터 추출
const issueTags = []

const issueTypeEmojis = {
  임상실패: '💣', 수주: '🏆', 실적: '📊',
  거시경제: '🌍', 루머: '🗣️', 기타: '📌',
}

if (result?.issueType && result.issueType !== '기타') {
  issueTags.push({
    label: result.issueType,
    emoji: issueTypeEmojis[result.issueType] || '📌',
    bgColor: 'rgba(234,88,12,0.08)',
    textColor: 'rgba(234,88,12,1)',
  })
}

if (result?.impactTag) {
  const isPositive = result.sectorImpact === '긍정'
  issueTags.push({
    label: result.impactTag,
    emoji: isPositive ? '🔵' : '🔴',
    bgColor: isPositive ? 'rgba(49,130,246,0.08)' : 'rgba(240,68,82,0.08)',
    textColor: isPositive ? 'var(--color-verdict-ok)' : 'var(--color-verdict-ban)',
  })
}

if (result?.priceSignalTag) {
  issueTags.push({
    label: result.priceSignalTag,
    emoji: '📉',
    bgColor: 'var(--color-bg-input)',
    textColor: 'var(--color-text-secondary)',
  })
}
```

- [x] **Step 2: 태그 바 렌더링 추가**

섹션 A(글래스카드) 닫는 태그 바로 아래에 삽입:

```jsx
{/* ── 이슈 태그 바 — 데이터 있을 때만 노출 ── */}
{issueTags.length > 0 && (
  <div
    style={{
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      marginBottom: '16px',
      paddingBottom: '2px',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
      animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.1s both',
    }}
  >
    {issueTags.map((tag, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: tag.bgColor,
          borderRadius: 'var(--radius-full)',
          padding: '6px 12px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '13px' }}>{tag.emoji}</span>
        <span style={{
          fontSize: '13px',
          fontWeight: 600,
          color: tag.textColor,
        }}>
          {tag.label}
        </span>
      </div>
    ))}
  </div>
)}
```

- [x] **Step 3: Edge Function 응답에서 태그 필드 추출**

VerdictScreen에서 result 구조 확인:

```javascript
// result 최상위 레벨에 issueType 등 필드가 있어야 함
// Task 3에서 LLM이 생성한 값이 result에 포함되어 있는지 확인
// 없으면 result.verdict 또는 result.reasons[0]에서 추출하도록 수정
```

- [x] **Step 4: 빌드 확인 및 커밋**

```bash
npm run build 2>&1 | tail -5
git add src/components/VerdictScreen.jsx
git commit -m "VerdictScreen 이슈 태그 바 추가 — 판결 컨텍스트 한눈에"
```

---

### Task 6 (수정): 시뮬레이션 스토리 중심 전환

**Files:**
- Modify: `src/components/SimulationScreen.jsx`
- Modify: `supabase/functions/check-stock/index.ts` (buildSimulation 함수)

기존 계획(1/5/10년 단방향) → 스토리 중심(3개월/6개월/1년, best/worst case 양방향)

- [x] **Step 1: Edge Function buildSimulation 함수 변경**

기존 `projections: { year5, year10, year20 }` → 새 구조:

```typescript
// dailyVolatility 활용
const annualVol = simulation.shortTerm.dailyVolatility * Math.sqrt(252)
const annualReturn = longTerm.annualReturn || 0.08

// 기간별 best/worst case
function calcScenario(months: number) {
  const years = months / 12
  const bestReturn = annualReturn * years + annualVol * Math.sqrt(years) * 1.28  // 상위 10%
  const worstReturn = annualReturn * years - annualVol * Math.sqrt(years) * 1.28 // 하위 10%
  return {
    bestCase: {
      amount: Math.round(investAmount * (1 + bestReturn)),
      label: getLabel(Math.round(investAmount * (1 + bestReturn)), investAmount),
      emoji: getEmoji(Math.round(investAmount * (1 + bestReturn)), investAmount),
    },
    worstCase: {
      amount: Math.round(investAmount * (1 + worstReturn)),
      label: getLabel(Math.round(investAmount * (1 + worstReturn)), investAmount),
      emoji: getEmoji(Math.round(investAmount * (1 + worstReturn)), investAmount),
    },
  }
}

projections: {
  month3: calcScenario(3),
  month6: calcScenario(6),
  year1:  calcScenario(12),
}
```

- [x] **Step 2: SimulationScreen.jsx 전면 재설계**

```jsx
export default function SimulationScreen({ simulation, investAmount, onReset }) {
  const projections = simulation?.longTerm?.projections || {}
  const periods = [
    { key: 'month3', label: '3개월 뒤' },
    { key: 'month6', label: '6개월 뒤' },
    { key: 'year1',  label: '1년 뒤' },
  ]

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '40px', animation: 'questionIn 0.22s cubic-bezier(0.2, 0, 0, 1)' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px' }}>
        그래도 샀다면? 🤷
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--color-text-tertiary)', marginBottom: '24px' }}>
        투자금 {(investAmount || 1_000_000).toLocaleString()}원 기준
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
        {periods.map(({ key, label }, i) => {
          const item = projections[key]
          if (!item) return null
          return (
            <div key={key} style={{
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-xl)',
              padding: '16px 20px',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'var(--shadow-card)',
              animation: `simIn 0.35s cubic-bezier(0.2, 0, 0, 1) ${i * 0.07}s both`,
            }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>
                📅 {label}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* 잘 됐을 때 */}
                <div style={{ flex: 1, backgroundColor: 'rgba(49,130,246,0.06)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--color-verdict-ok)', fontWeight: 600, marginBottom: '4px' }}>잘 되면</p>
                  <p style={{ fontSize: '15px', fontWeight: 700 }}>{item.bestCase.emoji} {item.bestCase.label}</p>
                </div>
                {/* 안 됐을 때 */}
                <div style={{ flex: 1, backgroundColor: 'rgba(240,68,82,0.06)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--color-verdict-ban)', fontWeight: 600, marginBottom: '4px' }}>안 되면</p>
                  <p style={{ fontSize: '15px', fontWeight: 700 }}>{item.worstCase.emoji} {item.worstCase.label}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={onReset} style={{
        width: '100%', height: 'var(--button-height-lg)',
        backgroundColor: 'var(--color-accent)', color: '#ffffff',
        border: 'none', borderRadius: 'var(--button-radius)',
        fontSize: '17px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        marginBottom: '16px',
      }}>
        다시 검색
      </button>

      <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: '18px' }}>
        과거 변동성 기준 추정치. 미래 수익을 보장하지 않습니다.
      </p>

      <style>{`
        @keyframes simIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
```

- [x] **Step 3: Edge Function 배포 및 빌드 확인**

```bash
supabase functions deploy check-stock
npm run build 2>&1 | tail -5
```

- [x] **Step 4: 커밋**

```bash
git add src/components/SimulationScreen.jsx supabase/functions/check-stock/index.ts
git commit -m "시뮬레이션 스토리 중심 전환 — 3개월/6개월/1년, 잘됐을때vs안됐을때"
```

---

## 셀프 리뷰

**스펙 커버리지 체크:**
- [x] SearchScreen 타이틀/서브타이틀/마퀴 → Task 1
- [x] GRADE_STYLES 이모지+타이틀 → Task 4
- [x] 배지 제거, 타이틀 크게 → Task 4
- [x] AI 멘트 작게 → Task 4
- [x] 손실 치환 snarky 톤 + 카드 안으로 이동 → Task 3 + Task 4
- [x] 이유 카드 완전 펼침 → Task 5
- [x] 건물층 메타포 (⛺🏚️🪜🏢🗼) → Task 5
- [x] 기업 가치 카드 PER 숨기기 → Task 5
- [x] 거래 분위기, 시장 기분 카드 → Task 5
- [x] 뉴스 카드 (있을 때만) → Task 3+5
- [x] rawData 응답 추가 → Task 2
- [x] headlineMent 프롬프트 강화 → Task 3
- [x] 시뮬레이션 1/5/10년 → Task 6

**실행 순서 의존성:**
- Task 2, 3은 Task 5보다 먼저 (rawData와 새 reasons 형식 필요)
- Task 1, 4는 독립적으로 가능
- Task 6은 독립적으로 가능
