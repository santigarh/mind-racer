import { describe, expect, it } from 'vitest';
import { isRoomCode } from '@mind-racer/protocol';
import { RoomManager } from './RoomManager';
import { FakeConn, harness, roomWithHost } from './test-helpers';

describe('RoomManager', () => {
  it('sala nueva: código válido, anfitrión y único jugador', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    expect(isRoomCode(code)).toBe(true);
    const room = host.conn.last('room')!;
    expect(room).toMatchObject({ code, phase: 'lobby', hostId: host.id });
    expect(room.players).toEqual([
      { id: host.id, name: 'Papá', level: 8, connected: true, status: 'lobby', car: { body: 'classic', paint: 'amber' } },
    ]);
    expect(h.manager.getRoom(code)).toBeDefined();
  });

  it('los códigos son únicos entre salas abiertas', () => {
    const h = harness();
    const codes = new Set(Array.from({ length: 150 }, () => roomWithHost(h).code));
    expect(codes.size).toBe(150);
    expect(h.manager.roomCount).toBe(150);
  });

  it('código inexistente: "No encontramos esa sala"', () => {
    const h = harness();
    const guest = h.client();
    guest.send({ type: 'join', code: 'ZZZZ', name: 'Leo', level: 2 });
    expect(guest.conn.last('error')).toMatchObject({ code: 'room-not-found', message: 'No encontramos esa sala' });
    expect(guest.conn.last('joined')).toBeUndefined();
  });

  it('sala vacía: se cierra tras 60 s sin conexiones y el código deja de funcionar', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    host.send({ type: 'leave' });
    h.advance(59_000);
    expect(h.manager.getRoom(code)).toBeDefined();
    h.advance(1_100);
    expect(h.manager.getRoom(code)).toBeUndefined();
    const late = h.client();
    late.send({ type: 'join', code, name: 'Leo', level: 2 });
    expect(late.conn.last('error')?.code).toBe('room-not-found');
  });

  it('una sala con alguien conectado no se cierra', () => {
    const h = harness();
    const { code } = roomWithHost(h);
    h.advance(120_000);
    expect(h.manager.getRoom(code)).toBeDefined();
  });

  it('respeta el tope de salas abiertas', () => {
    const manager = new RoomManager({ maxRooms: 2 });
    const conns = [new FakeConn(), new FakeConn(), new FakeConn()];
    for (const conn of conns) {
      manager.connect(conn);
      manager.message(conn, JSON.stringify({ type: 'create', name: 'A', level: 1 }));
    }
    expect(conns[2]!.last('error')?.code).toBe('too-many-rooms');
    expect(manager.roomCount).toBe(2);
  });

  it('mensajes de sala sin estar en una sala responden "not-in-room"', () => {
    const h = harness();
    const c = h.client();
    c.send({ type: 'setLevel', level: 3 });
    expect(c.conn.last('error')?.code).toBe('not-in-room');
  });
});
