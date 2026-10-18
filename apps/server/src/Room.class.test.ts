import { describe, expect, it } from 'vitest';
import { harness, roomWithHost } from './test-helpers';

type H = ReturnType<typeof harness>;

/** A class room: Profe Ana plus `students` students called Alumno 1, 2… */
function classRoom(h: H, students = 0) {
  const teacher = h.client();
  teacher.send({ type: 'create', name: 'Profe Ana', level: 5, mode: 'class' });
  const code = teacher.code!;
  const kids = Array.from({ length: students }, (_, i) => {
    const kid = h.client();
    kid.send({ type: 'join', code, name: `Alumno ${i + 1}`, level: 1 + (i % 3) });
    return kid;
  });
  return { teacher, code, kids };
}

describe('sala de clase: creación y capacidad', () => {
  it('la profesora abre la sala como anfitriona, sin ocupar lugar de alumno (La profesora abre la sala)', () => {
    const h = harness();
    const { teacher } = classRoom(h);
    const room = teacher.conn.last('room')!;
    expect(room).toMatchObject({ mode: 'class', hostId: teacher.id });
    expect(room.players).toEqual([expect.objectContaining({ name: 'Profe Ana', role: 'teacher' })]);
  });

  it('admite 40 alumnos y rechaza al 41 (Alumno 41)', () => {
    const h = harness();
    const { teacher, code, kids } = classRoom(h, 40);
    expect(kids.every((k) => k.id)).toBe(true);
    expect(teacher.conn.last('room')!.players).toHaveLength(41);
    const late = h.client();
    late.send({ type: 'join', code, name: 'Alumno 41', level: 1 });
    expect(late.conn.last('error')).toMatchObject({ code: 'room-full', message: 'La sala está llena' });
  });

  it('una sala familiar sigue llena con 4 y una de clase admite al quinto (Cuarto jugador, Sala de clase)', () => {
    const h = harness();
    const { code } = roomWithHost(h);
    const family = Array.from({ length: 4 }, (_, i) => {
      const c = h.client();
      c.send({ type: 'join', code, name: `Primo ${i}`, level: 2 });
      return c;
    });
    expect(family.slice(0, 3).every((c) => c.id)).toBe(true);
    expect(family[3]!.conn.last('error')?.code).toBe('room-full');
    expect(family[0]!.conn.last('room')!.mode).toBe('family');

    const { kids } = classRoom(h, 5);
    expect(kids[4]!.id).toBeDefined();
  });
});

describe('carrera de clase', () => {
  it('corren solo los alumnos, sin bots; la profesora mira sin recibir desafíos (Sin bots)', () => {
    const h = harness();
    const { teacher, kids } = classRoom(h, 3);
    teacher.send({ type: 'start' });
    const start = kids[0]!.conn.last('raceStart')!;
    expect(start.runners.map((r) => r.name)).toEqual(['Alumno 1', 'Alumno 2', 'Alumno 3']);
    expect(start.runners.every((r) => r.kind === 'human')).toBe(true);
    expect(teacher.conn.last('raceStart')).toEqual(start);
    h.advance(4_000);
    expect(teacher.conn.all('state').length).toBeGreaterThan(0);
    expect(teacher.conn.all('challenge')).toHaveLength(0);
    expect(kids[0]!.conn.all('challenge').length).toBeGreaterThan(0);
  });

  it('sin alumnos no empieza, y un alumno no puede iniciarla (Sala sin alumnos)', () => {
    const h = harness();
    const { teacher, code } = classRoom(h);
    teacher.send({ type: 'start' });
    expect(teacher.conn.last('raceStart')).toBeUndefined();
    const kid = h.client();
    kid.send({ type: 'join', code, name: 'Leo', level: 1 });
    kid.send({ type: 'start' });
    expect(kid.conn.last('error')?.code).toBe('not-host');
    expect(kid.conn.last('raceStart')).toBeUndefined();
  });

  it('la siguiente carrera incluye a los alumnos que todavía miran los resultados', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { teacher, kids } = classRoom(h, 2);
    teacher.send({ type: 'start' });
    h.advance(3_000 + 5_000 + 200);
    kids[0]!.send({ type: 'backToRoom' });
    teacher.conn.clear();
    teacher.send({ type: 'start' });
    expect(teacher.conn.last('raceStart')!.runners).toHaveLength(2);
  });

  it('al terminar, la profesora también recibe la clasificación', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { teacher } = classRoom(h, 2);
    teacher.send({ type: 'start' });
    h.advance(3_000 + 5_000 + 200);
    expect(teacher.conn.last('results')!.results).toHaveLength(2);
  });
});

describe('estado reducido en clase', () => {
  it('con 30 alumnos, cada uno recibe a lo sumo 6 corredores, 5 veces por segundo (Ancho de banda de una clase)', () => {
    const h = harness({ distance: 1e6 });
    const { teacher, kids } = classRoom(h, 30);
    teacher.send({ type: 'start' });
    h.advance(4_000);
    const kid = kids[17]!;
    const kidId = kid.id; // read before clearing: the id comes from the 'joined' message
    kid.conn.clear();
    teacher.conn.clear();
    h.advance(2_000);
    const states = kid.conn.all('state');
    expect(states.length).toBeLessThanOrEqual(10);
    expect(states.length).toBeGreaterThanOrEqual(9);
    for (const s of states) {
      expect(s.runners.length).toBeLessThanOrEqual(6);
      expect(s.runners.some((r) => r.id === kidId)).toBe(true);
      expect(s.runners.filter((r) => r.id !== kidId).every((r) => r.position <= 5)).toBe(true);
    }
    const board = teacher.conn.all('state');
    expect(board.length).toBeLessThanOrEqual(10);
    expect(board.every((s) => s.runners.length === 30)).toBe(true);
  });

  it('una sala familiar sigue recibiendo el estado completo 20 veces por segundo', () => {
    const h = harness({ distance: 1e6 });
    const { host, code } = roomWithHost(h);
    const guest = h.client();
    guest.send({ type: 'join', code, name: 'Lucía', level: 2 });
    host.send({ type: 'start' });
    h.advance(4_000);
    guest.conn.clear();
    h.advance(1_000);
    const states = guest.conn.all('state');
    expect(states.length).toBeGreaterThanOrEqual(19);
    expect(states.every((s) => s.runners.length === 4)).toBe(true);
  });
});

describe('quitar alumnos y cerrar la sala', () => {
  it('la profesora quita a un alumno del lobby y nadie más puede hacerlo (Nombre inadecuado)', () => {
    const h = harness();
    const { teacher, kids } = classRoom(h, 2);
    const [rude, other] = kids as [ReturnType<H['client']>, ReturnType<H['client']>];
    other.send({ type: 'kick', playerId: rude.id! });
    expect(other.conn.last('error')?.code).toBe('not-host');

    teacher.send({ type: 'kick', playerId: rude.id! });
    expect(rude.conn.last('error')).toMatchObject({ code: 'removed', message: 'La profesora te quitó de la sala' });
    expect(other.conn.last('room')!.players.map((p) => p.name)).toEqual(['Profe Ana', 'Alumno 2']);
  });

  it('un alumno quitado en plena carrera sale de ella y no puede volver con su sesión', () => {
    const h = harness({ distance: 1e6 });
    const { teacher, code, kids } = classRoom(h, 2);
    teacher.send({ type: 'start' });
    h.advance(4_000);
    const rude = kids[0]!;
    const token = rude.conn.last('joined')!.token;
    teacher.send({ type: 'kick', playerId: rude.id! });
    h.advance(500);
    const board = teacher.conn.last('state')!;
    expect(board.runners.find((r) => r.id === rude.id)?.presence).toBe('left');

    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(back.conn.last('error')?.code).toBe('rejoin-failed');
  });

  it('si a la profesora se le corta el wifi, la sala la espera (Se corta el wifi de la profesora)', () => {
    const h = harness();
    const { teacher, code, kids } = classRoom(h, 2);
    const token = teacher.conn.last('joined')!.token;
    teacher.disconnect();
    h.advance(20_000);
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(back.id).toBe(teacher.id);
    const room = kids[0]!.conn.last('room')!;
    expect(room.hostId).toBe(teacher.id);
    expect(room.players).toHaveLength(3);
  });

  it('pasado su tiempo de gracia sin carrera, la sala se cierra para todos', () => {
    const h = harness();
    const { teacher, code, kids } = classRoom(h, 1);
    teacher.disconnect();
    h.advance(31_000);
    expect(kids[0]!.conn.last('error')?.code).toBe('room-closed');
    expect(h.manager.getRoom(code)).toBeUndefined();
  });

  it('"Cerrar sala" avisa a los alumnos y el código deja de funcionar (Fin de la clase)', () => {
    const h = harness();
    const { teacher, code, kids } = classRoom(h, 2);
    teacher.send({ type: 'closeRoom' });
    for (const k of kids) expect(k.conn.last('error')).toMatchObject({ code: 'room-closed', message: 'La profesora cerró la sala' });
    expect(h.manager.getRoom(code)).toBeUndefined();
    const late = h.client();
    late.send({ type: 'join', code, name: 'Tarde', level: 1 });
    expect(late.conn.last('error')?.code).toBe('room-not-found');
  });

  it('en una sala familiar el anfitrión se transfiere como antes y nadie puede quitar', () => {
    const h = harness();
    const { host, code } = roomWithHost(h);
    const guest = h.client();
    guest.send({ type: 'join', code, name: 'Lucía', level: 2 });
    host.send({ type: 'kick', playerId: guest.id! });
    expect(guest.conn.last('error')).toBeUndefined();
    host.send({ type: 'leave' });
    expect(guest.conn.last('room')!.hostId).toBe(guest.id);
  });
});
