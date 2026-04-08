/**
 * 역할: 종목 검색 메인 화면
 * 주요 기능: 이모지 스티커 + 타이틀 + 검색바(퍼지 자동완성) + 실시간 이슈 배너 + 인기종목 마퀴
 * 의존성: StockLogo, useIssueFeed, useStockSearch
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import StockLogo from './StockLogo'
import { useIssueFeed } from '../hooks/useIssueFeed'
import { useStockSearch } from '../hooks/useStockSearch'
import stocks from '../lib/stocks.json'

// stock_name이 6자리 코드처럼 보이면 로컬에서 이름 조회
function resolveStockName(name, code) {
  if (!name || /^\d{4,6}$/.test(name.trim())) {
    const found = stocks.find(s => s.code === code)
    return found?.name || code
  }
  return name
}

// frontal→right→frontal→left 순환 시퀀스 + 각 프레임 유지 시간(ms)
const EMOJI_SEQUENCE = [
  { src: '/emoji/grimacing-frontal.png', duration: 900 },
  { src: '/emoji/grimacing-right.png',   duration: 400 },
  { src: '/emoji/grimacing-frontal.png', duration: 700 },
  { src: '/emoji/grimacing-left.png',    duration: 400 },
]

const POPULAR_STOCKS = [
  { name: '삼성전자', code: '005930' },
  { name: 'SK하이닉스', code: '000660' },
  { name: 'HLB', code: '028300' },
  { name: '카카오', code: '035720' },
  { name: '현대차', code: '005380' },
]

export default function SearchScreen({ onSearch, isSearching = false }) {
  const { issues, loading: issuesLoading } = useIssueFeed()
  const [bannerIdx, setBannerIdx] = useState(0)

  // 6초마다 다음 이슈로 순환
  useEffect(() => {
    if (issues.length <= 1) return
    const id = setInterval(() => setBannerIdx(i => (i + 1) % issues.length), 6000)
    return () => clearInterval(id)
  }, [issues.length])

  // 이모지 애니메이션 — 프레임 인덱스만 순환, 프리렌더된 이미지를 visibility로 토글
  const [emojiIdx, setEmojiIdx] = useState(0)
  const emojiUniqueSrcs = [...new Set(EMOJI_SEQUENCE.map(s => s.src))]

  useEffect(() => {
    const id = setTimeout(() => {
      setEmojiIdx(i => (i + 1) % EMOJI_SEQUENCE.length)
    }, EMOJI_SEQUENCE[emojiIdx].duration)
    return () => clearTimeout(id)
  }, [emojiIdx])

  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  const suggestions = useStockSearch(value)
  // 드롭다운: 포커스 상태이고 입력값 있고 후보가 있을 때
  const showDropdown = focused && value.trim().length > 0 && suggestions.length > 0

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isSearching) return
    // 자동완성 후보가 있으면 첫 번째 후보로 검색, 없으면 차단
    if (suggestions.length > 0) {
      handleSelect(suggestions[0])
    }
  }

  // 자동완성 항목 선택 → 코드로 검색 + 종목명 함께 전달
  const handleSelect = (stock) => {
    if (isSearching) return
    onSearch(stock.code, stock.name)
  }

  return (
    <div style={{
      // header 52px + main py-4 32px = 84px 제거해야 스크롤 없음
      height: 'calc(100dvh - 84px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '0 var(--search-px) 24px',
      position: 'relative',
    }}>
      {/* 컨텐츠 전체 너비 wrapper */}
      <div style={{ width: '100%', maxWidth: '480px' }}>

      {/* ══ 히어로 섹션 ══ */}
      <div style={{
        textAlign: 'center',
        paddingBottom: '48px',
        animation: 'heroIn 0.4s cubic-bezier(0.2, 0, 0, 1) both',
      }}>
        {/* 히어로 — 3D 이모지 이미지 스티커 */}
        <div style={{
          margin: '0 auto 8px',
          display: 'inline-block',
          userSelect: 'none',
          pointerEvents: 'none',
          animation: 'emojiFloat 3s ease-in-out infinite',
        }}>
          {/* 모든 프레임 프리렌더 — visibility 토글로 깜빡임 없이 전환 */}
          <div style={{ display: 'grid', padding: '10px' }}>
            {emojiUniqueSrcs.map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                style={{
                  gridArea: '1 / 1',
                  justifySelf: 'center',
                  height: '56px',
                  width: 'auto',
                  visibility: src === EMOJI_SEQUENCE[emojiIdx].src ? 'visible' : 'hidden',
                  willChange: 'visibility',
                  transform: 'translateZ(0)',
                  filter: `
                    drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff)
                    drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff)
                    drop-shadow(2px 2px 0 #fff) drop-shadow(-2px -2px 0 #fff)
                    drop-shadow(2px -2px 0 #fff) drop-shadow(-2px 2px 0 #fff)
                    drop-shadow(0 2px 1px rgba(0,0,0,0.10))
                  `,
                }}
              />
            ))}
          </div>
        </div>

        {/* 타이틀 — 2줄 */}
        <h1 style={{
          fontSize: '34px',
          fontWeight: 800,
          letterSpacing: '-0.6px',
          color: 'var(--color-text-primary)',
          lineHeight: 1.3,
          marginBottom: '6px',
        }}>
          오늘은<br />어떤 종목에 물리고 싶어?
        </h1>

        <p style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text-tertiary)',
          lineHeight: '21px',
        }}>
          물리기 전에 나한테 먼저 물어봐
        </p>
      </div>

      {/* ══ 검색창 + 자동완성 드롭다운 ══ */}
      <div style={{ paddingBottom: '16px', position: 'relative' }}>
        <form
          onSubmit={handleSubmit}
          style={{ animation: 'heroIn 0.4s cubic-bezier(0.2, 0, 0, 1) 0.08s both' }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: focused ? '#eaecef' : 'var(--color-bg-input)',
            borderRadius: '14px',
            padding: '0 14px',
            height: '52px',
            gap: '8px',
            transition: 'background-color 0.15s cubic-bezier(0.2, 0, 0, 1)',
          }}>
            {/* 돋보기 / 로딩 아이콘 */}
            <button
              type="submit"
              aria-label="검색"
              disabled={isSearching}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: isSearching ? 'default' : 'pointer', flexShrink: 0, display: 'flex',
                color: value.trim() && !isSearching ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                transition: 'color 0.15s',
              }}
            >
              {isSearching ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="15" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
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

            {/* × 버튼 */}
            {value && (
              <button
                type="button"
                onClick={() => { setValue(''); inputRef.current?.focus() }}
                aria-label="입력 초기화"
                style={{
                  width: '20px', height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-text-tertiary)',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, padding: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1l-8 8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* 자동완성 드롭다운 */}
        {showDropdown && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% - 8px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 6px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            maxHeight: `${5 * 44}px`,
            overflowY: 'auto',
            zIndex: 10,
          }}>
            {suggestions.map((stock, i) => (
              <button
                key={stock.code + i}
                // onMouseDown 으로 blur 전에 선택 처리
                onMouseDown={(e) => { e.preventDefault(); handleSelect(stock) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: i < suggestions.length - 1
                    ? '1px solid var(--color-border-light)' : 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-input)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <StockLogo stockCode={stock.code} stockName={stock.name} size={26} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.2px',
                  }}>
                    {stock.name}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 500,
                  }}>
                    {stock.code}
                  </span>
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: stock.market === 'KOSPI'
                    ? 'var(--color-accent)'
                    : stock.market === 'KOSDAQ'
                    ? '#00b070'
                    : 'var(--color-text-tertiary)',
                  backgroundColor: stock.market === 'KOSPI'
                    ? 'var(--color-accent-light)'
                    : stock.market === 'KOSDAQ'
                    ? '#e6f7f1'
                    : 'var(--color-bg-input)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  flexShrink: 0,
                }}>
                  {stock.market}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══ 실시간 이슈 배너 — 검색바 하단, 센터 정렬 ══ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
        minHeight: '32px',
        animation: 'heroIn 0.4s cubic-bezier(0.2, 0, 0, 1) 0.12s both',
      }}>
        {issuesLoading ? (
          <div style={{
            height: '14px', width: '140px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '4px',
            animation: 'skeletonPulse 1.5s ease-in-out infinite',
          }} />
        ) : issues.length > 0 ? (
          <button
            onClick={() => {
              const issue = issues[bannerIdx]
              if (!issue) return
              onSearch(issue.stock_code, resolveStockName(issue.stock_name, issue.stock_code))
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '0',
              cursor: 'pointer',
              fontFamily: 'inherit',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--color-accent)',
              letterSpacing: '-0.1px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
              ✦ 실시간 이슈
            </span>
            <span
              key={bannerIdx}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                letterSpacing: '-0.1px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                animation: 'bannerFadeIn 0.4s ease',
              }}
            >
              {issues[bannerIdx]?.one_line}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>›</span>
          </button>
        ) : null}
      </div>

      {/* ══ 인기종목 — 숨김 처리 (이슈 배너로 일원화) ══ */}
      {/* ══ 자주 검색하는 종목 — 마퀴 ══ */}
      <div style={{
        animation: 'heroIn 0.4s cubic-bezier(0.2, 0, 0, 1) 0.16s both',
      }}>
        <div style={{
          height: '1px',
          backgroundColor: 'var(--color-border-light)',
          marginBottom: '16px',
        }} />

        <span style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-tertiary)',
          letterSpacing: '-0.2px',
          marginBottom: '10px',
        }}>
          자주 검색하는 종목
        </span>

        {/* 마퀴 래퍼 — 양쪽 20px 흰색 마스크, 구분선 경계 기준 */}
        <div style={{
          overflow: 'hidden',
          marginLeft: 'calc(-1 * var(--search-px))',
          marginRight: 'calc(-1 * var(--search-px))',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0px, transparent var(--search-px), #000 calc(var(--search-px) + 60px), #000 calc(100% - var(--search-px) - 60px), transparent calc(100% - var(--search-px)), transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0px, transparent var(--search-px), #000 calc(var(--search-px) + 60px), #000 calc(100% - var(--search-px) - 60px), transparent calc(100% - var(--search-px)), transparent 100%)',
        }}>
          <div className="marquee-track" style={{ display: 'flex', gap: '8px', width: 'max-content' }}>
            {[...POPULAR_STOCKS, ...POPULAR_STOCKS].map((stock, i) => (
              <button
                key={i}
                onClick={() => onSearch(stock.code, stock.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
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
                  transition: 'background-color 0.12s cubic-bezier(0.2,0,0,1), color 0.12s cubic-bezier(0.2,0,0,1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-accent-light)'
                  e.currentTarget.style.color = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
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

      </div>{/* /컨텐츠 wrapper */}

      <style>{`
        @keyframes bannerFadeIn {
          from { opacity: 0; transform: translateY(3px); }
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
          animation: marquee 30s linear infinite;
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
