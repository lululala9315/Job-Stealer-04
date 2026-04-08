/**
 * 역할: 실시간 시장 이슈 피드 생성 Edge Function (Phase 10 — 토스증권 스타일)
 * 주요 기능: 네이버 뉴스 키워드 검색 → Claude Haiku 토픽 클러스터링 → DB 캐시 (30분)
 * 의존성: 네이버 뉴스 API, ANTHROPIC_API_KEY, Supabase DB
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** 허용 Origin 목록 — 배포 도메인 + 로컬 개발 */
const ALLOWED_ORIGINS = [
  'https://stockcheck-pi.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.vercel.app'))
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
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

// ─── 네이버 뉴스 키워드 검색 ─────────────────────────────────

const NEWS_KEYWORDS = ['코스피', '코스닥', '증시', '주식시장', '금리', '환율', '유가']

interface NewsItem {
  title: string
  description: string
}

async function fetchMarketNews(): Promise<NewsItem[]> {
  const clientId = Deno.env.get('NAVER_CLIENT_ID')
  const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET')
  if (!clientId || !clientSecret) return []

  // 키워드별 뉴스 병렬 수집
  const results = await Promise.allSettled(
    NEWS_KEYWORDS.map(async (keyword) => {
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=5&sort=date`
      const res = await fetchWithTimeout(url, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
          'User-Agent': 'Mozilla/5.0',
        },
      }, 4000)
      if (!res.ok) return []
      const data = await res.json()
      return (data.items || []).map((item: { title: string; description: string }) => ({
        title: item.title.replace(/<[^>]+>/g, '').trim(),
        description: (item.description || '').replace(/<[^>]+>/g, '').trim(),
      }))
    })
  )

  // 성공한 결과만 합침
  const allNews: NewsItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allNews.push(...r.value)
    }
  }

  // 제목 기준 중복 제거
  const seen = new Set<string>()
  return allNews.filter(item => {
    if (seen.has(item.title)) return false
    seen.add(item.title)
    return true
  })
}

// ─── Claude Haiku 토픽 클러스터링 ──────────────────────────────

interface TopicItem {
  topic: string
  impact: string
  sentiment: string
  emoji: string
  stock_name: string
  stock_code: string
  one_line: string
}

async function clusterWithLLM(news: NewsItem[]): Promise<TopicItem[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!

  const headlines = news.map(n => `- ${n.title}`).join('\n')

  const prompt = `아래 오늘 증권/경제 뉴스 헤드라인들을 분석해서, 가장 중요한 시장 이슈 토픽 최대 5개로 클러스터링해.

${headlines}

각 토픽에 대해 아래 JSON 배열로만 응답해. 다른 텍스트 없이 JSON만.

[
  {
    "topic": "토픽 제목 (구체적으로, 예: '미국-이란 휴전 합의', '삼성전자 1분기 실적 서프라이즈')",
    "impact": "시장 영향 요약 (예: '유가 급락, 반도체주 랠리', '코스피 7% 급등')",
    "sentiment": "긍정|주의|위험 중 하나",
    "emoji": "토픽에 맞는 이모지 1개",
    "stock_name": "가장 직접적 영향 받는 한국 상장 종목명 1개",
    "stock_code": "해당 종목 6자리 코드 (모르면 빈 문자열)",
    "one_line": "배너 한 줄 텍스트 (아래 예시 참고)"
  }
]

one_line 작성 규칙 (매우 중요):
- 형식: "[구체적 이벤트] · [종목명] [영향]"
- 좋은 예: "미국-이란 휴전 합의 · SK이노베이션 급락"
- 좋은 예: "반도체 수출 규제 완화 · 삼성전자 랠리"
- 좋은 예: "가계대출 4개월 만에 증가 · 키움증권 강세"
- 나쁜 예: "중동 휴전 · 삼성전자 랠리" (너무 축약, 무슨 휴전인지 모름)
- 나쁜 예: "반도체 실적 · SK하이닉스 폭주" (무슨 실적인지 모름)
- 왕초보가 읽어도 무슨 일이 있었는지 바로 이해되어야 함

기타 규칙:
- 비슷한 뉴스는 하나의 토픽으로 묶어
- 토픽은 중요도 순으로 정렬 (뉴스 수 많을수록 중요)
- stock_name은 반드시 한국 KOSPI/KOSDAQ 상장 종목 (ETF/ETN 제외)
- stock_code를 모르면 빈 문자열로, 절대 틀린 코드 넣지 마
- sentiment: 시장에 부정적=위험, 불확실=주의, 긍정적=긍정`

  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, 25000)

  const raw = await res.text()
  let result: Record<string, unknown>
  try { result = JSON.parse(raw) } catch (_) { return [] }

  const text = (result.content as Array<{ type: string; text: string }>)
    ?.find(b => b.type === 'text')?.text || ''
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) as TopicItem[] } catch (_) { return [] }
}

// ─── 메인 핸들러 ─────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // 1. DB 캐시 조회 (30분 유효)
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

    // 2. 네이버 뉴스 키워드 수집
    const news = await fetchMarketNews()
    if (news.length === 0) {
      return new Response(JSON.stringify({ issues: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Claude Haiku 토픽 클러스터링
    const topics = await clusterWithLLM(news)
    if (topics.length === 0) {
      return new Response(JSON.stringify({ issues: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. DB 저장 (기존 만료 데이터 삭제 후 INSERT)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await db.from('issue_feed').delete().lt('expires_at', new Date().toISOString())

    const rows = topics.map(t => ({
      topic: t.topic,
      impact: t.impact,
      stock_code: t.stock_code || '',
      stock_name: t.stock_name || '',
      price_change: null,
      issue_type: '거시경제',
      sentiment: t.sentiment || '주의',
      emoji: t.emoji || '📰',
      one_line: t.one_line || `${t.topic} · ${t.stock_name}`,
      plain_explain: '',
      expires_at: expiresAt,
    }))

    await db.from('issue_feed').insert(rows)

    return new Response(JSON.stringify({ issues: rows }), {
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
