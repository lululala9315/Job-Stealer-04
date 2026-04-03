/**
 * 역할: Supabase 클라이언트 초기화
 * 주요 기능: Auth, Database 연결
 * 의존성: @supabase/supabase-js
 * 참고: 환경변수는 .env 파일에서 관리
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
