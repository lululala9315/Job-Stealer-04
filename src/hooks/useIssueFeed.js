/**
 * 역할: 이슈 피드 데이터 fetch 훅
 * 주요 기능: Supabase DB 캐시 우선 조회 → 없으면 issue-feed Edge Function 호출
 * 의존성: supabase 클라이언트
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// sentiment 정렬 순서 — 위험을 먼저 보여줌
const SENTIMENT_ORDER = { '위험': 0, '주의': 1, '긍정': 2 }

export function useIssueFeed() {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // 1. DB 캐시 조회 (유효한 항목만)
        const { data: cached } = await supabase
          .from('issue_feed')
          .select('stock_code, stock_name, price_change, sentiment, emoji, one_line')
          .gt('expires_at', new Date().toISOString())
          .limit(5)

        if (!cancelled && cached?.length > 0) {
          const sorted = [...cached].sort(
            (a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 3) - (SENTIMENT_ORDER[b.sentiment] ?? 3)
          )
          setIssues(sorted)
          setLoading(false)
          return
        }

        // 2. 캐시 없으면 Edge Function 호출
        const { data } = await supabase.functions.invoke('issue-feed')
        if (!cancelled && data?.issues?.length > 0) {
          const sorted = [...data.issues].sort(
            (a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 3) - (SENTIMENT_ORDER[b.sentiment] ?? 3)
          )
          setIssues(sorted)
        }
      } catch (_) {
        // 에러 시 피드 숨김 (검색 기능에는 영향 없음)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { issues, loading }
}
