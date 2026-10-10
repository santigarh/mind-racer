import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RaceConfig } from '@mind-racer/engine';
import { App } from './App';
import { RaceController, type RaceControllerOptions } from './game/RaceController';
import { createProfile } from './progress/profile';
import { PROFILE_KEY, saveProfile } from './progress/storage';

/** App wired to a fake clock and short races. */
function setup(config: Partial<RaceConfig> = { distance: 40 }) {
  let wall = 0;
  let nextSeed = 100;
  const controllers: RaceController[] = [];
  const seeds: number[] = [];
  const createController = (options: RaceControllerOptions) => {
    seeds.push(options.seed);
    const controller = new RaceController({ ...options, config, now: () => wall, autoLoop: false });
    controllers.push(controller);
    return controller;
  };
  render(<App createController={createController} makeSeed={() => nextSeed++} />);

  const current = () => controllers[controllers.length - 1]!;
  /** Advances the fake clock in 16 ms frames. */
  const advance = (ms: number) =>
    act(() => {
      for (let t = 0; t < ms; t += 16) {
        wall += 16;
        current().tick();
      }
    });
  const solve = () => {
    const prompt = screen.getByTestId('challenge-prompt').textContent!;
    return String(prompt.split(' + ').reduce((sum, n) => sum + Number(n), 0));
  };
  return { controllers, seeds, current, advance, solve };
}

function withProfile() {
  saveProfile(createProfile('Ana', 'beginner'));
  return localStorage.getItem(PROFILE_KEY);
}

describe('App', () => {
  it('sin perfil muestra el primer ingreso y luego el menú', async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/nombre de piloto/i), 'Leo');
    await userEvent.click(screen.getByRole('button', { name: /empezar a correr/i }));
    expect(screen.getByRole('heading', { name: /elige tu pista/i })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)!)).toMatchObject({ name: 'Leo', unlockedLevel: 1 });
  });

  it('carrera completa: cuenta regresiva, respuestas, meta del jugador y resultados', async () => {
    withProfile();
    const { advance, solve, seeds } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Correr en nivel 1' }));
    expect(screen.getByText('Prepárate')).toBeInTheDocument();
    advance(3000);
    expect(screen.getByText('¡Ya!')).toBeInTheDocument();

    const input = screen.getByLabelText('Tu respuesta');
    for (let i = 0; i < 4 && screen.queryByLabelText('Tu respuesta'); i++) {
      fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: solve() } });
      advance(32);
    }
    advance(2000);
    expect(input).not.toBeInTheDocument();
    // El jugador llegó: se oculta la entrada y se muestra su llegada mientras los bots siguen.
    expect(screen.getByText(/Llegaste 1\.º en/)).toBeInTheDocument();
    expect(screen.getByTestId('hud-position')).toHaveTextContent('1.º de 4');

    advance(60_000);
    expect(await screen.findByRole('heading', { name: 'Ganaste la carrera' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Desbloqueaste el nivel 2')).toBeInTheDocument();
    expect(screen.getByText('Nuevo récord de tiempo')).toBeInTheDocument();
    const ranking = screen.getByRole('table');
    expect(within(ranking).getAllByRole('row')).toHaveLength(5);
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)!)).toMatchObject({ unlockedLevel: 2 });

    await userEvent.click(screen.getByRole('button', { name: /correr de nuevo/i }));
    expect(screen.getByText('Carrera · nivel 1')).toBeInTheDocument();
    expect(seeds).toHaveLength(2);
    expect(seeds[1]).not.toBe(seeds[0]);
  });

  it('Escape abre la confirmación; salir no cambia las estadísticas', async () => {
    const before = withProfile();
    const { advance, current } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Correr en nivel 1' }));
    advance(5000);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog', { name: /salir de la carrera/i })).toBeInTheDocument();
    expect(current().getState().paused).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Salir al menú' }));
    expect(screen.getByRole('heading', { name: /elige tu pista/i })).toBeInTheDocument();
    expect(localStorage.getItem(PROFILE_KEY)).toBe(before);
  });

  it('seguir corriendo reanuda con cuenta regresiva', async () => {
    withProfile();
    const { advance, current } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Correr en nivel 1' }));
    advance(5000);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Seguir corriendo' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Volvemos a correr')).toBeInTheDocument();
    advance(3100);
    expect(current().getState().paused).toBe(false);
  });

  it('indicadores en vivo: velocidad, racha, tiempo y nivel', async () => {
    withProfile();
    const { advance, solve } = setup({ distance: 5000 });
    await userEvent.click(screen.getByRole('button', { name: 'Correr en nivel 1' }));
    advance(3000);
    for (let i = 0; i < 2; i++) {
      fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: solve() } });
      advance(1000);
    }
    expect(Number(screen.getByTestId('hud-speed').textContent!.split(' ')[0])).toBeGreaterThan(0);
    expect(screen.getByTestId('hud-streak')).toHaveTextContent('2');
    expect(screen.getByTestId('hud-time')).toHaveTextContent(/^0:02,/);
    expect(screen.getByTestId('hud-level')).toHaveTextContent('1');
    expect(screen.getByTestId('answer-feedback')).toHaveTextContent('Correcto');
  });
});
