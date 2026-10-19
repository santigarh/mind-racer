import { describe, expect, it } from 'vitest';
import { answer, currentChallenge, harness, roomWithHost } from './test-helpers';

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

describe('número de carrera y última clasificación', () => {
  /** Plays a 5 s race that nobody finishes. */
  const race = (h: H, teacher: { send: (m: Record<string, unknown>) => void }) => {
    teacher.send({ type: 'start' });
    h.advance(3_000 + 5_000 + 200);
  };

  it('cada inicio de carrera trae su número y la hora de la sala al iniciar', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { teacher, kids } = classRoom(h, 1);
    const startedAt = h.now;
    race(h, teacher);
    expect(kids[0]!.conn.last('raceStart')).toMatchObject({ raceNumber: 1, startedAt });
    kids[0]!.send({ type: 'backToRoom' });
    race(h, teacher);
    expect(teacher.conn.last('raceStart')!.raceNumber).toBe(2);
  });

  it('si la profesora recarga en los resultados, recibe otra vez la carrera y su clasificación (Recarga en la pantalla de resultados)', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { teacher, code, kids } = classRoom(h, 2);
    race(h, teacher);
    kids[0]!.send({ type: 'backToRoom' });
    race(h, teacher);
    const results = teacher.conn.last('results')!.results;
    const token = teacher.conn.last('joined')!.token;
    teacher.disconnect();
    h.advance(2_000);
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    const types = back.conn.inbox.map((m) => m.type);
    expect(types.indexOf('raceStart')).toBeLessThan(types.indexOf('results'));
    expect(back.conn.last('raceStart')!.raceNumber).toBe(2);
    expect(back.conn.last('results')!.results).toEqual(results);
  });

  it('si ya empezó otra carrera, recibe la carrera en curso y no la clasificación anterior (Ya empezó otra carrera)', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { teacher, code } = classRoom(h, 1);
    race(h, teacher);
    teacher.send({ type: 'start' });
    h.advance(1_000);
    const token = teacher.conn.last('joined')!.token;
    teacher.disconnect();
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(back.conn.last('raceStart')!.raceNumber).toBe(2);
    expect(back.conn.last('results')).toBeUndefined();
    expect(back.conn.all('state').length).toBeGreaterThan(0);
  });

  it('un alumno que se reconecta tras la carrera no recibe la clasificación otra vez', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { teacher, code, kids } = classRoom(h, 1);
    race(h, teacher);
    const token = kids[0]!.conn.last('joined')!.token;
    kids[0]!.disconnect();
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(back.id).toBe(kids[0]!.id);
    expect(back.conn.last('raceStart')).toBeUndefined();
    expect(back.conn.last('results')).toBeUndefined();
  });

  it('una sala familiar no guarda la clasificación', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { host, code } = roomWithHost(h);
    host.send({ type: 'start' });
    h.advance(3_000 + 5_000 + 200);
    expect(host.conn.last('results')).toBeDefined();
    const token = host.conn.last('joined')!.token;
    host.disconnect();
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(back.conn.last('results')).toBeUndefined();
    expect((h.manager.getRoom(code) as unknown as { lastRace: unknown }).lastRace).toBeNull();
  });
});

describe('carrera de tablas en clase', () => {
  const SEVEN = { tables: [7], divisions: false };
  const isTableOf7 = (prompt: string) => /^(7 × \d+|\d+ × 7)$/.test(prompt);

  it('la profesora elige la tabla del 7 y todos la corren, sea cual sea su nivel (Hoy practicamos el 7)', () => {
    const h = harness();
    const { teacher, kids } = classRoom(h, 2);
    kids[1]!.send({ type: 'setLevel', level: 8 });
    teacher.send({ type: 'setTables', tables: SEVEN });
    expect(kids[0]!.conn.last('room')!.tables).toEqual(SEVEN);
    teacher.send({ type: 'start' });
    expect(kids[0]!.conn.last('raceStart')!.tables).toEqual(SEVEN);
    for (let t = 0; t < 4; t++) {
      h.advance(t === 0 ? 3_100 : 300);
      for (const kid of kids) {
        expect(isTableOf7(currentChallenge(kid)!.prompt), currentChallenge(kid)!.prompt).toBe(true);
        answer(kid);
      }
    }
  });

  it('corren exactamente los alumnos, sin bots (Carrera de tablas sin bots)', () => {
    const h = harness();
    const { teacher, kids } = classRoom(h, 3);
    teacher.send({ type: 'setTables', tables: { tables: [6], divisions: false } });
    teacher.send({ type: 'start' });
    const start = kids[0]!.conn.last('raceStart')!;
    expect(start.runners).toHaveLength(3);
    expect(start.runners.every((r) => r.kind === 'human')).toBe(true);
    h.advance(3_100);
    for (const kid of kids) expect(currentChallenge(kid)!.prompt).toMatch(/^(6 × \d+|\d+ × 6)$/);
  });

  it('con null cada uno vuelve a su nivel (Volver a los niveles)', () => {
    const h = harness();
    const { teacher, kids } = classRoom(h, 1);
    teacher.send({ type: 'setTables', tables: SEVEN });
    teacher.send({ type: 'setTables', tables: null });
    expect(kids[0]!.conn.last('room')!.tables).toBeNull();
    teacher.send({ type: 'start' });
    expect(kids[0]!.conn.last('raceStart')!.tables).toBeUndefined();
    h.advance(3_100);
    expect(currentChallenge(kids[0]!)!.prompt).toMatch(/^\d \+ \d$/);
  });

  it('un alumno no puede cambiarla (Un alumno intenta cambiarlo)', () => {
    const h = harness();
    const { teacher, kids } = classRoom(h, 1);
    teacher.send({ type: 'setTables', tables: SEVEN });
    kids[0]!.send({ type: 'setTables', tables: null });
    expect(kids[0]!.conn.last('error')?.code).toBe('not-host');
    expect(teacher.conn.last('room')!.tables).toEqual(SEVEN);
  });

  it('se mantiene después de "Nueva carrera" y al reconectarse (La elección se mantiene)', () => {
    const h = harness({ distance: 1e6, timeLimitMs: 5_000 });
    const { teacher, code, kids } = classRoom(h, 1);
    const both = { tables: [7, 8], divisions: false };
    teacher.send({ type: 'setTables', tables: both });
    teacher.send({ type: 'start' });
    h.advance(3_000 + 5_000 + 200);
    kids[0]!.send({ type: 'backToRoom' });
    expect(teacher.conn.last('room')!.tables).toEqual(both);
    teacher.send({ type: 'start' });
    expect(teacher.conn.last('raceStart')).toMatchObject({ raceNumber: 2, tables: both });
    h.advance(3_000 + 5_000 + 200);

    const token = teacher.conn.last('joined')!.token;
    teacher.disconnect();
    h.advance(2_000);
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(back.conn.last('room')!.tables).toEqual(both);
    expect(back.conn.last('raceStart')!.tables).toEqual(both);
  });
});
