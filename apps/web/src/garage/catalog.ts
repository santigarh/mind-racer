import { CarProfile, Motorcycle, Scooter, Tractor, Truck, Van, type Icon } from '@phosphor-icons/react';
import type { CarBody, CarPaint } from '@mind-racer/protocol';

/** How an item is earned (design D2). `free` items are available from the start. */
export type Requirement =
  | { kind: 'free' }
  | { kind: 'races' | 'wins' | 'level' | 'streak'; target: number };

export interface BodyInfo {
  id: CarBody;
  name: string;
  icon: Icon;
  /** Some icons face left; they are mirrored so every car faces the finish line. */
  mirrored: boolean;
  requirement: Requirement;
}

export interface PaintInfo {
  id: CarPaint;
  name: string;
  /** CSS variable with the color, defined in global.css. */
  color: string;
  requirement: Requirement;
}

export const BODIES: readonly BodyInfo[] = [
  { id: 'classic', name: 'Clásico', icon: CarProfile, mirrored: false, requirement: { kind: 'free' } },
  { id: 'motorcycle', name: 'Moto', icon: Motorcycle, mirrored: false, requirement: { kind: 'races', target: 3 } },
  { id: 'scooter', name: 'Scooter', icon: Scooter, mirrored: false, requirement: { kind: 'wins', target: 1 } },
  { id: 'truck', name: 'Camión', icon: Truck, mirrored: false, requirement: { kind: 'level', target: 4 } },
  { id: 'van', name: 'Furgoneta', icon: Van, mirrored: false, requirement: { kind: 'streak', target: 3 } },
  { id: 'tractor', name: 'Tractor', icon: Tractor, mirrored: false, requirement: { kind: 'wins', target: 10 } },
];

export const PAINTS: readonly PaintInfo[] = [
  { id: 'amber', name: 'Ámbar', color: 'var(--paint-amber)', requirement: { kind: 'free' } },
  { id: 'red', name: 'Rojo', color: 'var(--paint-red)', requirement: { kind: 'races', target: 1 } },
  { id: 'purple', name: 'Morado', color: 'var(--paint-purple)', requirement: { kind: 'level', target: 3 } },
  { id: 'green', name: 'Verde', color: 'var(--paint-green)', requirement: { kind: 'streak', target: 1 } },
  { id: 'blue', name: 'Azul', color: 'var(--paint-blue)', requirement: { kind: 'races', target: 5 } },
  { id: 'cyan', name: 'Cian', color: 'var(--paint-cyan)', requirement: { kind: 'wins', target: 5 } },
  { id: 'white', name: 'Blanco', color: 'var(--paint-white)', requirement: { kind: 'races', target: 25 } },
  { id: 'gold', name: 'Dorado', color: 'var(--paint-gold)', requirement: { kind: 'streak', target: 7 } },
];

export const bodyInfo = (id: CarBody): BodyInfo => BODIES.find((b) => b.id === id) ?? BODIES[0]!;
export const paintInfo = (id: CarPaint): PaintInfo => PAINTS.find((p) => p.id === id) ?? PAINTS[0]!;
