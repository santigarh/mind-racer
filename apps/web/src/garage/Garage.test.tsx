import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { createProfile, type LevelStats } from '../progress/profile';
import { saveProfile } from '../progress/storage';
import { GARAGE_KEY } from './choice';

const stats = (races: number, wins: number): LevelStats => ({
  races,
  wins,
  bestTimeMs: 60_000,
  bestCorrectPerMinute: 10,
  bestAccuracy: 0.9,
});

async function openGarage(races: number, wins: number) {
  saveProfile({ ...createProfile('Lucía', 'beginner'), stats: { '1': stats(races, wins) } });
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Garaje' }));
}

const group = (name: 'Vehículos' | 'Pinturas') => within(screen.getByRole('group', { name }));

describe('garaje', () => {
  it('se abre desde el menú y un jugador nuevo solo tiene el clásico ámbar (Primer día)', async () => {
    await openGarage(0, 0);
    expect(screen.getByRole('heading', { name: 'Garaje' })).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Tu auto' })).toHaveTextContent('Clásico · Ámbar');
    const enabled = [...group('Vehículos').getAllByRole('button'), ...group('Pinturas').getAllByRole('button')]
      .filter((b) => !(b as HTMLButtonElement).disabled)
      .map((b) => b.getAttribute('aria-label'));
    expect(enabled).toEqual(['Clásico', 'Ámbar']);
  });

  it('elegir una pintura desbloqueada cambia la vista previa y se guarda (Elegir pintura)', async () => {
    await openGarage(1, 0);
    const red = group('Pinturas').getByRole('button', { name: 'Rojo' });
    await userEvent.click(red);
    expect(red).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('figure', { name: 'Tu auto' })).toHaveTextContent('Clásico · Rojo');
    expect(JSON.parse(localStorage.getItem(GARAGE_KEY)!)).toEqual({ version: 1, body: 'classic', paint: 'red' });
  });

  it('lo bloqueado muestra cuánto falta y no se puede elegir (Ver cuánto falta)', async () => {
    await openGarage(2, 1);
    const tractor = group('Vehículos').getByRole('button', { name: /Tractor \(bloqueado\)/ });
    expect(tractor).toHaveAccessibleName('Tractor (bloqueado): Gana 10 carreras · 1/10');
    expect(tractor).toBeDisabled();
    await userEvent.click(tractor);
    expect(screen.getByRole('figure', { name: 'Tu auto' })).toHaveTextContent('Clásico · Ámbar');
    expect(localStorage.getItem(GARAGE_KEY)).toBeNull();
    // With 1 win the scooter is already available.
    expect(group('Vehículos').getByRole('button', { name: 'Scooter' })).toBeEnabled();
  });

  it('vuelve al menú', async () => {
    await openGarage(0, 0);
    await userEvent.click(screen.getByRole('button', { name: /volver al menú/i }));
    expect(screen.getByRole('heading', { name: /elige tu pista/i })).toBeInTheDocument();
  });
});

describe('garaje: clics seguidos', () => {
  it('elegir vehículo y pintura muy rápido conserva ambos', async () => {
    saveProfile({ ...createProfile('Lucía', 'beginner'), stats: { '1': stats(1, 1) } });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Garaje' }));
    const scooter = within(screen.getByRole('group', { name: 'Vehículos' })).getByRole('button', { name: 'Scooter' });
    const red = within(screen.getByRole('group', { name: 'Pinturas' })).getByRole('button', { name: 'Rojo' });
    // Both clicks before React re-renders.
    scooter.click();
    red.click();
    expect(JSON.parse(localStorage.getItem(GARAGE_KEY)!)).toEqual({ version: 1, body: 'scooter', paint: 'red' });
  });
});
