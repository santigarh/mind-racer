import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_RACE_CONFIG } from '@mind-racer/engine';
import type { ClientMessage, NetRunnerState, ServerMessage } from '@mind-racer/protocol';
import type { ConnectionStatus } from '../net/NetClient';
import { NetworkRaceController, type RaceChannel } from './NetworkRaceController';
import { useRaceController } from './useRaceController';

class FakeChannel implements RaceChannel {
  status: ConnectionStatus = 'open';
  readonly sent: ClientMessage[] = [];
  private messageListeners = new Set<(m: ServerMessage) => void>();
  private statusListeners = new Set<(s: ConnectionStatus) => void>();
  send(message: ClientMessage) {
    this.sent.push(message);
  }
  onMessage(l: (m: ServerMessage) => void) {
    this.messageListeners.add(l);
    return () => this.messageListeners.delete(l);
  }
  onStatus(l: (s: ConnectionStatus) => void) {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }
  emit(m: ServerMessage) {
    for (const l of this.messageListeners) l(m);
  }
  setStatus(s: ConnectionStatus) {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }
}

const raceStart: Extract<ServerMessage, { type: 'raceStart' }> = {
  type: 'raceStart',
  seed: 42,
  distance: 1000,
  runners: [
    { id: 'p1', name: 'Papá', kind: 'human', chosenLevel: 8 },
    { id: 'p2', name: 'Lucía', kind: 'human', chosenLevel: 2 },
    { id: 'bot-tortuga-0', name: 'Ada', kind: 'bot', chosenLevel: 2, botProfile: 'tortuga' },
  ],
};

const runner = (id: string, distance: number, speed: number, extra: Partial<NetRunnerState> = {}): NetRunnerState => ({
  id,
  distance,
  speed,
  streak: 0,
  nitroActive: false,
  position: 1,
  level: 2,
  maxLevel: 2,
  correct: 0,
  wrong: 0,
  finishTimeMs: null,
  presence: 'connected',
  ...extra,
});

const state = (elapsedMs: number, runners: NetRunnerState[], phase: 'countdown' | 'racing' = 'racing') =>
  ({ type: 'state', phase, elapsedMs, countdownRemainingMs: phase === 'countdown' ? 3000 - elapsedMs : 0, runners }) as const;

function setup() {
  let now = 10_000;
  const channel = new FakeChannel();
  const controller = new NetworkRaceController({ channel, raceStart, playerId: 'p2', now: () => now, autoLoop: false });
  const at = (ms: number) => {
    now += ms;
    controller.tick();
  };
  const view = () => controller.getState();
  const runnerOf = (id: string) => view().snapshot.runners.find((r) => r.id === id)!;
  return { channel, controller, at, view, runnerOf };
}

const k = Math.LN2 / DEFAULT_RACE_CONFIG.speedHalfLifeS;

describe('NetworkRaceController', () => {
  it('arma la vista con nombres, niveles elegidos y perfiles de bots del raceStart', () => {
    const { view } = setup();
    const { snapshot, botProfiles } = view();
    expect(snapshot.runners.map((r) => [r.name, r.chosenLevel])).toEqual([
      ['Papá', 8],
      ['Lucía', 2],
      ['Ada', 2],
    ]);
    expect(snapshot.level).toBe(2);
    expect(botProfiles).toEqual({ 'bot-tortuga-0': 'tortuga' });
    expect(snapshot.phase).toBe('countdown');
  });

  it('estima la posición entre mensajes con la física del motor', () => {
    const { channel, at, runnerOf } = setup();
    channel.emit(state(1000, [runner('p1', 100, 20), runner('p2', 50, 10), runner('bot-tortuga-0', 0, 0)]));
    at(200);
    const expected = 100 + (20 * (1 - Math.exp(-k * 0.2))) / k;
    expect(runnerOf('p1').distance).toBeCloseTo(expected, 6);
    expect(runnerOf('p1').speed).toBeCloseTo(20 * Math.exp(-k * 0.2), 6);
    expect(runnerOf('bot-tortuga-0').distance).toBe(0);
  });

  it('no extrapola más de 500 ms sin noticias del servidor', () => {
    const { channel, at, runnerOf } = setup();
    channel.emit(state(1000, [runner('p1', 100, 20)]));
    at(500);
    const atLimit = runnerOf('p1').distance;
    at(3000);
    expect(runnerOf('p1').distance).toBeCloseTo(atLimit, 9);
  });

  it('corrige suavemente cuando el servidor contradice la estimación', () => {
    const { channel, at, runnerOf } = setup();
    channel.emit(state(1000, [runner('p1', 100, 20)]));
    at(50);
    const shown = runnerOf('p1').distance;
    // El servidor dice que en realidad iba 3 m más atrás.
    channel.emit(state(1050, [runner('p1', shown - 3, 20)]));
    expect(runnerOf('p1').distance).toBeCloseTo(shown, 6);
    at(50);
    const halfway = runnerOf('p1').distance;
    at(60);
    const settled = runnerOf('p1').distance;
    const target = shown - 3 + (20 * (1 - Math.exp(-k * 0.11))) / k;
    expect(settled).toBeCloseTo(target, 6);
    expect(halfway).toBeGreaterThan(target - 1.5);
  });

  it('no avanza durante la cuenta regresiva y la descuenta en vivo', () => {
    const { channel, at, view } = setup();
    channel.emit(state(-2000, [runner('p1', 0, 0)], 'countdown'));
    at(500);
    expect(view().snapshot.countdownRemainingMs).toBe(4500);
    expect(view().snapshot.runners[0]!.distance).toBe(0);
  });

  it('envía la respuesta al desafío vigente y muestra el resultado del servidor', () => {
    const { channel, controller, view } = setup();
    channel.emit({ type: 'challenge', challenge: { seq: 1, level: 2, prompt: '3 + 4', answerLength: 1, issuedAtMs: 0 } });
    expect(view().snapshot.runners[1]!.challenge!.prompt).toBe('3 + 4');
    expect(view().snapshot.runners[0]!.challenge).toBeNull();
    controller.submit('7');
    expect(channel.sent).toEqual([{ type: 'answer', seq: 1, input: '7' }]);
    channel.emit({
      type: 'answer',
      outcome: { seq: 1, correct: true, expected: '7', given: '7', nitro: false, atMs: 900 },
      challenge: { seq: 2, level: 2, prompt: '5 − 1', answerLength: 1, issuedAtMs: 900 },
    });
    const me = view().snapshot.runners[1]!;
    expect(me.lastAnswer!.correct).toBe(true);
    expect(me.challenge!.seq).toBe(2);
  });

  it('resultados: fase terminada, clasificación y presencia', () => {
    const { channel, controller, view } = setup();
    channel.emit({
      type: 'results',
      results: [
        {
          id: 'p1', name: 'Papá', kind: 'human', position: 1, chosenLevel: 8, finished: true, finishTimeMs: 60_000,
          distance: 1000, correct: 30, wrong: 1, accuracy: 0.97, correctPerMinute: 30, maxLevel: 9, presence: 'connected',
        },
        {
          id: 'p2', name: 'Lucía', kind: 'human', position: 2, chosenLevel: 2, finished: false, finishTimeMs: null,
          distance: 400, correct: 10, wrong: 0, accuracy: 1, correctPerMinute: 10, maxLevel: 2, presence: 'disconnected',
        },
      ],
    });
    expect(view().snapshot.phase).toBe('finished');
    expect(view().snapshot.results!.map((r) => r.name)).toEqual(['Papá', 'Lucía']);
    expect(view().presence.p2).toBe('disconnected');
    controller.submit('1');
    expect(channel.sent).toEqual([]);
  });

  it('indica la reconexión', () => {
    const { channel, view } = setup();
    channel.setStatus('reconnecting');
    expect(view().reconnecting).toBe(true);
    channel.setStatus('open');
    expect(view().reconnecting).toBe(false);
  });

  it('no permite "Ver resultados" ni pausa', () => {
    const { controller } = setup();
    expect(controller.canFinishNow()).toBe(false);
    expect(controller.finishNow()).toBeNull();
  });

  it('ocultar la pestaña no pausa la carrera en línea', () => {
    const { channel, controller, at } = setup();
    let visibility: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    const { result } = renderHook(() => useRaceController(controller));
    act(() => {
      channel.emit(state(1000, [runner('p2', 10, 10)]));
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.paused).toBe(false);
    const before = result.current.snapshot.runners[1]!.distance;
    act(() => at(200));
    expect(result.current.snapshot.runners[1]!.distance).toBeGreaterThan(before);
  });
});
