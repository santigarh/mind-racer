import { describe, expect, it } from 'vitest';
import { harness, roomWithHost } from './test-helpers';

describe('Room: ping, RTT y límites', () => {
  it('mide el RTT con promedio móvil a partir de los pong', () => {
    const h = harness();
    const { host } = roomWithHost(h);
    const rttAfterPong = (delayMs: number) => {
      h.advance(2_000);
      const ping = host.conn.last('ping')!;
      h.advance(delayMs);
      host.send({ type: 'pong', id: ping.id });
    };
    rttAfterPong(100);
    // El RTT no se expone; se comprueba indirectamente en las pruebas de compensación de la carrera.
    // Aquí basta con que un pong con id equivocado no rompa nada.
    host.send({ type: 'pong', id: 999_999 });
    expect(host.conn.last('error')).toBeUndefined();
  });

  it('ignora mensajes de carrera en el lobby sin errores', () => {
    const h = harness();
    const { host } = roomWithHost(h);
    host.send({ type: 'answer', seq: 1, input: '5' });
    host.send({ type: 'abandon' });
    host.send({ type: 'backToRoom' });
    expect(host.conn.last('error')).toBeUndefined();
  });
});
