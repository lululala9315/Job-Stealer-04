/**
 * 역할: 사용자 판결 히스토리 목록
 * 주요 기능: check_history 테이블 최근 10개 조회, 판결 이모지+한줄멘트 표시
 * 의존성: supabase 클라이언트, useAuth
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import StockLogo from './StockLogo'

/** 판결 등급 → 이모지 매핑 */
const GRADE_EMOJI = {
  ban:  '🚨',
  wait: '🤔',
  ok:   '👀',
  hold: '🫥',
}

/** 판결 등급 → 색상 매핑 */
const GRADE_COLORS = {
  ban:  'var(--color-verdict-ban)',
  wait: 'var(--color-verdict-wait)',
  ok:   'var(--color-verdict-ok)',
  hold: 'var(--color-verdict-hold)',
}

export default function HistoryList({ onSelect }) {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchHistory = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('check_history')
        .select('id, stock_name, stock_code, check_result, verdict_grade, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error) setHistory(data || [])
      setLoading(false)
    }

    fetchHistory()
  }, [user])

  if (loading) {
    return (
      <div style={{ marginTop: '32px' }}>
        <div
          style={{
            height: '13px',
            width: '64px',
            backgroundColor: 'var(--color-bg-input)',
            borderRadius: '6px',
            marginBottom: '12px',
          }}
        />
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: '68px',
              backgroundColor: 'var(--color-bg-input)',
              borderRadius: '16px',
              marginBottom: '8px',
              animation: 'histPulse 1.5s ease-in-out infinite',
              opacity: 1 - i * 0.2,
            }}
          />
        ))}
        <style>{`@keyframes histPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div style={{ marginTop: '32px' }}>
        <p
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            marginBottom: '10px',
          }}
        >
          최근 판결
        </p>
        <div
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: '16px',
            padding: '24px 20px',
            border: '1px dashed var(--color-border)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '24px', marginBottom: '8px' }}>👀</p>
          <p
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: '6px',
            }}
          >
            아직 판결한 종목이 없어
          </p>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
              lineHeight: '19.5px',
            }}
          >
            눈 돌아간 거 뭐야?<br />같이 판결해볼게
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <p
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          marginBottom: '10px',
        }}
      >
        최근 판결
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {history.map((item) => {
          const grade = item.verdict_grade || item.check_result?.verdict?.grade || 'hold'
          const emoji = GRADE_EMOJI[grade] || '🫥'
          const gradeColor = GRADE_COLORS[grade] || GRADE_COLORS.hold
          const headlineMent = item.check_result?.verdict?.headlineMent || ''

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.check_result)}
              style={{
                width: '100%',
                textAlign: 'left',
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: '16px',
                padding: '14px 16px',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.99)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* 주식 로고 + 판결 이모지 뱃지 */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <StockLogo stockCode={item.stock_code} stockName={item.stock_name} size={40} />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -3,
                      right: -6,
                      width: '20px',
                      height: '20px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  >
                    {emoji}
                  </div>
                </div>

                {/* 종목명 + 한줄 멘트 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <p
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.stock_name}
                    </p>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: gradeColor,
                        flexShrink: 0,
                      }}
                    >
                      {grade === 'ban' ? '절대금지' : grade === 'wait' ? '대기' : grade === 'ok' ? '괜찮아' : '관망'}
                    </span>
                  </div>
                  {headlineMent && (
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--color-text-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {headlineMent}
                    </p>
                  )}
                </div>

                {/* 날짜 */}
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                    flexShrink: 0,
                  }}
                >
                  {formatDate(item.created_at)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 날짜를 "오늘 14:32" 또는 "3일 전" 형식으로 포맷 */
function formatDate(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `오늘 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  return `${date.getMonth() + 1}/${date.getDate()}`
}
