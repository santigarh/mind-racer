import { describe, expect, it, vi } from 'vitest';
import { PATTERNS, createHaptics } from './haptics';
import { SOUNDS, createSfx, type AudioContextLike, type SoundName } from './sfx';

function fakeAudio(initialState = 'suspended') {
  const oscillators: { type: string; freqs: number[]; started: number; stopped: number }[] = [];
  const param = (log?: number[]) => ({
    setValueAtTime: (v: number) => log?.push(v),
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: (v: number) => log?.push(v),
  });
  const ctx = {
    state: initialState,
    currentTime: 1,
    destination: {} as AudioNode,
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    createOscillator() {
      const record = { type: '', freqs: [] as number[], started: -1, stopped: -1 };
      oscillators.push(record);
      return {
        set type(t: string) {
          record.type = t;
        },
        frequency: param(record.freqs),
        connect: (node: unknown) => node,
        start: (t: number) => (record.started = t),
        stop: (t: number) => (record.stopped = t),
      } as unknown as OscillatorNode;
    },
    createGain() {
      return { gain: param(), connect: (node: unknown) => node } as unknown as GainNode;
    },
  };
  return { ctx: ctx as AudioContextLike & { state: string }, oscillators };
}

function fakeTarget() {
  const listeners = new Map<string, EventListener>();
  return {
    listeners,
    addEventListener: (type: string, fn: EventListener) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
  };
}

describe('sonidos sintetizados', () => {
  it('cada evento tiene un sonido distinto', () => {
    const names = Object.keys(SOUNDS) as SoundName[];
    const signatures = names.map((n) => JSON.stringify(SOUNDS[n].map((note) => [note.freq, note.type, note.toFreq])));
    expect(new Set(signatures).size).toBe(names.length);
  });

  it('toca las notas del sonido pedido desde el momento actual', () => {
    const { ctx, oscillators } = fakeAudio('running');
    const sfx = createSfx(() => ctx);
    sfx.play('correct');
    expect(oscillators.map((o) => [o.type, o.freqs[0], o.started])).toEqual([
      ['triangle', 660, 1],
      ['triangle', 990, 1.07],
    ]);
    sfx.play('nitro');
    expect(oscillators[2]!.freqs).toEqual([300, 1200]);
  });

  it('crea el AudioContext solo cuando hace falta', () => {
    const create = vi.fn(() => fakeAudio().ctx);
    const sfx = createSfx(create);
    expect(create).not.toHaveBeenCalled();
    sfx.play('go');
    sfx.play('go');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('se activa con la primera interacción y luego deja de escuchar (Primera visita)', () => {
    const { ctx } = fakeAudio('suspended');
    const target = fakeTarget();
    createSfx(() => ctx).unlockOnFirstInteraction(target);
    expect([...target.listeners.keys()]).toEqual(['pointerdown', 'keydown']);
    target.listeners.get('pointerdown')!(new Event('pointerdown'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('running');
    expect(target.listeners.size).toBe(0);
  });

  it('sigue escuchando mientras el navegador no deja reanudar el audio', () => {
    const { ctx } = fakeAudio('suspended');
    ctx.resume = vi.fn(async () => {});
    const target = fakeTarget();
    createSfx(() => ctx).unlockOnFirstInteraction(target);
    target.listeners.get('pointerdown')!(new Event('pointerdown'));
    expect(target.listeners.size).toBe(2);
    ctx.state = 'running';
    target.listeners.get('keydown')!(new Event('keydown'));
    expect(target.listeners.size).toBe(0);
  });

  it('sin Web Audio, o si falla, el juego sigue sin sonido y sin errores', () => {
    expect(() => createSfx(() => null).play('wrong')).not.toThrow();
    const broken = createSfx(() => {
      throw new Error('blocked');
    });
    expect(() => broken.play('finish')).not.toThrow();
    const { ctx } = fakeAudio('running');
    ctx.createOscillator = () => {
      throw new Error('closed');
    };
    expect(() => createSfx(() => ctx).play('countdown')).not.toThrow();
    const target = fakeTarget();
    createSfx(() => null).unlockOnFirstInteraction(target);
    expect(() => target.listeners.get('pointerdown')!(new Event('pointerdown'))).not.toThrow();
    expect(target.listeners.size).toBe(0);
  });
});

describe('vibración', () => {
  it('vibra con un patrón distinto para error, nitro y llegada (Celular Android)', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({ vibrate });
    haptics.vibrate('wrong');
    haptics.vibrate('nitro');
    haptics.vibrate('finish');
    expect(vibrate.mock.calls).toEqual([[PATTERNS.wrong], [PATTERNS.nitro], [PATTERNS.finish]]);
    expect(new Set(Object.values(PATTERNS).map((p) => p.join())).size).toBe(3);
  });

  it('sin soporte no hace nada y no falla (Navegador sin vibración)', () => {
    expect(() => createHaptics({}).vibrate('wrong')).not.toThrow();
    expect(() => createHaptics(undefined).vibrate('nitro')).not.toThrow();
    const throwing = createHaptics({
      vibrate: () => {
        throw new Error('not allowed');
      },
    });
    expect(() => throwing.vibrate('finish')).not.toThrow();
  });
});
