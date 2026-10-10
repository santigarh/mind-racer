import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { RESUME_COUNTDOWN_MS, RaceController } from './RaceController';
import { useRaceController } from './useRaceController';

function setup() {
  let wall = 1000;
  const controller = new RaceController({ seed: 7, level: 1, playerName: 'Ana', now: () => wall, autoLoop: false });
  const advance = (ms: number, step = 16) => {
    for (let t = 0; t < ms; t += step) {
      wall += Math.min(step, ms - t);
      controller.tick();
    }
  };
  return { controller, advance };
}

const player = (c: RaceController) => c.getState().snapshot.runners.find((r) => r.id === c.playerId)!;
const solve = (prompt: string) =>
  String(
    prompt
      .split(' + ')
      .map(Number)
      .reduce((a, b) => a + b, 0),
  );

describe('RaceController', () => {
  it('cuenta regresiva y luego carrera según el reloj', () => {
    const { controller, advance } = setup();
    controller.start();
    expect(controller.getState().snapshot.phase).toBe('countdown');
    advance(3000);
    expect(controller.getState().snapshot.phase).toBe('racing');
    expect(player(controller).challenge).not.toBeNull();
  });

  it('envía respuestas del jugador al motor', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(4000);
    const outcome = controller.submit(solve(player(controller).challenge!.prompt));
    expect(outcome?.correct).toBe(true);
    expect(player(controller).speed).toBeGreaterThan(0);
  });

  it('notifica a los suscriptores', () => {
    const { controller, advance } = setup();
    let calls = 0;
    controller.subscribe(() => calls++);
    controller.start();
    advance(160);
    expect(calls).toBeGreaterThan(5);
  });

  it('pausado nadie avanza; al volver hay cuenta regresiva de 3 s', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(8000);
    const before = controller.getState().snapshot;
    controller.hold('hidden');
    advance(10_000);
    const during = controller.getState();
    expect(during.paused).toBe(true);
    expect(during.snapshot.elapsedMs).toBe(before.elapsedMs);
    expect(during.snapshot.runners.map((r) => r.distance)).toEqual(before.runners.map((r) => r.distance));
    expect(controller.submit('1')).toBeNull();

    controller.release('hidden');
    expect(controller.getState().resumeRemainingMs).toBe(RESUME_COUNTDOWN_MS);
    advance(RESUME_COUNTDOWN_MS - 100);
    expect(controller.getState().snapshot.elapsedMs).toBe(before.elapsedMs);
    advance(500);
    expect(controller.getState().paused).toBe(false);
    expect(controller.getState().snapshot.elapsedMs).toBeGreaterThan(before.elapsedMs);
  });

  it('varias pausas a la vez se reanudan solo al liberar la última', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(5000);
    controller.hold('hidden');
    controller.hold('exit-dialog');
    controller.release('hidden');
    expect(controller.getState().paused).toBe(true);
    expect(controller.getState().resumeRemainingMs).toBe(0);
    controller.release('exit-dialog');
    expect(controller.getState().resumeRemainingMs).toBe(RESUME_COUNTDOWN_MS);
  });

  it('un salto grande de reloj no adelanta la carrera de golpe', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(60_000, 60_000);
    expect(controller.getState().snapshot.countdownRemainingMs).toBeGreaterThan(0);
  });

  it('useRaceController pausa al ocultar la pestaña', () => {
    const { controller, advance } = setup();
    let visibility: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    const { result } = renderHook(() => useRaceController(controller));
    act(() => advance(4000));
    expect(result.current.snapshot.phase).toBe('racing');
    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.paused).toBe(true);
    act(() => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.resumeRemainingMs).toBe(RESUME_COUNTDOWN_MS);
  });
});
