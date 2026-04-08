/**
 * 역할: 종목 로고 이미지
 * 주요 기능: alphasquare 직접 URL 시도 → 실패 시 API로 hash URL 조회 → 이니셜 fallback
 * 의존성: 없음
 */

import { useState, useEffect } from 'react'

function InitialFallback({ stockName, size }) {
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

export default function StockLogo({ stockCode, stockName, size = 36 }) {
  const isKoreanCode = /^\d{6}$/.test(stockCode)

  // 시도할 URL — null이면 이니셜 fallback
  const [imgUrl, setImgUrl] = useState(
    isKoreanCode
      ? `https://file.alphasquare.co.kr/media/images/stock_logo/kr/${stockCode}.png`
      : null
  )
  const [failed, setFailed] = useState(false)

  // stockCode 바뀌면 상태 초기화
  useEffect(() => {
    if (!isKoreanCode) {
      setImgUrl(null)
      setFailed(false)
      return
    }
    setImgUrl(`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${stockCode}.png`)
    setFailed(false)
  }, [stockCode])

  // 직접 URL 실패 → API에서 hash URL 조회
  const handleError = async () => {
    if (!isKoreanCode) { setFailed(true); return }

    // 이미 API 조회한 URL이면 (hash URL도 실패) → fallback
    const isDirectUrl = imgUrl?.includes('/kr/')
    if (!isDirectUrl) { setFailed(true); return }

    try {
      const res = await fetch(
        `https://api.alphasquare.co.kr/data/v2/stock/details?code=${stockCode}`
      )
      const data = await res.json()
      const logoUrl = data?.[stockCode]?.logo || data?.logo
      if (logoUrl) {
        setImgUrl(logoUrl)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    }
  }

  if (!imgUrl || failed) {
    return <InitialFallback stockName={stockName} size={size} />
  }

  return (
    <img
      key={imgUrl}
      src={imgUrl}
      alt={stockName}
      onError={handleError}
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
