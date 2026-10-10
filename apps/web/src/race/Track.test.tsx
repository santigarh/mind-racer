import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RunnerState } from '@mind-racer/engine';
import { Track } from './Track';

const runner = (id: string, distance: number, position: number, extra: Partial<RunnerState> = {}): RunnerState => ({
  id,
  name: id === 'player' ? 'Ana' : `Bot ${id}`,
  kind: id === 'player' ? 'human' : 'bot',
  index: 0,
  chosenLevel: 1,
  distance,
  speed: 0,
  streak: 0,
  nitroActive: false,
  correct: 0,
  wrong: 0,
  level: 1,
  maxLevel: 1,
  finishTimeMs: null,
  position,
  challenge: null,
  lastAnswer: null,
  ...extra,
});

describe('Track', () => {
  it('ubica cada auto en proporción a la distancia recorrida', () => {
    render(
      <Track
        runners={[runner('player', 250, 2), runner('b1', 500, 1), runner('b2', 0, 3)]}
        distance={1000}
        playerId="player"
        botProfiles={{ b1: 'turbo', b2: 'tortuga' }}
      />,
    );
    const progressOf = (id: string) =>
      Number(screen.getByTestId(`car-${id}`).closest('li')!.style.getPropertyValue('--progress'));
    expect(progressOf('player')).toBeCloseTo(0.25);
    expect(progressOf('b1')).toBeCloseTo(0.5);
    expect(progressOf('b2')).toBe(0);
  });

  it('destaca el carril del jugador y muestra posición y nombre', () => {
    render(<Track runners={[runner('player', 100, 1)]} distance={1000} playerId="player" botProfiles={{}} />);
    const lane = screen.getByRole('listitem', { name: /Ana, 1\.º lugar, 10 %/ });
    expect(lane).toHaveAttribute('data-player', 'true');
    expect(lane).toHaveTextContent('Tú');
  });

  it('marca el nitro en el auto', () => {
    render(
      <Track runners={[runner('player', 100, 1, { nitroActive: true })]} distance={1000} playerId="player" botProfiles={{}} />,
    );
    expect(screen.getByTestId('car-player')).toHaveAttribute('data-nitro', 'true');
  });
});
