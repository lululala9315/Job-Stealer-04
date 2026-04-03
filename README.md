# stockcheck

> "그래서 사? 말아?" — FOMO에 눈먼 초보를 위한 초간편 주식 판결 & 손실방어 서비스

## 서비스 개요

주식 왕초보를 위한 AI 판결 앱. 종목 검색 → 투자금 입력 → 4단계 판결(절대금지🚨/대기🤔/괜찮아👀/관망🫥) → 실생활 치환("치킨 5마리 날릴 확률 85%") → 장기 시뮬레이션(5/10/20년).

## 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run preview  # 빌드 결과 미리보기
```

## 기술 스택

- **프론트**: React 19 + Vite + Tailwind CSS v4
- **백엔드**: Supabase (Auth + DB + Edge Functions)
- **AI**: Gemini API
- **주식 데이터**: KIS (한국투자증권) Open API
- **시장 데이터**: assetx2-dashboard API (VIX, 금리, 코스피/코스닥)
- **뉴스**: 네이버 뉴스 검색 API

## 문서

- [서비스 개요](docs/service-overview.md)
- [디자인 시스템](docs/design-system.md)
- [컴포넌트](docs/components.md)
- [설계 스펙](docs/superpowers/specs/2026-04-01-verdict-service-redesign.md)

## 환경변수

```bash
# 프론트 (.env)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Edge Function (Supabase Secrets)
KIS_APP_KEY=
KIS_APP_SECRET=
GEMINI_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```
