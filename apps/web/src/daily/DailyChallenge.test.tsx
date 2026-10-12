import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { RaceConfig } from '@mind-racer/engine';
import { App } from '../App';
import { LocalRaceController, type LocalRaceControllerOptions } from '../game/LocalRaceController';
import { createProfile } from '../progress/profile';
import { saveProfile } from '../progress/storage';
import { DAILY_KEY, EMPTY_DAILY, dailySeed, loadDaily, recordDaily, saveDaily, type DailyResult } from './daily';
import { DailyCard } from './DailyCard';

const TODAY = '2026-10-11';
const YESTERDAY = '2026-10-10';

/** App with a fake race clock; `config` is merged over what the app asks for. */
function setup(config: Partial<RaceConfig> = { distance: 40 }) {
  let wall = 0;
  const created: LocalRaceControllerOptions[] = [];
  const controllers: LocalRaceController[] = [];
  render(
    <App
      createController={(options) => {
        created.push(options);
        const controller = new LocalRaceController({
          ...options,
          config: { ...options.config, ...config },
          now: () => wall,
          autoLoop: false,
        });
        controllers.push(controller);
        return controller;
      }}
    />,
  );
  const current = () => controllers[controllers.length - 1]!;
  const advance = (ms: number, step = 16) =>
    act(() => {
      for (let t = 0; t < ms; t += step) {
        wall += step;
        current().tick();
      }
    });
  /** The results screen appears after a short delay (setTimeout). */
  const showResults = () => act(() => vi.advanceTimersByTime(2000));
  const solve = () => {
    const [a, op, b] = screen.getByTestId('challenge-prompt').textContent!.split(' ');
    return String(op === '+' ? Number(a) + Number(b) : Number(a) - Number(b));
  };
  const answer = (value: string) => {
    const input = screen.getByRole('textbox', { name: /respuesta/i });
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest('form')!);
  };
  return { created, current, advance, solve, answer, showResults };
}

function withProfile(unlockedLevel = 1) {
  saveProfile({ ...createProfile('Lucía', 'beginner'), unlockedLevel });
}

const result = (extra: Partial<DailyResult> = {}): DailyResult => ({
  level: 3,
  position: 1,
  finished: true,
  finishTimeMs: 42_300,
  correct: 18,
  wrong: 2,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 11, 18, 48));
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of ['share', 'clipboard']) Object.defineProperty(navigator, key, { configurable: true, value: undefined });
});

const card = () => within(screen.getByRole('region', { name: 'Desafío de hoy' }));

describe('desafío de hoy en el menú', () => {
  it('ofrece el nivel máximo desbloqueado y solo los desbloqueados (Nivel por defecto)', () => {
    withProfile(6);
    setup();
    const select = card().getByLabelText('Nivel') as HTMLSelectElement;
    expect(select.value).toBe('6');
    expect([...select.options].map((o) => o.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(card().getByText('Empieza tu racha hoy')).toBeInTheDocument();
  });

  it('en otro nivel corre la carrera del día de ese nivel, sin adaptación (Elegir un nivel más bajo)', () => {
    withProfile(6);
    const { created } = setup();
    fireEvent.change(card().getByLabelText('Nivel'), { target: { value: '3' } });
    fireEvent.click(card().getByRole('button', { name: 'Correr el desafío' }));
    expect(created.at(-1)).toMatchObject({
      seed: dailySeed(TODAY, 3),
      level: 3,
      config: { adaptiveDifficulty: false },
    });
    expect(screen.getByRole('heading', { name: 'Desafío diario · nivel 3' })).toBeInTheDocument();
  });

  it('muestra la racha que sigue viva y pide mantenerla (Racha pendiente hoy)', () => {
    withProfile();
    saveDaily({ ...EMPTY_DAILY, streak: 4, bestStreak: 4, lastDate: YESTERDAY });
    setup();
    expect(card().getByText(/Racha de 4 días: córrelo hoy para mantenerla/)).toBeInTheDocument();
  });

  it('hecho hoy: resultado, racha, cuánto falta, y sin botón para correrlo otra vez (Desafío terminado)', () => {
    withProfile(3);
    saveDaily(recordDaily({ ...EMPTY_DAILY, streak: 4, bestStreak: 7, lastDate: YESTERDAY }, TODAY, result()));
    setup();
    expect(card().getByText('Hecho hoy')).toBeInTheDocument();
    expect(card().getByText('Nivel 3 · 1.º · 0:42,3 · 18/20 correctas')).toBeInTheDocument();
    expect(card().getByText(/Racha de 5 días/, { selector: 'p' })).toBeInTheDocument();
    expect(card().getByText(/mejor 7/)).toBeInTheDocument();
    expect(card().getByText('Nuevo desafío en 5 h 12 min')).toBeInTheDocument();
    expect(card().queryByRole('button', { name: 'Correr el desafío' })).not.toBeInTheDocument();
  });

  it('a la medianoche pasa solo al desafío del nuevo día', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 11, 23, 59));
    withProfile(3);
    saveDaily(recordDaily(EMPTY_DAILY, TODAY, result()));
    render(<DailyCard profile={{ ...createProfile('Lucía', 'beginner'), unlockedLevel: 3 }} daily={loadDaily()} onStart={() => {}} />);
    expect(card().getByText('Hecho hoy')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2 * 60_000));
    expect(card().getByRole('button', { name: 'Correr el desafío' })).toBeInTheDocument();
    expect(card().getByText('lun 12 oct')).toBeInTheDocument();
  });
});

describe('correr el desafío', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 11, 18, 48));
  });

  it('salir a mitad no cuenta y se puede volver a intentar (Salir a mitad)', () => {
    withProfile();
    const { advance } = setup();
    fireEvent.click(card().getByRole('button', { name: 'Correr el desafío' }));
    advance(4000);
    fireEvent.click(screen.getByRole('button', { name: /salir/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('podrás intentar el desafío de nuevo hoy');
    fireEvent.click(screen.getByRole('button', { name: 'Salir al menú' }));
    expect(card().getByRole('button', { name: 'Correr el desafío' })).toBeInTheDocument();
    expect(localStorage.getItem(DAILY_KEY)).toBeNull();
  });

  it('si se acaba el tiempo cuenta como hecho, sin llegar (Se acaba el tiempo)', () => {
    withProfile();
    const { advance, showResults } = setup({ distance: 1e6, timeLimitMs: 5000 });
    fireEvent.click(card().getByRole('button', { name: 'Correr el desafío' }));
    advance(3000 + 5000 + 100, 50);
    showResults();
    expect(screen.getByText('Desafío diario · Nivel 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Correr de nuevo' })).not.toBeInTheDocument();
    expect(loadDaily().results[TODAY]).toMatchObject({ level: 1, finished: false, finishTimeMs: null });
    fireEvent.click(screen.getByRole('button', { name: 'Volver al menú' }));
    expect(card().getByText(/Sin llegar/, { selector: 'p' })).toBeInTheDocument();
  });

  it('cuenta como carrera normal: desbloquea el siguiente nivel y suma la racha (Desbloqueo desde el desafío)', () => {
    withProfile(1);
    saveDaily({ ...EMPTY_DAILY, streak: 2, bestStreak: 2, lastDate: YESTERDAY });
    const { advance, solve, answer, current, showResults } = setup({ distance: 40 });
    fireEvent.click(card().getByRole('button', { name: 'Correr el desafío' }));
    advance(3100);
    for (let i = 0; i < 40 && current().getState().snapshot.phase !== 'finished'; i++) {
      const player = current().getState().snapshot.runners.find((r) => r.id === current().playerId)!;
      if (player.finishTimeMs === null) answer(solve());
      advance(300);
    }
    showResults();
    expect(screen.getByText('Desbloqueaste el nivel 2')).toBeInTheDocument();
    expect(screen.getByText('Racha de 3 días')).toBeInTheDocument();
    // jsdom has no share menu or clipboard: the result shows in a field to copy by hand.
    const shared = screen.getByRole('textbox', { name: 'Resultado para copiar' }) as HTMLTextAreaElement;
    expect(shared.value).toContain('🔥 Racha de 3 días');
    expect(loadDaily()).toMatchObject({ streak: 3, lastDate: TODAY });
  });
});

describe('compartir el resultado', () => {
  function doneCard() {
    withProfile(3);
    saveDaily(recordDaily({ ...EMPTY_DAILY, streak: 4, bestStreak: 4, lastDate: YESTERDAY }, TODAY, result()));
    setup();
  }
  const TEXT = 'Mind Racer · Desafío del 11 oct · Nivel 3\n🏁 1.º · 0:42,3 · 18/20\n🔥 Racha de 5 días';

  it('abre el menú de compartir con el texto y la dirección del juego (Compartir por mensaje)', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    doneCard();
    await act(async () => fireEvent.click(card().getByRole('button', { name: 'Compartir resultado' })));
    expect(share).toHaveBeenCalledWith({ title: 'Mind Racer', text: TEXT, url: `${window.location.origin}/` });
  });

  it('sin menú de compartir copia el texto y avisa (Computadora)', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    doneCard();
    await act(async () => fireEvent.click(card().getByRole('button', { name: 'Compartir resultado' })));
    expect(writeText).toHaveBeenCalledWith(`${TEXT}\n${window.location.origin}/`);
    expect(card().getByText('Resultado copiado')).toBeInTheDocument();
  });

  it('sin ninguna de las dos, muestra el texto para copiarlo a mano', () => {
    doneCard();
    expect(card().queryByRole('button', { name: 'Compartir resultado' })).not.toBeInTheDocument();
    expect(card().getByRole('textbox', { name: 'Resultado para copiar' })).toHaveValue(`${TEXT}\n${window.location.origin}/`);
  });
});
