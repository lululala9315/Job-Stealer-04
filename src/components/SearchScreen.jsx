/**
 * 역할: 종목 검색 메인 화면
 * 주요 기능: 원형 글래스 이모지 + 정적 타이틀 + 검색 입력(메인) + 인기종목 마퀴
 * 의존성: StockLogo
 */

import { useState, useRef, useEffect } from 'react'
import StockLogo from './StockLogo'
import { useIssueFeed } from '../hooks/useIssueFeed'

const POPULAR_STOCKS = [
  { name: '삼성전자', code: '005930' },
  { name: 'SK하이닉스', code: '000660' },
  { name: 'HLB', code: '028300' },
  { name: '카카오', code: '035720' },
  { name: '현대차', code: '005380' },
]

export default function SearchScreen({ onSearch }) {
  const { issues, loading: issuesLoading } = useIssueFeed()
  const [bannerIdx, setBannerIdx] = useState(0)

  // 3초마다 다음 이슈로 순환
  useEffect(() => {
    if (issues.length <= 1) return
    const id = setInterval(() => setBannerIdx(i => (i + 1) % issues.length), 3000)
    return () => clearInterval(id)
  }, [issues.length])

  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSearch(trimmed)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 20px 40px',
    }}>

      {/* ══ 히어로 섹션 — 흰 배경, 원형 글래스 이모지 ══ */}
      <div
        style={{
          textAlign: 'center',
          paddingBottom: '40px',
          animation: 'heroIn 0.4s cubic-bezier(0.2, 0, 0, 1) both',
        }}
      >
        {/*
          원형 글래스 컨테이너 + 이모지
          구조: 컨테이너(80×92) — 원(80×80, 하단 정렬) — 이모지(52px, top:4px)
          이모지 top:4px → 원 top:12px → 이모지가 원 위로 8px 오버플로
        */}
        <div
          style={{
            position: 'relative',
            width: '80px',
            height: '92px',
            margin: '0 auto 20px',
          }}
        >
          {/* 원형 컨테이너 — 하단 정렬 */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '80px',
              background: 'linear-gradient(145deg, #f0f1f3 0%, #e8eaed 100%)',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.95)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.10)',
            }}
          />

          {/* 이모지 — 원 상단 위로 8px 오버플로, 흰 스티커 라인 */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '52px',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: 'none',
              filter:
                'drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
            }}
          >
            🤔
          </div>
        </div>

        {/* 타이틀 */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 800,
            letterSpacing: '-0.6px',
            color: 'var(--color-text-primary)',
            lineHeight: 1.25,
            textWrap: 'balance',
            marginBottom: '8px',
          }}
        >
          오늘은 어떤 종목에 물리고 싶어?
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            lineHeight: '21px',
          }}
        >
          물리기 전에 나한테 먼저 물어봐
        </p>
      </div>

      {/* ══ 실시간 이슈 배너 — 검색창 위, 토스증권 AI 스타일 ══ */}
      {issuesLoading ? (
        <div
          style={{
            height: '44px',
            backgroundColor: 'var(--color-bg-input)',
            borderRadius: '12px',
            marginBottom: '12px',
            animation: 'skeletonPulse 1.5s ease-in-out infinite',
          }}
        />
      ) : issues.length > 0 ? (
        <button
          onClick={() => onSearch(issues[bannerIdx]?.stock_code)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            height: '44px',
            backgroundColor: 'var(--color-accent-light)',
            borderRadius: '12px',
            border: 'none',
            padding: '0 14px',
            cursor: 'pointer',
            marginBottom: '12px',
            overflow: 'hidden',
            textAlign: 'left',
            fontFamily: 'inherit',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '999px',
            flexShrink: 0,
            letterSpacing: '-0.2px',
          }}>
            ⚡ 실시간 이슈
          </span>
          <span
            key={bannerIdx}
            style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              fontWeight: 500,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              animation: 'bannerFadeIn 0.3s ease',
            }}
          >
            {issues[bannerIdx]?.one_line}
          </span>
          <span style={{ fontSize: '14px', color: 'var(--color-accent)', flexShrink: 0 }}>›</span>
        </button>
      ) : null}

      {/* ══ 검색창 — 토스 스타일 ══ */}
      <div style={{ paddingBottom: '24px' }}>
        <form
          onSubmit={handleSubmit}
          style={{ animation: 'heroIn 0.4s cubic-bezier(0.2, 0, 0, 1) 0.08s both' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: focused ? '#eaecef' : 'var(--color-bg-input)',
              borderRadius: '14px',
              padding: '0 14px',
              height: '52px',
              gap: '8px',
              transition: 'background-color 0.15s cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            {/* 돋보기 아이콘 — 클릭 시 제출 */}
            <button
              type="submit"
              aria-label="검색"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, display: 'flex', color: value.trim() ? 'var(--color-accent)' : 'var(--color-text-tertiary)', transition: 'color 0.15s' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              name="stock-search"
              autoComplete="off"
              placeholder="종목명 또는 6자리 코드"
              aria-label="종목 검색"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                flex: 1,
                height: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                minWidth: 0,
              }}
            />

            {/* × 버튼 — 입력 시에만 노출 */}
            {value && (
              <button
                type="button"
                onClick={() => { setValue(''); inputRef.current?.focus() }}
                aria-label="입력 초기화"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-text-tertiary)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1l-8 8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ══ 인기종목 — 마퀴 무한 스크롤 ══ */}
      <div
        style={{
          animation: 'heroIn 0.4s cubic-bezier(0.2, 0, 0, 1) 0.16s both',
          paddingBottom: '8px',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--color-text-secondary)',
            marginBottom: '10px',
          }}
        >
          🔥 지금 뜨고있는 종목
        </p>

        {/* 마퀴 래퍼 — 좌우 페이드 마스크 */}
        <div
          style={{
            overflow: 'hidden',
            marginLeft: '-20px',
            marginRight: '-20px',
            paddingLeft: '20px',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, #000 60px, #000 calc(100% - 60px), transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0%, #000 60px, #000 calc(100% - 60px), transparent 100%)',
          }}
        >
          <div
            className="marquee-track"
            style={{
              display: 'flex',
              gap: '8px',
              width: 'max-content',
            }}
          >
            {/* 두 번 반복 → 끊김 없는 루프 */}
            {[...POPULAR_STOCKS, ...POPULAR_STOCKS].map((stock, i) => (
              <button
                key={i}
                onClick={() => onSearch(stock.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-full)',
                  minHeight: '40px',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition:
                    'background-color 0.12s cubic-bezier(0.2, 0, 0, 1), color 0.12s cubic-bezier(0.2, 0, 0, 1)',
                  willChange: 'transform',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-accent-light)'
                  e.currentTarget.style.color = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <StockLogo stockCode={stock.code} stockName={stock.name} size={20} />
                {stock.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bannerFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes heroIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee 18s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
