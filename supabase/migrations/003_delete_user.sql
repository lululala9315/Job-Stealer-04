-- 회원탈퇴: 현재 로그인한 사용자를 auth.users에서 삭제
-- SECURITY DEFINER로 실행해 auth 스키마 접근 권한 확보
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
