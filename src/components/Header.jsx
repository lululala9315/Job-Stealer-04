/**
 * 역할: 상단 네비게이션 바
 * 주요 기능: 뒤로가기(좌) + 타이틀(중앙) + 메뉴(우, 로그인 시만)
 * 의존성: useAuth
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Header({ onBack = null, title = '', onLogin = null, transparent = false }) {
  const { user, signOut, deleteUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef(null)

  // 스크롤 감지 — 10px 이상 스크롤 시 블러 배경 적용
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 외부 클릭 시 메뉴 닫힘
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
  }

  const handleDeleteUser = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setMenuOpen(false)
    setConfirmDelete(false)
    await deleteUser()
  }

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      backgroundColor: scrolled
        ? (transparent ? 'rgba(243,244,246,0.72)' : 'rgba(255,255,255,0.72)')
        : (transparent ? 'transparent' : '#ffffff'),
      backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
      borderBottom: scrolled ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
      transition: 'background-color 0.2s, backdrop-filter 0.2s',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '52px',
        padding: '0 20px',
        position: 'relative',
      }}>

        {/* 좌: 뒤로가기 — ··· 버튼과 동일한 Liquid Glass 원형 */}
        <button
          onClick={onBack || undefined}
          disabled={!onBack}
          aria-label="뒤로가기"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: onBack ? 'var(--btn-glass-circle-bg)' : 'transparent',
            backdropFilter: onBack ? 'blur(20px) saturate(180%)' : 'none',
            WebkitBackdropFilter: onBack ? 'blur(20px) saturate(180%)' : 'none',
            border: 'none',
            cursor: onBack ? 'pointer' : 'default',
            opacity: onBack ? 1 : 0,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 1px 0 0',
            boxShadow: onBack ? 'var(--btn-glass-circle-shadow)' : 'none',
            transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
          }}
          onMouseDown={(e) => { if (onBack) e.currentTarget.style.transform = 'scale(0.92)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <svg width="7" height="13" viewBox="0 0 7 13" fill="none">
            <path d="M6 1L1 6.5L6 12" stroke="var(--color-text-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* 중앙: 타이틀 */}
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.3px',
          pointerEvents: 'none',
        }}>
          {title}
        </div>

        {/* 우: 로그인 버튼(비로그인) 또는 ··· 메뉴(로그인) */}
        <div style={{ flex: 1 }} />
        {!user && onLogin && (
          /* 로그인 — Liquid Glass pill (JOMO 스타일) */
          <button
            onClick={onLogin}
            style={{
              height: '36px',
              padding: '0 16px',
              background: 'var(--btn-glass-circle-bg)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.2px',
              flexShrink: 0,
              boxShadow: 'var(--btn-glass-circle-shadow)',
              transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            로그인
          </button>
        )}
        {user && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            {/* ··· — Liquid Glass 원형 버튼 (JOMO 스타일) */}
            <button
              onClick={() => { setMenuOpen(v => !v); setConfirmDelete(false) }}
              aria-label="메뉴"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: menuOpen ? 'rgba(240,242,245,0.90)' : 'var(--btn-glass-circle-bg)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                color: 'var(--color-text-secondary)',
                boxShadow: 'var(--btn-glass-circle-shadow)',
                transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg width="13" height="3" viewBox="0 0 13 3" fill="currentColor">
                <circle cx="1.5" cy="1.5" r="1.5"/>
                <circle cx="6.5" cy="1.5" r="1.5"/>
                <circle cx="11.5" cy="1.5" r="1.5"/>
              </svg>
            </button>

            {/* 드롭다운 — Liquid Glass */}
            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: '48px',
                right: '0px',
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                borderRadius: '16px',
                boxShadow: `
                  inset 0 1px 0 rgba(255,255,255,0.95),
                  0 0 0 0.5px rgba(0,0,0,0.07),
                  0 8px 32px rgba(0,0,0,0.12),
                  0 2px 8px rgba(0,0,0,0.06)
                `,
                overflow: 'hidden',
                minWidth: '140px',
                zIndex: 100,
              }}>
                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%', padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontSize: '14px', fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    fontFamily: 'inherit',
                  }}
                >
                  로그아웃
                </button>

                <div style={{ height: '1px', backgroundColor: 'var(--color-border-light)' }} />

                <button
                  onClick={handleDeleteUser}
                  style={{
                    width: '100%', padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontSize: '14px', fontWeight: 500,
                    color: confirmDelete ? 'var(--color-negative)' : 'var(--color-text-secondary)',
                    fontFamily: 'inherit',
                  }}
                >
                  {confirmDelete ? '정말 탈퇴할게요' : '회원탈퇴'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
