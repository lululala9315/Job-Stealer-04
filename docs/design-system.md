# Design System

Toss Design System(TDS) 기반. `src/index.css`의 `@theme` 디렉티브로 CSS 변수 관리. `tailwind.config.js` 없음.

---

## 색상 토큰

### 배경
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-bg` | `#ffffff` | 전체 배경 (모바일) |
| `--color-bg-card` | `#ffffff` | 카드 배경 |
| `--color-bg-elevated` | `#ffffff` | 모달/오버레이 배경 |
| `--color-bg-input` | `#f2f4f6` | 인풋 배경, 데스크탑 body 배경 |

> 데스크탑(`min-width: 640px`)에서 `body`는 `--color-bg-input`으로 자동 변경 → 480px 흰색 컬럼이 중앙에 "떠 있는" 효과

### 텍스트
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-text-primary` | `#191f28` | 기본 텍스트 |
| `--color-text-secondary` | `#6b7684` | 보조 텍스트 |
| `--color-text-tertiary` | `#b0b8c1` | 힌트, 캡션 |
| `--color-text-inverse` | `#ffffff` | 어두운 배경 위 텍스트 |
| `--color-text-disabled` | `#d1d6db` | 비활성 텍스트 |

### 포인트 (토스 블루)
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-accent` | `#3182f6` | 버튼, 선택 상태 |
| `--color-accent-hover` | `#2272eb` | 호버 상태 |
| `--color-accent-light` | `#e8f3ff` | 선택된 옵션 배경 |

### 시그널
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-positive` | `#3182f6` | 매수/상승 (토스증권은 블루) |
| `--color-positive-light` | `#e8f3ff` | |
| `--color-negative` | `#f04452` | 매도/하락, 위험 |
| `--color-negative-light` | `#ffeeee` | |
| `--color-warning` | `#f59e0b` | 주의 |
| `--color-warning-light` | `#fffbeb` | |

### 보더
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-border` | `#e5e8eb` | 일반 보더 |
| `--color-border-light` | `#f2f4f6` | 연한 구분선 |

---

## 판결 등급 이모지-색상 매핑 (신규)

판결 결과 화면에서 글래스 배경 블리딩 + 이모지 색에 사용.

### 판결 등급별 색상
| 등급 | 이모지 | 색상 토큰 | glow | glass |
|------|--------|-----------|------|-------|
| 절대금지 | 🚨 | `--color-verdict-ban: #f04452` | `rgba(240,68,82,0.15)` | `rgba(240,68,82,0.08)` |
| 대기 | 🤔 | `--color-verdict-wait: #f59e0b` | `rgba(245,158,11,0.15)` | `rgba(245,158,11,0.08)` |
| 괜찮아 보여 | 👀 | `--color-verdict-ok: #3182f6` | `rgba(49,130,246,0.15)` | `rgba(49,130,246,0.08)` |
| 관망 | 🫥 | `--color-verdict-hold: #8b95a1` | `rgba(139,149,161,0.12)` | `rgba(139,149,161,0.06)` |

### 치환 이모지별 블리딩 색상
| 이모지 | 아이템 | CSS 변수 |
|--------|--------|----------|
| 🍗 | 치킨 | `--emoji-chicken: rgba(255,165,0,0.12)` |
| ☕ | 커피 | `--emoji-coffee: rgba(139,90,43,0.12)` |
| 🚗 | 테슬라/자동차 | `--emoji-car: rgba(220,50,50,0.12)` |
| 💻 | 맥북/노트북 | `--emoji-laptop: rgba(150,150,170,0.12)` |
| 🎧 | 에어팟 | `--emoji-airpods: rgba(200,200,220,0.12)` |
| ✈️ | 여행/항공권 | `--emoji-travel: rgba(50,130,246,0.12)` |
| 🍕 | 피자 | `--emoji-pizza: rgba(210,100,30,0.12)` |
| 📱 | 아이패드 | `--emoji-ipad: rgba(100,130,180,0.12)` |

---

## 글래스모피즘 (신규 — 판결 영역 전용)

판결 결과 화면의 히어로 섹션에만 적용. 나머지는 토스 플랫 유지.

### 토큰
| 토큰 | 값 |
|------|----|
| `--glass-bg` | `rgba(255,255,255,0.72)` |
| `--glass-border` | `rgba(255,255,255,0.5)` |
| `--glass-blur` | `20px` |
| `--glass-shadow` | `0 8px 32px rgba(0,27,55,0.08)` |

### 유틸 클래스
```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

### 이모지 색 블리딩 구현
```css
/* 이모지 뒤에 radial-gradient로 이모지 색상 번짐 */
.emoji-glow {
  position: relative;
}
.emoji-glow::before {
  content: '';
  position: absolute;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, var(--current-emoji-color) 0%, transparent 70%);
  filter: blur(40px);
  opacity: 0.3;
  z-index: 0;
}
```

---

## 스티커 이모지 (신규)

CSS만으로 구현. 별도 이미지 에셋 불필요.

| 토큰 | 값 |
|------|----|
| `--sticker-shadow` | `0 4px 12px rgba(0,0,0,0.15)` |
| `--sticker-border` | `2px solid rgba(255,255,255,0.9)` |

```css
.sticker-emoji {
  font-size: 64px;
  /* 흰 테두리 + 그림자 — 스티커 느낌 */
  text-shadow:
    0 0 4px rgba(255,255,255,0.9),
    0 0 8px rgba(255,255,255,0.7);
  filter: drop-shadow(var(--sticker-shadow));
  /* 둥둥 떠있는 float 애니메이션 */
  animation: emojiFloat 3s ease-in-out infinite;
}

@keyframes emojiFloat {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
}
```

---

## 타이포그래피

폰트: `Pretendard` (CDN) — Toss Product Sans CDN 미지원으로 가장 유사한 대체 폰트

### TDS 스케일 (T1~T7)
| 레벨 | 크기 | 행간 | 용도 |
|------|------|------|------|
| T1 | 30px | 40px | 대형 타이틀 |
| T2 | 26px | 35px | |
| T3 | 22px | 31px | |
| T4 | 20px | 29px | |
| T5 | 17px | 25.5px | 본문 기본 |
| T6 | 15px | 22.5px | 버튼, 리스트 |
| T7 | 13px | 19.5px | 캡션, 레이블 |

### 주요 규칙
- 제목: `fontWeight: 800`, `letterSpacing: '-0.5px'`, `textWrap: 'balance'`
- 본문: `textWrap: 'pretty'`
- 숫자: `fontVariantNumeric: 'tabular-nums'`

---

## 간격 시스템 (4px 베이스)

| 토큰 | 값 |
|------|-----|
| `--spacing-1` | 4px |
| `--spacing-2` | 8px |
| `--spacing-3` | 12px |
| `--spacing-4` | 16px |
| `--spacing-5` | 20px |
| `--spacing-6` | 24px |
| `--spacing-8` | 32px |
| `--spacing-10` | 40px |
| `--spacing-12` | 48px |

---

## Border Radius

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--radius-sm` | 8px | 소형 요소 |
| `--radius-md` | 12px | |
| `--radius-lg` | 14px | TextField |
| `--radius-xl` | 16px | 카드, 버튼 |
| `--radius-2xl` | 20px | 대형 카드, 글래스 카드 |
| `--radius-full` | 9999px | 알약형, 칩 |

---

## 그림자

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--shadow-card` | `0px 1px 3px 0px rgba(0,27,55,0.10)` | 카드 기본 |
| `--shadow-card-hover` | `0px 4px 12px 0px rgba(0,27,55,0.14)` | 카드 호버 |
| `--shadow-float` | `0px 8px 24px 0px rgba(0,27,55,0.16)` | 드롭다운, 모달 |

---

## 버튼 스펙

| 토큰 | 값 |
|------|-----|
| `--button-height-lg` | 52px |
| `--button-height-md` | 44px |
| `--button-height-sm` | 36px |
| `--button-font-weight` | 600 |
| `--button-radius` | 14px |

**인터랙션 규칙:**
- Press: `scale(0.96)` — 절대 0.95 미만 금지
- `transition: all` 절대 금지 → 항상 specific property 명시

---

## 인풋 스펙

| 토큰 | 값 |
|------|-----|
| `--input-height` | 52px |
| `--input-radius` | 14px |
| `--input-padding` | 14px 16px |
| `--input-border` | `inset 0 0 0 1px rgba(2,32,71,0.05)` |

---

## 레이아웃

- **모바일**: 전체 너비, 좌우 padding `20px`
- **반응형 wrapper**: `App.jsx`에서 `max-w-[640px] mx-auto w-full min-h-dvh` wrapper div로 전체 앱 감쌈
- **`#root` 정렬**: `display: flex; flex-direction: column; align-items: center` — mx-auto가 flex-column 컨테이너 안에서 동작하려면 필수
- **데스크탑 (640px+)**: 콘텐츠 최대 너비 `480px`의 흰색 컬럼이 중앙에 위치
- **헤더**: 전체 너비, sticky, height `52px`
- **최소 히트 영역**: 인터랙티브 요소 `40×40px` 이상

---

## 애니메이션

```css
@keyframes questionIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes emojiFloat {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
}
```

**규칙:**
- 진입: `questionIn 0.22s cubic-bezier(0.2, 0, 0, 1)`
- 스티커 이모지: `emojiFloat 3s ease-in-out infinite`
- `prefers-reduced-motion`: 자동 비활성화 처리
