/**
 * 역할: Edge Function 호출 중 로딩 화면
 * 주요 기능: 랜덤 재미 문구 + 스피너
 * 의존성: 없음
 */

import { useState } from 'react'

const LOADING_MESSAGES = [
  '충동 억제 AI 가동 중...',
  'FOMO 방지벽 세우는 중...',
  '팩트로 찬물 끼얹는 중...',
  '잘못 탄 건 아닌지 확인 중...',
  '무릎인지 어깨인지 파악 중...',
]

export default function LoadingScreen() {
  // 렌더링 시 한 번만 선택 — 리렌더링마다 바뀌지 않도록 useState 초기화
  const [msg] = useState(
    () => LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
  )

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
      {/* 스피너 — className으로 직접 타겟팅 */}
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

      {/* 로딩 메시지 */}
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            fontSize: '22px',
            lineHeight: '31px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
            textWrap: 'balance',
          }}
        >
          {msg}
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
