import { describe, expect, it } from 'vitest';
import { harness, roomWithHost } from './test-helpers';

describe('Room: lobby', () => {
  it('código válido: unirse en minúsculas y todos lo ven aparecer', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    const guest = h.client();
    guest.send({ type: 'join', code: code.toLowerCase(), name: 'Lucía', level: 2 });
    expect(guest.code).toBe(code);
    for (const c of [host, guest]) {
      expect(c.conn.last('room')!.players.map((p) => [p.name, p.level])).toEqual([
        ['Papá', 8],
        ['Lucía', 2],
      ]);
    }
  });

  it('cuarto jugador: entra y la sala queda llena; un quinto ve "La sala está llena"', () => {
    const h = harness();
    const { code } = roomWithHost(h);
    const guests = ['A', 'B', 'C'].map((name) => {
      const c = h.client();
      c.send({ type: 'join', code, name, level: 1 });
      return c;
    });
    expect(guests[2]!.code).toBe(code);
    expect(guests[2]!.conn.last('room')!.players).toHaveLength(4);
    const fifth = h.client();
    fifth.send({ type: 'join', code, name: 'E', level: 1 });
    expect(fifth.conn.last('error')).toMatchObject({ code: 'room-full', message: 'La sala está llena' });
    expect(fifth.conn.last('joined')).toBeUndefined();
  });

  it('otro jugador cambia de nivel y todos lo ven', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    const guest = h.client();
    guest.send({ type: 'join', code, name: 'Lucía', level: 3 });
    guest.send({ type: 'setLevel', level: 5 });
    expect(host.conn.last('room')!.players.find((p) => p.id === guest.id)!.level).toBe(5);
  });

  it('el anfitrión se va: pasa al que entró primero entre los restantes', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    const first = h.client();
    first.send({ type: 'join', code, name: 'Primero', level: 2 });
    const second = h.client();
    second.send({ type: 'join', code, name: 'Segundo', level: 2 });
    host.send({ type: 'leave' });
    for (const c of [first, second]) {
      const room = c.conn.last('room')!;
      expect(room.hostId).toBe(first.id);
      expect(room.players.map((p) => p.name)).toEqual(['Primero', 'Segundo']);
    }
  });

  it('desconectado en el lobby: se marca y sale tras 30 s, pasando el anfitrión', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    const guest = h.client();
    guest.send({ type: 'join', code, name: 'Lucía', level: 2 });
    host.disconnect();
    expect(guest.conn.last('room')!.players[0]!.connected).toBe(false);
    h.advance(29_000);
    expect(guest.conn.last('room')!.players).toHaveLength(2);
    h.advance(2_000);
    const room = guest.conn.last('room')!;
    expect(room.players.map((p) => p.name)).toEqual(['Lucía']);
    expect(room.hostId).toBe(guest.id);
  });

  it('mensaje inválido: se rechaza y la sala sigue funcionando para todos', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    const guest = h.client();
    guest.send({ type: 'join', code, name: 'Lucía', level: 2 });
    guest.send({ type: 'setLevel', level: 15 });
    expect(guest.conn.last('error')?.code).toBe('invalid-message');
    h.manager.message(guest.conn, 'no es json');
    expect(guest.conn.last('error')?.code).toBe('invalid-message');
    host.send({ type: 'setLevel', level: 7 });
    expect(guest.conn.last('room')!.players.map((p) => p.level)).toEqual([7, 2]);
  });

  it('rechaza nombres vacíos o largos al crear y al unirse', () => {
    const h = harness();
    const c = h.client();
    c.send({ type: 'create', name: '  ', level: 1 });
    expect(c.conn.last('error')?.code).toBe('invalid-message');
    c.send({ type: 'create', name: 'x'.repeat(21), level: 1 });
    expect(c.conn.last('error')?.code).toBe('invalid-message');
    expect(h.manager.roomCount).toBe(0);
  });

  it('envía ping cada 2 s a cada persona conectada', () => {
    const h = harness();
    const { host } = roomWithHost(h);
    h.advance(6_000);
    expect(host.conn.all('ping').length).toBe(3);
  });
});

describe('Room: tablas en una sala familiar', () => {
  it('no envía tablas y rechaza setTables, también del anfitrión', () => {
    const h = harness();
    const { host } = roomWithHost(h);
    expect(host.conn.last('room')!).not.toHaveProperty('tables');
    host.send({ type: 'setTables', tables: { tables: [7], divisions: false } });
    expect(host.conn.last('error')?.code).toBe('not-host');
    host.send({ type: 'start' });
    expect(host.conn.last('raceStart')!.tables).toBeUndefined();
  });
});
