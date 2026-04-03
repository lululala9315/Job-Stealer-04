/**
 * 역할: 장기 시뮬레이션 화면 — 단일 예측 중심
 * 주요 기능: 3개월/6개월/1년 기댓값 예측 + 범위 밴드 차트 + 수익/손실 라벨
 * 의존성: 없음
 */

/**
 * 범위 밴드 라인 차트
 * - 실선: 기댓값 (예측)
 * - 음영: best~worst 범위 밴드
 */
function BandLineChart({ investAmount, projections, width = 280, height = 80 }) {
  const keys = ['month3', 'month6', 'year1']
  const items = keys.map(k => projections[k]).filter(Boolean)
  if (items.length < 1) return null

  const midValues  = [investAmount, ...items.map(d => d.amount)]
  const bestValues = [investAmount, ...items.map(d => d.bestAmount)]
  const worstValues= [investAmount, ...items.map(d => d.worstAmount)]
  const n = midValues.length

  const allValues = [...bestValues, ...worstValues]
  const max = Math.max(...allValues)
  const min = Math.min(...allValues)
  const range = max - min || 1

  const pad = { x: 8, y: 10 }
  const innerW = width - pad.x * 2
  const innerH = height - pad.y * 2

  const toX = (i) => pad.x + (i / (n - 1)) * innerW
  const toY = (v) => pad.y + innerH - ((v - min) / range) * innerH

  const linePath = (vals) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')

  // 범위 밴드 path (best 위쪽 → worst 아래쪽 역방향)
  const bandPath = [
    ...bestValues.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`),
    ...[...worstValues].reverse().map((v, i) => `L ${toX(n - 1 - i)} ${toY(v)}`),
    'Z',
  ].join(' ')

  const isPositive = items[items.length - 1]?.gain >= 0
  const lineColor = isPositive ? 'var(--color-verdict-ok)' : 'var(--color-verdict-ban)'
  const bandColor = isPositive ? 'rgba(49,130,246,0.08)' : 'rgba(240,68,82,0.08)'

  const labels = ['현재', '3개월', '6개월', '1년'].slice(0, n)

  return (
    <svg width={width} height={height + 20} viewBox={`0 0 ${width} ${height + 20}`} style={{ overflow: 'visible' }}>
      {/* 범위 밴드 */}
      <path d={bandPath} fill={bandColor} />

      {/* 기댓값 실선 */}
      <path d={linePath(midValues)} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* 포인트 */}
      {midValues.map((v, i) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={lineColor} />
      ))}

      {/* X축 라벨 */}
      {labels.map((label, i) => (
        <text key={i} x={toX(i)} y={height + 15} textAnchor="middle" fontSize="11" fill="var(--color-text-tertiary)" fontFamily="inherit">
          {label}
        </text>
      ))}
    </svg>
  )
}

export default function SimulationScreen({ simulation, investAmount, onReset }) {
  const projections = simulation?.longTerm?.projections || {}
  const periods = [
    { key: 'month3', label: '3개월 뒤' },
    { key: 'month6', label: '6개월 뒤' },
    { key: 'year1',  label: '1년 뒤' },
  ]

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '40px', animation: 'questionIn 0.22s cubic-bezier(0.2, 0, 0, 1)' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px' }}>
        그래도 샀다면? 🤷
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--color-text-tertiary)', marginBottom: '20px' }}>
        투자금 {(investAmount || 1_000_000).toLocaleString()}원 기준
      </p>

      {/* 범위 밴드 차트 */}
      <div style={{
        backgroundColor: 'var(--color-bg-input)',
        borderRadius: 'var(--radius-xl)',
        padding: '20px',
        marginBottom: '6px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <BandLineChart investAmount={investAmount || 1_000_000} projections={projections} />
      </div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textAlign: 'center', marginBottom: '20px' }}>
        음영은 변동 가능 범위
      </p>

      {/* 기간별 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
        {periods.map(({ key, label }, i) => {
          const item = projections[key]
          if (!item) return null
          const isPositive = item.gain >= 0
          return (
            <div key={key} style={{
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-xl)',
              padding: '16px 20px',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'var(--shadow-card)',
              animation: `simIn 0.35s cubic-bezier(0.2, 0, 0, 1) ${i * 0.07}s both`,
            }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                📅 {label}
              </p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: isPositive ? 'var(--color-verdict-ok)' : 'var(--color-verdict-ban)' }}>
                {item.emoji} {item.label}
              </p>
            </div>
          )
        })}
      </div>

      <button onClick={onReset} style={{
        width: '100%', height: 'var(--button-height-lg)',
        backgroundColor: 'var(--color-accent)', color: '#ffffff',
        border: 'none', borderRadius: 'var(--button-radius)',
        fontSize: '17px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)', willChange: 'transform',
        marginBottom: '16px',
      }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        다시 검색
      </button>

      <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: '18px' }}>
        과거 변동성 기준 추정치. 미래 수익을 보장하지 않습니다.
      </p>

      <style>{`
        @keyframes simIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
