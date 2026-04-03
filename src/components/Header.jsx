/**
 * 역할: 상단 헤더 바 (뒤로가기 + 앱 타이틀 + 프로필 드롭다운)
 * 주요 기능: onBack null이면 뒤로가기 숨김, 프로필 아이콘 클릭 → 드롭다운 (로그아웃)
 * 의존성: useAuth
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Header({ onBack = null }) {
  const { user, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // 외부 클릭 시 드롭다운 닫힘
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 아바타: 이미지 URL 우선, 없으면 이름 첫 글자
  const avatarUrl = user?.user_metadata?.avatar_url
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    '사용자'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--color-border-light)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          height: '52px',
          width: '100%',
          maxWidth: '480px',
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* 뒤로가기 버튼 — SEARCH step에서는 숨김 */}
        {onBack ? (
          <button
            onClick={onBack}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              marginRight: '4px',
              color: 'var(--color-text-primary)',
              fontSize: '20px',
              flexShrink: 0,
            }}
            aria-label="뒤로가기"
          >
            ←
          </button>
        ) : (
          <div style={{ width: '36px', flexShrink: 0 }} />
        )}

        {/* 앱 타이틀, 프로필 — 추후 활성화 */}
        <div style={{ flex: 1 }} />
      </div>
    </header>
  )
}
