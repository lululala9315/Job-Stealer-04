/**
 * 역할: AI 판결 결과 화면 — 서비스 핵심 화면
 * 주요 기능: 판결 히어로(글래스모피즘) + 이슈 태그 바 + 초보용 근거 카드 + 시뮬레이션 CTA
 * 의존성: 없음
 */

import { useState } from 'react'

/**
 * Twemoji CDN — 플랫폼 무관 이모지 렌더링
 * Windows / Android / iOS 모두 동일한 Twitter 이모지 표시
 */
function TwEmoji({ codepoint, size = 36, alt = '' }) {
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoint}.svg`}
      alt={alt}
      aria-hidden={alt === '' ? 'true' : undefined}
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', userSelect: 'none' }}
    />
  )
}

/** 판결 등급별 스타일 매핑 */
const GRADE_STYLES = {
  ban:  { glassColor: 'var(--color-verdict-ban-glass)',  glowColor: 'var(--color-verdict-ban-glow)',  label: '절대금지',    title: '호구 입장 1초 전',        emoji: '🤬', cp: '1f92c', bubbleBg: 'rgba(240,68,82,0.08)'  },
  wait: { glassColor: 'var(--color-verdict-wait-glass)', glowColor: 'var(--color-verdict-wait-glow)', label: '대기',        title: '호구 대기표 뽑는 중',     emoji: '😤', cp: '1f624', bubbleBg: 'rgba(245,158,11,0.08)' },
  ok:   { glassColor: 'var(--color-verdict-ok-glass)',   glowColor: 'var(--color-verdict-ok-glow)',   label: '괜찮아 보여', title: '인정. 가즈아!',           emoji: '😎', cp: '1f60e', bubbleBg: 'rgba(49,130,246,0.08)' },
  hold: { glassColor: 'var(--color-verdict-hold-glass)', glowColor: 'var(--color-verdict-hold-glow)', label: '관망',        title: '이건 어렵군..',           emoji: '🫠', cp: '1fae0', bubbleBg: '#F2F4F6'              },
}

const GRADE_COLORS = {
  ban:  'var(--color-verdict-ban)',
  wait: 'var(--color-verdict-wait)',
  ok:   'var(--color-verdict-ok)',
  hold: 'var(--color-verdict-hold)',
}

/** 가격 위치 카드 — highRatio(%) → 건물층 메타포 */
function getPriceCard(highRatio) {
  if (highRatio >= 85) return { emoji: '🗼', title: '지금 가격이 어디야?', nickname: '꼭대기야' }
  if (highRatio >= 65) return { emoji: '🏢', title: '지금 가격이 어디야?', nickname: '고층이야' }
  if (highRatio >= 40) return { emoji: '🪜', title: '지금 가격이 어디야?', nickname: '딱 중간층이야' }
  if (highRatio >= 20) return { emoji: '🏚️', title: '지금 가격이 어디야?', nickname: '폐가 수준이야' }
  return                      { emoji: '⛺', title: '지금 가격이 어디야?', nickname: '텐트야' }
}

/** 기업 가치 카드 — per(배) → 회수 기간 메타포 */
function getValueCard(per, isDeficit) {
  if (isDeficit || per === null) return { emoji: '💸', title: '이 회사 제값이야?', nickname: '돈도 못 버는 회사' }
  if (per >= 60) return { emoji: '🤑', title: '이 회사 제값이야?', nickname: '바가지 씌우는 중' }
  if (per >= 30) return { emoji: '😒', title: '이 회사 제값이야?', nickname: '좀 비싸' }
  if (per >= 15) return { emoji: '👌', title: '이 회사 제값이야?', nickname: '적당해' }
  return                { emoji: '💎', title: '이 회사 제값이야?', nickname: '진짜 싸게 파는 중' }
}

/** 거래 분위기 카드 — volMultiple(배) */
function getVolumeCard(volMultiple) {
  if (volMultiple >= 3)   return { emoji: '🔥', title: '오늘 얼마나 사고 팔아?', nickname: '뭔가 터졌나봐' }
  if (volMultiple >= 1.5) return { emoji: '👀', title: '오늘 얼마나 사고 팔아?', nickname: '좀 활발해' }
  return                         { emoji: '😴', title: '오늘 얼마나 사고 팔아?', nickname: '조용해' }
}

/** 시장 기분 카드 — fearGreed(0~100), null이면 null 반환 → 미노출 */
function getMarketCard(fearGreed) {
  if (fearGreed === null || fearGreed === undefined) return null
  if (fearGreed <= 30) return { emoji: '😱', title: '요즘 주식 시장 기분?', nickname: '다들 겁쟁이 모드' }
  if (fearGreed <= 69) return { emoji: '😐', title: '요즘 주식 시장 기분?', nickname: '평범해' }
  return                      { emoji: '🤪', title: '요즘 주식 시장 기분?', nickname: '다들 흥분 모드' }
}

/**
 * LLM reasons + rawData → 화면 카드 배열 생성
 * cardType별 룩업 테이블에서 emoji/title/nickname, description은 LLM 생성값 사용
 * 데이터 없는 카드 자동 미노출
 */
function buildReasonCards(reasons, rawData) {
  if (!reasons?.length || !rawData) return []

  const lookup = {
    price:  rawData.highRatio != null ? getPriceCard(rawData.highRatio) : null,
    value:  getValueCard(rawData.per, rawData.isDeficit),
    volume: rawData.volMultiple != null ? getVolumeCard(rawData.volMultiple) : null,
    market: getMarketCard(rawData.fearGreed),
    news:   { emoji: '📰', title: '요즘 무슨 얘기 나와?', nickname: null },
  }

  return reasons
    .filter(r => r.cardType && lookup[r.cardType])
    .map(r => ({ ...lookup[r.cardType], description: r.description }))
}

export default function VerdictScreen({ result, onSimulation, onReset }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const verdict = result?.verdict || {}
  const grade = verdict.grade || 'hold'
  const gradeStyle = GRADE_STYLES[grade] || GRADE_STYLES.hold
  const gradeColor = GRADE_COLORS[grade] || GRADE_COLORS.hold
  const lossConversion = verdict.lossConversion || ''

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
      bgColor: 'rgba(234,88,12,0.08)',
      textColor: 'rgba(234,88,12,1)',
    })
  }
  if (result?.impactTag) {
    const isPositive = result.sectorImpact === '긍정'
    issueTags.push({
      label: result.impactTag,
      emoji: isPositive ? '🔵' : '🔴',
      bgColor: isPositive ? 'rgba(49,130,246,0.08)' : 'rgba(240,68,82,0.08)',
      textColor: isPositive ? 'var(--color-verdict-ok)' : 'var(--color-verdict-ban)',
    })
  }
  if (result?.priceSignalTag) {
    issueTags.push({
      label: result.priceSignalTag,
      emoji: '📉',
      bgColor: 'var(--color-bg-input)',
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
    <div style={{ paddingTop: '20px', paddingBottom: '40px' }}>

      {/* ── 섹션 A: 판결 히어로 (글래스모피즘) ── */}
      <div
        className="glass-card"
        style={{
          borderRadius: 'var(--radius-2xl)',
          padding: '32px 24px',
          marginBottom: '16px',
          background: `linear-gradient(135deg, ${gradeStyle.glassColor} 0%, var(--glass-bg) 100%)`,
          boxShadow: `0 8px 32px ${gradeStyle.glowColor}, var(--glass-shadow)`,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) both',
        }}
      >
        {/* 이모지 색 글로우 배경 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '260px',
            height: '260px',
            background: `radial-gradient(circle, ${gradeStyle.glowColor} 0%, transparent 65%)`,
            filter: 'blur(40px)',
            opacity: 0.8,
            pointerEvents: 'none',
          }}
        />

        {/* 스티커 이모지 버블 */}
        <div
          style={{
            width: '88px',
            height: '88px',
            backgroundColor: gradeStyle.bubbleBg,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 0 0 3px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.10)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <TwEmoji codepoint={gradeStyle.cp} size={44} />
        </div>

        {/* 판결 타이틀 — 등급별 고정 텍스트, 크게 */}
        <p
          style={{
            fontSize: '28px',
            lineHeight: '36px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
            textWrap: 'balance',
            position: 'relative',
            zIndex: 1,
            marginBottom: '8px',
          }}
        >
          {gradeStyle.title}
        </p>

        {/* AI 멘트 — 작게, 보조 역할 */}
        {verdict.headlineMent && (
          <p
            style={{
              fontSize: '14px',
              lineHeight: '21px',
              color: 'var(--color-text-secondary)',
              position: 'relative',
              zIndex: 1,
              marginBottom: '10px',
            }}
          >
            {verdict.headlineMent}
          </p>
        )}

        {/* 손실 치환 — 카드 하단 */}
        {lossConversion && (
          <p
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: gradeColor,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {lossConversion}
          </p>
        )}
      </div>

      {/* ── 이슈 태그 바 — 데이터 있을 때만 노출 ── */}
      {issueTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            marginBottom: '16px',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.1s both',
          }}
        >
          {issueTags.map((tag, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: tag.bgColor,
                borderRadius: 'var(--radius-full)',
                padding: '6px 12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '13px' }}>{tag.emoji}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: tag.textColor }}>
                {tag.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── 섹션 C: 이유 카드 — 완전 펼침 ── */}
      {reasonCards.length > 0 && (
        <div
          style={{
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.16s both',
          }}
        >
          {reasonCards.map((card, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-xl)',
                padding: '16px',
                border: '1px solid var(--color-border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* 상단: 이모지 + 카드 제목 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '22px', lineHeight: 1 }}>{card.emoji}</span>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 600,
                  }}
                >
                  {card.title}
                </span>
              </div>

              {/* 닉네임 */}
              {card.nickname && (
                <p
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.2px',
                    marginBottom: '6px',
                  }}
                >
                  {card.nickname}
                </p>
              )}

              {/* 설명 */}
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: '21px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {card.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── 섹션 D: 하단 CTA ── */}
      <div
        style={{
          marginTop: '24px',
          animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.24s both',
        }}
      >
        <button
          onClick={handleSimulationClick}
          style={{
            width: '100%',
            height: 'var(--button-height-lg)',
            backgroundColor: 'var(--color-text-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--button-radius)',
            fontSize: '17px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
            willChange: 'transform',
            marginBottom: '12px',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          그래도 사면? 🤷
        </button>

        <button
          onClick={onReset}
          style={{
            width: '100%',
            height: 'var(--button-height-md)',
            backgroundColor: 'transparent',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--button-radius)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
            willChange: 'transform',
            marginBottom: '20px',
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
                backgroundColor: 'rgba(240,68,82,0.08)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 0 0 3px rgba(255,255,255,0.9), 0 4px 16px rgba(240,68,82,0.15)',
              }}
            >
              <TwEmoji codepoint="1f92c" size={36} />
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
                  backgroundColor: 'var(--color-bg-input)',
                  border: 'none', borderRadius: 'var(--button-radius)',
                  fontSize: '15px', fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)', willChange: 'transform',
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
                  backgroundColor: 'var(--color-negative)',
                  border: 'none', borderRadius: 'var(--button-radius)',
                  fontSize: '15px', fontWeight: 700,
                  color: '#ffffff',
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
