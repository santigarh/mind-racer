import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoomQr, qrPath } from './RoomQr';

describe('QR de la sala', () => {
  it('dibuja el SVG del enlace de la sala, negro sobre blanco con margen', () => {
    render(<RoomQr url="https://mind-racer.santigarh-77.workers.dev/?sala=K7QF" />);
    const svg = screen.getByRole('img', { name: 'Código QR del enlace de la sala' });
    const [quiet, , box] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(quiet).toBe(-4);
    expect(svg.querySelector('rect')).toHaveAttribute('fill', '#ffffff');
    const path = svg.querySelector('path')!;
    expect(path).toHaveAttribute('fill', '#000000');
    expect(path.getAttribute('d')!.length).toBeGreaterThan(100);
    expect(box).toBe(qrPath('https://mind-racer.santigarh-77.workers.dev/?sala=K7QF').size + 8);
  });

  it('cada sala tiene su propio código', () => {
    expect(qrPath('http://192.168.1.12:5173/?sala=K7QF').path).not.toBe(qrPath('http://192.168.1.12:5173/?sala=AB2C').path);
  });
});
