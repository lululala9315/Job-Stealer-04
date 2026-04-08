# 실시간 시장 이슈 피드 리뉴얼 — 토스증권 스타일

> 2026-04-08 | Phase 10

## 목표

현재 종목 단위 이슈 피드를 **토픽(거시경제 이벤트) 단위**로 전환한다. 왕초보가 종목 검색 전에 "오늘 시장에서 무슨 일이 있었는지" 자연스럽게 파악할 수 있게 한다.

## 현재 → 변경

| | 현재 (Phase 5) | 변경 (Phase 10) |
|---|---|---|
| 소스 | KIS 거래량 상위 + 네이버 뉴스 | 네이버 뉴스 키워드 검색만 |
| 분석 단위 | 종목별 | 토픽(이벤트)별 |
| LLM 역할 | 종목별 이슈 요약 | 뉴스 → 토픽 클러스터링 + 영향 + 대표 종목 매핑 |
| 배너 포맷 | `✦ 실시간 이슈 [종목명 이슈]` | `✦ 실시간 이슈 [토픽] · [대표종목 영향]` |
| KIS API | 필요 (거래량 상위) | 불필요 (제거) |

## 배너 포맷

```
✦ 실시간 이슈  미국-이란 휴전 합의 · SK이노베이션 급락  ›
✦ 실시간 이슈  반도체 수출 규제 완화 · 삼성전자 랠리  ›
```

- 6초 순환, 한줄배너 유지
- 클릭 시 대표 종목으로 검색 이동

## Edge Function 변경 (`issue-feed/index.ts`)

### 뉴스 수집

KIS 거래량 상위 제거. 네이버 뉴스 API로 경제/증권 키워드 검색:

```
키워드: ["코스피", "코스닥", "증시", "주식시장", "금리", "환율", "유가"]
각 키워드 display=5, sort=date → 최대 35개 기사 수집
중복 제거 (제목 기준)
```

### LLM 프롬프트

Claude Haiku에 전체 뉴스 헤드라인 전달 → JSON 배열 응답:

```json
[
  {
    "topic": "미국-이란 휴전 합의",
    "impact": "유가 급락, 반도체주 랠리",
    "sentiment": "긍정",
    "emoji": "🕊️",
    "stock_name": "SK이노베이션",
    "stock_code": "096770",
    "one_line": "미국-이란 휴전 합의 · SK이노베이션 급락"
  }
]
```

- 토픽 최대 5개
- 대표 종목은 KOSPI/KOSDAQ 상장 종목 중 가장 직접적 영향 받는 종목 1개
- 종목코드 6자리 필수 (LLM이 모르면 종목명만, 프론트에서 stocks.json 매칭)

### 캐시

- 기존 `issue_feed` 테이블 재사용
- `expires_at`: 30분 유지
- 기존 만료 데이터 삭제 후 INSERT

## DB 스키마 변경

`issue_feed` 테이블에 컬럼 추가:

```sql
ALTER TABLE issue_feed ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE issue_feed ADD COLUMN IF NOT EXISTS impact text;
```

기존 컬럼 유지 (하위 호환): `stock_code`, `stock_name`, `price_change`, `issue_type`, `sentiment`, `emoji`, `one_line`, `plain_explain`, `expires_at`

- `topic`: 토픽 제목 (예: "미국-이란 휴전 합의")
- `impact`: 영향 요약 (예: "유가 급락, 반도체주 랠리")
- `price_change`: LLM이 모르면 null 허용
- `issue_type`: 기존 유지 (거시경제/실적/수주 등)

## 프론트엔드 변경

### `useIssueFeed.js`
- `topic`, `impact` 필드 select에 추가
- 정렬: sentiment 기준 유지

### `SearchScreen.jsx`
- 배너 텍스트: `issue.one_line` 사용 (Edge Function에서 `[토픽] · [대표종목 영향]` 포맷으로 생성)
- 클릭 시: `issue.stock_name`으로 검색 이동 (기존과 동일)

## 구현 순서

1. DB 마이그레이션 (topic/impact 컬럼 추가)
2. `issue-feed` Edge Function 전면 교체
3. Edge Function 배포 + 테스트
4. `useIssueFeed.js` 필드 추가
5. `SearchScreen.jsx` 배너 포맷 확인
6. Vercel 배포
