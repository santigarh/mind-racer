/**
 * Race sound effects synthesized with Web Audio: no audio files to download (design D4).
 * Every audio error is swallowed: a blocked or missing AudioContext just means silence.
 */
export type SoundName = 'countdown' | 'go' | 'correct' | 'wrong' | 'nitro' | 'finish';

export interface Sfx {
  play(name: SoundName): void;
  /** Creates or resumes the AudioContext on the first tap, click or key (autoplay policy). */
  unlockOnFirstInteraction(target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>): void;
}

/** The part of AudioContext we use, so tests can pass a fake. */
export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
}

interface Note {
  freq: number;
  /** Slides to this frequency over the note (the nitro sweep). */
  toFreq?: number;
  at: number;
  duration: number;
  type: OscillatorType;
  /** Relative loudness; square and sawtooth waves sound louder than sine. */
  level?: number;
}

const VOLUME = 0.15;

export const SOUNDS: Record<SoundName, readonly Note[]> = {
  countdown: [{ freq: 440, at: 0, duration: 0.12, type: 'sine' }],
  go: [{ freq: 880, at: 0, duration: 0.4, type: 'sine' }],
  correct: [
    { freq: 660, at: 0, duration: 0.07, type: 'triangle' },
    { freq: 990, at: 0.07, duration: 0.1, type: 'triangle' },
  ],
  wrong: [{ freq: 140, at: 0, duration: 0.22, type: 'square', level: 0.5 }],
  nitro: [{ freq: 300, toFreq: 1200, at: 0, duration: 0.35, type: 'sawtooth', level: 0.5 }],
  finish: [
    { freq: 523, at: 0, duration: 0.12, type: 'triangle' },
    { freq: 659, at: 0.1, duration: 0.12, type: 'triangle' },
    { freq: 784, at: 0.2, duration: 0.12, type: 'triangle' },
    { freq: 1047, at: 0.3, duration: 0.4, type: 'triangle' },
  ],
};

function defaultContext(): AudioContextLike | null {
  const Ctor =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function createSfx(createContext: () => AudioContextLike | null = defaultContext): Sfx {
  let ctx: AudioContextLike | null = null;
  let failed = false;

  function context(): AudioContextLike | null {
    if (!ctx && !failed) {
      try {
        ctx = createContext();
      } catch {
        ctx = null;
      }
      if (!ctx) failed = true;
    }
    return ctx;
  }

  function resume(audio: AudioContextLike) {
    if (audio.state !== 'suspended') return;
    try {
      audio.resume().catch(() => {});
    } catch {
      // ignore
    }
  }

  return {
    play(name) {
      const audio = context();
      if (!audio) return;
      try {
        resume(audio);
        const start = audio.currentTime;
        for (const note of SOUNDS[name]) {
          const t = start + note.at;
          const end = t + note.duration;
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = note.type;
          osc.frequency.setValueAtTime(note.freq, t);
          if (note.toFreq) osc.frequency.exponentialRampToValueAtTime(note.toFreq, end);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(VOLUME * (note.level ?? 1), t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(gain).connect(audio.destination);
          osc.start(t);
          osc.stop(end + 0.02);
        }
      } catch {
        // Audio is a nice-to-have; the race goes on.
      }
    },

    unlockOnFirstInteraction(target = globalThis) {
      const events = ['pointerdown', 'keydown'] as const;
      const unlock = () => {
        const audio = context();
        if (audio) resume(audio);
        if (!audio || audio.state === 'running' || failed) {
          events.forEach((type) => target.removeEventListener(type, unlock, true));
        }
      };
      events.forEach((type) => target.addEventListener(type, unlock, true));
    },
  };
}

export const sfx = createSfx();
