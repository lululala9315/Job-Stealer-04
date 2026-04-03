/**
 * 역할: 종목 로고 이미지 (alphasquare CDN + 이니셜 fallback)
 * 주요 기능: 국내 6자리 코드면 CDN 이미지, 실패 or 해외 종목이면 이니셜 원형
 * 의존성: 없음
 */

import { useState } from 'react'

export default function StockLogo({ stockCode, stockName, size = 36 }) {
  const [error, setError] = useState(false)
  const isKoreanCode = /^\d{6}$/.test(stockCode)

  if (error || !isKoreanCode) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: 'var(--color-accent-light)',
          color: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.4),
          fontWeight: 700,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {stockName?.[0] || '?'}
      </div>
    )
  }

  return (
    <img
      src={`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${stockCode}.png`}
      alt={stockName}
      onError={() => setError(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        outline: '1px solid rgba(0, 27, 55, 0.06)',
      }}
    />
  )
}
