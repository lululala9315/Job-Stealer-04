/**
 * 역할: Edge Function 호출 중 로딩 화면
 * 주요 기능: thinking 이모지 crossfade + 순환 메시지 + 가상 진행률 표시
 * 의존성: public/emoji/ (thinking 3종 PNG)
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

// thinking frontal(900ms) → right(450ms) → frontal(750ms) → left(450ms) 반복
const EMOJI_SEQUENCE = [
  { src: '/emoji/thinking-frontal.png', duration: 900 },
  { src: '/emoji/thinking-right.png',   duration: 450 },
  { src: '/emoji/thinking-frontal.png', duration: 750 },
  { src: '/emoji/thinking-left.png',    duration: 450 },
]

// SearchScreen과 동일한 스트로크 필터
const STICKER_FILTER = `
  drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff)
  drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff)
  drop-shadow(2px 2px 0 #fff) drop-shadow(-2px -2px 0 #fff)
  drop-shadow(2px -2px 0 #fff) drop-shadow(-2px 2px 0 #fff)
  drop-shadow(0 3px 6px rgba(0,0,0,0.07))
  drop-shadow(0 1px 2px rgba(0,0,0,0.05))
`

export default function LoadingScreen() {
  const [msgIdx, setMsgIdx]           = useState(0)
  const [emojiIdx, setEmojiIdx]       = useState(0)
  const [activeLayer, setActiveLayer] = useState('a')
  const [srcA, setSrcA] = useState(EMOJI_SEQUENCE[0].src)
  const [srcB, setSrcB] = useState(EMOJI_SEQUENCE[1].src)
  const [progress, setProgress]       = useState(0)

  // 2.5초마다 로딩 메시지 순환
  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2500)
    return () => clearInterval(id)
  }, [])

  // 이모지 crossfade — A/B 레이어 방식 (깜빡임 없음)
  useEffect(() => {
    const id = setTimeout(() => {
      const nextIdx = (emojiIdx + 1) % EMOJI_SEQUENCE.length
      if (activeLayer === 'a') {
        setSrcB(EMOJI_SEQUENCE[nextIdx].src)
        setActiveLayer('b')
      } else {
        setSrcA(EMOJI_SEQUENCE[nextIdx].src)
        setActiveLayer('a')
      }
      setEmojiIdx(nextIdx)
    }, EMOJI_SEQUENCE[emojiIdx].duration)
    return () => clearTimeout(id)
  }, [emojiIdx, activeLayer])

  // 진행률 시뮬레이션 — 지수 감속 곡선으로 90%까지 (~8초)
  useEffect(() => {
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p
        const increment = Math.max(0.3, (90 - p) / 12)
        return Math.min(90, p + increment)
      })
    }, 150)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="분석 중"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 헤더(52px) 높이만큼 위로 보정 — 뷰포트 기준 시각적 센터
        paddingBottom: '52px',
        animation: 'loadingFadeIn 0.3s cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {/* 콘텐츠 그룹 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        textAlign: 'center',
        width: '100%',
        padding: '0 20px',
      }}>

        {/* 이모지 crossfade */}
        <div style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ display: 'grid', padding: '12px' }}>
            {[
              { src: srcA, visible: activeLayer === 'a' },
              { src: srcB, visible: activeLayer === 'b' },
            ].map(({ src, visible }, i) => (
              <img
                key={i}
                src={src}
                alt=""
                draggable={false}
                style={{
                  gridArea: '1 / 1',
                  justifySelf: 'center',
                  height: '80px',
                  width: 'auto',
                  opacity: visible ? 1 : 0,
                  transition: 'opacity 200ms ease',
                  filter: STICKER_FILTER,
                }}
              />
            ))}
          </div>
        </div>

        {/* 메시지 + 서브메시지 그룹 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <p
            key={msgIdx}
            style={{
              fontSize: '20px',
              lineHeight: '30px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.4px',
              textWrap: 'balance',
              animation: 'loadingFadeIn 0.3s cubic-bezier(0.2, 0, 0, 1)',
              margin: 0,
            }}
          >
            {LOADING_MESSAGES[msgIdx]}
          </p>
          <p
            className="loading-pulse"
            style={{
              fontSize: '14px',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}
          >
            분석 중... {Math.round(progress)}%
          </p>
        </div>

      </div>

      <style>{`
        @keyframes loadingFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        .loading-pulse {
          animation: loadingPulse 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .loading-pulse { animation: none; opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
