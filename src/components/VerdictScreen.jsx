/**
 * 역할: AI 판결 결과 화면 — 서비스 핵심 화면
 * 주요 기능: 판결 히어로(JOMO 감성) + 이슈 태그 + 이유 리스트 카드 + CTA
 * 의존성: 없음
 */

import { useState, useMemo, useEffect } from 'react'
// 스티커 스트로크 + 그림자 (로딩/메인과 동일)
// 스티커 스트로크 + 딱 붙은 그림자
// 스티커 스트로크 + 딱 붙은 그림자
const STICKER_FILTER = `
  drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff)
  drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff)
  drop-shadow(2px 2px 0 #fff) drop-shadow(-2px -2px 0 #fff)
  drop-shadow(2px -2px 0 #fff) drop-shadow(-2px 2px 0 #fff)
  drop-shadow(0 2px 1px rgba(0,0,0,0.10))
`

/** 등급별 이모지 이미지 시퀀스 — 메인과 동일 3D PNG crossfade */
/** 시퀀스 생성 — frontal→right→frontal→left를 3사이클 + 정면 마무리 */
function makeSeq(name) {
  return [
    { src: `/emoji/${name}-frontal.png`, duration: 900 },
    { src: `/emoji/${name}-right.png`, duration: 400 },
    { src: `/emoji/${name}-frontal.png`, duration: 700 },
    { src: `/emoji/${name}-left.png`, duration: 400 },
    { src: `/emoji/${name}-frontal.png`, duration: 700 },
    { src: `/emoji/${name}-right.png`, duration: 400 },
    { src: `/emoji/${name}-frontal.png`, duration: 700 },
    { src: `/emoji/${name}-left.png`, duration: 400 },
    { src: `/emoji/${name}-frontal.png`, duration: 700 },
    { src: `/emoji/${name}-right.png`, duration: 400 },
    { src: `/emoji/${name}-frontal.png`, duration: 700 },
    { src: `/emoji/${name}-left.png`, duration: 400 },
    { src: `/emoji/${name}-frontal.png`, duration: 900 },
  ]
}

/** 등급별 이모지 후보 — 진입 시 랜덤 1개 선택 */
const GRADE_EMOJI_OPTIONS = {
  ban: [makeSeq('exploding'), makeSeq('screaming')],
  wait: [makeSeq('peekingeye'), makeSeq('grimacing')],
  ok: [makeSeq('cowboy'), makeSeq('smiling')],
  hold: [makeSeq('thinking'), makeSeq('rollingeyes')],
}

/** 등급별 이모지 crossfade 애니메이션 컴포넌트 */
function GradeEmoji({ grade, size = 72, once = false }) {
  // 등급별 랜덤 이모지 선택 — 마운트 시 고정
  const options = GRADE_EMOJI_OPTIONS[grade] || GRADE_EMOJI_OPTIONS.hold
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seq = useMemo(() => options[Math.floor(Math.random() * options.length)], [grade, options])
  // 중복 src 제거하여 고유 프레임만 추출 — 모든 프레임을 미리 렌더
  const uniqueSrcs = useMemo(() => [...new Set(seq.map(s => s.src))], [seq])
  const [idx, setIdx] = useState(0)
  const [stopped, setStopped] = useState(false)

  useEffect(() => {
    if (stopped) return
    const id = setTimeout(() => {
      const nextIdx = (idx + 1) % seq.length
      if (once && nextIdx === 0) {
        setStopped(true)
        return
      }
      setIdx(nextIdx)
    }, seq[idx].duration)
    return () => clearTimeout(id)
  }, [idx, seq, once, stopped])

  const currentSrc = seq[idx].src

  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ display: 'grid', padding: '10px' }}>
        {/* 모든 고유 프레임을 미리 렌더 — visibility로만 토글하여 필터 재계산 방지 */}
        {uniqueSrcs.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            style={{
              gridArea: '1 / 1',
              justifySelf: 'center',
              height: `${size}px`,
              width: 'auto',
              filter: STICKER_FILTER,
              visibility: src === currentSrc ? 'visible' : 'hidden',
              willChange: 'visibility',
              transform: 'translateZ(0)',
            }}
          />
        ))}
      </div>
    </div>
  )
}


/** SVG 스티커 아웃라인 필터 — feMorphology로 흰 테두리 생성 */
function StickerFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="sticker-outline">
          <feMorphology in="SourceAlpha" result="Dilated" operator="dilate" radius="2" />
          <feFlood floodColor="#ffffff" result="OutlineColor" />
          <feComposite in="OutlineColor" in2="Dilated" operator="in" result="Outline" />
          <feMerge>
            <feMergeNode in="Outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

/** 금액 포맷 — ±N만원 / ±N,000원 */
function formatGain(amount) {
  const abs = Math.abs(amount)
  const sign = amount >= 0 ? '+' : '-'
  if (abs >= 10000) {
    const man = Math.round(abs / 10000)
    return `${sign}${man.toLocaleString()}만원`
  }
  return `${sign}${abs.toLocaleString()}원`
}


/** 등급별 타이틀 변형 목록 — 진입 시 랜덤 선택 */
const GRADE_TITLES = {
  ban: [
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
  ok: [
    '줍줍타임',
    '이건 못참쥐',
    '입벌려 돈들어간다',
    '인정. 가즈아!',
    '개미 밥상 차려짐',
  ],
  hold: [
    '엄...이건 어렵군..',
    '엄...기도 메타 ON',
    '무당한테 물어봐',
    '정보가 없네 쩝.',
  ],
}

/** 가격 위치 카드 — highRatio(%) → 건물층 메타포 */
function getPriceCard(highRatio) {
  if (highRatio >= 85) return { emoji: '🗼', nickname: '주가가 꼭대기야', description: null }
  if (highRatio >= 65) return { emoji: '🏢', nickname: '주가가 고층이야', description: null }
  if (highRatio >= 40) return { emoji: '🪜', nickname: '주가가 딱 중간층이야', description: null }
  if (highRatio >= 20) return { emoji: '🏚️', nickname: '주가가 폐가 수준이야', description: null }
  return { emoji: '⛺', nickname: '주가가 바닥이야', description: null }
}

/** 기업 가치 카드 — per(배) → 회수 기간 메타포 */
function getValueCard(per, isDeficit) {
  if (isDeficit || per === null) return { emoji: '💸', nickname: '돈도 못 버는 회사야', description: null }
  if (per >= 60) return { emoji: '🤑', nickname: '기업 가치가 바가지야', description: null }
  if (per >= 30) return { emoji: '😒', nickname: '기업 가치가 좀 비싸', description: null }
  if (per >= 15) return { emoji: '👌', nickname: '기업 가치가 적당해', description: null }
  return { emoji: '💎', nickname: '기업 가치가 싸', description: null }
}

/** 거래 분위기 카드 — volMultiple(배) */
function getVolumeCard(volMultiple) {
  if (volMultiple >= 3) return { emoji: '🔥', nickname: '거래가 뭔가 터졌나봐', description: null }
  if (volMultiple >= 1.5) return { emoji: '👀', nickname: '거래가 좀 활발해', description: null }
  return { emoji: '😴', nickname: '거래가 조용해', description: null }
}

/** 시장 기분 카드 — fearGreed(0~100) */
function getMarketCard(fearGreed) {
  if (fearGreed === null || fearGreed === undefined) return null
  if (fearGreed <= 30) return { emoji: '😱', nickname: '시장이 겁쟁이 모드', description: null }
  if (fearGreed <= 69) return { emoji: '😐', nickname: '시장 분위기가 평범해', description: null }
  return { emoji: '🤪', nickname: '시장이 흥분 모드', description: null }
}

/**
 * LLM reasons + rawData → 화면 카드 배열 생성
 * market 카드 제거 — 종목 판단에 부차적
 */
function buildReasonCards(reasons, rawData) {
  if (!reasons?.length || !rawData) return []

  const lookup = {
    price: rawData.highRatio != null ? getPriceCard(rawData.highRatio) : null,
    value: getValueCard(rawData.per, rawData.isDeficit),
    volume: rawData.volMultiple != null ? getVolumeCard(rawData.volMultiple) : null,
    market: getMarketCard(rawData.fearGreed),
    news: { emoji: '📰', nickname: null, description: null },
  }

  return reasons
    .filter(r => r.cardType && lookup[r.cardType])
    .map(r => ({ ...lookup[r.cardType], description: r.description }))
}

/** 실생활 라벨 suffix 제거 — "치킨 4마리 벌 수 있어" → "치킨 4마리" */
function trimLifeLabel(label) {
  if (!label) return ''
  return label
    .replace(/\s*(벌 수 있어|살 수 있어|잃을 수 있어|날릴 수 있어|만큼이야|날려|잃어|벌어)$/g, '')
    .trim()
}

/** 손실/수익 금액 → 실생활 치환 라벨 (서버 LABELS와 동일 기준) */
const LIFE_LABELS = [
  { max: 5000, emoji: '☕', text: '아메리카노 1잔' },
  { max: 12000, emoji: '🍜', text: '점심 한 끼' },
  { max: 25000, emoji: '🍗', text: '치킨 한 마리' },
  { max: 45000, emoji: '🥩', text: '삼겹살 2인분' },
  { max: 70000, emoji: '🍿', text: '영화 2인 팝콘 세트' },
  { max: 100000, emoji: '📺', text: '넷플릭스 6개월' },
  { max: 150000, emoji: '👟', text: '나이키 운동화' },
  { max: 280000, emoji: '🎧', text: '에어팟' },
  { max: 450000, emoji: '🎮', text: '닌텐도 스위치' },
  { max: 700000, emoji: '🏝️', text: '제주도 여행' },
  { max: 900000, emoji: '📱', text: '아이패드' },
  { max: 1500000, emoji: '📱', text: '아이폰' },
  { max: 2000000, emoji: '✈️', text: '유럽 왕복 항공권' },
  { max: 3000000, emoji: '💻', text: '맥북 프로' },
  { max: 5000000, emoji: '🏍️', text: '오토바이 한 대' },
  { max: 10000000, emoji: '🚗', text: '중고차 한 대' },
  { max: 20000000, emoji: '🚙', text: '소형차 한 대' },
  { max: 35000000, emoji: '🏠', text: '전세 보증금 일부' },
  { max: 50000000, emoji: '🚘', text: '중형차 한 대' },
  { max: 80000000, emoji: '🏡', text: '원룸 전세' },
  { max: 150000000, emoji: '🚘', text: '수입차 한 대' },
  { max: Infinity, emoji: '🏢', text: '아파트 보증금' },
]

/** 중복 방지 라벨 — 같은 금액대여도 이미 쓴 라벨 피해서 인접 항목 반환 */
function getLifeLabelUnique(amount, usedTexts) {
  const abs = Math.abs(amount)
  const idx = LIFE_LABELS.findIndex(l => abs <= l.max)
  const baseIdx = idx >= 0 ? idx : LIFE_LABELS.length - 1
  const base = LIFE_LABELS[baseIdx]

  // 아직 안 쓴 라벨이면 그대로
  if (!usedTexts.has(base.text)) return base

  // 인접 항목에서 안 쓴 거 찾기 (위→아래 순서)
  if (baseIdx > 0 && !usedTexts.has(LIFE_LABELS[baseIdx - 1].text)) {
    return LIFE_LABELS[baseIdx - 1]
  }
  if (baseIdx < LIFE_LABELS.length - 1 && !usedTexts.has(LIFE_LABELS[baseIdx + 1].text)) {
    return LIFE_LABELS[baseIdx + 1]
  }

  return base
}

/** 투자금액 포맷 — 약 XX만원 */
function formatApprox(amount) {
  if (!amount) return null
  const man = Math.round(amount / 10000)
  return man >= 1 ? `약 ${man.toLocaleString()}만원` : `약 ${amount.toLocaleString()}원`
}

export default function VerdictScreen({ result, stockName: stockNameProp, shares, investAmount, onReset }) {
  const [showReasons, setShowReasons] = useState(false)

  const verdict = result?.verdict || {}
  const grade = verdict.grade || 'hold'

  // 숫자(코드)가 아닌 실제 종목명 우선 — 코드가 들어오면 prop 폴백
  const isCode = (v) => !v || /^\d+$/.test(v)
  const resolvedStockName = !isCode(result?.stockName) ? result.stockName
    : !isCode(stockNameProp) ? stockNameProp
      : result?.stockName || stockNameProp || '-'

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

  // 시뮬레이션 데이터
  const projections = result?.simulation?.longTerm?.projections || {}
  const simInvestAmount = investAmount || result?.investAmount || 1_000_000

  return (
    /* 페이지 배경 */
    <div style={{
      paddingTop: '20px',
      paddingBottom: 'calc(54px + 28px + 12px + env(safe-area-inset-bottom, 0px))',
      background: '#F3F4F6',
    }}>

      <StickerFilter />

      {/* ── 전체를 하나의 흐름으로 ── */}
      <div style={{
        padding: '0 24px',
        textAlign: 'center',
      }}>
        {/* 맥락 — 질문 */}
        <p style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#8B95A1',
          letterSpacing: '-0.2px',
          marginBottom: '10px',
          animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) both',
        }}>
          {resolvedStockName}
          {shares > 0 ? ` ${shares}주` : ''}
          {simInvestAmount ? ` · ${formatApprox(simInvestAmount)}` : ''} 매수한다면?
        </p>

        {/* 판결 타이틀 — 답변, 페이지 주인공 */}
        <p style={{
          fontSize: '28px',
          lineHeight: 1.15,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.8px',
          textWrap: 'balance',
          marginBottom: issueTags.length > 0 ? '12px' : '0',
          animation: 'verdictIn 0.4s cubic-bezier(0.2, 0, 0, 1) 0.12s both',
        }}>
          {title}
        </p>

        {/* 이슈 태그 — 판결 근거 */}
        {issueTags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4px', animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.22s both' }}>
            {issueTags.map((tag, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                backgroundColor: tag.bgColor, borderRadius: '99px',
                padding: '4px 10px', whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: '11px' }}>{tag.emoji}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: tag.textColor }}>{tag.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* 이모지 — 스티커 붙이기 (태그 아래) */}
        <div style={{
          marginTop: '16px',
          marginBottom: '8px',
          animation: 'stickerDrop 0.45s cubic-bezier(0.2, 0, 0, 1) 0.32s both',
        }}>
          <GradeEmoji grade={grade} size={80} once />
        </div>
      </div>

      {/* ── hold 전용 대체 카드 — 데이터 부족으로 시뮬레이션 불가 ── */}
      {grade === 'hold' && (
        <div style={{
          margin: '24px 16px 0',
          background: 'rgba(255,255,255,0.45)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1.5px solid rgba(255,255,255,0.6)',
          boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.6), 0 2px 8px 0 rgba(31,38,135,0.04)',
          borderRadius: '24px',
          padding: '20px',
          textAlign: 'center',
          animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.10s both',
        }}>
          <p style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.3px',
            marginBottom: '8px',
          }}>
            이건 나도 모르겠어
          </p>
          <p style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            lineHeight: '21px',
          }}>
            데이터가 충분하지 않아서<br />시뮬레이션을 보여줄 수 없어.<br />좀 더 지켜보고 다시 검색해봐.
          </p>
        </div>
      )}

      {/* ── 시뮬레이션 카드 ── */}
      {grade !== 'hold' && Object.keys(projections).length > 0 && (
        <div style={{
          margin: '24px 16px 0',
          background: 'rgba(255,255,255,0.45)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1.5px solid rgba(255,255,255,0.6)',
          boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.6), 0 2px 8px 0 rgba(31,38,135,0.04)',
          borderRadius: '24px',
          padding: '20px',
          animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.10s both',
        }}>
          {/* 카드 제목 — 등급별 분기 */}
          <p style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.3px',
            marginBottom: '12px',
          }}>
            {grade === 'ban'
              ? '최악의 경우엔?'
              : grade === 'wait'
              ? '일단 기다려봐, 최악의 경우엔?'
              : '만약 매수하게 된다면?'}
          </p>

          {/* 기간별 상세 — 3등분 + 세로 구분선 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0',
            marginTop: '4px',
          }}>
            {(() => {
              const usedTexts = new Set()
              return [
              { key: 'month3', label: '3개월 뒤' },
              { key: 'month6', label: '6개월 뒤' },
              { key: 'year1', label: '1년 뒤' },
            ].map(({ key, label }, colIdx) => {
              const item = projections[key]
              if (!item) return null

              // ban/wait → 최악값, ok/hold → 기대값 (마이너스면 best로 전환)
              const useWorst = grade === 'ban' || grade === 'wait'
              let displayGain
              if (useWorst) {
                const baseAmount = item.worstAmount ?? item.amount
                displayGain = baseAmount - simInvestAmount
              } else {
                const expectedGain = item.gain || (item.amount - simInvestAmount)
                // ok/hold인데 기대값이 마이너스면 best 시나리오로 전환 — 긍정 판결과 모순 방지
                displayGain = expectedGain < 0 && item.bestAmount
                  ? (item.bestAmount - simInvestAmount)
                  : expectedGain
              }
              const isPos = displayGain >= 0
              const isZero = displayGain === 0
              const color = isPos ? '#3182F6' : '#F04452'

              // 클라이언트 룩업 — 중복 방지로 인접 메타포 선택
              const life = isZero ? null : getLifeLabelUnique(displayGain, usedTexts)
              if (life) usedTexts.add(life.text)
              const displayEmoji = isZero ? '🤔' : (life?.emoji || item.emoji || '📈')
              const displayLabel = isZero ? '아직 모르겠어' : life?.text || trimLifeLabel(item.label) || ''

              return (
                <div key={key} style={{
                  textAlign: 'center',
                  padding: '16px 14px',
                  position: 'relative',
                }}>
                  {/* 짧은 세로 구분선 — 콘텐츠 높이 40% */}
                  {colIdx > 0 && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '30%',
                      height: '40%',
                      width: '1px',
                      background: 'rgba(0,0,0,0.06)',
                    }} />
                  )}
                  <p style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6B7280',
                    marginBottom: '8px',
                  }}>
                    {label}
                  </p>
                  <span style={{
                    fontSize: '34px',
                    lineHeight: 1,
                    display: 'inline-block',
                    filter: 'url(#sticker-outline) drop-shadow(0 2px 0.5px rgba(0,0,0,0.18))',
                  }}>
                    {displayEmoji}
                  </span>
                  {/* 치환 라벨 — 메인 정보 */}
                  <p style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: isZero ? '#9CA3AF' : 'var(--color-text-primary)',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.3,
                    marginTop: '12px',
                    marginBottom: '4px',
                  }}>
                    {displayLabel}
                  </p>
                  {/* 금액 — 보조 정보 */}
                  <p style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isZero ? '#9CA3AF' : color,
                    letterSpacing: '-0.2px',
                  }}>
                    {isZero ? '-' : formatGain(displayGain)}
                  </p>
                </div>
              )
            })
            })()}
          </div>

        </div>
      )}

      {/* ── 이 종목에 대해 궁금해? (바텀시트 트리거) ── */}
      {reasonCards.length > 0 && (
        <div style={{ padding: '0 16px', marginTop: '10px' }}>
          <button
            onClick={() => setShowReasons(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '4px',
              padding: '14px 0',
              background: 'rgba(255,255,255,0.35)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              border: '1.5px solid rgba(255,255,255,0.5)',
              boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.5), 0 1px 4px rgba(31,38,135,0.03)',
              borderRadius: '16px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>
              이 종목에 대해 궁금해?
            </span>
            <span style={{ fontSize: '12px', color: '#8B95A1' }}>›</span>
          </button>
        </div>
      )}

      {/* ── 면책 ── */}
      <p style={{ fontSize: '10px', color: '#8B95A1', textAlign: 'center', lineHeight: '16px', opacity: 0.6, padding: '12px 16px 0' }}>
        과거 변동성 기준 추정치 · 투자 판단의 책임은 본인에게 있습니다
      </p>

      {/* ── 하단 고정 CTA ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        margin: '0 auto',
        width: '100%',
        maxWidth: '480px',
        padding: '12px 20px',
        paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        backgroundColor: '#F3F4F6',
        animation: 'verdictIn 0.35s cubic-bezier(0.2, 0, 0, 1) 0.18s both',
        display: 'flex',
        gap: '8px',
      }}>
        {/* 다른 종목 알아보기 — 메인 CTA */}
        <button
          onClick={onReset}
          style={{
            flex: 1,
            height: '54px',
            backgroundColor: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            borderRadius: '14px',
            fontSize: '17px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '-0.2px',
            transition: 'transform 0.1s, box-shadow 0.1s',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          다른 종목 알아보기
        </button>
        {/* 공유하기 — 보조 버튼 */}
        <button
          onClick={() => {
            const shareText = `${resolvedStockName} ${title}\n\n지금 이 종목, 사도 될까? 👉 https://stockcheck-pi.vercel.app`
            if (navigator.share) {
              navigator.share({ text: shareText }).catch(() => {})
            } else {
              navigator.clipboard?.writeText(shareText)
            }
          }}
          style={{
            height: '54px',
            padding: '0 18px',
            flexShrink: 0,
            backgroundColor: '#E5E7EB',
            border: 'none',
            borderRadius: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'transform 0.1s',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.95)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          aria-label="공유하기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="16,6 12,2 8,6" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="2" x2="12" y2="15" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>


      {/* ── 이유 상세 바텀시트 ── */}
      {showReasons && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowReasons(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px 36px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '70vh',
              overflowY: 'auto',
              animation: 'sheetUp 0.3s cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>
                이 종목에 대해 궁금해?
              </p>
              <button
                onClick={() => setShowReasons(false)}
                aria-label="닫기"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="var(--color-text-secondary)" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {reasonCards.map((card, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '14px 0',
                  alignItems: 'flex-start',
                  borderBottom: i < reasonCards.length - 1
                    ? '0.5px solid rgba(0,0,0,0.06)'
                    : 'none',
                }}
              >
                <span style={{ fontSize: '22px', lineHeight: 1.2, flexShrink: 0 }}>
                  {card.emoji}
                </span>
                <div>
                  {card.nickname && (
                    <p style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      letterSpacing: '-0.2px',
                      lineHeight: 1.3,
                      marginBottom: '4px',
                    }}>
                      {card.nickname}
                    </p>
                  )}
                  <p style={{
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: 'var(--color-text-secondary)',
                  }}>
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes verdictIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stickerDrop {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes simIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
