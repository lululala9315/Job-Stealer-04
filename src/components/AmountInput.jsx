/**
 * 역할: 투자 금액 입력 화면 (플로우 2단계)
 * 주요 기능: 만원 단위 입력 → 원 단위 실시간 표시, 기본값 100만원
 * 의존성: 없음
 */

import { useState, useRef, useEffect } from 'react'

/** 원 단위 금액을 한국어 표기로 포맷 */
function formatAmount(won) {
  if (won >= 100_000_000) {
    const eok = won / 100_000_000
    return `${eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)}억원`
  }
  if (won >= 10_000) {
    return `${(won / 10_000).toLocaleString()}만원`
  }
  return `${won.toLocaleString()}원`
}

/** 퀵셀렉트 프리셋 — 토스/카카오페이 표준 금액 입력 패턴 */
const PRESETS = [
  { label: '30만', value: '30' },
  { label: '100만', value: '100' },
  { label: '300만', value: '300' },
  { label: '500만', value: '500' },
]

export default function AmountInput({ stockName, stockPrice, onSubmit }) {
  const [value, setValue] = useState('100') // 만원 단위
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const parsedAmount = Math.max(0, parseInt(value.replace(/[^0-9]/g, '') || '0', 10))
  const wonAmount = parsedAmount * 10_000

  const handleChange = (e) => {
    // 숫자만 허용
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setValue(raw)
  }

  const handleSubmit = () => {
    if (parsedAmount <= 0) return
    onSubmit(wonAmount)
  }

  const handleSkip = () => {
    // 건너뛰기 = 기본값 100만원 적용
    onSubmit(1_000_000)
  }

  return (
    <div
      style={{
        animation: 'questionIn 0.22s cubic-bezier(0.2, 0, 0, 1)',
        paddingTop: '32px',
      }}
    >
      {/* 타이틀 */}
      <p
        style={{
          fontSize: '15px',
          color: 'var(--color-text-secondary)',
          marginBottom: '6px',
        }}
      >
        {stockName}에
      </p>
      <h1
        style={{
          fontSize: '26px',
          lineHeight: '35px',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.5px',
          marginBottom: '24px',
        }}
      >
        얼마나 넣을
        <br />
        생각이야?
      </h1>

      {/* 입력 영역 */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-input)',
          borderRadius: 'var(--radius-2xl)',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        {/* 만원 단위 입력 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            name="invest-amount"
            autoComplete="off"
            aria-label="투자 금액 (만원 단위)"
            value={value}
            onChange={handleChange}
            style={{
              flex: 1,
              height: '52px',
              backgroundColor: '#ffffff',
              border: '1.5px solid var(--color-accent)',
              borderRadius: 'var(--radius-lg)',
              padding: '0 16px',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
            }}
          />
          <span
            style={{
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              flexShrink: 0,
            }}
          >
            만원
          </span>
        </div>

        {/* 원 단위 + 주수 실시간 표시 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <p style={{ fontSize: '15px', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {parsedAmount > 0 ? `= ${wonAmount.toLocaleString()}원` : '금액을 입력해줘'}
          </p>
          {/* 주수 계산 — 현재가 로드됐을 때만 표시 */}
          {stockPrice && parsedAmount > 0 && (
            <p style={{ fontSize: '14px', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              약 {Math.floor(wonAmount / stockPrice).toLocaleString()}주
            </p>
          )}
        </div>

        {/* 퀵셀렉트 칩 — 토스 금액입력 표준 패턴 */}
        <div style={{ display: 'flex', gap: '7px' }}>
          {PRESETS.map((preset) => {
            const isActive = value === preset.value
            return (
              <button
                key={preset.value}
                onClick={() => setValue(preset.value)}
                style={{
                  flex: 1,
                  height: '36px',
                  backgroundColor: isActive ? 'var(--color-accent)' : '#ffffff',
                  color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background-color 0.15s cubic-bezier(0.2, 0, 0, 1), color 0.15s cubic-bezier(0.2, 0, 0, 1), transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
                  willChange: 'transform',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 다음 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={parsedAmount <= 0}
        style={{
          width: '100%',
          height: 'var(--button-height-lg)',
          backgroundColor: parsedAmount > 0 ? 'var(--color-accent)' : 'var(--color-bg-input)',
          color: parsedAmount > 0 ? '#ffffff' : 'var(--color-text-disabled)',
          border: 'none',
          borderRadius: 'var(--button-radius)',
          fontSize: '17px',
          fontWeight: 700,
          cursor: parsedAmount > 0 ? 'pointer' : 'default',
          fontFamily: 'inherit',
          transition: 'background-color 0.15s cubic-bezier(0.2, 0, 0, 1), transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
          willChange: 'transform',
          marginBottom: '14px',
        }}
        onMouseDown={(e) => { if (parsedAmount > 0) e.currentTarget.style.transform = 'scale(0.96)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        이 금액으로 판결받기
      </button>

      {/* 건너뛰기 — 최소 히트 영역 44px 확보 */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleSkip}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '14px',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '12px 16px',
            minHeight: '44px',
          }}
        >
          잘 모르겠어, 건너뛸게 (100만원 기준)
        </button>
      </div>
    </div>
  )
}
