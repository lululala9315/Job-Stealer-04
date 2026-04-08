/**
 * 역할: 메인 화면 — 전체 판결 플로우 관리
 * 주요 기능: SEARCH → AMOUNT(페이지) → LOADING → VERDICT → SIMULATION
 * 의존성: useAuth, SearchScreen, AmountInput, LoadingScreen, VerdictScreen, SimulationScreen, supabase
 */

import { useState, useEffect } from 'react'
import Header from '../components/Header'
import SearchScreen from '../components/SearchScreen'
import AmountInput from '../components/AmountInput'
import LoadingScreen from '../components/LoadingScreen'
import VerdictScreen from '../components/VerdictScreen'
// SimulationScreen은 VerdictScreen에 인라인 통합됨
import LoginBottomSheet from '../components/LoginBottomSheet'
import USStockSheet from '../components/USStockSheet'

// 미국 주식 한글 종목명 목록 — 검색 차단 후 준비중 시트 노출
const US_STOCK_NAMES = [
  '애플', '테슬라', '엔비디아', '구글', '알파벳', '메타', '아마존',
  '마이크로소프트', '넷플릭스', '팔란티어', '코인베이스', '스타벅스',
  '나이키', '아크', '스냅', '트위터', '우버', '리프트', '에어비앤비',
  '스포티파이', '쇼피파이', '스퀘어', '페이팔', '줌', '로블록스',
]

function isUSStock(query) {
  const q = query.trim()
  // 영문 티커 (AAPL, TSLA 등)
  if (/^[A-Za-z]{1,5}$/.test(q)) return true
  // 한글 미국 기업명
  return US_STOCK_NAMES.some(name => q.includes(name))
}
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STEPS = {
  SEARCH:     'search',
  AMOUNT:     'amount',
  LOADING:    'loading',
  VERDICT:    'verdict',
  SIMULATION: 'simulation',
}

export default function MainPage() {
  const { user } = useAuth()
  const [step, setStep]                 = useState(STEPS.SEARCH)
  const [query, setQuery]               = useState('')
  const [stockName, setStockName]       = useState('')
  const [investAmount, setInvestAmount] = useState(1_000_000)
  const [result, setResult]             = useState(null)
  const [error, setError]               = useState(null)
  const [showLoginSheet, setShowLoginSheet]   = useState(false)
  const [showUSStockSheet, setShowUSStockSheet] = useState(false)
  const [stockPrice, setStockPrice]     = useState(null)
  const [stockCode, setStockCode]       = useState('')
  const [isSearching, setIsSearching]   = useState(false)
  const [shares, setShares]             = useState(0)
  const [priceAtCheck, setPriceAtCheck] = useState(null)

  /** 1단계: 검색 완료 → 종목 확인 후 AMOUNT 페이지 이동 */
  const handleSearch = async (searchQuery, displayName) => {
    if (!user) {
      setShowLoginSheet(true)
      return
    }
    setQuery(searchQuery)
    setStockName(displayName || searchQuery)
    setError(null)
    setStockPrice(null)
    setStockCode('')

    // 미국 주식이면 준비중 시트 — API 호출 없이 즉시 차단
    if (isUSStock(searchQuery)) {
      setShowUSStockSheet(true)
      return
    }

    // 종목 유효성 확인 후 이동
    setIsSearching(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-stock', {
        body: { query: searchQuery, priceOnly: true },
      })
      if (fnError || data?.error) {
        setError(data?.error || '종목을 찾을 수 없어. 한국 종목명이나 6자리 코드로 검색해줘.')
        return
      }
      if (data?.currentPrice) setStockPrice(data.currentPrice)
      if (data?.stockCode) setStockCode(data.stockCode)
      setStep(STEPS.AMOUNT)
    } catch {
      setError('종목 조회 중 오류가 생겼어. 잠깐 뒤에 다시 시도해봐.')
    } finally {
      setIsSearching(false)
    }
  }

  /** 2단계: 수량 확정 (shares × price = 원 단위) → Edge Function 호출 */
  const handleAmountSubmit = async (amount, submittedShares, submittedPrice) => {
    setInvestAmount(amount)
    setShares(submittedShares || 0)
    setPriceAtCheck(submittedPrice || null)
    setStep(STEPS.LOADING)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-stock', {
        body: { query, userId: user?.id, investAmount: amount, stockName },
      })

      if (data?.error) throw new Error(data.error)
      if (fnError) throw fnError

      setResult(data)
      // API가 숫자(코드)를 반환하면 기존 displayName 유지
      const apiName = data.stockName
      if (apiName && !/^\d+$/.test(apiName)) {
        setStockName(apiName)
      }
      setStep(STEPS.VERDICT)
    } catch (err) {
      console.error('판결 오류:', err)
      setError(err.message || '판결 중에 오류가 생겼어. 잠깐 뒤에 다시 시도해봐.')
      setStep(STEPS.SEARCH)
    }
  }

  // 에러 토스트 4초 후 자동 클리어
  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(id)
  }, [error])

  // AMOUNT 페이지에 있는 동안 15초마다 현재가 갱신 — 장중 가격 반영
  useEffect(() => {
    if (step !== STEPS.AMOUNT || !query) return

    const refresh = async () => {
      try {
        const { data } = await supabase.functions.invoke('check-stock', {
          body: { query, priceOnly: true },
        })
        if (data?.currentPrice) setStockPrice(data.currentPrice)
      } catch {
        // 갱신 실패해도 기존 가격 유지
      }
    }

    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [step, query])

  const handleReset = () => {
    setStep(STEPS.SEARCH)
    setResult(null)
    setQuery('')
    setError(null)
  }

  const handleBack = step === STEPS.SEARCH ? null : () => {
    if (step === STEPS.AMOUNT)       setStep(STEPS.SEARCH)
    else if (step === STEPS.VERDICT) setStep(STEPS.SEARCH)
  }

  const headerTitle = ''

  const isAmountStep   = step === STEPS.AMOUNT
  const isLoadingStep  = step === STEPS.LOADING
  const isVerdictStep  = step === STEPS.VERDICT

  // VERDICT 단계에서 전체 배경색 변경
  const pageBg = isVerdictStep ? '#F3F4F6' : '#ffffff'

  return (
    <div className="flex flex-col min-h-dvh w-full items-center" style={{ backgroundColor: pageBg }}>
      <Header
        onBack={step === STEPS.SEARCH || step === STEPS.LOADING ? null : handleBack}
        title={headerTitle}
        onLogin={() => setShowLoginSheet(true)}
        transparent={isVerdictStep}
      />

      <div
        className="flex-1 flex flex-col w-full"
        style={{ maxWidth: '480px', backgroundColor: pageBg }}
      >
        <main className={`flex-1 flex flex-col${isAmountStep || isLoadingStep || isVerdictStep ? '' : ' px-5 py-4'}`}>
          {/* 에러 토스트는 하단 고정으로 이동 */}

          {step === STEPS.SEARCH  && <SearchScreen onSearch={handleSearch} isSearching={isSearching} />}
          {step === STEPS.AMOUNT  && (
            <AmountInput
              stockName={stockName}
              stockCode={stockCode || (query.match(/^\d{6}$/) ? query : '')}
              stockPrice={stockPrice}
              onSubmit={handleAmountSubmit}
            />
          )}
          {step === STEPS.LOADING && <LoadingScreen />}
          {step === STEPS.VERDICT && result && (
            <VerdictScreen
              result={result}
              stockName={stockName}
              shares={shares}
              investAmount={investAmount}
              onReset={handleReset}
            />
          )}
        </main>
      </div>

      {showLoginSheet && (
        <LoginBottomSheet onClose={() => setShowLoginSheet(false)} />
      )}

      {showUSStockSheet && (
        <USStockSheet onClose={() => setShowUSStockSheet(false)} />
      )}

      {/* 하단 에러 토스트 */}
      {error && step === STEPS.SEARCH && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '440px',
          width: 'calc(100% - 40px)',
          backgroundColor: 'rgba(30,30,30,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '14px',
          padding: '14px 18px',
          zIndex: 100,
          animation: 'toastIn 0.3s cubic-bezier(0.2,0,0,1)',
        }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: '#fff', lineHeight: '20px', margin: 0 }}>
            {error}
          </p>
          <style>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateX(-50%) translateY(12px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
