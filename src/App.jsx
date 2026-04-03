/**
 * 역할: 앱 루트 컴포넌트 (라우팅 + 인증 게이트)
 * 주요 기능: 로그인 여부에 따라 LoginPage / MainPage 분기
 * 의존성: useAuth, react-router-dom
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import MainPage from './pages/MainPage'
import AuthCallbackPage from './pages/AuthCallbackPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return !user ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-[640px] mx-auto w-full min-h-dvh">
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </BrowserRouter>
  )
}
