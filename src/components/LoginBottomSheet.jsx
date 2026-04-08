/**
 * 역할: 비로그인 상태에서 검색 시도 시 노출되는 로그인 바텀시트
 * 주요 기능: 카카오/구글 소셜 로그인 버튼
 * 의존성: useAuth
 */

import { useAuth } from '../hooks/useAuth'
import BottomSheet from './BottomSheet'

export default function LoginBottomSheet({ onClose }) {
  const { signIn } = useAuth()

  const handleSignIn = async (provider) => {
    try {
      await signIn(provider)
    } catch (e) {
      console.error('로그인 오류:', e)
    }
  }

  return (
    <BottomSheet onClose={onClose} zIndex={60}>
      {/* 카피 */}
      <p style={{
        fontSize: '22px', fontWeight: 800,
        color: 'var(--color-text-primary)',
        letterSpacing: '-0.4px', lineHeight: '31px',
        marginBottom: '6px',
      }}>
        물리기 전에<br />나한테 물어봐
      </p>
      <p style={{
        fontSize: '14px',
        color: 'var(--color-text-secondary)',
        marginBottom: '28px',
        lineHeight: '21px',
      }}>
        로그인하면 알려줄게
      </p>

      {/* 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => handleSignIn('kakao')}
          style={{
            width: '100%', height: '52px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            borderRadius: '14px', border: 'none',
            backgroundColor: '#FEE500', color: '#191919',
            fontSize: '15px', fontWeight: 600,
            cursor: 'pointer', letterSpacing: '-0.2px',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <KakaoIcon />
          카카오로 시작하기
        </button>

        <button
          onClick={() => handleSignIn('google')}
          style={{
            width: '100%', height: '52px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            borderRadius: '14px', border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
            fontSize: '15px', fontWeight: 600,
            cursor: 'pointer', letterSpacing: '-0.2px',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <GoogleIcon />
          Google로 시작하기
        </button>
      </div>

      <p style={{
        marginTop: '20px', fontSize: '12px',
        color: 'var(--color-text-tertiary)',
        textAlign: 'center', lineHeight: '18px',
      }}>
        로그인 시 서비스 이용약관에 동의합니다.<br />
        본 서비스는 투자 조언을 제공하지 않습니다.
      </p>
    </BottomSheet>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 3C5.58 3 2 5.87 2 9.35c0 2.18 1.4 4.1 3.52 5.22l-.9 3.33c-.08.28.24.5.48.34l3.96-2.61c.31.03.62.05.94.05 4.42 0 8-2.87 8-6.33C18 5.87 14.42 3 10 3z" fill="#191919" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path d="M19.6 10.23c0-.68-.06-1.36-.17-2.01H10v3.8h5.38a4.6 4.6 0 01-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.31z" fill="#4285F4" />
      <path d="M10 20c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H1.08v2.58A9.99 9.99 0 0010 20z" fill="#34A853" />
      <path d="M4.42 11.92A6.01 6.01 0 014.1 10c0-.67.12-1.31.32-1.92V5.5H1.08A9.99 9.99 0 000 10c0 1.61.39 3.14 1.08 4.5l3.34-2.58z" fill="#FBBC05" />
      <path d="M10 3.96c1.47 0 2.78.5 3.82 1.5l2.86-2.86C14.96.99 12.7 0 10 0A9.99 9.99 0 001.08 5.5l3.34 2.58C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335" />
    </svg>
  )
}
