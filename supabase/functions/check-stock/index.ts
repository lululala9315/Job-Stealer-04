/**
 * 역할: 주식 종목 AI 판결 Edge Function
 * 주요 기능: KIS API + assetx2 API + 네이버 뉴스 3축 병렬 수집 → 100점 스코어링 → Gemini 판결 생성 → DB 저장
 * 의존성: KIS API, assetx2 API, 네이버 뉴스 API, Gemini API, Supabase DB
 * 참고: KIS_APP_KEY, KIS_APP_SECRET, GEMINI_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 필요
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** 타임아웃 있는 fetch — 외부 API 무한 대기 방지 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ─── 타입 정의 ───────────────────────────────────────────────

interface PriceData {
  stockName: string
  currentPrice: number
  priceChange: number
  priceChangeRate: number
  week52High: number
  week52Low: number
  volumeRatio: number
  per: number
  pbr: number
  marketCap: number
  marketType: 'KOSPI' | 'KOSDAQ' | 'UNKNOWN' // 코스피/코스닥 구분
}

interface DailyBar {
  date: string
  close: number
  volume: number
  changeRate: number
}

interface InstitutionalData {
  recentDays: number // 조회한 일수
  institutionNet: number // 기관 순매수 합계 (주)
  foreignNet: number    // 외인 순매수 합계 (주)
  bothSelling: boolean  // 기관+외인 동시 순매도 여부
}

interface MarketSignals {
  vix: number           // VIX 지수
  fearGreed: number     // 공포탐욕지수 (0~100)
  kospiDrawdown: number // 코스피 전고점 대비 현재 (0~100, 100이 전고점)
  kosdaqDrawdown: number
  fedRate: number       // 미국 기준금리
  rateDirection: 'up' | 'down' | 'flat' // 금리 방향
  dxy: number           // 달러 인덱스
  dataAvailable: boolean
}

interface NewsSignals {
  totalCount: number
  rumorCount: number   // 루머/카더라 기사 수
  earnCount: number    // 실적 관련
  issueCount: number   // 공시/이슈 관련
  absorbed: boolean    // 뉴스가 이미 주가에 반영됐는지 (급등 후 뉴스)
  dataAvailable: boolean
}

interface VerdictResult {
  stockName: string
  stockCode: string
  investAmount: number
  verdict: {
    grade: 'ban' | 'wait' | 'ok' | 'hold'
    label: string
    emoji: string
    score: number
    headlineMent: string
    lossConversion: string
  }
  reasons: Array<{
    cardType: 'price' | 'value' | 'volume' | 'market' | 'news'
    description: string
  }>
  rawData: {
    highRatio: number        // 52주 고점 대비 현재가 위치 (%)
    per: number | null       // 적자면 null
    isDeficit: boolean
    volMultiple: number      // 거래량 평소 대비 배수
    fearGreed: number | null // 0~100, 없으면 null
  }
  issueType?: string
  sectorImpact?: string
  impactTag?: string
  priceSignalTag?: string
  simulation: {
    shortTerm: {
      dailyVolatility: number
      threeDayRange: { bestCase: number; worstCase: number }
    }
    longTerm: {
      annualReturn: number
      projections: {
        month3: { amount: number; gain: number; bestAmount: number; worstAmount: number; label: string; emoji: string }
        month6: { amount: number; gain: number; bestAmount: number; worstAmount: number; label: string; emoji: string }
        year1:  { amount: number; gain: number; bestAmount: number; worstAmount: number; label: string; emoji: string }
      }
    }
  }
  signals: {
    stock: Record<string, unknown>
    market: Record<string, unknown>
    news: Record<string, unknown>
  }
}

// ─── 메인 핸들러 ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, userId, investAmount: rawAmount, priceOnly } = await req.json() as {
      query: string
      userId?: string
      investAmount?: number
      priceOnly?: boolean
    }

    if (!query) {
      return jsonError('종목명 또는 코드를 입력해줘', 400)
    }

    const investAmount = rawAmount || 1_000_000

    // Mock 모드 (API 키 미설정 시)
    const isMockMode = !Deno.env.get('KIS_APP_KEY') || !Deno.env.get('GEMINI_API_KEY')
    if (isMockMode) {
      // priceOnly Mock — 바텀시트 주수 계산용
      if (priceOnly) {
        return new Response(JSON.stringify({ stockCode: '005930', stockName: query, currentPrice: 75000 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const mockResult = buildMockResult(query, investAmount)
      return new Response(JSON.stringify(mockResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // KIS 토큰 발급 (캐시)
    const kisToken = await getKisToken()

    // 종목 코드 확인
    const stockCode = await resolveStockCode(query, kisToken)
    if (!stockCode) {
      return jsonError('종목을 찾을 수 없어. 정확한 종목명이나 코드로 다시 입력해봐.', 404)
    }

    // priceOnly 모드 — 바텀시트 주수 계산용, 빠르게 현재가만 반환
    if (priceOnly) {
      const priceData = await fetchPriceData(stockCode, kisToken)
      return new Response(
        JSON.stringify({ stockCode, stockName: priceData.stockName, currentPrice: priceData.currentPrice }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3축 병렬 데이터 수집 ──
    const [
      [priceData, dailyData, institutionalData],
      marketSignals,
      newsSignals,
    ] = await Promise.all([
      // 종목축: KIS API
      Promise.all([
        fetchPriceData(stockCode, kisToken),
        fetchDailyData(stockCode, kisToken),
        fetchInstitutionalData(stockCode, kisToken),
      ]),
      // 시장축: assetx2 API
      fetchMarketSignals(),
      // 뉴스축: 네이버 뉴스 (종목명은 priceData 전에 알 수 없어서 query 사용)
      fetchNewsSignals(query),
    ])

    const stockName = priceData.stockName

    // 뉴스 신호를 실제 종목명으로 재조회 (query가 코드였을 경우 보완)
    const finalNewsSignals = stockName !== query
      ? await fetchNewsSignals(stockName).catch(() => newsSignals)
      : newsSignals

    // ── 3축 스코어링 ──
    const stockScore = scoreStock(priceData, dailyData, institutionalData)
    const marketScore = scoreMarket(marketSignals, priceData.marketType)
    const newsScore = scoreNews(finalNewsSignals, priceData, dailyData)

    // ── 판결 등급 결정 ──
    const verdict = combineVerdict(stockScore, marketScore, newsScore, priceData, marketSignals, institutionalData)

    // ── 시뮬레이션 ──
    const simulation = buildSimulation(priceData, dailyData, investAmount)

    // ── LLM 판결 멘트 생성 ──
    const llmResult = await generateVerdictWithLLM({
      stockName, stockCode, investAmount,
      priceData, dailyData, verdict,
      stockScore, marketScore, newsScore,
      marketSignals, newsSignals: finalNewsSignals,
      simulation,
    })

    const result: VerdictResult = {
      stockName,
      stockCode,
      investAmount,
      verdict: {
        grade: verdict.grade,
        label: verdict.label,
        emoji: verdict.emoji,
        score: verdict.totalScore,
        headlineMent: llmResult.headlineMent,
        lossConversion: llmResult.lossConversion,
      },
      reasons: llmResult.reasons || [],
      rawData: llmResult.rawData,
      issueType: llmResult.issueType,
      sectorImpact: llmResult.sectorImpact,
      impactTag: llmResult.impactTag,
      priceSignalTag: llmResult.priceSignalTag,
      simulation,
      signals: {
        stock: { score: stockScore.score, breakdown: stockScore.breakdown },
        market: { score: marketScore.score, breakdown: marketScore.breakdown },
        news: { score: newsScore.score, breakdown: newsScore.breakdown },
      },
    }

    // ── DB 저장 ──
    if (userId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await supabase.from('check_history').insert({
        user_id: userId,
        stock_code: stockCode,
        stock_name: stockName,
        check_result: result,
        stock_price_at_check: priceData.currentPrice,
        summary: llmResult.headlineMent,
        invest_amount: investAmount,
        verdict_grade: verdict.grade,
        verdict_score: verdict.totalScore,
      })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('check-stock 오류:', msg)
    return jsonError(`판결 중 오류가 생겼어. 잠깐 뒤에 다시 시도해봐. (${msg})`, 500)
  }
})

// ─── KIS API ────────────────────────────────────────────────

/** KIS 토큰 캐시 — 모듈 레벨 (같은 워커 인스턴스 내 재사용) */
let _kisTokenCache: { token: string; expiresAt: number } | null = null

/** KIS 토큰 만료 에러 코드 목록 */
const KIS_TOKEN_EXPIRED_CODES = ['EGW00123', 'EGW00201', 'IGW00109']

/** KIS API 응답이 토큰 만료 에러인지 확인 */
function isKisTokenError(data: Record<string, unknown>): boolean {
  return KIS_TOKEN_EXPIRED_CODES.some(code => String(data.msg_cd || '').includes(code))
}

/** KIS 토큰 캐시 강제 초기화 — 토큰 에러 감지 시 호출 */
async function clearKisTokenCache() {
  _kisTokenCache = null
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await db.from('kis_token_cache').delete().eq('id', 'singleton')
  } catch (_) { /* 무시 */ }
}

/** KIS OAuth 접근토큰 발급 — 모듈 캐시 → DB 캐시 → 신규 발급 순서 */
async function getKisToken(): Promise<string> {
  // 1. 모듈 캐시 (같은 워커 인스턴스)
  if (_kisTokenCache && Date.now() < _kisTokenCache.expiresAt) {
    return _kisTokenCache.token
  }

  // 2. DB 캐시 (다른 워커 인스턴스에서 발급한 토큰 재사용)
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data: cached } = await db
    .from('kis_token_cache')
    .select('token, expires_at')
    .eq('id', 'singleton')
    .single()

  if (cached && new Date(cached.expires_at) > new Date(Date.now() + 60_000)) {
    // 만료 1분 이상 남은 경우만 사용
    _kisTokenCache = { token: cached.token, expiresAt: new Date(cached.expires_at).getTime() }
    return cached.token
  }

  // 3. 신규 발급
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

  // 모듈 캐시 갱신
  _kisTokenCache = { token: data.access_token, expiresAt: expiresAt.getTime() }

  // DB 캐시 저장 (워커 간 공유용)
  await db.from('kis_token_cache').upsert({
    id: 'singleton',
    token: data.access_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  })

  return data.access_token
}

/** 종목명 → 종목코드 변환 (6자리 숫자면 그대로, 아니면 네이버 자동완성) */
async function resolveStockCode(query: string, _token: string): Promise<string | null> {
  const trimmed = query.trim()
  if (/^\d{6}$/.test(trimmed)) return trimmed

  // 1차: 네이버 증권 자동완성 (Supabase에서 ac.finance.naver.com DNS 차단 → ac.stock.naver.com 사용)
  try {
    const naverRes = await fetchWithTimeout(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(trimmed)}&target=stock&st=111`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      4000
    )
    if (naverRes.ok) {
      const naverData = await naverRes.json()
      const items = naverData?.items || []
      const krStock = items.find(
        (item: { nationCode: string; code: string }) =>
          item.nationCode === 'KOR' && /^\d{6}$/.test(item.code)
      )
      if (krStock) return krStock.code
    }
  } catch (e) {
    console.log('네이버 자동완성 실패:', e instanceof Error ? e.message : e)
  }

  // 2차: Yahoo Finance 폴백 (영어 종목명용)
  try {
    const yahooRes = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(trimmed)}&newsCount=0&quotesCount=5`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      4000
    )
    if (yahooRes.ok) {
      const yahooData = await yahooRes.json()
      const quotes = yahooData?.quotes || []
      const krStock = quotes.find(
        (q: { symbol: string }) => q.symbol?.endsWith('.KS') || q.symbol?.endsWith('.KQ')
      )
      if (krStock) return krStock.symbol.replace(/\.(KS|KQ)$/, '')
    }
  } catch (e) {
    console.log('Yahoo Finance 검색 실패:', e instanceof Error ? e.message : e)
  }

  return null
}

/** 현재가 + 52주 고/저가 + PER/PBR + 시장 구분 조회 (토큰 에러 시 1회 재시도) */
async function fetchPriceData(stockCode: string, token: string): Promise<PriceData> {
  const doFetch = async (t: string) => {
    const res = await fetchWithTimeout(
      `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}`,
      { headers: kisHeaders(t, 'FHKST01010100') },
      6000
    )
    return res.json()
  }

  let data = await doFetch(token)

  // 토큰 만료 에러 → 캐시 초기화 후 재발급 1회 재시도
  if (!data.output && isKisTokenError(data)) {
    console.log('KIS 토큰 만료 감지, 재발급 후 재시도:', data.msg_cd)
    await clearKisTokenCache()
    const newToken = await getKisToken()
    data = await doFetch(newToken)
  }

  const o = data.output

  // KIS API 에러 응답 처리 — output 없으면 rt_cd/msg1으로 원인 파악
  if (!o) {
    const kisMsg = data.msg1 || data.msg_cd || 'KIS API 응답 없음'
    throw new Error(`시세 조회 실패: ${kisMsg}`)
  }

  // 코스피/코스닥 구분: bstp_kor_isnm (업종명)에 코스닥 포함 여부로 판단
  const marketType: PriceData['marketType'] = o.rprs_mrkt_kor_name?.includes('코스닥')
    ? 'KOSDAQ'
    : o.rprs_mrkt_kor_name?.includes('코스피') ? 'KOSPI' : 'UNKNOWN'

  return {
    stockName: o.hts_kor_isnm,
    currentPrice: Number(o.stck_prpr),
    priceChange: Number(o.prdy_vrss),
    priceChangeRate: Number(o.prdy_ctrt),
    week52High: Number(o.w52_hgpr),
    week52Low: Number(o.w52_lwpr),
    volumeRatio: Number(o.vol_tnrt),
    per: Number(o.per),
    pbr: Number(o.pbr),
    marketCap: Number(o.hts_avls),
    marketType,
  }
}

/** 최근 20일 일별 시세 조회 */
async function fetchDailyData(stockCode: string, token: string): Promise<DailyBar[]> {
  const res = await fetchWithTimeout(
    `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-daily-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}&FID_PERIOD_DIV_CODE=D&FID_ORG_ADJ_PRC=0`,
    { headers: kisHeaders(token, 'FHKST01010400') },
    6000
  )
  const data = await res.json()
  const days = (data.output || []).slice(0, 20)

  return days.map((d: Record<string, string>) => ({
    date: d.stck_bsop_date,
    close: Number(d.stck_clpr),
    volume: Number(d.acml_vol),
    changeRate: Number(d.prdy_ctrt),
  }))
}

/** 기관/외인 수급 — neutral 반환 (KIS 투자자별 API 추후 연동) */
async function fetchInstitutionalData(_stockCode: string, _token: string): Promise<InstitutionalData> {
  return { recentDays: 0, institutionNet: 0, foreignNet: 0, bothSelling: false }
}

/** RSI 계산 (일별 등락률 기반, period=14) */
function calculateRSI(daily: DailyBar[], period = 14): number {
  if (daily.length < period) return 50
  const rates = daily.slice(0, period).map(d => d.changeRate)
  const gains = rates.map(r => r > 0 ? r : 0)
  const losses = rates.map(r => r < 0 ? Math.abs(r) : 0)
  const avgGain = gains.reduce((s, v) => s + v, 0) / period
  const avgLoss = losses.reduce((s, v) => s + v, 0) / period
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100
  const rs = avgGain / avgLoss
  return Math.round(100 - (100 / (1 + rs)))
}

/** KIS API 공통 헤더 */
function kisHeaders(token: string, trId: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    appkey: Deno.env.get('KIS_APP_KEY')!,
    appsecret: Deno.env.get('KIS_APP_SECRET')!,
    tr_id: trId,
  }
}

// ─── 시장 신호 API (Yahoo Finance + Alternative.me) ──────────

/** Yahoo Finance에서 심볼 1년치 데이터 조회 → 현재가 + 52주 고점 */
async function fetchYahooChart(symbol: string): Promise<{ price: number; week52High: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 4000)
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null
    const closes: number[] = (result.indicators?.quote?.[0]?.close || []).filter((v: number | null) => v != null)
    if (closes.length === 0) return null
    return {
      price: closes[closes.length - 1],
      week52High: Math.max(...closes),
    }
  } catch {
    return null
  }
}

/** 시장 신호 수집 — Yahoo Finance(VIX, 코스피, 코스닥) + Alternative.me(공포탐욕) */
async function fetchMarketSignals(): Promise<MarketSignals> {
  try {
    const [vixRes, fngRes, kospiRes, kosdaqRes] = await Promise.allSettled([
      fetchYahooChart('%5EVIX'),   // VIX 지수
      fetchWithTimeout('https://api.alternative.me/fng/?limit=1', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }, 3000).then(r => r.json()),
      fetchYahooChart('%5EKS11'),  // 코스피
      fetchYahooChart('%5EKQ11'),  // 코스닥 150
    ])

    // VIX
    const vixData = vixRes.status === 'fulfilled' ? vixRes.value : null
    const vix = vixData?.price ?? 20

    // 공포탐욕 (0~100)
    const fngData = fngRes.status === 'fulfilled' ? fngRes.value : null
    const fearGreed = Number(fngData?.data?.[0]?.value) || 50

    // 코스피 drawdown — (현재가 / 52주고점) × 100
    const kospiData = kospiRes.status === 'fulfilled' ? kospiRes.value : null
    const kospiDrawdown = kospiData
      ? Math.round((kospiData.price / kospiData.week52High) * 100)
      : 88

    // 코스닥 drawdown
    const kosdaqData = kosdaqRes.status === 'fulfilled' ? kosdaqRes.value : null
    const kosdaqDrawdown = kosdaqData
      ? Math.round((kosdaqData.price / kosdaqData.week52High) * 100)
      : 85

    // 미국 기준금리 — 2026년 4월 현재 4.25% (FOMC 결정값, 자주 안 바뀜)
    const fedRate = 4.25
    const rateDirection: MarketSignals['rateDirection'] = 'down'

    // 달러 인덱스 — Yahoo Finance DX-Y.NYB
    const dxyData = await fetchYahooChart('DX-Y.NYB').catch(() => null)
    const dxyValue = dxyData?.price ?? 102

    const dataAvailable = vixData !== null || fngData !== null

    return { vix, fearGreed, kospiDrawdown, kosdaqDrawdown, fedRate, rateDirection, dxy: dxyValue, dataAvailable }
  } catch (_e) {
    return {
      vix: 20, fearGreed: 50, kospiDrawdown: 88, kosdaqDrawdown: 85,
      fedRate: 4.25, rateDirection: 'down', dxy: 102,
      dataAvailable: false,
    }
  }
}

/** 중첩 객체에서 키로 숫자 값 추출 (여러 키명 폴백) */
function extractNumber(obj: unknown, keys: string[]): number | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  for (const key of keys) {
    const val = o[key]
    if (typeof val === 'number' && !isNaN(val)) return val
    if (typeof val === 'string') {
      const n = parseFloat(val)
      if (!isNaN(n)) return n
    }
    // 1단계 중첩 탐색
    for (const topKey of Object.keys(o)) {
      const sub = o[topKey]
      if (sub && typeof sub === 'object') {
        const subVal = (sub as Record<string, unknown>)[key]
        if (typeof subVal === 'number' && !isNaN(subVal)) return subVal
      }
    }
  }
  return null
}

// ─── 네이버 뉴스 API ─────────────────────────────────────────

/** 네이버 뉴스 검색 → 뉴스 신호 추출 */
async function fetchNewsSignals(stockName: string): Promise<NewsSignals> {
  const clientId = Deno.env.get('NAVER_CLIENT_ID')
  const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    return { totalCount: 0, rumorCount: 0, earnCount: 0, issueCount: 0, absorbed: false, dataAvailable: false }
  }

  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(stockName)}&display=15&sort=date`
    const res = await fetchWithTimeout(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    }, 4000)

    if (!res.ok) throw new Error(`Naver News API ${res.status}`)

    const data = await res.json()
    const items: Array<{ title: string; description: string }> = data.items || []

    // 키워드 기반 카테고리 분류
    const RUMOR_KEYWORDS = ['카더라', '소문', '루머', '의혹', '확인되지', '떠돌', '급등 이유', '이유없는', '이유 없는']
    const EARN_KEYWORDS = ['실적', '매출', '영업이익', '순이익', '어닝', '분기', '연간', '공시', '사업보고서']
    const ISSUE_KEYWORDS = ['계약', '수주', '인수', 'M&A', '합병', '특허', '파트너십', '협약', '자회사']

    let rumorCount = 0
    let earnCount = 0
    let issueCount = 0

    for (const item of items) {
      const text = `${item.title} ${item.description}`.toLowerCase()
      if (RUMOR_KEYWORDS.some(k => text.includes(k))) rumorCount++
      if (EARN_KEYWORDS.some(k => text.includes(k))) earnCount++
      if (ISSUE_KEYWORDS.some(k => text.includes(k))) issueCount++
    }

    return {
      totalCount: items.length,
      rumorCount,
      earnCount,
      issueCount,
      absorbed: false, // combineVerdict에서 가격 데이터와 조합해서 판단
      dataAvailable: true,
    }
  } catch (_e) {
    return { totalCount: 0, rumorCount: 0, earnCount: 0, issueCount: 0, absorbed: false, dataAvailable: false }
  }
}

// ─── 3축 스코어링 엔진 ───────────────────────────────────────

interface ScoreResult {
  score: number
  maxScore: number
  breakdown: Record<string, number>
}

/**
 * 종목 축 스코어링 (40점 만점)
 * 높을수록 위험
 */
function scoreStock(price: PriceData, daily: DailyBar[], institutional: InstitutionalData): ScoreResult {
  const breakdown: Record<string, number> = {}

  // 1. 가격 위치 (12점) — 52주 고점 대비 현재가
  const highRatio = price.week52High > 0
    ? (price.currentPrice / price.week52High) * 100
    : 50
  let priceScore = 0
  if (highRatio >= 98) priceScore = 12
  else if (highRatio >= 93) priceScore = 9
  else if (highRatio >= 85) priceScore = 6
  else if (highRatio >= 70) priceScore = 3
  breakdown['가격위치'] = priceScore

  // 2. PER 밸류에이션 (10점)
  let perScore = 0
  if (price.per <= 0) perScore = 5        // 적자: 중간
  else if (price.per >= 50) perScore = 10
  else if (price.per >= 30) perScore = 7
  else if (price.per >= 20) perScore = 4
  else if (price.per >= 15) perScore = 2
  breakdown['PER밸류'] = perScore

  // 3. 거래량 (10점) — 오늘 vs 20일 평균
  const avgVol = daily.length > 1
    ? daily.slice(1).reduce((s, d) => s + d.volume, 0) / (daily.length - 1)
    : 0
  const todayVol = daily[0]?.volume || 0
  const volMultiple = avgVol > 0 ? todayVol / avgVol : 1
  let volScore = 0
  if (volMultiple >= 5) volScore = 10
  else if (volMultiple >= 3) volScore = 7
  else if (volMultiple >= 1.5) volScore = 4
  breakdown['거래량'] = volScore

  // 4. RSI 과매수 (8점) — 70+ 과매수 = 위험 신호
  const rsi = calculateRSI(daily)
  let rsiScore = 0
  if (rsi >= 80) rsiScore = 8
  else if (rsi >= 70) rsiScore = 5
  else if (rsi >= 60) rsiScore = 2
  breakdown['RSI'] = rsiScore

  let total = priceScore + perScore + volScore + rsiScore

  // 동적 조정: 고점(>=90%) + 과열(>=3배) 동시 → *1.2
  if (highRatio >= 90 && volMultiple >= 3) {
    total = Math.round(total * 1.2)
  }

  return { score: Math.min(total, 40), maxScore: 40, breakdown }
}

/**
 * 시장 축 스코어링 (40점 만점)
 * 높을수록 위험
 */
function scoreMarket(signals: MarketSignals, marketType: PriceData['marketType']): ScoreResult {
  if (!signals.dataAvailable) {
    return { score: 0, maxScore: 40, breakdown: { '데이터없음': 0 } }
  }

  const breakdown: Record<string, number> = {}

  // 1. VIX (10점) — 공포지수
  let vixScore = 0
  if (signals.vix >= 35) vixScore = 10
  else if (signals.vix >= 25) vixScore = 7
  else if (signals.vix >= 20) vixScore = 4
  else if (signals.vix >= 15) vixScore = 2
  breakdown['VIX'] = vixScore

  // 2. 공포탐욕지수 (8점) — 극단적 탐욕 = 고점 신호
  let fgScore = 0
  if (signals.fearGreed >= 80) fgScore = 8
  else if (signals.fearGreed >= 65) fgScore = 6
  else if (signals.fearGreed >= 50) fgScore = 3
  else if (signals.fearGreed <= 20) fgScore = 2 // 극단적 공포도 위험(변동성)
  breakdown['공포탐욕'] = fgScore

  // 3. 코스피/코스닥 지수 위치 (8점) — 전고점에 가까울수록 위험
  const drawdown = marketType === 'KOSDAQ' ? signals.kosdaqDrawdown : signals.kospiDrawdown
  let indexScore = 0
  if (drawdown >= 98) indexScore = 8
  else if (drawdown >= 95) indexScore = 6
  else if (drawdown >= 90) indexScore = 4
  else if (drawdown >= 80) indexScore = 2
  breakdown['지수위치'] = indexScore

  // 4. 금리 (8점) — 고금리일수록 위험
  let rateScore = 0
  if (signals.fedRate >= 5) rateScore = 8
  else if (signals.fedRate >= 4) rateScore = 6
  else if (signals.fedRate >= 3) rateScore = 4
  else if (signals.fedRate >= 2) rateScore = 2
  breakdown['금리'] = rateScore

  // 5. 달러/유동성 (6점) — 달러 강세 = 신흥국 유동성 위험
  let dxyScore = 0
  if (signals.dxy >= 108) dxyScore = 6
  else if (signals.dxy >= 105) dxyScore = 4
  else if (signals.dxy >= 102) dxyScore = 2
  breakdown['달러DXY'] = dxyScore

  let total = vixScore + fgScore + indexScore + rateScore + dxyScore

  // 동적 조정: 5축 중 3개+ 동시 위험 → *1.3
  const dangerCount = [
    vixScore >= 7, fgScore >= 6, indexScore >= 6, rateScore >= 6, dxyScore >= 4,
  ].filter(Boolean).length
  if (dangerCount >= 3) {
    total = Math.round(total * 1.3)
  }

  return { score: Math.min(total, 40), maxScore: 40, breakdown }
}

/**
 * 뉴스 축 스코어링 (20점 만점)
 * 높을수록 위험
 */
function scoreNews(news: NewsSignals, price: PriceData, daily: DailyBar[]): ScoreResult {
  if (!news.dataAvailable) {
    return { score: 0, maxScore: 20, breakdown: { '데이터없음': 0 } }
  }

  const breakdown: Record<string, number> = {}

  // 1. 루머 비율 (12점)
  let rumorScore = 0
  if (news.totalCount > 0) {
    const rumorRatio = news.rumorCount / news.totalCount
    if (rumorRatio >= 0.5) rumorScore = 12
    else if (rumorRatio >= 0.3) rumorScore = 8
    else if (rumorRatio >= 0.15) rumorScore = 4
  }
  breakdown['루머비율'] = rumorScore

  // 2. 뉴스가 이미 주가에 반영됐는지 (8점) — 최근 5일 급등 + 뉴스 많음 = 이미 반영
  const recent5 = daily.slice(0, 5)
  const cumReturn5 = recent5.reduce((s, d) => s + d.changeRate, 0)
  const highRatio = price.week52High > 0 ? (price.currentPrice / price.week52High) * 100 : 50

  let absorbScore = 0
  // 고점 근처이면서 최근 급등 + 뉴스 많음 = 선반영 가능성
  if (highRatio >= 90 && cumReturn5 >= 10 && news.totalCount >= 5) absorbScore = 8
  else if (cumReturn5 >= 15) absorbScore = 6
  else if (cumReturn5 >= 8 && news.totalCount >= 3) absorbScore = 4
  breakdown['선반영여부'] = absorbScore

  return { score: Math.min(rumorScore + absorbScore, 20), maxScore: 20, breakdown }
}

/**
 * 3축 합산 → 판결 등급 결정
 * 총점 100점, 높을수록 위험
 */
function combineVerdict(
  stockScore: ScoreResult,
  marketScore: ScoreResult,
  newsScore: ScoreResult,
  price: PriceData,
  market: MarketSignals,
  institutional: InstitutionalData,
) {
  const totalScore = stockScore.score + marketScore.score + newsScore.score

  // 강제 트리거 — 임계값 무관하게 절대금지
  const highRatio = price.week52High > 0 ? (price.currentPrice / price.week52High) * 100 : 50
  const avgVol20 = 0 // 이미 scoreStock에서 계산했지만 여기선 고점+거래량 강제트리거만 체크
  const forceBan =
    (highRatio >= 98 && price.volumeRatio >= 5) ||  // 고점 98%+ + 거래량 5배 이상
    market.vix >= 35                                 // 공황 수준 VIX

  if (forceBan) {
    return { grade: 'ban' as const, label: '절대금지', emoji: '🚨', totalScore: Math.max(totalScore, 70) }
  }

  // 데이터가 모두 없으면 관망
  const noData = !marketScore.breakdown['데이터없음'] !== true &&
    marketScore.score === 0 && newsScore.score === 0
  if (noData) {
    return { grade: 'hold' as const, label: '관망', emoji: '🫥', totalScore }
  }

  if (totalScore >= 45) return { grade: 'ban' as const, label: '절대금지', emoji: '🚨', totalScore }
  if (totalScore >= 25) return { grade: 'wait' as const, label: '대기', emoji: '🤔', totalScore }
  return { grade: 'ok' as const, label: '괜찮아 보여', emoji: '👀', totalScore }
}

// ─── 시뮬레이션 ─────────────────────────────────────────────

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

/** 실생활 치환 단위 테이블 */
const RELATABLE_UNITS = [
  { label: '아메리카노', price: 5500,     unit: '잔',  emoji: '☕' },
  { label: '편의점 도시락', price: 4500,  unit: '개',  emoji: '🍱' },
  { label: '치킨', price: 22000,          unit: '마리', emoji: '🍗' },
  { label: '피자', price: 25000,          unit: '판',  emoji: '🍕' },
  { label: '삼겹살 2인분', price: 30000,  unit: '인분', emoji: '🥩' },
  { label: '넷플릭스', price: 17000,      unit: '달',  emoji: '📺' },
  { label: '에어팟 프로', price: 359000,  unit: '개',  emoji: '🎧' },
  { label: '아이패드', price: 599000,     unit: '대',  emoji: '📱' },
  { label: '맥북 에어', price: 1590000,   unit: '대',  emoji: '💻' },
  { label: '제주도 왕복', price: 800000,  unit: '번',  emoji: '🏝️' },
  { label: '유럽 항공권', price: 1500000, unit: '장',  emoji: '✈️' },
  { label: '테슬라 모델3', price: 52990000, unit: '대', emoji: '🚗' },
]

/** 금액대에 맞는 실생활 치환 단위 선택 (count 1~15 사이) */
function getRelatableUnit(amount: number) {
  const candidates = RELATABLE_UNITS
    .map(u => ({ ...u, count: Math.round(amount / u.price) }))
    .filter(u => u.count >= 1 && u.count <= 15)

  if (candidates.length === 0) {
    const fallback = amount < 10000
      ? { label: '아메리카노', price: 5500, unit: '잔', emoji: '☕', count: Math.max(1, Math.round(amount / 5500)) }
      : { label: '유럽 항공권', price: 1500000, unit: '장', emoji: '✈️', count: Math.max(1, Math.round(amount / 1500000)) }
    return fallback
  }

  // 중간 금액대 우선
  return candidates[Math.floor(candidates.length / 2)]
}

/** 장기 시뮬레이션용 치환 아이템 (고가) */
function getLongTermUnit(amount: number) {
  const HIGH_UNITS = [
    { label: '에어팟 프로 주인', price: 359000, emoji: '🎧' },
    { label: '아이패드 주인', price: 599000, emoji: '📱' },
    { label: '제주도 여행자', price: 800000, emoji: '🏝️' },
    { label: '맥북 주인', price: 1590000, emoji: '💻' },
    { label: '유럽여행 다녀온 사람', price: 3000000, emoji: '✈️' },
    { label: '테슬라 모델3 주인', price: 52990000, emoji: '🚗' },
  ]

  // 금액보다 작거나 가장 가까운 항목 선택
  const suitable = HIGH_UNITS
    .map(u => ({ ...u, ratio: amount / u.price }))
    .filter(u => u.ratio >= 0.5) // 최소 반값 이상
    .sort((a, b) => Math.abs(1 - a.ratio) - Math.abs(1 - b.ratio)) // 1에 가장 가까운 것

  const picked = suitable[0] || HIGH_UNITS[0]
  return { label: picked.label, emoji: picked.emoji }
}

/** 단기 + 장기 시뮬레이션 통합 생성 */
function buildSimulation(
  price: PriceData,
  daily: DailyBar[],
  investAmount: number,
): VerdictResult['simulation'] {
  // 일별 변동성 계산 (20일)
  const returns = daily.slice(0, 20).map(d => d.changeRate)
  const mean = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0
  const variance = returns.length > 1
    ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
    : 0
  const dailyVol = Math.sqrt(variance)
  const threeDayVol = dailyVol * Math.sqrt(3)

  // 단기 시뮬레이션 (3일)
  const shortTerm = {
    dailyVolatility: Math.round(dailyVol * 100) / 100,
    threeDayRange: {
      bestCase: Math.round(threeDayVol * 100) / 100,
      worstCase: Math.round(-threeDayVol * 100) / 100,
    },
  }

  // 장기 시뮬레이션 — 연평균 수익률 + 변동성 기반 best/worst case
  // 종목 과거 수익률 기반: 20일 평균 수익률 * 250 거래일
  const annualReturnRaw = mean * 250 / 100
  // 너무 극단적인 값은 클램프 (현실적 범위: -20% ~ +30%)
  const annualReturn = Math.max(-0.2, Math.min(0.3, annualReturnRaw))
  const annualVol = dailyVol * Math.sqrt(252) / 100

  // 기간별 단일 예측값 (기댓값) + 차트용 범위 밴드 (±1.28σ)
  function calcScenario(months: number) {
    const years = months / 12
    const expectedReturn = annualReturn * years
    const bandWidth = annualVol * Math.sqrt(years) * 1.28

    const amount      = Math.round(investAmount * (1 + expectedReturn))
    const bestAmount  = Math.round(investAmount * (1 + expectedReturn + bandWidth))
    const worstAmount = Math.round(investAmount * (1 + expectedReturn - bandWidth))
    const gain        = amount - investAmount

    // 수익/손실 금액 기준 라벨 — 창의적 실생활 치환
    const absGain = Math.abs(gain)
    const labelItem = gain >= 0 ? getGainLabel(absGain) : getLossLabel(absGain)
    const label = gain >= 0
      ? `${labelItem.text} 살 수 있어`
      : `${labelItem.text}만큼이야`

    return { amount, gain, bestAmount, worstAmount, label, emoji: labelItem.emoji }
  }

  const longTerm = {
    annualReturn: Math.round(annualReturn * 1000) / 10, // % 단위
    projections: {
      month3: calcScenario(3),
      month6: calcScenario(6),
      year1:  calcScenario(12),
    },
  }

  return { shortTerm, longTerm }
}

// ─── LLM 어댑터 (Claude Haiku) ────────────────────────────────

/**
 * LLM 어댑터 — Claude Haiku
 * Gemini 무료 쿼터 소진으로 Claude 전환
 */
async function callLLM(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        temperature: 0.75,
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    30000
  )

  const rawText = await res.text()
  let result: Record<string, unknown>
  try {
    result = JSON.parse(rawText)
  } catch (_) {
    throw new Error(`Claude 응답 파싱 실패 (HTTP ${res.status})`)
  }

  if (!res.ok) {
    const errorMsg = (result as Record<string, { message?: string }>)?.error?.message || `HTTP ${res.status}`
    throw new Error(`Claude API 오류: ${errorMsg}`)
  }

  const text = (result.content as Array<{ type: string; text: string }>)
    ?.find(b => b.type === 'text')?.text || ''
  return text
}

/** 판결 멘트 + 비유 근거 + 치환 텍스트 Gemini 생성 */
async function generateVerdictWithLLM(ctx: {
  stockName: string
  stockCode: string
  investAmount: number
  priceData: PriceData
  dailyData: DailyBar[]
  verdict: { grade: string; label: string; totalScore: number }
  stockScore: ScoreResult
  marketScore: ScoreResult
  newsScore: ScoreResult
  marketSignals: MarketSignals
  newsSignals: NewsSignals
  simulation: VerdictResult['simulation']
}) {
  const { stockName, stockCode, investAmount, priceData, dailyData, verdict, simulation } = ctx
  const highRatio = priceData.week52High > 0
    ? Math.round((priceData.currentPrice / priceData.week52High) * 100)
    : 0
  const avgVol20 = dailyData.length > 1
    ? dailyData.slice(1).reduce((s, d) => s + d.volume, 0) / (dailyData.length - 1)
    : 0
  const todayVolMultiple = avgVol20 > 0 ? (dailyData[0]?.volume || 0) / avgVol20 : 1
  const recent5Return = dailyData.slice(0, 5).reduce((s, d) => s + d.changeRate, 0)

  const worstLoss3d = Math.round(investAmount * (simulation.shortTerm.threeDayRange.bestCase / 100))

  const newsHeadlines = ctx.newsSignals?.dataAvailable
    ? '뉴스 데이터 있음'
    : '뉴스 없음'

  const prompt = `너는 30대 직장인이야.
낮에는 회사 다니고 밤에는 토스·카카오페이로 주식 보는 MZ 고인물.
HLB 반토막, 카카오 존버 3년, 공모주 청약 줄섰다 꽝까지 다 경험했어.
유튜브 주식 채널 즐겨찾기만 20개고, 주식 갤러리도 매일 들어가.
지금 후배가 "${stockName} 이거 사도 돼?" 하고 카톡 보내왔어.
말리고 싶은 마음 반, 어차피 살 거 아는 마음 반.
직장인 특유의 자조적 유머로 현실을 직격해.

## 종목 데이터
- 종목: ${stockName} (${stockCode})
- 현재가: ${priceData.currentPrice.toLocaleString()}원
- 고점 대비 위치: ${highRatio}% (100%=고점, 낮을수록 바닥)
- 거래량: 평소 대비 ${todayVolMultiple.toFixed(1)}배
- 최근 5일 등락: ${recent5Return > 0 ? '+' : ''}${recent5Return.toFixed(1)}%
- 시장 분위기 (공포탐욕): ${ctx.marketSignals.fearGreed ?? '데이터 없음'}/100
- 관련 뉴스: ${newsHeadlines}
- 판결: ${verdict.label} (위험점수 ${verdict.totalScore}/100)
- 투자금: ${investAmount.toLocaleString()}원
- 최악 손실 예상: ${worstLoss3d.toLocaleString()}원

## 판결별 말투
🤬 절대금지: 형이 직접 당한 것처럼 진심으로 말려. "아 이거 나 작년에 샀다가 반토막 났어. 진짜로." / "사지 마. 사면 나중에 나한테 욕해도 됨."
😤 대기: 선배 톤으로 탐욕 참으라고. "3일만 참아. 딱 3일만." / "지금 들어가면 왜 이때 샀지 하면서 잠 못 잠."
😎 인정: 쿨하게, 절대 몰빵 금지. "나쁘진 않네. 근데 월급 전부는 넣지 마." / "타이밍은 맞는 것 같아. -10% 되면 버틸 수 있어?"
🫠 관망: 솔직하게. "이건 나도 모르겠다. 진짜로." / "이럴 땐 그냥 안 사는 게 답임."

## 손실 치환 기준 (lossConversion용) — "날린다" 표현 절대 금지. 아래처럼 엉뚱하게.
1~3만원: "편의점 야식 한 번이야" / "택시비 한 번인데"
3~10만원: "치킨 한 마리인데" / "디즈니플러스 5개월치야"
10~30만원: "제주도 편도야" / "제주도 왕복 두 번이야"
30~70만원: "메타버스에서 집 살 수 있었어" / "한강뷰 원룸 한 달이야"
70만원+: "꿈에서만 살 수 있는 금액이야" / "꿈에서 스테이크 먹는 수준이야"

## 절대 금지
- "사라", "매수해", "좋은 종목" 등 매수 추천 금지
- 금융 보고서 톤, 딱딱한 문체 금지
- 초성 축약어(ㅋㅋ, ㄹㅇ) 금지
- PER, VIX, 52주, 이평선 등 전문용어 금지
- 없는 용어 창작 금지

## 응답 형식 (JSON만, 다른 텍스트 없이)
{
  "headlineMent": "10~20자. 반말. MZ 주식 커뮤니티 말투. 예: '지금 사면 기부 천사 등극' / '3일만 참아 진짜로' / '나쁘지 않은데 몰빵은 금지'",
  "lossConversion": "snarky 톤. '날린다' 표현 금지. 예: '제주도 왕복 두 번이야 ㅋ' / '메타버스에서 집 살 수 있었는데' / '꿈에서만 살 수 있는 금액이야'",
  "issueType": "임상실패 | 수주 | 실적 | 거시경제 | 루머 | 기타 중 하나",
  "sectorImpact": "긍정 | 부정 | 중립 중 하나",
  "impactTag": "섹터+방향 한 줄 (예: '바이오 부정', '반도체 긍정'). 없으면 null",
  "priceSignalTag": "가격 이상 신호 한 줄 (예: '3일 연속 하락', '거래량 급등'). 없으면 null",
  "reasons": [
    {
      "cardType": "price | value | volume | market | news 중 하나",
      "description": "2문장 이내. 완전 쉬운 말. 중학생도 이해 가능. 전문용어 절대 금지. 예: '지금 거의 제일 비쌀 때야. 더 오를 공간이 없어.' / '이 회사 돈 버는 속도로 따지면 투자금 돌려받는 데 50년 걸려.'"
    }
  ]
}
- reasons: 데이터 있는 항목만. price/value/volume/market은 데이터 있으면 포함, news는 뉴스 있을 때만.`

  // rawData — 프론트 카드 룩업에 필요한 수치 모음
  const rawDataForResponse = {
    highRatio: Math.round(priceData.week52High > 0
      ? (priceData.currentPrice / priceData.week52High) * 100
      : 50),
    per: priceData.per > 0 ? Math.round(priceData.per) : null,
    isDeficit: priceData.per <= 0,
    volMultiple: Math.round(todayVolMultiple * 10) / 10,
    fearGreed: ctx.marketSignals.fearGreed ?? null,
  }

  const text = await callLLM(prompt)
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // LLM 응답 실패 시 기본값 반환 — 서비스 중단 방지
    return {
      headlineMent: `${verdict.label} — 지금은 아냐`,
      lossConversion: `${getLossLabel(worstLoss3d).emoji} ${getLossLabel(worstLoss3d).text}만큼이야`,
      reasons: [{ cardType: 'price', description: `고점 대비 ${highRatio}% 위치야. 지금 꽤 비쌀 때야.` }],
      rawData: rawDataForResponse,
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return { ...parsed, rawData: rawDataForResponse }
  } catch (_) {
    return {
      headlineMent: `${verdict.label} — 지금은 애매해`,
      lossConversion: `${getLossLabel(worstLoss3d).emoji} ${getLossLabel(worstLoss3d).text}만큼이야`,
      reasons: [],
      rawData: rawDataForResponse,
    }
  }
}

// ─── Mock 데이터 (API 키 미설정 환경) ────────────────────────

/** API 키 미설정 환경에서 UI 테스트용 목업 결과 반환 */
function buildMockResult(query: string, investAmount: number): VerdictResult {
  const stockName = query.length <= 6 && /^\d+$/.test(query) ? '삼성전자' : query
  const stockCode = query.length === 6 && /^\d+$/.test(query) ? query : '005930'

  const lossAmount = Math.round(investAmount * 0.04)

  // 목업 시뮬레이션 — 단일 기댓값 + 범위 밴드
  function mockScenario(months: number) {
    const ar = 0.08
    const av = 0.25
    const years = months / 12
    const amount      = Math.round(investAmount * (1 + ar * years))
    const bestAmount  = Math.round(investAmount * (1 + ar * years + av * Math.sqrt(years) * 1.28))
    const worstAmount = Math.round(investAmount * (1 + ar * years - av * Math.sqrt(years) * 1.28))
    const gain        = amount - investAmount
    const absGain     = Math.abs(gain)
    const labelItem   = gain >= 0 ? getGainLabel(absGain) : getLossLabel(absGain)
    const label       = gain >= 0 ? `${labelItem.text} 살 수 있어` : `${labelItem.text}만큼이야`
    return { amount, gain, bestAmount, worstAmount, label, emoji: labelItem.emoji }
  }

  return {
    stockName,
    stockCode,
    investAmount,
    verdict: {
      grade: 'wait',
      label: '대기',
      emoji: '🤔',
      score: 52,
      headlineMent: '3일만 참아 지금은 좀 애매해',
      lossConversion: `${getLossLabel(lossAmount).emoji} ${getLossLabel(lossAmount).text}만큼이야`,
    },
    reasons: [
      { cardType: 'price',  description: '지금 꽤 높은 가격이야. 1년 중 제일 비쌌을 때랑 별로 차이 안 나.' },
      { cardType: 'volume', description: '오늘 엄청 많이 사고 팔고 있어. 뭔가 터졌나봐.' },
      { cardType: 'market', description: '요즘 다들 좀 불안해하는 분위기야. 시장 전체가 살짝 겁쟁이 모드.' },
    ],
    rawData: { highRatio: 92, per: 18, isDeficit: false, volMultiple: 3.2, fearGreed: 42 },
    issueType: '기타',
    sectorImpact: '중립',
    impactTag: null,
    priceSignalTag: '거래량 급등',
    simulation: {
      shortTerm: {
        dailyVolatility: 2.37,
        threeDayRange: { bestCase: 4.1, worstCase: -4.1 },
      },
      longTerm: {
        annualReturn: 8,
        projections: {
          month3: mockScenario(3),
          month6: mockScenario(6),
          year1:  mockScenario(12),
        },
      },
    },
    signals: {
      stock: { score: 28, breakdown: { '가격위치': 9, 'PER밸류': 7, '거래량': 7, '수급': 0 } },
      market: { score: 24, breakdown: { VIX: 4, '공포탐욕': 6, '지수위치': 6, '금리': 6, '달러DXY': 2 } },
      news: { score: 0, breakdown: { '루머비율': 0, '선반영여부': 0 } },
    },
  }
}

// ─── 유틸 ───────────────────────────────────────────────────

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
