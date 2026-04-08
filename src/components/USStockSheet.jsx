/**
 * 역할: 미국 주식 검색 시 노출되는 준비중 바텀시트
 * 주요 기능: 미국 주식 미지원 안내 + 기대감 유지
 * 의존성: BottomSheet
 */

import BottomSheet from './BottomSheet'

export default function USStockSheet({ onClose }) {
  return (
    <BottomSheet onClose={onClose} zIndex={60}>
      {/* 이모지 */}
      <div style={{ fontSize: '48px', marginBottom: '16px', lineHeight: 1 }}>🇺🇸</div>

      {/* 타이틀 */}
      <p style={{
        fontSize: '22px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        letterSpacing: '-0.4px',
        lineHeight: '31px',
        marginBottom: '8px',
      }}>
        미국 주식은<br />열심히 준비 중이야
      </p>

      {/* 서브텍스트 */}
      <p style={{
        fontSize: '14px',
        color: 'var(--color-text-secondary)',
        marginBottom: '28px',
        lineHeight: '21px',
      }}>
        지금은 한국 종목만 분석할 수 있어.<br />
        미국 주식도 곧 열릴 예정이니 조금만 기다려줘!
      </p>

      {/* CTA */}
      <button
        onClick={onClose}
        style={{
          width: '100%',
          height: '52px',
          backgroundColor: 'var(--color-text-primary)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '14px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '-0.2px',
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
        onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        한국 종목 검색하기
      </button>
    </BottomSheet>
  )
}
