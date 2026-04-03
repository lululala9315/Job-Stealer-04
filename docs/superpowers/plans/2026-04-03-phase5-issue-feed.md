# Phase 5 구현 플랜: 이슈 배너 + 로딩 개선 + 표현 개편

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 화면에 실시간 이슈 배너 추가, 로딩 텍스트 사이클링, 손실/수익 표현 개편

**Architecture:** SearchScreen 위에 `IssueBanner` 인라인 컴포넌트 추가 (on-demand + DB 2시간 캐시). 이슈 데이터는 `useIssueFeed` 훅이 Supabase DB 우선 조회 → 없으면 `issue-feed` Edge Function 호출. 손실/수익 라벨은 `buildSimulation` 내 룩업 테이블로 직접 생성.

**Tech Stack:** React 19, Supabase Edge Functions (Deno), KIS API, 네이버 뉴스 API, Claude Haiku

---

## 파일 목록

| 파일 | 역할 |
|------|------|
| `supabase/migrations/006_issue_feed.sql` | issue_feed 테이블 신규 생성 |
| `supabase/functions/issue-feed/index.ts` | 이슈 피드 Edge Function (KIS + 뉴스 + LLM) |
| `src/hooks/useIssueFeed.js` | 이슈 피드 데이터 fetch 훅 (DB 캐시 우선) |
| `src/components/SearchScreen.jsx` | IssueBanner 인라인 추가, useIssueFeed 사용 |
| `src/components/LoadingScreen.jsx` | 텍스트 사이클링 + 문구 교체 |
| `supabase/functions/check-stock/index.ts` | LOSS_LABELS/GAIN_LABELS 추가, 표현 개편 |

---

## Task 1: DB 마이그레이션 — issue_feed 테이블

**Files:**
- Create: `supabase/migrations/006_issue_feed.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

```sql
-- supabase/migrations/006_issue_feed.sql
create table if not exists issue_feed (
  id            uuid primary key default gen_random_uuid(),
  stock_code    text not null,
  stock_name    text not null,
  price_change  numeric not null,
  issue_type    text not null,
  sentiment     text not null,
  emoji         text not null,
  one_line      text not null,
  plain_explain text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

alter table issue_feed enable row level security;

create policy "issue_feed_select" on issue_feed
  for select using (auth.role() = 'authenticated');

create policy "issue_feed_insert" on issue_feed
  for insert with check (true);
```

- [ ] **Step 2: Supabase에 마이그레이션 적용**

```bash
cd /Users/haeunlee/Desktop/claude/04\ 금융/stockcheck
npx supabase db push --project-ref nceekggewxufjqythenq
```

기대 출력:
```
Connecting to remote database...
Applying migration 006_issue_feed.sql...done
```

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/006_issue_feed.sql
git commit -m "issue_feed 테이블 추가 — 이슈 피드 2시간 캐시용"
```

---

## Task 2: issue-feed Edge Function

**Files:**
- Create: `supabase/functions/issue-feed/index.ts`

- [ ] **Step 1: 디렉토리 생성 확인**

```bash
ls supabase/functions/
```

`check-stock` 폴더가 보이면 정상.

- [ ] **Step 2: Edge Function 파일 생성**

```typescript
// supabase/functions/issue-feed/index.ts
/**
 * 역할: 실시간 이슈 피드 생성 Edge Function
 * 주요 기능: KIS 거래량 상위 스크리닝 + 네이버 뉴스 + Claude Haiku → DB 저장 (2시간 캐시)
 * 의존성: KIS API, 네이버 뉴스 API, ANTHROPIC_API_KEY, Supabase DB
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ─── KIS 토큰 캐시 (check-stock과 동일 로직) ──────────────────

let _kisTokenCache: { token: string; expiresAt: number } | null = null
const KIS_TOKEN_EXPIRED_CODES = ['EGW00123', 'EGW00201', 'IGW00109']

function isKisTokenError(data: Record<string, unknown>): boolean {
  return KIS_TOKEN_EXPIRED_CODES.some(code => String(data.msg_cd || '').includes(code))
}

async function clearKisTokenCache() {
  _kisTokenCache = null
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await db.from('kis_token_cache').delete().eq('id', 'singleton')
  } catch (_) { /* 무시 */ }
}

async function getKisToken(): Promise<string> {
  if (_kisTokenCache && Date.now() < _kisTokenCache.expiresAt) {
    return _kisTokenCache.token
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cached } = await db
    .from('kis_token_cache')
    .select('token, expires_at')
    .eq('id', 'singleton')
    .single()
  if (cached && new Date(cached.expires_at) > new Date(Date.now() + 60_000)) {
    _kisTokenCache = { token: cached.token, expiresAt: new Date(cached.expires_at).getTime() }
    return cached.token
  }
  const res = await fetchWithTimeout('https://openapi.koreainvestment.com:9443/oauth2/tokenP', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: Deno.env.get('KIS_APP_KEY'),
      appsecret: Deno.env.get('KIS_APP_SECRET'),
    }),
  }, 8000)
  const data = await res.json()
  if (!data.access_token) throw new Error(`KIS 토큰 발급 실패: ${JSON.stringify(data)}`)
  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000)
  _kisTokenCache = { token: data.access_token, expiresAt: expiresAt.getTime() }
  await db.from('kis_token_cache').upsert({
    id: 'singleton',
    token: data.access_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  })
  return data.access_token
}

function kisHeaders(token: string, trId: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    appkey: Deno.env.get('KIS_APP_KEY')!,
    appsecret: Deno.env.get('KIS_APP_SECRET')!,
    tr_id: trId,
  }
}

// ─── KIS 거래량 상위 스크리닝 ──────────────────────────────────

interface VolumeRankItem {
  stock_code: string
  stock_name: string
  price_change: number   // % 등락율
  vol_ratio: number      // 거래량 증가율
}

async function fetchVolumeRankStocks(token: string): Promise<VolumeRankItem[]> {
  const res = await fetchWithTimeout(
    'https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/volume-rank?' +
    'FID_COND_MRKT_DIV_CODE=J&FID_COND_SCR_DIV_CODE=20171&FID_INPUT_ISCD=0000' +
    '&FID_DIV_CLS_CODE=0&FID_BLNG_CLS_CODE=0&FID_TRGT_CLS_CODE=111111111' +
    '&FID_TRGT_EXLS_CLS_CODE=000000&FID_INPUT_PRICE_1=&FID_INPUT_PRICE_2=' +
    '&FID_VOL_CNT=&FID_INPUT_DATE_1=',
    { headers: kisHeaders(token, 'FHPST01710000') },
    8000
  )
  const data = await res.json()

  // 토큰 만료 처리
  if (!data.output && isKisTokenError(data)) {
    await clearKisTokenCache()
    const newToken = await getKisToken()
    return fetchVolumeRankStocks(newToken)
  }

  const items: Array<Record<string, string>> = data.output || []

  // 필터: 거래량 증가율 200%+ OR 등락율 절대값 3%+, 상위 5개
  return items
    .map(item => ({
      stock_code: item.mksc_shrn_iscd,
      stock_name: item.hts_kor_isnm,
      price_change: parseFloat(item.prdy_ctrt || '0'),
      vol_ratio: parseFloat(item.vol_inrt || '0'),
    }))
    .filter(item => item.vol_ratio >= 200 || Math.abs(item.price_change) >= 3)
    .slice(0, 5)
}

// ─── 네이버 뉴스 ───────────────────────────────────────────────

async function fetchNewsHeadlines(stockName: string): Promise<string[]> {
  const clientId = Deno.env.get('NAVER_CLIENT_ID')
  const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET')
  if (!clientId || !clientSecret) return []
  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(stockName)}&display=3&sort=date`
    const res = await fetchWithTimeout(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        'User-Agent': 'Mozilla/5.0',
      },
    }, 4000)
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).map((item: { title: string }) =>
      item.title.replace(/<[^>]+>/g, '')
    )
  } catch (_) {
    return []
  }
}

// ─── Claude Haiku 이슈 분석 ────────────────────────────────────

interface IssueFeedItem {
  stock_code: string
  stock_name: string
  price_change: number
  issue_type: string
  sentiment: string
  emoji: string
  one_line: string
  plain_explain: string
}

async function analyzeWithLLM(
  stocks: Array<VolumeRankItem & { headlines: string[] }>
): Promise<IssueFeedItem[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const stockList = stocks.map(s =>
    `- ${s.stock_name}(${s.stock_code}): ${s.price_change > 0 ? '+' : ''}${s.price_change}%, 뉴스: ${s.headlines.join(' / ') || '없음'}`
  ).join('\n')

  const prompt = `아래 종목들의 오늘 이슈를 분석해서 JSON 배열로만 응답해. 다른 텍스트 없이 JSON만.

${stockList}

각 항목:
{
  "stock_code": "종목코드",
  "stock_name": "종목명",
  "price_change": 숫자,
  "issue_type": "임상실패|수주|실적|거시경제|루머|기타 중 하나",
  "sentiment": "위험|주의|긍정 중 하나 (하락+부정뉴스=위험, 상승+긍정뉴스=긍정, 그 외=주의)",
  "emoji": "이슈에 맞는 이모지 1개",
  "one_line": "10자 이내. 반말. 이슈 핵심. 예: '임상 또 실패', '미국 수주 터짐'",
  "plain_explain": "2문장 이내. 반말. 전문용어 절대 금지. 중학생도 이해 가능하게."
}`

  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, 20000)

  const raw = await res.text()
  let result: Record<string, unknown>
  try { result = JSON.parse(raw) } catch (_) { return [] }

  const text = (result.content as Array<{ type: string; text: string }>)
    ?.find(b => b.type === 'text')?.text || ''
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) as IssueFeedItem[] } catch (_) { return [] }
}

// ─── 메인 핸들러 ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // 1. DB 캐시 조회 (2시간 유효)
    const { data: cached } = await db
      .from('issue_feed')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({ issues: cached }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. KIS 거래량 상위 스크리닝
    const kisToken = await getKisToken()
    const volumeStocks = await fetchVolumeRankStocks(kisToken)

    if (volumeStocks.length === 0) {
      return new Response(JSON.stringify({ issues: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. 네이버 뉴스 수집 (병렬)
    const stocksWithNews = await Promise.all(
      volumeStocks.map(async (stock) => ({
        ...stock,
        headlines: await fetchNewsHeadlines(stock.stock_name),
      }))
    )

    // 4. Claude Haiku 이슈 분석
    const issues = await analyzeWithLLM(stocksWithNews)
    if (issues.length === 0) {
      return new Response(JSON.stringify({ issues: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. DB 저장 (기존 만료 데이터 삭제 후 INSERT)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await db.from('issue_feed').delete().lt('expires_at', new Date().toISOString())
    await db.from('issue_feed').insert(
      issues.map(item => ({ ...item, expires_at: expiresAt }))
    )

    return new Response(JSON.stringify({ issues }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('issue-feed 오류:', msg)
    return new Response(JSON.stringify({ issues: [], error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
```

- [ ] **Step 3: Edge Function 배포**

```bash
npx supabase functions deploy issue-feed --no-verify-jwt --project-ref nceekggewxufjqythenq
```

기대 출력:
```
Deploying Function issue-feed (script size: ...KB)
Done.
```

- [ ] **Step 4: 배포 확인 (브라우저 DevTools 또는 curl)**

```bash
# .env에서 SUPABASE URL과 ANON_KEY 확인 후:
curl -X GET "https://nceekggewxufjqythenq.supabase.co/functions/v1/issue-feed" \
  -H "Authorization: Bearer <ANON_KEY>"
```

기대 응답: `{"issues":[...]}` 또는 `{"issues":[]}` (장 마감 시간엔 빈 배열 가능)

- [ ] **Step 5: 커밋**

```bash
git add supabase/functions/issue-feed/
git commit -m "issue-feed Edge Function 추가 — KIS 거래량 상위 + 뉴스 + LLM 이슈 분석"
```

---

## Task 3: useIssueFeed 훅

**Files:**
- Create: `src/hooks/useIssueFeed.js`

- [ ] **Step 1: 훅 파일 생성**

```javascript
/**
 * 역할: 이슈 피드 데이터 fetch 훅
 * 주요 기능: Supabase DB 캐시 우선 조회 → 없으면 issue-feed Edge Function 호출
 * 의존성: supabase 클라이언트
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// sentiment 정렬 순서 — 위험을 먼저 보여줌
const SENTIMENT_ORDER = { '위험': 0, '주의': 1, '긍정': 2 }

export function useIssueFeed() {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // 1. DB 캐시 조회 (유효한 항목만)
        const { data: cached } = await supabase
          .from('issue_feed')
          .select('stock_code, stock_name, price_change, sentiment, emoji, one_line')
          .gt('expires_at', new Date().toISOString())
          .limit(5)

        if (!cancelled && cached?.length > 0) {
          const sorted = [...cached].sort(
            (a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 3) - (SENTIMENT_ORDER[b.sentiment] ?? 3)
          )
          setIssues(sorted)
          setLoading(false)
          return
        }

        // 2. 캐시 없으면 Edge Function 호출
        const { data } = await supabase.functions.invoke('issue-feed')
        if (!cancelled && data?.issues?.length > 0) {
          const sorted = [...data.issues].sort(
            (a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 3) - (SENTIMENT_ORDER[b.sentiment] ?? 3)
          )
          setIssues(sorted)
        }
      } catch (_) {
        // 에러 시 피드 숨김 (검색 기능에는 영향 없음)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { issues, loading }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/hooks/useIssueFeed.js
git commit -m "useIssueFeed 훅 추가 — DB 캐시 우선, Edge Function 폴백"
```

---

## Task 4: SearchScreen — IssueBanner 추가

**Files:**
- Modify: `src/components/SearchScreen.jsx`

- [ ] **Step 1: SearchScreen.jsx 상단 import 수정**

파일 상단 `import { useState, useRef, useEffect } from 'react'` 를 아래로 교체:

```javascript
import { useState, useRef, useEffect } from 'react'
import { useIssueFeed } from '../hooks/useIssueFeed'
```

- [ ] **Step 2: 컴포넌트 함수 상단에 훅 호출 추가**

`export default function SearchScreen({ onSearch }) {` 바로 아래:

```javascript
  const { issues, loading: issuesLoading } = useIssueFeed()
  const [bannerIdx, setBannerIdx] = useState(0)

  // 3초마다 다음 이슈로 순환
  useEffect(() => {
    if (issues.length <= 1) return
    const id = setInterval(() => setBannerIdx(i => (i + 1) % issues.length), 3000)
    return () => clearInterval(id)
  }, [issues.length])
```

- [ ] **Step 3: 히어로 섹션과 검색창 사이에 IssueBanner 삽입**

검색창 `<div style={{ paddingBottom: '24px' }}>` 바로 위에 추가:

```jsx
      {/* ══ 실시간 이슈 배너 — 검색창 위 ══ */}
      {issuesLoading ? (
        // 스켈레톤 — 높이 44px 고정으로 레이아웃 점프 방지
        <div
          style={{
            height: '44px',
            backgroundColor: 'var(--color-bg-input)',
            borderRadius: '12px',
            marginBottom: '12px',
            animation: 'skeletonPulse 1.5s ease-in-out infinite',
          }}
        />
      ) : issues.length > 0 ? (
        <button
          onClick={() => onSearch(issues[bannerIdx]?.stock_code)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            height: '44px',
            backgroundColor: 'var(--color-accent-light)',  /* 연한 오렌지 배경 */
            borderRadius: '12px',
            border: 'none',
            padding: '0 14px',
            cursor: 'pointer',
            marginBottom: '12px',
            overflow: 'hidden',
            textAlign: 'left',
            fontFamily: 'inherit',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {/* 왼쪽 배지 — 토스증권 AI 칩 스타일 */}
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '999px',
            flexShrink: 0,
            letterSpacing: '-0.2px',
          }}>
            ⚡ 실시간 이슈
          </span>
          {/* 이슈 텍스트 — fade 전환 */}
          <span
            key={bannerIdx}
            style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              fontWeight: 500,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              animation: 'bannerFadeIn 0.3s ease',
            }}
          >
            {issues[bannerIdx]?.one_line}
          </span>
          <span style={{ fontSize: '14px', color: 'var(--color-accent)', flexShrink: 0 }}>›</span>
        </button>
      ) : null}
```

- [ ] **Step 4: `<style>` 블록에 애니메이션 추가**

기존 `<style>` 태그 내 `@keyframes heroIn` 앞에 추가:

```css
        @keyframes bannerFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
```

- [ ] **Step 5: 개발 서버에서 확인**

```bash
cd /Users/haeunlee/Desktop/claude/04\ 금융/stockcheck
npm run dev
```

- 배너 로딩 중: 스켈레톤 회색 박스 44px 표시 확인
- 배너 로드 후: "⚡ 실시간 이슈 [이슈텍스트]" 표시 확인
- 3초마다 텍스트 fade 전환 확인
- 배너 탭 시 해당 종목 판결 시작 확인

- [ ] **Step 6: 커밋**

```bash
git add src/components/SearchScreen.jsx
git commit -m "SearchScreen에 실시간 이슈 배너 추가 — 검색창 위, 3초 순환"
```

---

## Task 5: LoadingScreen — 텍스트 사이클링

**Files:**
- Modify: `src/components/LoadingScreen.jsx`

- [ ] **Step 1: LoadingScreen.jsx 전체 교체**

```javascript
/**
 * 역할: Edge Function 호출 중 로딩 화면
 * 주요 기능: 2.5초마다 재밌는 텍스트 순환 + 스피너
 * 의존성: 없음
 */

import { useState, useEffect } from 'react'

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

export default function LoadingScreen() {
  const [idx, setIdx] = useState(0)

  // 2.5초마다 다음 메시지로 순환
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % LOADING_MESSAGES.length), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="분석 중"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '28px',
        animation: 'loadingFadeIn 0.3s cubic-bezier(0.2, 0, 0, 1)',
        paddingTop: '32px',
      }}
    >
      {/* 스피너 */}
      <div
        className="loading-spinner"
        style={{
          width: '48px',
          height: '48px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent)',
          borderRadius: '50%',
        }}
      />

      {/* 순환 메시지 — key={idx}로 fade 재생 */}
      <div style={{ textAlign: 'center' }}>
        <p
          key={idx}
          style={{
            fontSize: '22px',
            lineHeight: '31px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
            textWrap: 'balance',
            animation: 'loadingFadeIn 0.3s cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          {LOADING_MESSAGES[idx]}
        </p>
        <p
          className="loading-pulse"
          style={{
            marginTop: '10px',
            fontSize: '14px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          보통 5–10초 걸려
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .loading-spinner {
          animation: spin 0.75s linear infinite;
        }
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        .loading-pulse {
          animation: loadingPulse 2s ease-in-out infinite;
        }
        @keyframes loadingFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .loading-spinner { animation: none; }
          .loading-pulse   { animation: none; opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: 개발 서버에서 확인**

종목 검색 → 금액 입력 → 로딩 화면에서:
- 텍스트가 2.5초마다 fade 전환되며 순환하는지 확인
- "FOMO" 단어 없는지 확인

- [ ] **Step 3: 커밋**

```bash
git add src/components/LoadingScreen.jsx
git commit -m "LoadingScreen 텍스트 2.5초 순환으로 개선 — FOMO 표현 제거"
```

---

## Task 6: check-stock — 손실/수익 표현 개편

**Files:**
- Modify: `supabase/functions/check-stock/index.ts`

- [ ] **Step 1: RELATABLE_UNITS 아래에 새 룩업 테이블 추가**

`// ─── 시뮬레이션 ─────────────────────────────────────────────` 섹션에서
`const RELATABLE_UNITS = [` 바로 위에 추가:

```typescript
/** 손실 표현 룩업 — "날린다" 대신 엉뚱한 실생활 치환 */
const LOSS_LABELS = [
  { max: 10000,    text: '편의점 야식 한 번', emoji: '🍜' },
  { max: 30000,    text: '택시비 한 번', emoji: '🚕' },
  { max: 50000,    text: '치킨 한 마리', emoji: '🍗' },
  { max: 100000,   text: '디즈니플러스 5개월치', emoji: '🎬' },
  { max: 200000,   text: '제주도 편도', emoji: '✈️' },
  { max: 500000,   text: '제주도 왕복 두 번', emoji: '🏝️' },
  { max: 1000000,  text: '메타버스에서 집', emoji: '🏠' },
  { max: 3000000,  text: '한강뷰 원룸 한 달', emoji: '🌆' },
  { max: Infinity, text: '꿈에서만 살 수 있는 금액', emoji: '💭' },
]

/** 수익 표현 룩업 — 구체적이고 재밌는 실생활 치환 */
const GAIN_LABELS = [
  { max: 10000,    text: '아메리카노 한 잔 수준', emoji: '☕' },
  { max: 30000,    text: '편의점 간식 한 세트', emoji: '🍫' },
  { max: 50000,    text: '치킨 한 마리', emoji: '🍗' },
  { max: 100000,   text: '소고기 한 팩', emoji: '🥩' },
  { max: 200000,   text: '에어팟 케이블 새 걸로', emoji: '🎧' },
  { max: 500000,   text: '아이패드 반 대', emoji: '📱' },
  { max: 1000000,  text: '꿈에서 스테이크', emoji: '🍖' },
  { max: 3000000,  text: '국내 여행 풀코스', emoji: '🗺️' },
  { max: Infinity, text: '꿈에서 차 한 대', emoji: '🚗' },
]

/** 금액에 맞는 손실 표현 선택 */
function getLossLabel(amount: number): { text: string; emoji: string } {
  return LOSS_LABELS.find(l => amount <= l.max) ?? LOSS_LABELS[LOSS_LABELS.length - 1]
}

/** 금액에 맞는 수익 표현 선택 */
function getGainLabel(amount: number): { text: string; emoji: string } {
  return GAIN_LABELS.find(l => amount <= l.max) ?? GAIN_LABELS[GAIN_LABELS.length - 1]
}
```

- [ ] **Step 2: `buildSimulation` 내 `calcScenario`의 label 생성 교체**

현재 코드 (945~953번째 줄 근처):
```typescript
    // 수익/손실 금액 기준 라벨 — 총액 대신 얼마 벌었나/잃었나로 표현
    const unit = getRelatableUnit(Math.abs(gain))
    const label = gain >= 0
      ? `${unit.label} ${unit.count}${unit.unit} 벌 수 있어`
      : `${unit.label} ${unit.count}${unit.unit} 날릴 수 있어`

    return { amount, gain, bestAmount, worstAmount, label, emoji: unit.emoji }
```

교체 후:
```typescript
    // 수익/손실 금액 기준 라벨 — 창의적 실생활 치환
    const absGain = Math.abs(gain)
    const labelItem = gain >= 0 ? getGainLabel(absGain) : getLossLabel(absGain)
    const label = gain >= 0
      ? `${labelItem.text} 살 수 있어`
      : `${labelItem.text}만큼이야`

    return { amount, gain, bestAmount, worstAmount, label, emoji: labelItem.emoji }
```

- [ ] **Step 3: buildMockResult 내 label 생성도 동일하게 교체**

현재 코드 (1154~1163번째 줄 근처):
```typescript
    const unit        = getRelatableUnit(Math.abs(gain))
    const label       = gain >= 0 ? `${unit.label} ${unit.count}${unit.unit} 벌 수 있어` : `${unit.label} ${unit.count}${unit.unit} 날릴 수 있어`
```

교체 후:
```typescript
    const absGain     = Math.abs(gain)
    const labelItem   = gain >= 0 ? getGainLabel(absGain) : getLossLabel(absGain)
    const label       = gain >= 0 ? `${labelItem.text} 살 수 있어` : `${labelItem.text}만큼이야`
```

그리고 `return { amount, gain, bestAmount, worstAmount, label, emoji: unit.emoji }` →
`return { amount, gain, bestAmount, worstAmount, label, emoji: labelItem.emoji }`

- [ ] **Step 4: LLM 프롬프트 lossConversion 가이드 교체**

현재 (1073~1080번째 줄):
```
## 손실 치환 기준 (lossConversion용)
1~3만원: 스벅 아아 10잔 / 마라탕 2번 / 편의점 야식 1주일
...
```

교체 후:
```
## 손실 치환 기준 (lossConversion용) — "날린다" 표현 절대 금지. 아래처럼 엉뚱하게.
1~3만원: "편의점 야식 한 번이야" / "택시비 한 번인데" 
3~10만원: "치킨 한 마리인데" / "디즈니플러스 5개월치야"
10~30만원: "제주도 편도야" / "제주도 왕복 두 번이야"
30~70만원: "메타버스에서 집 살 수 있었어" / "한강뷰 원룸 한 달이야"
70만원+: "꿈에서만 살 수 있는 금액이야" / "꿈에서 스테이크 먹는 수준이야"
```

그리고 같은 프롬프트의 `"lossConversion"` 예시 부분:
```
  "lossConversion": "snarky 톤. 예: '${lossUnit.emoji}${lossUnit.label} ${lossUnit.count}${lossUnit.unit} 날리고 싶나보네' 또는 '태울 각이네' 스타일로",
```

교체 후:
```
  "lossConversion": "snarky 톤. '날린다' 표현 금지. 예: '제주도 왕복 두 번이야 ㅋ' / '메타버스에서 집 살 수 있었는데' / '꿈에서만 살 수 있는 금액이야'",
```

- [ ] **Step 5: LLM 실패 fallback lossConversion 표현 교체**

1122~1124번째 줄:
```typescript
      lossConversion: `${lossUnit.emoji}${lossUnit.label} ${lossUnit.count}${lossUnit.unit} 날릴 수 있어`,
```
교체:
```typescript
      lossConversion: `${getLossLabel(worstLoss3d).emoji} ${getLossLabel(worstLoss3d).text}만큼이야`,
```

1134~1136번째 줄:
```typescript
      lossConversion: `${lossUnit.emoji}${lossUnit.label} ${lossUnit.count}${lossUnit.unit} 위험`,
```
교체:
```typescript
      lossConversion: `${getLossLabel(worstLoss3d).emoji} ${getLossLabel(worstLoss3d).text}만큼이야`,
```

- [ ] **Step 6: buildMockResult lossConversion 교체**

1177번째 줄:
```typescript
      lossConversion: `${lossUnit.emoji}${lossUnit.label} ${lossUnit.count}${lossUnit.unit} 날리고 싶나보네`,
```
교체 (`lossAmount`는 이미 정의되어 있음):
```typescript
      lossConversion: `${getLossLabel(lossAmount).emoji} ${getLossLabel(lossAmount).text}만큼이야`,
```

- [ ] **Step 7: Edge Function 배포**

```bash
npx supabase functions deploy check-stock --no-verify-jwt --project-ref nceekggewxufjqythenq
```

기대 출력:
```
Deploying Function check-stock ...done
```

- [ ] **Step 8: 커밋**

```bash
git add supabase/functions/check-stock/index.ts
git commit -m "손실/수익 표현 개편 — '날린다' 제거, 창의적 실생활 치환으로 교체"
```

---

## Task 7: 최종 빌드 확인

- [ ] **Step 1: 프론트엔드 빌드 에러 확인**

```bash
cd /Users/haeunlee/Desktop/claude/04\ 금융/stockcheck
npm run build
```

기대 출력:
```
✓ built in ...s
```
에러 없으면 통과.

- [ ] **Step 2: Vercel 배포**

```bash
vercel --prod
```

- [ ] **Step 3: 브라우저 E2E 확인 체크리스트**

1. 검색 화면 진입 → 이슈 배너 로딩(스켈레톤) → 배너 표시 확인
2. 배너 텍스트 3초마다 fade 전환 확인
3. 배너 탭 → 해당 종목 판결 시작 확인
4. 종목 검색 → 로딩 화면에서 텍스트 2.5초 순환 확인
5. 판결 화면 `lossConversion` 표현에 "날린다" 없는지 확인
6. 시뮬레이션 화면 라벨이 새 표현인지 확인 ("살 수 있어" / "만큼이야")
