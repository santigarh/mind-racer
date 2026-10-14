import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '@mind-racer/protocol';
import { harness } from './test-helpers';

const truck = { body: 'truck', paint: 'blue' } as const;
const moto = { body: 'motorcycle', paint: 'red' } as const;

const NO_CAR = Symbol('no car');

/** Papá creates a room with the blue truck; Lucía joins with `car`, or without one. */
function family(car: unknown = moto) {
  const h = harness();
  const papa = h.client();
  papa.send({ type: 'create', name: 'Papá', level: 8, car: truck });
  const code = papa.code!;
  const lucia = h.client();
  lucia.send({ type: 'join', code, name: 'Lucía', level: 2, ...(car === NO_CAR ? {} : { car }) });
  return { h, papa, lucia, code };
}

const carsIn = (players: { name: string; car?: unknown }[]) => Object.fromEntries(players.map((p) => [p.name, p.car]));

describe('el auto de cada persona en la sala', () => {
  it('todos ven el auto de cada persona en la sala y en la carrera (La familia ve los autos)', () => {
    const { papa, lucia } = family();
    for (const c of [papa, lucia]) {
      expect(carsIn(c.conn.last('room')!.players)).toEqual({ Papá: truck, Lucía: moto });
    }
    papa.send({ type: 'start' });
    const runners = lucia.conn.last('raceStart')!.runners;
    expect(carsIn(runners.filter((r) => r.kind === 'human'))).toEqual({ Papá: truck, Lucía: moto });
    expect(runners.filter((r) => r.kind === 'bot').every((r) => r.car === undefined && r.botProfile)).toBe(true);
  });

  it('sin auto entra con el clásico ámbar (Versión vieja del juego)', () => {
    const { papa } = family(NO_CAR);
    expect(carsIn(papa.conn.last('room')!.players).Lucía).toEqual(DEFAULT_CAR);
  });

  it('un auto que no existe no la rechaza: entra con el clásico ámbar (Auto inválido)', () => {
    const { papa, lucia } = family({ body: 'nave-espacial', paint: 'red' });
    expect(lucia.conn.last('error')).toBeUndefined();
    expect(lucia.id).toBeDefined();
    expect(carsIn(papa.conn.last('room')!.players).Lucía).toEqual(DEFAULT_CAR);
  });

  it('conserva el auto al reconectar (Reconexión)', () => {
    const { h, papa, lucia, code } = family();
    const token = lucia.conn.last('joined')!.token;
    lucia.disconnect();
    h.advance(5_000);
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(carsIn(papa.conn.last('room')!.players).Lucía).toEqual(moto);
  });

  it('dos personas pueden tener el mismo auto (Mismo auto)', () => {
    const { papa, lucia } = family(truck);
    expect(lucia.id).toBeDefined();
    expect(carsIn(papa.conn.last('room')!.players)).toEqual({ Papá: truck, Lucía: truck });
  });
});
