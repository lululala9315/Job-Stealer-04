# Components

모든 컴포넌트는 `src/components/`에 위치. 인라인 스타일 + CSS 변수(`var(--*)`) 방식 사용. Tailwind는 레이아웃 유틸리티에만 제한적으로 사용.

---

## 플로우 구조

```
MainPage (step 관리)
  ├── SearchScreen     — SEARCH step
  ├── AmountInput      — AMOUNT step (풀페이지)
  ├── LoadingScreen    — LOADING step
  ├── VerdictScreen    — VERDICT step
  └── SimulationScreen — SIMULATION step

공통 컴포넌트:
  ├── Header           — 전체 화면 상단
  ├── HistoryList      — SEARCH step 하단
  ├── LoginBottomSheet — 비로그인 상태 로그인 유도
  └── USStockSheet     — 미국 주식 검색 시 준비중 안내
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
| `onSearch` | `(query: string, displayName?: string) => void` | 검색어 제출 시 콜백 |
| `isSearching` | `boolean` | 검색 중 여부 — 중복 제출 방지 + 스피너 표시 |

### 주요 동작
- 외부 wrapper: `minHeight: '100dvh'`, `justifyContent: 'center'` — 화면 세로 중앙 정렬
- 타이틀: "오늘은 어떤 종목에 물리고 싶어?"
- **검색바 (토스 스타일)**:
  - 배경: `var(--color-bg-input)` 회색, 보더 없음, `border-radius: 14px`, `height: 52px`
  - 왼쪽: 돋보기 SVG 아이콘 (type="submit" 버튼) — 텍스트 입력 시 파란색으로 전환
  - 오른쪽: × 클리어 버튼 (입력값 있을 때만 표시) — 원형 회색 배경
  - 별도 "검색" 버튼 없음 — Enter 또는 돋보기 클릭으로 제출
  - placeholder: "종목명 또는 6자리 코드"
- 인기종목: 마퀴 무한 스크롤 (삼성전자/SK하이닉스/HLB/카카오/현대차 하드코딩, StockLogo 칩)
  - 호버 시 일시정지 (`animation-play-state: paused`)
  - 칩 탭 시 종목 코드로 `onSearch` 호출
- `isSearching` 동안 검색 버튼 → 스피너 SVG로 대체, 중복 제출 차단

---

## AmountInput

**파일:** `src/components/AmountInput.jsx`
**역할:** 투자 수량 입력 화면 (풀페이지, AMOUNT step)

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `stockName` | `string` | 선택된 종목명 (상단 서브레이블에 표시) |
| `stockCode` | `string` | 6자리 종목코드 — StockLogo 표시용, 없으면 빈 문자열 |
| `stockPrice` | `number \| null` | 현재가 (원) — null이면 "조회 중..." 표시 + 입력 비활성 |
| `onSubmit` | `(amount: number) => void` | 수량 확정 시 콜백 (주수 × 현재가 = 원 단위) |

### 주요 동작
- 타이틀: "몇 주 살 생각이야?" (30px, semibold)
- 상단에 `StockLogo` + 종목명 서브레이블 표시
- **단위: 주(株)** — 만원 단위 입력 방식 폐지
- **시스템 키보드**: 투명 input(opacity:0) 오버레이 위에 표시용 텍스트 렌더링
  - `inputMode="numeric"`, `pattern="[0-9]*"` — iOS/Android 숫자 키패드 자동 노출
  - 최대 9999주 제한
- 입력 표시: `{shares}주` 인라인 (22px, letterSpacing -0.8px)
- 플레이스홀더: "몇 주 살 생각이야?" (입력값 없을 때)
- 예상 금액: `예상 {formatWon(주수 × 현재가)}` — 18px, semibold, `--color-text-primary`
- **현재가 카드**: 회색 bg(`#f4f6f8`) 카드 — `stockPrice` 없으면 "조회 중...", 있으면 `{n}원`
  - 15초 주기 현재가 갱신은 **부모(MainPage)** 가 담당, `stockPrice` prop으로 전달
- **프리셋 칩 (누적 방식)**: "+1주 / +5주 / +10주 / +50주" — 클릭 시 현재 주수에 덧셈
  - 라인 스타일: `backgroundColor: transparent`, `border: 1px solid var(--color-border)`, radius 999px
  - `stockPrice` null이면 opacity 0.4 + 비활성
- **Liquid Glass CTA**: "AI한테 물어보기" 버튼
  - 활성: `rgba(20,26,35,0.78)` + `blur(28px) saturate(180%)` + 스페큘러 하이라이트 + 레이어드 섀도
  - 비활성: `rgba(220,224,228,0.55)` + `blur(12px)`
  - `canSubmit`: 주수 > 0 AND stockPrice 존재 시 활성화

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

**파일:** `src/components/LoadingScreen.jsx`
**역할:** Edge Function 호출 중 로딩 화면

### Props
없음

### 레이아웃
- `flex: 1` — MainPage `main` 컨테이너 전체 높이 차지
- `paddingBottom: 52px` — 헤더(52px) 높이 보정, 뷰포트 기준 시각적 센터
- MainPage: LOADING step에서 `py-4` 패딩 제거 (`isLoadingStep` 조건)

### 이모지 애니메이션
- thinking 4프레임 crossfade 반복 (disguised 제거)
  - frontal(900ms) → right(450ms) → frontal(750ms) → left(450ms)
- A/B 레이어 교차 방식 — 깜빡임 없음
- 이미지: `public/emoji/thinking-{frontal|right|left}.png`

### 로딩 메시지 (2.5초 순환)
```js
const LOADING_MESSAGES = [
  '충동이 올라오고 있어...',
  '지금 이 종목 진짜 괜찮은지 보는 중...',
  '팩트 몇 개 긁어오는 중...',
  '뇌동매매 감지 레이더 켜는 중...',
  '무릎인지 어깨인지 파악 중...',
  '지금 사면 어떻게 될지 시뮬 중...',
  '남들도 다 사는지 확인 중...',
  '이미 늦은 건지 확인 중...',
]
```

### 진행률 시뮬레이션
- 0% → 90% 지수 감속 곡선 (~8초), 150ms 인터벌
- 서브메시지: `"분석 중... {X}%"` (tertiary, pulse 애니메이션)

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
- **STEPS**: `SEARCH → AMOUNT → LOADING → VERDICT → SIMULATION` (AMOUNT는 풀페이지, 별도 step)
- 상태: `step`, `query`, `stockName`, `investAmount`, `result`, `error`, `stockPrice`, `isSearching`, `showLoginSheet`, `showUSStockSheet`
- **미국 주식 차단**: `isUSStock(query)` 감지 → `USStockSheet` 노출, API 호출 없음
  - ASCII 영문 1~5자 티커 (AAPL, TSLA 등) 또는 한글 미국 기업명 (애플, 테슬라 등) 감지
- **SEARCH 단계 (`handleSearch`)**: `priceOnly: true` 호출로 종목 유효성 확인 후 AMOUNT 이동
  - 로그인 미확인 시 LoginBottomSheet 노출
  - 검색 중 `isSearching: true` → 중복 검색 방지, SearchScreen 스피너
  - 에러 시 SEARCH 화면 유지 + 에러 배너
- **AMOUNT 단계**: 현재가 15초 폴링 (`useEffect` interval) — `stockPrice` 상태 갱신 후 AmountInput에 전달
- **Edge Function 호출 (`handleAmountSubmit`)**: `{ query, userId, investAmount }` — LOADING step 전환 후 호출
- 에러 처리: `data?.error` 먼저 체크 → `fnError` 체크 (fnError는 generic 메시지라 실 원인 묻힘)

### LoginPage (`src/pages/LoginPage.jsx`)
- 카카오 / 구글 OAuth 버튼
- `useAuth().signIn(provider)` 호출
- 카카오: `scopes: 'profile_nickname'` (이메일 제외)

---

## USStockSheet

**파일:** `src/components/USStockSheet.jsx`
**역할:** 미국 주식 검색 시 노출되는 준비중 바텀시트

### Props
| prop | 타입 | 설명 |
|------|------|------|
| `onClose` | `() => void` | 시트 닫기 콜백 |

### 주요 동작
- 🇺🇸 이모지 + "미국 주식은 열심히 준비 중이야" 타이틀
- 서브: "지금은 한국 종목만 분석할 수 있어."
- CTA: "한국 종목 검색하기" → `onClose()`
- `MainPage.isUSStock()` 감지 즉시 노출 — Edge Function 호출 없음

---

## 제거된 컴포넌트 (구 버전)

아래 컴포넌트는 리빌드 시 제거됨:
- `ChecklistScreen.jsx` — FOMO 체크리스트 (3문항)
- `ResultCards.jsx` — Swiper 기반 카드 스와이프
- `VirtualPortfolio.jsx` — 가상매수 추적
- `KakaoShare.jsx` — 카카오톡 공유
- `StockSearch.jsx` — SearchScreen으로 대체
