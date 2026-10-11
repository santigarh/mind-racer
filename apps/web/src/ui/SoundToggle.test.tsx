import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HapticName } from '../audio/haptics';
import type { SoundName } from '../audio/sfx';
import { LocalRaceController } from '../game/LocalRaceController';
import { RaceScreen } from '../race/RaceScreen';
import { SETTINGS_KEY, createSettingsStore } from '../settings/settings';
import { SoundToggle } from './SoundToggle';

describe('interruptor de sonido', () => {
  it('silencia en medio de una carrera: desde ese momento no suena ni vibra', async () => {
    const user = userEvent.setup();
    let wall = 1000;
    const controller = new LocalRaceController({ seed: 7, level: 1, playerName: 'Ana', now: () => wall, autoLoop: false });
    const sounds: SoundName[] = [];
    const vibrations: HapticName[] = [];
    render(
      <RaceScreen
        controller={controller}
        onFinish={() => {}}
        onAbandon={() => {}}
        feedback={{
          sfx: { play: (n) => sounds.push(n), unlockOnFirstInteraction: () => {} },
          haptics: { vibrate: (n) => vibrations.push(n) },
        }}
      />,
    );
    act(() => controller.start());
    for (let t = 0; t < 3500; t += 50) {
      wall += 50;
      act(() => controller.tick());
    }
    act(() => void controller.submit('-1'));
    expect(sounds.at(-1)).toBe('wrong');
    expect(vibrations).toEqual(['wrong']);
    const before = sounds.length;

    const toggle = screen.getByRole('button', { name: 'Silenciar' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    act(() => void controller.submit('-1'));
    expect(sounds).toHaveLength(before);
    expect(vibrations).toEqual(['wrong']);
    controller.dispose();
  });

  it('recuerda el silencio al volver a abrir el juego (Preferencia recordada)', async () => {
    const user = userEvent.setup();
    const first = render(<SoundToggle store={createSettingsStore(localStorage)} />);
    await user.click(screen.getByRole('button', { name: 'Silenciar' }));
    first.unmount();
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({ sound: false });

    render(<SoundToggle store={createSettingsStore(localStorage)} />);
    const toggle = screen.getByRole('button', { name: 'Silenciar' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('title', 'Activar sonido');
  });

  it('los interruptores de distintas pantallas se mantienen sincronizados', async () => {
    const user = userEvent.setup();
    const store = createSettingsStore(null);
    render(
      <>
        <SoundToggle store={store} />
        <SoundToggle store={store} />
      </>,
    );
    const [a, b] = screen.getAllByRole('button', { name: 'Silenciar' });
    await user.click(a!);
    expect(b).toHaveAttribute('aria-pressed', 'true');
  });
});
