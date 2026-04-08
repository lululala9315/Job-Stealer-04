/**
 * 역할: AI 판결 결과 화면 — 서비스 핵심 화면
 * 주요 기능: 판결 히어로(JOMO 감성) + 이슈 태그 + 이유 리스트 카드 + CTA
 * 의존성: 없음
 */

import { useState, useMemo } from 'react'
import StockLogo from './StockLogo'

// 로딩 화면과 동일한 스티커 스트로크 + 그림자
const STICKER_FILTER = `
  drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff)
  drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff)
  drop-shadow(2px 2px 0 #fff) drop-shadow(-2px -2px 0 #fff)
  drop-shadow(2px -2px 0 #fff) drop-shadow(-2px 2px 0 #fff)
  drop-shadow(0 6px 12px rgba(0,0,0,0.10))
  drop-shadow(0 2px 4px rgba(0,0,0,0.07))
`

/** 등급별 타이틀 변형 목록 — 진입 시 랜덤 선택 */
const GRADE_TITLES = {
  ban:  [
    '호구 입장 1초 전',
    '사면 존버각',
    '기부천사 납셨네',
    '손가락 압수',
    '뇌빼고 매매 금지',
    '응, 너 사면 고점',
    '나락도 락이다',
    '탈출은 지능순',
  ],
  wait: [
    '호구 대기표 뽑는 중',
    '손가락 묶어라',
    '눈감고 빵이나 먹어',
    '관망도 실력',
    '계좌 살살 녹는다',
    '일단 차 한잔 해',
  ],
  ok:   [
    '줍줍타임',
    '이건 못참쥐',
    '입벌려 돈들어간다',
    '인정. 가즈아!',
    '개미 밥상 차려짐',
  ],
  hold: [
    '이건 어렵군..',
    '기도 메타 ON',
    '세력만 알고 있음',
    '무당한테 물어봐',
    '반반치킨 살 걸',
  ],
}

/** 판결 등급별 스타일 매핑 */
const GRADE_STYLES = {
  ban:  {
    label: '절대금지', emoji: '🤬',
    bubbleBg:   'rgba(240,68,82,0.10)',
    bubbleBorder: '0 0 0 0.5px rgba(240,68,82,0.14)',
    bubbleGlow: '0 6px 20px rgba(240,68,82,0.18)',
  },
  wait: {
    label: '대기', emoji: '😤',
    bubbleBg:   'rgba(245,158,11,0.10)',
    bubbleBorder: '0 0 0 0.5px rgba(245,158,11,0.14)',
    bubbleGlow: '0 6px 20px rgba(245,158,11,0.16)',
  },
  ok:   {
    label: '괜찮아 보여', emoji: '😎',
    bubbleBg:   'rgba(49,130,246,0.10)',
    bubbleBorder: '0 0 0 0.5px rgba(49,130,246,0.14)',
    bubbleGlow: '0 6px 20px rgba(49,130,246,0.16)',
  },
  hold: {
    label: '관망', emoji: '🫠',
    bubbleBg:   'rgba(139,149,161,0.09)',
    bubbleBorder: '0 0 0 0.5px rgba(139,149,161,0.12)',
    bubbleGlow: '0 6px 20px rgba(139,149,161,0.12)',
  },
}

/** 손실/수익 텍스트 색상 — 등급별 */
const GRADE_COLORS = {
  ban:  '#f04452',
  wait: '#d97706',
  ok:   '#2563eb',
  hold: '#888888',
}

/** 가격 위치 카드 — highRatio(%) → 건물층 메타포 */
function getPriceCard(highRatio) {
  if (highRatio >= 85) return { emoji: '🗼', nickname: '꼭대기야',      description: null }
  if (highRatio >= 65) return { emoji: '🏢', nickname: '고층이야',      description: null }
  if (highRatio >= 40) return { emoji: '🪜', nickname: '딱 중간층이야', description: null }
  if (highRatio >= 20) return { emoji: '🏚️', nickname: '폐가 수준이야', description: null }
  return                      { emoji: '⛺', nickname: '텐트야',         description: null }
}

/** 기업 가치 카드 — per(배) → 회수 기간 메타포 */
function getValueCard(per, isDeficit) {
  if (isDeficit || per === null) return { emoji: '💸', nickname: '돈도 못 버는 회사',  description: null }
  if (per >= 60) return                 { emoji: '🤑', nickname: '바가지 씌우는 중',   description: null }
  if (per >= 30) return                 { emoji: '😒', nickname: '좀 비싸',            description: null }
  if (per >= 15) return                 { emoji: '👌', nickname: '적당해',             description: null }
  return                                { emoji: '💎', nickname: '진짜 싸게 파는 중', description: null }
}

/** 거래 분위기 카드 — volMultiple(배) */
function getVolumeCard(volMultiple) {
  if (volMultiple >= 3)   return { emoji: '🔥', nickname: '뭔가 터졌나봐', description: null }
  if (volMultiple >= 1.5) return { emoji: '👀', nickname: '좀 활발해',     description: null }
  return                         { emoji: '😴', nickname: '조용해',         description: null }
}

/** 시장 기분 카드 — fearGreed(0~100) */
function getMarketCard(fearGreed) {
  if (fearGreed === null || fearGreed === undefined) return null
  if (fearGreed <= 30) return { emoji: '😱', nickname: '다들 겁쟁이 모드', description: null }
  if (fearGreed <= 69) return { emoji: '😐', nickname: '평범해',           description: null }
  return                      { emoji: '🤪', nickname: '다들 흥분 모드',   description: null }
}

/**
 * LLM reasons + rawData → 화면 카드 배열 생성
 * market 카드 제거 — 종목 판단에 부차적
 */
function buildReasonCards(reasons, rawData) {
  if (!reasons?.length || !rawData) return []

  const lookup = {
    price:  rawData.highRatio != null ? getPriceCard(rawData.highRatio) : null,
    value:  getValueCard(rawData.per, rawData.isDeficit),
    volume: rawData.volMultiple != null ? getVolumeCard(rawData.volMultiple) : null,
    market: getMarketCard(rawData.fearGreed),
    news:   { emoji: '📰', nickname: null, description: null },
  }

  return reasons
    .filter(r => r.cardType && lookup[r.cardType])
    .map(r => ({ ...lookup[r.cardType], description: r.description }))
}

/** 투자금액 포맷 — 약 XX만원 */
function formatApprox(amount) {
  if (!amount) return null
  const man = Math.round(amount / 10000)
  return man >= 1 ? `약 ${man.toLocaleString()}만원` : `약 ${amount.toLocaleString()}원`
}

export default function VerdictScreen({ result, stockName: stockNameProp, shares, priceAtCheck, onSimulation, onReset }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const verdict = result?.verdict || {}
  const grade = verdict.grade || 'hold'

  // 숫자(코드)가 아닌 실제 종목명 우선 — 코드가 들어오면 prop 폴백
  const isCode = (v) => !v || /^\d+$/.test(v)
  const resolvedStockName = !isCode(result?.stockName) ? result.stockName
    : !isCode(stockNameProp) ? stockNameProp
    : result?.stockName || stockNameProp || '-'
  const gradeStyle = GRADE_STYLES[grade] || GRADE_STYLES.hold
  const gradeColor = GRADE_COLORS[grade] || GRADE_COLORS.hold
  const lossConversion = verdict.lossConversion || ''

  // 마운트 시 랜덤 타이틀 고정 — 리렌더링마다 바뀌지 않게
  const title = useMemo(() => {
    const titles = GRADE_TITLES[grade] || GRADE_TITLES.hold
    return titles[Math.floor(Math.random() * titles.length)]
  }, [grade])

  const reasonCards = buildReasonCards(result?.reasons, result?.rawData)

  // 이슈 태그 데이터 구성
  const issueTags = []
  const issueTypeEmojis = {
    임상실패: '💣', 수주: '🏆', 실적: '📊',
    거시경제: '🌍', 루머: '🗣️', 기타: '📌',
  }
  if (result?.issueType && result.issueType !== '기타') {
    issueTags.push({
      label: result.issueType,
      emoji: issueTypeEmojis[result.issueType] || '📌',
      bgColor: 'rgba(240,68,82,0.10)',
      textColor: '#f04452',
    })
  }
  if (result?.impactTag) {
    const isPositive = result.sectorImpact === '긍정'
    issueTags.push({
      label: result.impactTag,
      emoji: isPositive ? '🔵' : '🔴',
      bgColor: isPositive ? 'rgba(49,130,246,0.09)' : 'rgba(240,68,82,0.10)',
      textColor: isPositive ? '#2563eb' : '#f04452',
    })
  }
  if (result?.priceSignalTag) {
    issueTags.push({
      label: result.priceSignalTag,
      emoji: '📉',
      bgColor: 'rgba(0,0,0,0.06)',
      textColor: 'var(--color-text-secondary)',
    })
  }

  const handleSimulationClick = () => {
    if (grade === 'ban') {
      setShowConfirm(true)
    } else {
      onSimulation()
    }
  }

  return (
    /* 페이지 배경 — JOMO 그레이 단색 */
    <div style={{
      paddingTop: '20px',
      paddingBottom: '40px',
      background: '#F3F4F6',
    }}>

      {/* ── 히어로 섹션 ── */}
      <div style={{
        padding: '12px 20px 20px',
        textAlign: 'center',
        animation: 'verdictIn 0.38s cubic-bezier(0.2, 0, 0, 1) both',
      }}>

        {/* 종목 타이틀 — 좌측 정렬, 세미볼드, 크게 */}
        <div style={{ textAlign: 'left', marginBottom: '24px' }}>
          <p style={{
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.7px',
            lineHeight: 1.2,
            marginBottom: '4px',
          }}>
            {resolvedStockName}
          </p>
          <p style={{
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '-0.3px',
            lineHeight: 1.4,
          }}>
            {shares > 0 ? `${shares}주` : ''}
            {shares > 0 && formatApprox(result?.investAmount) ? ' · ' : ''}
            {formatApprox(result?.investAmount) || ''}
            {(shares > 0 || result?.investAmount) ? ' 매수한다면?' : '매수한다면?'}
          </p>
        </div>

        {/* 종목 로고 — 스티커 스트로크 + 그림자 */}
        <div style={{ filter: STICKER_FILTER, display: 'inline-block', marginBottom: '14px' }}>
          <StockLogo
            stockCode={result?.stockCode}
            stockName={resolvedStockName}
            size={88}
          />
        </div>

        {/* 판결 등급 뱃지 */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            color: gradeColor,
            backgroundColor: gradeStyle.bubbleBg,
            border: `1px solid ${gradeColor}33`,
            borderRadius: '99px',
            padding: '3px 10px',
            letterSpacing: '-0.1px',
          }}>
            {gradeStyle.label}
          </span>
        </div>

        {/* 판결 타이틀 */}
        <p style={{
          fontSize: '22px',
          lineHeight: 1.2,
          fontWeight: 900,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.6px',
          textWrap: 'balance',
          marginBottom: lossConversion ? '6px' : '16px',
        }}>
          {title}
        </p>

        {/* 손실/수익 치환 */}
        {lossConversion && (
          <p style={{
            fontSize: '14px',
            fontWeight: 600,
            color: gradeColor,
            marginBottom: '16px',
            letterSpacing: '-0.2px',
          }}>
            {lossConversion}
          </p>
        )}

        {/* 이슈 태그 */}
        {issueTags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {issueTags.map((tag, i) => (
              <div key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                backgroundColor: tag.bgColor,
                borderRadius: '99px',
                padding: '4px 10px',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: '11px' }}>{tag.emoji}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: tag.textColor }}>{tag.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 이유 리스트 카드 — 하나의 흰 카드에 리스트로 ── */}
      {reasonCards.length > 0 && (
        <div
          style={{
            margin: '0 20px 16px',
            borderRadius: '18px',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.10s both',
          }}
        >
          {reasonCards.map((card, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '10px',
                padding: '11px 14px',
                alignItems: 'flex-start',
                borderBottom: i < reasonCards.length - 1
                  ? '0.5px solid rgba(0,0,0,0.05)'
                  : 'none',
              }}
            >
              {/* 이모지 */}
              <span style={{ fontSize: '19px', lineHeight: 1.3, flexShrink: 0 }}>
                {card.emoji}
              </span>

              {/* 닉네임 + 설명 */}
              <div>
                {card.nickname && (
                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: 'var(--color-text-primary)',
                      letterSpacing: '-0.2px',
                      lineHeight: 1.3,
                      marginBottom: '2px',
                    }}
                  >
                    {card.nickname}
                  </p>
                )}
                <p
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.5,
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 하단 CTA ── */}
      <div
        style={{
          padding: '0 20px',
          marginTop: '8px',
          animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.20s both',
        }}
      >
        {/* Primary CTA — 등급별 문구 분기 */}
        <button
          onClick={handleSimulationClick}
          style={{
            width: '100%',
            height: 'var(--button-height-lg)',
            backgroundColor: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: 'var(--button-radius)',
            fontSize: '17px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '-0.2px',
            transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
            willChange: 'transform',
            marginBottom: '12px',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {grade === 'ban'  && '그래도 사면?'}
          {grade === 'wait' && '사면 어떻게 될까?'}
          {grade === 'ok'   && '얼마나 벌 수 있을까?'}
          {grade === 'hold' && '어떻게 될지 볼까?'}
        </button>

        {/* 다시 검색 — Secondary 하늘색 */}
        <button
          onClick={onReset}
          style={{
            width: '100%',
            height: 'var(--button-height-md)',
            background: 'var(--btn-sky-bg)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            color: 'var(--btn-sky-text)',
            border: 'none',
            borderRadius: 'var(--button-radius)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
            willChange: 'transform',
            marginBottom: '20px',
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.80),
              0 0 0 0.5px rgba(26,127,191,0.14),
              0 2px 10px var(--btn-sky-glow)
            `,
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          다시 검색
        </button>

        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            textAlign: 'center',
            lineHeight: '18px',
          }}
        >
          본 서비스는 투자 참고 정보만 제공하며,
          <br />
          투자 판단의 책임은 본인에게 있습니다.
        </p>
      </div>

      {/* 절대금지 재확인 모달 */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-2xl)',
              padding: '28px 24px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: 'var(--shadow-float)',
              textAlign: 'center',
              animation: 'verdictIn 0.22s cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                background: 'rgba(240,68,82,0.10)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: `
                  inset 0 1px 0 rgba(255,255,255,0.80),
                  0 0 0 0.5px rgba(240,68,82,0.14),
                  0 6px 20px rgba(240,68,82,0.18),
                  0 2px 8px rgba(0,0,0,0.06)
                `,
              }}
            >
              <span style={{ fontSize: '36px', lineHeight: 1, userSelect: 'none' }}>🤬</span>
            </div>
            <p
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.3px',
                marginBottom: '10px',
              }}
            >
              그래도 볼 거야?
              <br />
              진짜?
            </p>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                marginBottom: '24px',
                lineHeight: '21px',
              }}
            >
              절대금지 판결이야. 시뮬레이션은 참고용이고,
              <br />
              실제 결과는 다를 수 있어.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, height: '48px',
                  background: 'var(--btn-white-bg)',
                  backdropFilter: 'blur(16px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                  border: 'none', borderRadius: 'var(--button-radius)',
                  fontSize: '15px', fontWeight: 600,
                  color: 'var(--btn-white-text)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)', willChange: 'transform',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 0.5px rgba(0,0,0,0.06)',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                돌아갈게
              </button>
              <button
                onClick={() => { setShowConfirm(false); onSimulation() }}
                style={{
                  flex: 1, height: '48px',
                  backgroundColor: 'var(--btn-primary-bg)',
                  border: 'none', borderRadius: 'var(--button-radius)',
                  fontSize: '15px', fontWeight: 700,
                  color: 'var(--btn-primary-text)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)', willChange: 'transform',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                그래도 볼게
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes verdictIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
