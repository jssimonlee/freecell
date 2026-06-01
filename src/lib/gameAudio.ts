import { useEffect, useRef } from 'react'

export type GameSound = 'select' | 'move' | 'home' | 'invalid' | 'undo' | 'deal' | 'win'

type AudioContextFactory = new () => AudioContext
type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: AudioContextFactory
}

type ToneOptions = {
  time: number
  frequency: number
  duration: number
  volume: number
  type?: OscillatorType
  attack?: number
  decayTo?: number
  endFrequency?: number
}

function getAudioContextFactory() {
  if (typeof window === 'undefined') {
    return null
  }

  const audioWindow = window as WindowWithWebkitAudio

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function playTone(context: AudioContext, options: ToneOptions) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const attack = options.attack ?? 0.01
  const decayTo = options.decayTo ?? 0.0001
  const endFrequency = options.endFrequency ?? options.frequency

  oscillator.type = options.type ?? 'triangle'
  oscillator.frequency.setValueAtTime(options.frequency, options.time)

  if (endFrequency !== options.frequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      options.time + options.duration,
    )
  }

  gain.gain.setValueAtTime(0.0001, options.time)
  gain.gain.exponentialRampToValueAtTime(options.volume, options.time + attack)
  gain.gain.exponentialRampToValueAtTime(decayTo, options.time + options.duration)

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(options.time)
  oscillator.stop(options.time + options.duration + 0.04)
}

function scheduleSound(context: AudioContext, sound: GameSound) {
  const time = context.currentTime + 0.01

  switch (sound) {
    case 'select':
      playTone(context, {
        time,
        frequency: 540,
        endFrequency: 620,
        duration: 0.05,
        volume: 0.035,
        type: 'sine',
      })
      break

    case 'move':
      playTone(context, {
        time,
        frequency: 420,
        endFrequency: 300,
        duration: 0.08,
        volume: 0.05,
        type: 'triangle',
      })
      playTone(context, {
        time: time + 0.015,
        frequency: 760,
        endFrequency: 660,
        duration: 0.04,
        volume: 0.018,
        type: 'sine',
      })
      break

    case 'home':
      playTone(context, {
        time,
        frequency: 620,
        endFrequency: 760,
        duration: 0.07,
        volume: 0.04,
        type: 'sine',
      })
      playTone(context, {
        time: time + 0.045,
        frequency: 930,
        duration: 0.12,
        volume: 0.03,
        type: 'triangle',
      })
      break

    case 'invalid':
      playTone(context, {
        time,
        frequency: 180,
        endFrequency: 110,
        duration: 0.14,
        volume: 0.03,
        type: 'sawtooth',
      })
      break

    case 'undo':
      playTone(context, {
        time,
        frequency: 520,
        duration: 0.06,
        volume: 0.03,
        type: 'triangle',
      })
      playTone(context, {
        time: time + 0.055,
        frequency: 380,
        duration: 0.08,
        volume: 0.028,
        type: 'triangle',
      })
      break

    case 'deal':
      playTone(context, {
        time,
        frequency: 300,
        duration: 0.05,
        volume: 0.028,
        type: 'square',
      })
      playTone(context, {
        time: time + 0.04,
        frequency: 360,
        duration: 0.05,
        volume: 0.028,
        type: 'square',
      })
      playTone(context, {
        time: time + 0.08,
        frequency: 280,
        duration: 0.07,
        volume: 0.026,
        type: 'triangle',
      })
      break

    case 'win':
      playTone(context, {
        time,
        frequency: 523,
        duration: 0.1,
        volume: 0.05,
        type: 'triangle',
      })
      playTone(context, {
        time: time + 0.08,
        frequency: 659,
        duration: 0.1,
        volume: 0.05,
        type: 'triangle',
      })
      playTone(context, {
        time: time + 0.16,
        frequency: 784,
        duration: 0.15,
        volume: 0.045,
        type: 'triangle',
      })
      playTone(context, {
        time: time + 0.26,
        frequency: 1047,
        duration: 0.22,
        volume: 0.04,
        type: 'sine',
      })
      break
  }
}

export function useGameAudio() {
  const contextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      const context = contextRef.current

      if (context && context.state !== 'closed') {
        void context.close()
      }
    }
  }, [])

  const playSound = (sound: GameSound) => {
    void (async () => {
      let context = contextRef.current

      if (!context || context.state === 'closed') {
        const AudioContextClass = getAudioContextFactory()

        if (!AudioContextClass) {
          return
        }

        context = new AudioContextClass()
        contextRef.current = context
      }

      if (context.state === 'suspended') {
        try {
          await context.resume()
        } catch {
          return
        }
      }

      scheduleSound(context, sound)
    })()
  }

  return { playSound }
}