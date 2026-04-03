/**
 * 역할: 인증 상태 관리 커스텀 훅
 * 주요 기능: 로그인/로그아웃, 세션 상태 감지
 * 의존성: supabase 클라이언트
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth]', event, session?.user?.email ?? session?.user?.id ?? null)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  /** 소셜 로그인 (카카오 또는 구글) */
  const signIn = async (provider) => {
    const options = {
      redirectTo: `${window.location.origin}/auth/callback`,
    }
    // 카카오는 닉네임만 요청 — 이메일은 비즈니스 인증 필요해서 제외
    if (provider === 'kakao') {
      options.scopes = 'profile_nickname'
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider, options })
    if (error) throw error
  }

  /** 로그아웃 */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { user, loading, signIn, signOut }
}
