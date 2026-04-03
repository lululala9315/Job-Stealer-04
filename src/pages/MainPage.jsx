/**
 * 역할: 메인 화면 — 전체 판결 플로우 관리
 * 주요 기능: SEARCH(+바텀시트 금액입력) → LOADING → VERDICT → SIMULATION
 * 의존성: useAuth, SearchScreen, AmountInput, LoadingScreen, VerdictScreen, SimulationScreen, supabase
 */

import { useState } from 'react'
import Header from '../components/Header'
import SearchScreen from '../components/SearchScreen'
import AmountInput from '../components/AmountInput'
import LoadingScreen from '../components/LoadingScreen'
import VerdictScreen from '../components/VerdictScreen'
import SimulationScreen from '../components/SimulationScreen'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STEPS = {
  SEARCH:     'search',
  LOADING:    'loading',
  VERDICT:    'verdict',
  SIMULATION: 'simulation',
}

export default function MainPage() {
  const { user } = useAuth()
  const [step, setStep]                   = useState(STEPS.SEARCH)
  const [query, setQuery]                 = useState('')
  const [stockName, setStockName]         = useState('')
  const [investAmount, setInvestAmount]   = useState(1_000_000)
  const [result, setResult]               = useState(null)
  const [error, setError]                 = useState(null)
  const [showAmountSheet, setShowAmountSheet] = useState(false) // 바텀시트 표시 여부

  /** 1단계: 검색 완료 → 바텀시트 열기 */
  const handleSearch = (searchQuery) => {
    setQuery(searchQuery)
    setStockName(searchQuery)
    setError(null)
    setShowAmountSheet(true)
  }

  /** 2단계: 금액 확정 → 바텀시트 닫고 Edge Function 호출 */
  const handleAmountSubmit = async (amount) => {
    setShowAmountSheet(false)
    setInvestAmount(amount)
    setStep(STEPS.LOADING)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-stock', {
        body: { query, userId: user?.id, investAmount: amount },
      })

      // data?.error 우선 — fnError는 generic 메시지라 실제 원인이 묻힘
      if (data?.error) throw new Error(data.error)
      if (fnError) throw fnError

      setResult(data)
      setStockName(data.stockName || query)
      setStep(STEPS.VERDICT)
    } catch (err) {
      console.error('판결 오류:', err)
      setError(err.message || '판결 중에 오류가 생겼어. 잠깐 뒤에 다시 시도해봐.')
      setStep(STEPS.SEARCH)
    }
  }

  const handleReset = () => {
    setStep(STEPS.SEARCH)
    setResult(null)
    setQuery('')
    setError(null)
    setShowAmountSheet(false)
  }

  const handleBack = step === STEPS.SEARCH ? null : () => {
    if (step === STEPS.VERDICT) setStep(STEPS.SEARCH)
    else if (step === STEPS.SIMULATION) setStep(STEPS.VERDICT)
  }

  return (
    <div className="flex flex-col min-h-dvh items-center" style={{ backgroundColor: '#ffffff' }}>
      {step !== STEPS.SEARCH && (
        <Header onBack={step === STEPS.LOADING ? null : handleBack} />
      )}

      <div
        className="flex-1 flex flex-col w-full"
        style={{ maxWidth: '480px', backgroundColor: '#ffffff' }}
      >
        <main className="flex-1 px-5 py-4">
          {/* 에러 메시지 */}
          {error && step === STEPS.SEARCH && (
            <div
              style={{
                backgroundColor: 'var(--color-negative-light)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                marginBottom: '16px',
                border: '1px solid rgba(240,68,82,0.2)',
              }}
            >
              <p style={{ fontSize: '14px', color: 'var(--color-negative)', lineHeight: '21px' }}>
                {error}
              </p>
            </div>
          )}

          {step === STEPS.SEARCH     && <SearchScreen onSearch={handleSearch} />}
          {step === STEPS.LOADING    && <LoadingScreen />}
          {step === STEPS.VERDICT    && result && (
            <VerdictScreen
              result={result}
              onSimulation={() => setStep(STEPS.SIMULATION)}
              onReset={handleReset}
            />
          )}
          {step === STEPS.SIMULATION && result && (
            <SimulationScreen
              simulation={result.simulation}
              investAmount={investAmount}
              onReset={handleReset}
            />
          )}
        </main>
      </div>

      {/* 금액 입력 바텀시트 */}
      {showAmountSheet && (
        <>
          {/* 딤 배경 */}
          <div
            onClick={() => setShowAmountSheet(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 40,
            }}
          />
          {/* 시트 */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
              borderRadius: '24px 24px 0 0',
              padding: '12px 20px 40px',
              zIndex: 50,
              animation: 'sheetUp 0.28s cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            {/* 핸들 바 */}
            <div
              style={{
                width: '36px',
                height: '4px',
                backgroundColor: 'var(--color-border)',
                borderRadius: '9999px',
                margin: '0 auto 20px',
              }}
            />
            <AmountInput
              stockName={stockName}
              onSubmit={handleAmountSubmit}
            />
          </div>
          <style>{`
            @keyframes sheetUp {
              from { transform: translateX(-50%) translateY(100%); }
              to   { transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
