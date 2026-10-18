import { afterEach, describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import { SESSION_KEY } from '../net/NetClient';
import { classRoomMessage, classSetup, student, teacherPlayer } from './testHarness';

afterEach(() => window.history.replaceState(null, '', '/'));

function inClassLobby() {
  const ctx = classSetup({ link: 'K7QF' });
  act(() => ctx.net.socket.open());
  ctx.server(
    { type: 'joined', code: 'K7QF', playerId: 'p2', token: 't' },
    classRoomMessage([teacherPlayer(), student('p2', 'Lucía')]),
  );
  expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
  return ctx;
}

describe('alumno fuera de la sala de clase', () => {
  it('si la profesora lo quita, vuelve a "Jugar con amigos" con el aviso y sin sesión guardada', () => {
    const ctx = inClassLobby();
    ctx.server({ type: 'error', code: 'removed', message: 'La profesora te quitó de la sala' });
    expect(screen.getByRole('heading', { name: 'Jugar con amigos' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('La profesora te quitó de la sala');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('si la profesora cierra la sala, vuelve a "Jugar con amigos" con el aviso', () => {
    const ctx = inClassLobby();
    ctx.server({ type: 'error', code: 'room-closed', message: 'La profesora cerró la sala' });
    expect(screen.getByRole('heading', { name: 'Jugar con amigos' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('La profesora cerró la sala');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('lobby del alumno en una sala de clase', () => {
  it('cuenta solo alumnos sobre 40, no lista a la profesora y espera a que ella inicie', () => {
    inClassLobby();
    expect(screen.getByRole('heading', { name: /Alumnos/ })).toHaveTextContent('1 de 40');
    expect(screen.queryByRole('listitem', { name: /Profe Ana/ })).not.toBeInTheDocument();
    expect(screen.getByText('Esperando a que la profesora inicie.')).toBeInTheDocument();
    expect(screen.queryByText(/se llenan con bots/)).not.toBeInTheDocument();
  });
});
