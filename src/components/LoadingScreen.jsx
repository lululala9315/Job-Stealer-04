/**
 * 역할: Edge Function 호출 중 로딩 화면
 * 주요 기능: 2.5초마다 재밌는 텍스트 순환 + 스피너
 * 의존성: 없음
 */

import { useState, useEffect } from 'react'

const LOADING_MESSAGES = [
  '충동이 올라오고 있어...',
  '지금 이 종목 진짜 괜찮은지 보는 중...',
  '팩트 몇 개 긁어오는 중...',
  '뇌동매매 감지 레이더 켜는 중...',
  '무릎인지 어깨인지 파악 중...',
  '지금 사면 어떻게 될지 시뮬 중...',
  '남들도 다 사는지 확인 중...',
  '이미 늦은 건지 확인 중...',
]

export default function LoadingScreen() {
  const [idx, setIdx] = useState(0)

  // 2.5초마다 다음 메시지로 순환
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % LOADING_MESSAGES.length), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="분석 중"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '28px',
        animation: 'loadingFadeIn 0.3s cubic-bezier(0.2, 0, 0, 1)',
        paddingTop: '32px',
      }}
    >
      {/* 스피너 */}
      <div
        className="loading-spinner"
        style={{
          width: '48px',
          height: '48px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent)',
          borderRadius: '50%',
        }}
      />

      {/* 순환 메시지 — key={idx}로 fade 재생 */}
      <div style={{ textAlign: 'center' }}>
        <p
          key={idx}
          style={{
            fontSize: '22px',
            lineHeight: '31px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
            textWrap: 'balance',
            animation: 'loadingFadeIn 0.3s cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          {LOADING_MESSAGES[idx]}
        </p>
        <p
          className="loading-pulse"
          style={{
            marginTop: '10px',
            fontSize: '14px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          보통 5–10초 걸려
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .loading-spinner {
          animation: spin 0.75s linear infinite;
        }
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        .loading-pulse {
          animation: loadingPulse 2s ease-in-out infinite;
        }
        @keyframes loadingFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .loading-spinner { animation: none; }
          .loading-pulse   { animation: none; opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
