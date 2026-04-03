/**
 * 역할: 텍스트 로테이션 애니메이션 컴포넌트
 * 주요 기능: 여러 텍스트를 캐릭터 단위 spring 애니메이션으로 순환
 * 의존성: motion/react
 * 참고: danielpetho/text-rotate (21st.dev) 기반, TypeScript → JSX 변환
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'

const TextRotate = forwardRef(
  (
    {
      texts,
      transition = { type: 'spring', damping: 25, stiffness: 300 },
      initial = { y: '100%', opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: '-120%', opacity: 0 },
      animatePresenceMode = 'wait',
      animatePresenceInitial = false,
      rotationInterval = 2000,
      staggerDuration = 0,
      staggerFrom = 'first',
      loop = true,
      auto = true,
      splitBy = 'characters',
      onNext,
      style,
      ...props
    },
    ref
  ) => {
    const [currentTextIndex, setCurrentTextIndex] = useState(0)

    /** 유니코드·이모지 지원 캐릭터 분리 */
    const splitIntoCharacters = (text) => {
      if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
        const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' })
        return Array.from(segmenter.segment(text), ({ segment }) => segment)
      }
      return Array.from(text)
    }

    const elements = useMemo(() => {
      const currentText = texts[currentTextIndex]
      if (splitBy === 'characters') {
        return currentText.split(' ').map((word, i, arr) => ({
          characters: splitIntoCharacters(word),
          needsSpace: i !== arr.length - 1,
        }))
      }
      if (splitBy === 'words') return currentText.split(' ')
      if (splitBy === 'lines') return currentText.split('\n')
      return currentText.split(splitBy)
    }, [texts, currentTextIndex, splitBy])

    const getStaggerDelay = useCallback(
      (index, totalChars) => {
        if (staggerFrom === 'first') return index * staggerDuration
        if (staggerFrom === 'last') return (totalChars - 1 - index) * staggerDuration
        if (staggerFrom === 'center') {
          const center = Math.floor(totalChars / 2)
          return Math.abs(center - index) * staggerDuration
        }
        if (staggerFrom === 'random') {
          const randomIndex = Math.floor(Math.random() * totalChars)
          return Math.abs(randomIndex - index) * staggerDuration
        }
        return Math.abs(staggerFrom - index) * staggerDuration
      },
      [staggerFrom, staggerDuration]
    )

    const handleIndexChange = useCallback(
      (newIndex) => {
        setCurrentTextIndex(newIndex)
        onNext?.(newIndex)
      },
      [onNext]
    )

    const next = useCallback(() => {
      const nextIndex =
        currentTextIndex === texts.length - 1
          ? loop ? 0 : currentTextIndex
          : currentTextIndex + 1
      if (nextIndex !== currentTextIndex) handleIndexChange(nextIndex)
    }, [currentTextIndex, texts.length, loop, handleIndexChange])

    const previous = useCallback(() => {
      const prevIndex =
        currentTextIndex === 0
          ? loop ? texts.length - 1 : currentTextIndex
          : currentTextIndex - 1
      if (prevIndex !== currentTextIndex) handleIndexChange(prevIndex)
    }, [currentTextIndex, texts.length, loop, handleIndexChange])

    const jumpTo = useCallback(
      (index) => {
        const validIndex = Math.max(0, Math.min(index, texts.length - 1))
        if (validIndex !== currentTextIndex) handleIndexChange(validIndex)
      },
      [texts.length, currentTextIndex, handleIndexChange]
    )

    const reset = useCallback(() => {
      if (currentTextIndex !== 0) handleIndexChange(0)
    }, [currentTextIndex, handleIndexChange])

    useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [
      next, previous, jumpTo, reset,
    ])

    useEffect(() => {
      if (!auto) return
      const id = setInterval(next, rotationInterval)
      return () => clearInterval(id)
    }, [next, rotationInterval, auto])

    const wordObjects =
      splitBy === 'characters'
        ? elements
        : elements.map((el, i) => ({
            characters: [el],
            needsSpace: i !== elements.length - 1,
          }))

    return (
      <motion.span
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          whiteSpace: 'pre-wrap',
          ...style,
        }}
        layout
        transition={transition}
        {...props}
      >
        {/* 스크린리더용 숨김 텍스트 */}
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {texts[currentTextIndex]}
        </span>

        <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
          <motion.span
            key={currentTextIndex}
            style={{ display: 'inline-flex', flexWrap: 'wrap' }}
            layout
            aria-hidden="true"
          >
            {wordObjects.map((wordObj, wordIndex, array) => {
              const previousCharsCount = array
                .slice(0, wordIndex)
                .reduce((sum, word) => sum + word.characters.length, 0)
              const totalChars = array.reduce((sum, word) => sum + word.characters.length, 0)

              return (
                <span key={wordIndex} style={{ display: 'inline-flex' }}>
                  {wordObj.characters.map((char, charIndex) => (
                    <motion.span
                      key={charIndex}
                      initial={initial}
                      animate={animate}
                      exit={exit}
                      transition={{
                        ...transition,
                        delay: getStaggerDelay(previousCharsCount + charIndex, totalChars),
                      }}
                      style={{ display: 'inline-block' }}
                    >
                      {char}
                    </motion.span>
                  ))}
                  {wordObj.needsSpace && <span style={{ whiteSpace: 'pre' }}> </span>}
                </span>
              )
            })}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    )
  }
)

TextRotate.displayName = 'TextRotate'
export { TextRotate }
