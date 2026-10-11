import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomPlayer } from '@mind-racer/protocol';
import { Lobby } from './Lobby';

const player = (id: string, name: string, level: number): RoomPlayer => ({
  id,
  name,
  level,
  connected: true,
  status: 'lobby',
});

function renderLobby() {
  return render(
    <Lobby
      room={{ type: 'room', code: 'K7QF', phase: 'lobby', hostId: 'p1', players: [player('p1', 'Papá', 8)] }}
      playerId="p1"
      unlockedLevel={8}
      reconnecting={false}
      onSetLevel={() => {}}
      onStart={() => {}}
      onLeave={() => {}}
    />,
  );
}

/** jsdom has neither API; each test adds what that browser would have. */
function stubNavigator(apis: { share?: unknown; clipboard?: unknown }) {
  for (const [key, value] of Object.entries(apis)) {
    Object.defineProperty(navigator, key, { configurable: true, value });
  }
}

afterEach(() => {
  stubNavigator({ share: undefined, clipboard: undefined });
  vi.useRealTimers();
});

const LINK = `${window.location.origin}/?sala=K7QF`;

describe('compartir la sala', () => {
  it('muestra el QR y el enlace de la sala (QR para la familia)', () => {
    renderLobby();
    expect(screen.getByRole('img', { name: 'Código QR del enlace de la sala' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Enlace de la sala' })).toHaveValue(LINK);
  });

  it('abre el menú de compartir del celular con el enlace y una invitación (Compartir por mensaje)', async () => {
    const share = vi.fn(async () => {});
    stubNavigator({ share });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    expect(share).toHaveBeenCalledWith({ title: 'Mind Racer', text: '¡Ven a correr conmigo! Sala K7QF', url: LINK });
  });

  it('si la persona cierra el menú de compartir no pasa nada', async () => {
    const writeText = vi.fn(async () => {});
    stubNavigator({
      share: vi.fn(async () => {
        throw new DOMException('cancelado', 'AbortError');
      }),
      clipboard: { writeText },
    });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText('Enlace copiado')).not.toBeInTheDocument();
  });

  it('sin menú de compartir copia el enlace y avisa durante 2 s (Computadora sin menú de compartir)', async () => {
    const writeText = vi.fn(async () => {});
    stubNavigator({ clipboard: { writeText } });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(screen.getByText('Enlace copiado')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.queryByText('Enlace copiado')).not.toBeInTheDocument();
  });

  it('si el navegador no deja copiar, pide copiarlo del campo', async () => {
    stubNavigator({
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
    });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    expect(screen.getByText(/selecciona el enlace y cópialo/)).toBeInTheDocument();
  });

  it('por http en la red de casa, sin ninguna de las dos, el enlace queda a la vista para copiarlo a mano', async () => {
    renderLobby();
    expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: 'Enlace de la sala' });
    await userEvent.click(field);
    expect((field as HTMLInputElement).selectionStart).toBe(0);
    expect((field as HTMLInputElement).selectionEnd).toBe(LINK.length);
  });
});
