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
  const [providerToken, setProviderToken] = useState(null)

  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.provider_token) setProviderToken(session.provider_token)
      setLoading(false)
    })

    // 인증 상태 변경 감지 + provider_token 저장
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        if (session?.provider_token) setProviderToken(session.provider_token)
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

  /** 회원탈퇴 — 카카오 연결 해제 → DB 삭제 → 세션 정리 */
  const deleteUser = async () => {
    // 카카오 OAuth 연결 해제 — 재로그인 시 자동 로그인 방지
    if (providerToken) {
      try {
        await fetch('https://kapi.kakao.com/v1/user/unlink', {
          method: 'POST',
          headers: { Authorization: `Bearer ${providerToken}` },
        })
      } catch {
        // 연결 해제 실패해도 탈퇴 진행
      }
    }
    const { error } = await supabase.rpc('delete_user')
    if (error) throw error
    await supabase.auth.signOut()
  }

  return { user, loading, signIn, signOut, deleteUser }
}
