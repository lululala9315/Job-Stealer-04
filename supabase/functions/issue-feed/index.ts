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
  price_change: number
  vol_ratio: number
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

  if (!data.output && isKisTokenError(data)) {
    await clearKisTokenCache()
    const newToken = await getKisToken()
    return fetchVolumeRankStocks(newToken)
  }

  const items: Array<Record<string, string>> = data.output || []

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
