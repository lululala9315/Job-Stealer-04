/**
 * 역할: 공통 바텀시트 래퍼
 * 주요 기능: 딤 배경 + 슬라이드업 시트 + 핸들바 + safe area 패딩
 * 의존성: 없음
 */

export default function BottomSheet({ onClose, children, zIndex = 50 }) {
  return (
    <>
      {/* 딤 배경 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          marginBottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: zIndex - 1,
        }}
      />

      {/* 시트 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '24px 24px 0 0',
          padding: '12px 20px 0',
          paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
          zIndex: zIndex,
          animation: 'sheetUp 0.28s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        {/* 핸들바 */}
        <div style={{
          width: '36px',
          height: '4px',
          backgroundColor: 'var(--color-border)',
          borderRadius: '9999px',
          margin: '0 auto 20px',
        }} />

        {children}
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateX(-50%) translateY(100%); }
          to   { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  )
}
