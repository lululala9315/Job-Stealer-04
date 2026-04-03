/**
 * 역할: OAuth 콜백 처리 페이지
 * 주요 기능: URL의 code 파라미터를 세션으로 교환 후 메인으로 이동
 * 의존성: supabase, react-router-dom
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    // hash에 access_token이 있으면 Supabase가 자동으로 세션을 감지함
    // SIGNED_IN 이벤트 기다렸다가 메인으로 이동
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        navigate('/', { replace: true })
      }
    })

    // hash에 error가 있으면 바로 처리
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const errorDesc = hashParams.get('error_description')
    if (errorDesc) {
      subscription.unsubscribe()
      setError(decodeURIComponent(errorDesc))
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    }

    return () => subscription.unsubscribe()
  }, [navigate])

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', flexDirection: 'column', gap: '12px',
        color: 'var(--color-text-secondary)', fontSize: '14px',
      }}>
        <p>로그인 중 오류가 발생했어: {error}</p>
        <p>잠시 후 다시 시도해줘...</p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh',
    }}>
      <div style={{
        width: '24px', height: '24px',
        border: '2px solid var(--color-accent)',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}
