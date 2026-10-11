import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Haptics, HapticName } from '../audio/haptics';
import type { Sfx, SoundName } from '../audio/sfx';
import { LocalRaceController } from '../game/LocalRaceController';
import { useRaceController } from '../game/useRaceController';
import { useRaceFeedback } from './useRaceFeedback';

function recorder() {
  const sounds: SoundName[] = [];
  const vibrations: HapticName[] = [];
  const sfx: Sfx = { play: (name) => sounds.push(name), unlockOnFirstInteraction: () => {} };
  const haptics: Haptics = { vibrate: (name) => vibrations.push(name) };
  return { sounds, vibrations, sfx, haptics };
}

/** Level 1 adapts up to level 3: sums and subtractions only. */
function solve(prompt: string): number {
  const [a, op, b] = prompt.split(' ');
  if (op === '+') return Number(a) + Number(b);
  if (op === '−') return Number(a) - Number(b);
  throw new Error(`unexpected prompt ${prompt}`);
}

function setup() {
  let wall = 1000;
  const controller = new LocalRaceController({ seed: 7, level: 1, playerName: 'Ana', now: () => wall, autoLoop: false });
  // One act per frame, like the real loop: React renders every intermediate state.
  const advance = (ms: number, step = 16) => {
    for (let t = 0; t < ms; t += step) {
      wall += Math.min(step, ms - t);
      act(() => controller.tick());
    }
  };
  const player = () => controller.getState().snapshot.runners.find((r) => r.id === controller.playerId)!;
  const answer = (right: boolean) =>
    act(() => {
      const value = solve(player().challenge!.prompt);
      controller.submit(String(right ? value : value + 1));
    });
  return { controller, advance, player, answer };
}

function mount(controller: LocalRaceController, enabled = true) {
  const rec = recorder();
  const hook = renderHook(
    ({ on }) => {
      const state = useRaceController(controller);
      useRaceFeedback(state, controller.playerId, { enabled: on, sfx: rec.sfx, haptics: rec.haptics });
    },
    { initialProps: { on: enabled } },
  );
  return { ...rec, hook };
}

describe('sonido y vibración de la carrera', () => {
  it('suena en el 3, el 2 y el 1, y distinto en la salida (Cuenta regresiva y salida)', () => {
    const race = setup();
    const { sounds } = mount(race.controller);
    act(() => race.controller.start());
    race.advance(3200);
    expect(sounds).toEqual(['countdown', 'countdown', 'countdown', 'go']);
  });

  it('acierto y error suenan distinto; el error vibra (Acierto y error)', () => {
    const race = setup();
    act(() => race.controller.start());
    race.advance(3500);
    const { sounds, vibrations } = mount(race.controller);
    race.answer(true);
    race.answer(false);
    expect(sounds).toEqual(['correct', 'wrong']);
    expect(vibrations).toEqual(['wrong']);
  });

  it('el acierto que activa el nitro suena como nitro (Nitro)', () => {
    const race = setup();
    act(() => race.controller.start());
    race.advance(3500);
    const { sounds, vibrations } = mount(race.controller);
    for (let i = 0; i < 5; i++) race.answer(true);
    expect(race.player().nitroActive).toBe(true);
    expect(sounds).toEqual(['correct', 'correct', 'correct', 'correct', 'nitro']);
    expect(vibrations).toEqual(['nitro']);
  });

  it('la llegada suena una sola vez, y nunca por los rivales (Llegada, Rival con nitro)', () => {
    const race = setup();
    act(() => race.controller.start());
    race.advance(3500);
    const { sounds, vibrations } = mount(race.controller);
    let answers = 0;
    let rivalNitros = 0;
    for (let i = 0; i < 2000 && race.controller.getState().snapshot.phase !== 'finished'; i++) {
      if (race.player().finishTimeMs === null) {
        race.answer(true);
        answers++;
      }
      race.advance(400, 100);
      rivalNitros += race.controller
        .getState()
        .snapshot.runners.filter((r) => r.id !== race.controller.playerId && r.nitroActive).length;
    }
    race.advance(5000, 100);
    expect(race.player().finishTimeMs).not.toBeNull();
    expect(rivalNitros).toBeGreaterThan(0);
    expect(sounds.filter((s) => s === 'finish')).toHaveLength(1);
    expect(vibrations.filter((v) => v === 'finish')).toHaveLength(1);
    expect(sounds.filter((s) => s === 'correct' || s === 'nitro')).toHaveLength(answers);
    expect(sounds).not.toContain('wrong');
  });

  it('al montar sobre una carrera en curso no repite sonidos viejos', () => {
    const race = setup();
    act(() => race.controller.start());
    race.advance(3500);
    race.answer(true);
    race.answer(false);
    const { sounds, vibrations } = mount(race.controller);
    race.advance(1000);
    expect(sounds).toEqual([]);
    expect(vibrations).toEqual([]);
  });

  it('al silenciar dejan de sonar y vibrar desde ese momento (Silenciar en medio de una carrera)', () => {
    const race = setup();
    act(() => race.controller.start());
    race.advance(3500);
    const { sounds, vibrations, hook } = mount(race.controller);
    race.answer(false);
    hook.rerender({ on: false });
    race.answer(false);
    race.answer(true);
    expect(sounds).toEqual(['wrong']);
    expect(vibrations).toEqual(['wrong']);
    hook.rerender({ on: true });
    expect(sounds).toEqual(['wrong']);
    race.answer(true);
    expect(sounds).toEqual(['wrong', 'correct']);
  });

  it('la reanudación tras una pausa local también cuenta y arranca', () => {
    const race = setup();
    act(() => race.controller.start());
    race.advance(5000);
    const { sounds } = mount(race.controller);
    act(() => race.controller.hold('hidden'));
    race.advance(1000);
    act(() => race.controller.release('hidden'));
    race.advance(3200);
    expect(sounds).toEqual(['countdown', 'countdown', 'countdown', 'go']);
  });
});
