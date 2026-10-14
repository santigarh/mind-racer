import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { RaceConfig } from '@mind-racer/engine';
import { App } from '../App';
import { LocalRaceController } from '../game/LocalRaceController';
import { createProfile, type LevelStats } from '../progress/profile';
import { saveProfile } from '../progress/storage';

const stats = (races: number, wins: number): LevelStats => ({
  races,
  wins,
  bestTimeMs: 90_000,
  bestCorrectPerMinute: 1,
  bestAccuracy: 0.5,
});

/** App with a fake clock; races are short so the player can win them. */
function setup(config: Partial<RaceConfig>) {
  let wall = 0;
  const controllers: LocalRaceController[] = [];
  render(
    <App
      createController={(options) => {
        const c = new LocalRaceController({ ...options, config: { ...options.config, ...config }, now: () => wall, autoLoop: false });
        controllers.push(c);
        return c;
      }}
    />,
  );
  const current = () => controllers.at(-1)!;
  const advance = (ms: number, step = 16) =>
    act(() => {
      for (let t = 0; t < ms; t += step) {
        wall += step;
        current().tick();
      }
    });
  const winRace = () => {
    advance(3100);
    for (let i = 0; i < 40 && current().getState().snapshot.phase !== 'finished'; i++) {
      const me = current().getState().snapshot.runners.find((r) => r.id === current().playerId)!;
      if (me.finishTimeMs === null) {
        const [a, op, b] = screen.getByTestId('challenge-prompt').textContent!.split(' ');
        const input = screen.getByRole('textbox', { name: /respuesta/i });
        fireEvent.change(input, { target: { value: String(op === '+' ? +a! + +b! : +a! - +b!) } });
        fireEvent.submit(input.closest('form')!);
      }
      advance(300);
    }
    // Local races let the player see the results without waiting for the bots.
    const seeResults = screen.queryByRole('button', { name: 'Ver resultados' });
    if (seeResults) fireEvent.click(seeResults);
    act(() => vi.advanceTimersByTime(2000));
  };
  return { advance, winRace };
}

const badges = () => within(screen.getByRole('list', { name: 'Logros' }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(2026, 9, 13, 18, 0));
});
afterEach(() => vi.useRealTimers());

describe('aviso de desbloqueo en los resultados', () => {
  it('la primera victoria anuncia el scooter (Primera victoria)', () => {
    saveProfile({ ...createProfile('Lucía', 'beginner'), stats: { '1': stats(1, 0) } });
    const { winRace } = setup({ distance: 40 });
    fireEvent.click(screen.getByRole('button', { name: 'Correr en nivel 1' }));
    winRace();
    expect(screen.getByText('Ganaste la carrera')).toBeInTheDocument();
    expect(badges().getByText('Nuevo en el garaje: Scooter')).toBeInTheDocument();
    expect(badges().queryByText(/Nuevo en el garaje: Rojo/)).not.toBeInTheDocument();
  });

  it('el primer desafío diario anuncia lo que desbloquea (rojo por la carrera, verde por el desafío)', () => {
    saveProfile(createProfile('Leo', 'beginner'));
    const { advance } = setup({ distance: 1e6, timeLimitMs: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Correr el desafío' }));
    advance(3000 + 5000 + 100, 50);
    act(() => vi.advanceTimersByTime(2000));
    const names = badges()
      .getAllByText(/Nuevo en el garaje/)
      .map((el) => el.textContent);
    expect(names).toEqual(['Nuevo en el garaje: Rojo', 'Nuevo en el garaje: Verde']);
  });

  it('sin nada nuevo no hay aviso', () => {
    saveProfile({ ...createProfile('Ana', 'beginner'), stats: { '1': stats(30, 20) } });
    const { winRace } = setup({ distance: 40 });
    fireEvent.click(screen.getByRole('button', { name: 'Correr en nivel 1' }));
    winRace();
    expect(screen.getByText('Ganaste la carrera')).toBeInTheDocument();
    expect(screen.queryByText(/Nuevo en el garaje/)).not.toBeInTheDocument();
  });
});
