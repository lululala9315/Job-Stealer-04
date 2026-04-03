# Components

모든 컴포넌트는 `src/components/`에 위치. 인라인 스타일 + CSS 변수(`var(--*)`) 방식 사용. Tailwind는 레이아웃 유틸리티에만 제한적으로 사용.

---

## 플로우 구조

```
MainPage (step 관리)
  ├── SearchScreen     — SEARCH step
  ├── AmountInput      — AMOUNT step
  ├── LoadingScreen    — LOADING step
  ├── VerdictScreen    — VERDICT step
  └── SimulationScreen — SIMULATION step

공통 컴포넌트:
  ├── Header           — 전체 화면 상단
  └── HistoryList      — SEARCH step 하단
```

---

## Header

**파일:** `src/components/Header.jsx`
**역할:** 상단 헤더 바 (뒤로가기 + 프로필 드롭다운)

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `onBack` | `() => void \| null` | 뒤로가기 콜백. null이면 버튼 숨김 |

### 주요 동작
- `onBack`이 있을 때만 좌측 뒤로가기 버튼 표시 (SEARCH step은 숨김)
- 우측 프로필 아이콘 클릭 → 드롭다운 (이름/이메일 + 로그아웃)
- 외부 클릭 시 드롭다운 닫힘
- 아바타 우선순위: `user_metadata.avatar_url` → 이름 첫 글자 원형

---

## SearchScreen

**파일:** `src/components/SearchScreen.jsx`
**역할:** 종목 검색 화면

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `onSearch` | `(query: string) => void` | 검색어 제출 시 콜백 |

### 주요 동작
- 외부 wrapper: `minHeight: '100dvh'`, `justifyContent: 'center'` — 화면 세로 중앙 정렬
- 타이틀: "어떤 주식에 눈 돌아갔어?"
- **검색바 (토스 스타일)**:
  - 배경: `var(--color-bg-input)` 회색, 보더 없음, `border-radius: 14px`, `height: 52px`
  - 왼쪽: 돋보기 SVG 아이콘 (type="submit" 버튼) — 텍스트 입력 시 파란색으로 전환
  - 오른쪽: × 클리어 버튼 (입력값 있을 때만 표시) — 원형 회색 배경
  - 별도 "검색" 버튼 없음 — Enter 또는 돋보기 클릭으로 제출
  - placeholder: "종목명 또는 6자리 코드"
- 인기종목: 마퀴 무한 스크롤 (삼성전자/SK하이닉스/HLB/카카오/현대차 하드코딩, StockLogo 칩)
  - 호버 시 일시정지 (`animation-play-state: paused`)
  - 칩 탭 시 종목 코드로 `onSearch` 호출

---

## AmountInput

**파일:** `src/components/AmountInput.jsx` (신규)
**역할:** 투자 금액 입력 화면

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `stockName` | `string` | 선택된 종목명 (서브 타이틀에 표시) |
| `onSubmit` | `(amount: number) => void` | 금액 확인 시 콜백 (원 단위) |

### 주요 동작
- 타이틀: "얼마나 넣을 생각이야?"
- 서브: "{stockName}에"
- `type="text"` + `inputmode="numeric"` — 네이티브 숫자 키패드 자동 노출
- 입력값은 만원 단위, 자동으로 원 단위 변환 (100 입력 → 1,000,000원)
- 실시간 표시: "= 1,000,000원" 회색 서브텍스트
- 기본값: 100 (만원)
- "건너뛰기" 링크 → `onSubmit(1000000)` (기본값 적용)
- "다음" 버튼 → `onSubmit(입력값 * 10000)`

---

## VerdictScreen

**파일:** `src/components/VerdictScreen.jsx` (신규) — 서비스 핵심 화면
**역할:** AI 판결 결과 표시 (한 화면 스크롤)

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `result` | `VerdictResult` | Edge Function 응답 전체 |
| `onSimulation` | `() => void` | "그래도 사면?" 버튼 콜백 |
| `onReset` | `() => void` | "다시 검색" 콜백 |

### 섹션 구조

**섹션 A — 판결 히어로 (글래스모피즘)**
- 배경: `backdrop-filter: blur(20px)` + 판결 등급 색상 glass 토큰 (`--color-verdict-{grade}-glass`)
- 이모지 블리딩: 이모지 색상 `radial-gradient`로 배경에 번짐
- 스티커 이모지: 판결 등급 이모지 (🚨/🤔/👀/🫥) + `emojiFloat` 애니메이션
- 판결 한줄 멘트 (Gemini 생성)
- 판결 등급 라벨 ("절대금지" / "대기" / "괜찮아 보여" / "관망")

**섹션 B — 손실/수익 치환**
- 메인: "치킨 5마리 날릴 확률 85%" 크고 임팩트 있게
- 서브: 실제 금액 표시 (투자금 기반)
- 치환 이모지 스티커 + 색 블리딩 적용

**섹션 C — 초보용 근거 (3~4개)**
- 비유 텍스트 (메인): "지금 들어가면 버스 마지막 정류장에서 탄 거야"
- ℹ️ 아이콘 (오른쪽, 소형): 탭 시 한줄 용어 설명 토글
- 데이터 수치 (서브, 연한 텍스트): "52주 고점 대비 95%"

**섹션 D — 하단 CTA**
- "그래도 사면?" 버튼 → `onSimulation()` 호출
- 절대금지 판결 시: 버튼 탭 → 확인 모달 "그래도 볼 거야? 진짜?" → 확인 시 `onSimulation()`
- 하단 고정 디스클레이머: "본 서비스는 투자 참고 정보만 제공하며, 투자 판단의 책임은 본인에게 있습니다."

### 글래스 카드 등급별 스타일
```js
const GRADE_STYLES = {
  ban:  { glassColor: 'var(--color-verdict-ban-glass)',  glowColor: 'var(--color-verdict-ban-glow)' },
  wait: { glassColor: 'var(--color-verdict-wait-glass)', glowColor: 'var(--color-verdict-wait-glow)' },
  ok:   { glassColor: 'var(--color-verdict-ok-glass)',   glowColor: 'var(--color-verdict-ok-glow)' },
  hold: { glassColor: 'var(--color-verdict-hold-glass)', glowColor: 'var(--color-verdict-hold-glow)' },
}
```

---

## SimulationScreen

**파일:** `src/components/SimulationScreen.jsx` (신규)
**역할:** 장기 시뮬레이션 (5/10/20년 예측)

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `simulation` | `SimulationData` | Edge Function의 longTerm 시뮬레이션 데이터 |
| `investAmount` | `number` | 투자금 (원 단위) |
| `onReset` | `() => void` | "다시 검색" 버튼 콜백 |

### 화면 구조
- 헤더 치환 텍스트: "5년 뒤, 넌 에어팟 프로 주인이야 🎧" (스티커 이모지)
- 서브: "약 440만원"
- 각 시점 블록 (5년/10년/20년):
  - 치환 아이템 텍스트 (메인)
  - 예상 금액 (서브)
- SVG 미니 라인 차트: 3개 포인트 (현재가 → 5년 → 10년 → 20년), 라이브러리 없이 직접 구현
- "다시 검색" 버튼
- 하단 디스클레이머: "과거 연평균 수익률 기준 추정. 미래 수익을 보장하지 않습니다."

---

## LoadingScreen

**파일:** `src/components/LoadingScreen.jsx` (신규)
**역할:** Edge Function 호출 중 로딩 화면

### Props
없음

### 로딩 메시지 (랜덤)
```js
const LOADING_MESSAGES = [
  '충동 억제 AI 가동 중...',
  'FOMO 방지벽 세우는 중...',
  '팩트로 찬물 끼얹는 중...',
  '잘못 탄 건 아닌지 확인 중...',
  '무릎인지 어깨인지 파악 중...',
]
```

---

## HistoryList

**파일:** `src/components/HistoryList.jsx`
**역할:** 사용자 판결 히스토리 목록

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `onSelect` | `(result: VerdictResult) => void` | 히스토리 항목 클릭 → VerdictScreen으로 이동 |

### 주요 동작
- `check_history` 테이블에서 최근 10개 조회
- 각 항목: 판결 이모지 + 종목명 + 한줄 멘트 + 날짜
- 로딩: 스켈레톤 3개 (pulse 애니메이션)
- 빈 상태: "아직 판결한 종목이 없어. 눈 돌아간 거 뭐야?" 유도 카드
- 날짜 포맷: "오늘 14:32" / "어제" / "3일 전" / "4/1"

---

## 페이지 컴포넌트

### MainPage (`src/pages/MainPage.jsx`)
- 전체 플로우 step 관리
- **STEPS**: `SEARCH → LOADING → VERDICT → SIMULATION` (AMOUNT는 바텀시트, 별도 step 없음)
- 상태: `step`, `query`, `stockName`, `investAmount`, `result`, `error`, `showAmountSheet`
- 금액 입력: `showAmountSheet` 바텀시트로 처리. 확인 시 Edge Function 호출
- Edge Function 호출: `handleAmountSubmit`에서 바텀시트 닫은 후 즉시 호출
- 호출 body: `{ query, userId, investAmount }`
- 에러 처리: `data?.error` 먼저 체크 → `fnError` 체크 (fnError는 generic 메시지라 실 원인 묻힘)
- priceOnly 사전 호출 없음 (KIS 토큰 1분 제한 충돌 방지)

### LoginPage (`src/pages/LoginPage.jsx`)
- 카카오 / 구글 OAuth 버튼
- `useAuth().signIn(provider)` 호출
- 카카오: `scopes: 'profile_nickname'` (이메일 제외)

---

## 제거된 컴포넌트 (구 버전)

아래 컴포넌트는 리빌드 시 제거됨:
- `ChecklistScreen.jsx` — FOMO 체크리스트 (3문항)
- `ResultCards.jsx` — Swiper 기반 카드 스와이프
- `VirtualPortfolio.jsx` — 가상매수 추적
- `KakaoShare.jsx` — 카카오톡 공유
- `StockSearch.jsx` — SearchScreen으로 대체
