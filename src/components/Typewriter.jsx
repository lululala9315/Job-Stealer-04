/**
 * 역할: 타이핑 효과 컴포넌트
 * 주요 기능: words 배열을 순서대로 타이핑 → 대기 → 삭제 → 다음 단어 반복
 * 의존성: 없음
 * 참고: TypeScript 원본 → JSX 변환 (use client 제거, 타입 제거)
 */

import { useEffect, useState } from 'react'

export function Typewriter({
  words,
  speed = 100,
  delayBetweenWords = 2000,
  cursor = true,
  cursorChar = '|',
}) {
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [wordIndex, setWordIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [showCursor, setShowCursor] = useState(true)

  const currentWord = words[wordIndex]

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (charIndex < currentWord.length) {
            setDisplayText(currentWord.substring(0, charIndex + 1))
            setCharIndex(charIndex + 1)
          } else {
            // 단어 완성 → delayBetweenWords 후 삭제 시작
            setTimeout(() => {
              setIsDeleting(true)
            }, delayBetweenWords)
          }
        } else {
          if (charIndex > 0) {
            setDisplayText(currentWord.substring(0, charIndex - 1))
            setCharIndex(charIndex - 1)
          } else {
            // 삭제 완료 → 다음 단어
            setIsDeleting(false)
            setWordIndex((prev) => (prev + 1) % words.length)
          }
        }
      },
      isDeleting ? speed / 2 : speed,
    )

    return () => clearTimeout(timeout)
  }, [charIndex, currentWord, isDeleting, speed, delayBetweenWords, wordIndex, words])

  // 커서 깜빡 — CSS 애니메이션 대신 interval로 처리
  useEffect(() => {
    if (!cursor) return
    const id = setInterval(() => setShowCursor((prev) => !prev), 500)
    return () => clearInterval(id)
  }, [cursor])

  return (
    <span style={{ display: 'inline' }}>
      {displayText}
      {cursor && (
        <span
          style={{
            marginLeft: '2px',
            opacity: showCursor ? 1 : 0,
            transition: 'opacity 75ms',
          }}
        >
          {cursorChar}
        </span>
      )}
    </span>
  )
}
