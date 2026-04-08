/**
 * 역할: 투자 수량 입력 화면 (플로우 2단계) — 풀페이지
 * 주요 기능: 현재가 카드 + 수량 입력 카드 (시스템 키보드) + 프리셋 칩 + 하단 고정 CTA
 * 의존성: StockLogo
 */

import { useRef, useState } from 'react'
import StockLogo from './StockLogo'

const SHARE_PRESETS = [
  { label: '1주',  value: '1' },
  { label: '5주',  value: '5' },
  { label: '10주', value: '10' },
  { label: '50주', value: '50' },
]

function formatWon(won) {
  if (won >= 100_000_000) {
    const eok = Math.floor(won / 100_000_000)
    const man = Math.floor((won % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`
  }
  if (won >= 10_000) return `${Math.floor(won / 10_000).toLocaleString()}만원`
  return `${won.toLocaleString()}원`
}

export default function AmountInput({ stockName, stockCode, stockPrice, onSubmit }) {
  const [shares, setShares] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef(null)

  const parsedShares = parseInt(shares || '0', 10)
  const estimatedAmount = stockPrice ? parsedShares * stockPrice : 0
  const canSubmit = parsedShares > 0 && !!stockPrice

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (parseInt(raw || '0', 10) > 9999) return
    setShares(raw.replace(/^0+(\d)/, '$1'))
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100dvh - 52px)',
      backgroundColor: '#ffffff',
      animation: 'questionIn 0.22s cubic-bezier(0.2, 0, 0, 1)',
    }}>

      {/* 스크롤 영역 */}
      <div style={{ flex: 1, padding: '28px 20px 24px', overflowY: 'auto' }}>

        {/* 타이틀 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '10px' }}>
            <StockLogo stockCode={stockCode} stockName={stockName} size={52} />
          </div>
          <p style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            letterSpacing: '-0.4px',
            lineHeight: '28px',
            marginBottom: '2px',
          }}>
            {stockName}
          </p>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
            lineHeight: '36px',
          }}>
            몇 주 매수 예정이야?
          </h1>
        </div>

        {/* 현재가 카드 */}
        <div style={{
          backgroundColor: '#f4f6f8',
          borderRadius: '16px',
          padding: '16px 18px',
          marginBottom: '8px',
        }}>
          <p style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}>
            현재가
          </p>
          {stockPrice ? (
            <p style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.8px',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}>
              {stockPrice.toLocaleString()}원
            </p>
          ) : (
            <p style={{ fontSize: '22px', fontWeight: 500, color: 'var(--color-text-tertiary)', lineHeight: 1.2 }}>
              조회 중...
            </p>
          )}
        </div>

        {/* 수량 입력 카드 */}
        <div style={{
          backgroundColor: '#f4f6f8',
          borderRadius: '16px',
          padding: '16px 18px',
          marginBottom: '16px',
        }}>
          <p style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}>
            수량
          </p>

          <div
            style={{ display: 'flex', alignItems: 'baseline', cursor: 'text' }}
            onClick={() => inputRef.current?.focus()}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                ref={inputRef}
                className="amount-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={!stockPrice}
                value={shares}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'text',
                  fontSize: '22px',
                }}
              />
              {/* 수량 표시 — Toss/카카오뱅크 패턴 */}
              <p style={{
                fontSize: '22px',
                fontWeight: 600,
                letterSpacing: '-0.6px',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.3,
                display: 'flex',
                alignItems: 'center',
              }}>
                {/* 숫자 or 플레이스홀더 */}
                <span style={{
                  color: shares
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-tertiary)',
                }}>
                  {!isFocused && !shares ? '몇 주?' : shares}
                </span>

                {/* 커서 — 포커스 시에만, 숫자 뒤(단위 앞) */}
                {isFocused && (
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '24px',
                    backgroundColor: 'var(--color-text-primary)',
                    borderRadius: '1px',
                    animation: 'inputCursorBlink 1s step-end infinite',
                    margin: '0 1px',
                    flexShrink: 0,
                  }} />
                )}

                {/* "주" 단위 — 숫자 있을 때만 */}
                {shares && (
                  <span style={{ color: 'var(--color-text-primary)' }}>주</span>
                )}
              </p>
            </div>
          </div>

          {parsedShares > 0 && stockPrice && (
            <p style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.4px',
              lineHeight: 1.3,
              marginTop: '2px',
            }}>
              예상 {formatWon(estimatedAmount)}
            </p>
          )}
        </div>

        {/* 프리셋 칩 — 주수 추가 버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {SHARE_PRESETS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => {
                if (!stockPrice) return
                const added = (parseInt(shares || '0', 10) + parseInt(value, 10))
                if (added > 9999) return
                setShares(String(added))
                // 칩 클릭 시 input focus → 커서 노출
                inputRef.current?.focus()
              }}
              disabled={!stockPrice}
              style={{
                flex: 1,
                height: '36px',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: stockPrice ? 'pointer' : 'default',
                fontFamily: 'inherit',
                opacity: stockPrice ? 1 : 0.4,
                transition: 'transform 0.08s',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseDown={(e) => { if (stockPrice) e.currentTarget.style.transform = 'scale(0.95)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              +{label}
            </button>
          ))}
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <div style={{
        padding: '12px 20px',
        paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        backgroundColor: '#ffffff',
        position: 'sticky',
        bottom: 0,
      }}>
        <button
          onClick={() => canSubmit && onSubmit(estimatedAmount, parsedShares, stockPrice)}
          disabled={!canSubmit}
          style={{
            width: '100%',
            height: '54px',
            /* Primary 검정 버튼 */
            backgroundColor: canSubmit ? 'var(--btn-primary-bg)' : 'var(--color-grey-200)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            color: canSubmit ? 'var(--btn-primary-text)' : 'var(--color-text-disabled)',
            border: 'none',
            boxShadow: canSubmit ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            borderRadius: '14px',
            fontSize: '17px',
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
            fontFamily: 'inherit',
            letterSpacing: '-0.2px',
            transition: 'transform 0.1s, box-shadow 0.1s',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseDown={(e) => { if (canSubmit) e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={(e) => { if (canSubmit) e.currentTarget.style.transform = 'scale(0.98)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          물릴 각인지 확인하기
        </button>
      </div>
    </div>
  )
}
