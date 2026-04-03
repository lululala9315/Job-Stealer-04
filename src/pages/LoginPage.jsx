/**
 * 역할: 소셜 로그인 페이지
 * 주요 기능: 카카오/구글 로그인 버튼
 * 의존성: useAuth 훅
 */

import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn } = useAuth()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '0 24px',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* 브랜딩 영역 */}
      <div style={{ marginBottom: '52px', textAlign: 'center' }}>
        {/* 핵심 카피 */}
        <h1
          style={{
            fontSize: '28px',
            lineHeight: '38px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            marginBottom: '10px',
            letterSpacing: '-0.6px',
            textWrap: 'balance',
          }}
        >
          그 주식,<br />
          지금 사도 되는 거 맞아?
        </h1>
        <p
          style={{
            fontSize: '15px',
            lineHeight: '22.5px',
            color: 'var(--color-text-secondary)',
          }}
        >
          매수 전에 한번만 체크해봐
        </p>
      </div>

      {/* 로그인 버튼 */}
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <button
          onClick={() => signIn('kakao')}
          style={{
            width: '100%',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: '#FEE500',
            color: '#191919',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transitionProperty: 'transform, filter',
            transitionDuration: '0.1s',
            letterSpacing: '-0.2px',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.96)' }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <KakaoIcon />
          카카오로 시작하기
        </button>

        <button
          onClick={() => signIn('google')}
          style={{
            width: '100%',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            borderRadius: '14px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transitionProperty: 'transform, background-color',
            transitionDuration: '0.1s',
            letterSpacing: '-0.2px',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-card)' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <GoogleIcon />
          Google로 시작하기
        </button>
      </div>

      {/* 디스클레이머 */}
      <p
        style={{
          marginTop: '32px',
          fontSize: '13px',
          lineHeight: '19.5px',
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          maxWidth: '280px',
        }}
      >
        로그인 시 서비스 이용약관에 동의하는 것으로 간주합니다.
        <br />
        본 서비스는 투자 조언을 제공하지 않습니다.
      </p>
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3C5.58 3 2 5.87 2 9.35c0 2.18 1.4 4.1 3.52 5.22l-.9 3.33c-.08.28.24.5.48.34l3.96-2.61c.31.03.62.05.94.05 4.42 0 8-2.87 8-6.33C18 5.87 14.42 3 10 3z"
        fill="#191919"
      />
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
