import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { applyRaceResult, createProfile } from '../progress/profile';
import { Menu } from './Menu';
import { Onboarding } from './Onboarding';

describe('Onboarding', () => {
  it('pide un nombre válido antes de continuar', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /empezar a correr/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('1 a 20 caracteres');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('crea el perfil con el punto de partida elegido', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    await userEvent.type(screen.getByLabelText(/nombre de piloto/i), 'Valentina');
    await userEvent.click(screen.getByText('Avanzado'));
    await userEvent.click(screen.getByRole('button', { name: /empezar a correr/i }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ name: 'Valentina', unlockedLevel: 7 }));
  });
});

describe('Menu', () => {
  const profile = { ...createProfile('Ana', 'beginner'), unlockedLevel: 3 };

  it('muestra bloqueados los niveles 4 a 10 y no permite elegirlos', async () => {
    const onStart = vi.fn();
    render(<Menu profile={profile} onStart={onStart} />);
    for (let level = 1; level <= 10; level++) {
      const button = screen.getByRole('button', { name: new RegExp(`^Nivel ${level}:`) });
      if (level <= 3) expect(button).toBeEnabled();
      else {
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleName(/bloqueado/);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: /^Nivel 7:/ }));
    await userEvent.click(screen.getByRole('button', { name: /correr en nivel/i }));
    expect(onStart).toHaveBeenCalledWith(3);
  });

  it('inicia la carrera en el nivel desbloqueado elegido', async () => {
    const onStart = vi.fn();
    render(<Menu profile={profile} onStart={onStart} />);
    await userEvent.click(screen.getByRole('button', { name: /^Nivel 2:/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Correr en nivel 2' }));
    expect(onStart).toHaveBeenCalledWith(2);
  });

  it('muestra los récords del nivel seleccionado', () => {
    const played = applyRaceResult(profile, {
      level: 3,
      position: 1,
      finished: true,
      finishTimeMs: 62_400,
      accuracy: 0.92,
      correctPerMinute: 21.3,
    }).profile;
    render(<Menu profile={{ ...played, unlockedLevel: 3 }} onStart={() => {}} />);
    expect(screen.getByText('1:02,4')).toBeInTheDocument();
    expect(screen.getByText('92 %')).toBeInTheDocument();
    expect(screen.getByText('21,3')).toBeInTheDocument();
  });
});
