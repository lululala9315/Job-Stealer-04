/**
 * 역할: 종목명/코드 퍼지 검색 훅
 * 주요 기능: Fuse.js 기반 오타 허용 검색 (예: "사성전자" → "삼성전자")
 * 의존성: fuse.js, src/lib/stocks.json
 */

import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import stocks from '../lib/stocks.json'

const fuse = new Fuse(stocks, {
  keys: ['name', 'code'],
  threshold: 0.35,      // 낮을수록 엄격 (0.35 = 오타 1~2자 허용)
  distance: 100,
  minMatchCharLength: 1,
  shouldSort: true,
})

export function useStockSearch(query) {
  const results = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return []

    // 6자리 숫자 코드 직접 입력 시 정확 매칭 우선
    if (/^\d{4,6}$/.test(trimmed)) {
      const exact = stocks.filter(s => s.code.startsWith(trimmed))
      if (exact.length) return exact.slice(0, 6)
    }

    return fuse.search(trimmed).map(r => r.item).slice(0, 6)
  }, [query])

  return results
}
