import { describe, expect, it } from 'vitest';
import { DEFAULT_RACE_CONFIG, getLevelDefinition } from '@mind-racer/engine';
import { answer, currentChallenge, harness, roomRace, roomWithHost } from './test-helpers';

const COUNTDOWN = DEFAULT_RACE_CONFIG.countdownMs;

/** Host (level 8) + Lucía (level 2) in a room; short races. */
function family(distance = 60) {
  const h = harness({ distance });
  const { host, code } = roomWithHost(h, 'Papá', 8);
  const guest = h.client();
  guest.send({ type: 'join', code, name: 'Lucía', level: 2 });
  return { h, host, guest, code };
}

/** Answers correctly every `everyMs` for the given clients while they have challenges. */
function race(h: ReturnType<typeof harness>, clients: ReturnType<typeof family>['host'][], ms: number, everyMs = 300) {
  for (let t = 0; t < ms; t += everyMs) {
    for (const c of clients) if (currentChallenge(c)) answer(c);
    h.advance(everyMs);
  }
}

describe('iniciar la carrera', () => {
  it('invitado intenta iniciar: error y no empieza', () => {
    const { guest, host } = family();
    guest.send({ type: 'start' });
    expect(guest.conn.last('error')?.code).toBe('not-host');
    expect(host.conn.last('raceStart')).toBeUndefined();
  });

  it('anfitrión inicia: todos pasan a la misma carrera y reciben su desafío tras la cuenta regresiva', () => {
    const { h, host, guest } = family();
    host.send({ type: 'start' });
    const a = host.conn.last('raceStart')!;
    const b = guest.conn.last('raceStart')!;
    expect(a).toEqual(b);
    expect(host.conn.last('room')!.phase).toBe('racing');
    expect(host.conn.last('state')!.phase).toBe('countdown');
    expect(currentChallenge(host)).toBeNull();
    h.advance(COUNTDOWN + 50);
    expect(currentChallenge(host)!.level).toBe(8);
    expect(currentChallenge(guest)!.level).toBe(2);
  });

  it('dos personas: bots Tortuga y Crucero en el nivel más bajo', () => {
    const { host } = family();
    host.send({ type: 'start' });
    const runners = host.conn.last('raceStart')!.runners;
    expect(runners.map((r) => [r.kind, r.chosenLevel, r.botProfile ?? null])).toEqual([
      ['human', 8, null],
      ['human', 2, null],
      ['bot', 2, 'tortuga'],
      ['bot', 2, 'crucero'],
    ]);
  });

  it('sala llena: sin bots', () => {
    const h = harness({ distance: 60 });
    const { host, code } = roomWithHost(h);
    for (const name of ['A', 'B', 'C']) h.client().send({ type: 'join', code, name, level: 3 });
    host.send({ type: 'start' });
    expect(host.conn.last('raceStart')!.runners.every((r) => r.kind === 'human')).toBe(true);
  });

  it('envía el estado de la carrera a 20 por segundo', () => {
    const { h, host } = family();
    host.send({ type: 'start' });
    host.conn.clear();
    h.advance(1000);
    expect(host.conn.all('state')).toHaveLength(20);
  });
});

describe('respuestas', () => {
  it('respuesta oculta: ningún desafío enviado contiene la respuesta', () => {
    const { h, host, guest } = family(1000);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    race(h, [host, guest], 5000);
    for (const c of [host, guest]) {
      const sent = c.conn.inbox.filter((m) => m.type === 'challenge' || m.type === 'answer').map((m) => m.challenge);
      expect(sent.length).toBeGreaterThan(5);
      for (const challenge of sent) {
        if (challenge) expect(Object.keys(challenge).sort()).toEqual(['answerLength', 'issuedAtMs', 'level', 'prompt', 'seq']);
      }
    }
  });

  it('respuesta validada por el servidor: informa el resultado y el siguiente desafío', () => {
    const { h, host } = family();
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    const first = currentChallenge(host)!;
    answer(host);
    const reply = host.conn.last('answer')!;
    expect(reply.outcome.correct).toBe(true);
    expect(reply.challenge!.seq).toBe(first.seq + 1);
    answer(host, '-1');
    expect(host.conn.last('answer')!.outcome).toMatchObject({ correct: false, given: '-1' });
  });

  it('ignora respuestas repetidas para un desafío ya reemplazado', () => {
    const { h, host } = family();
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    const first = currentChallenge(host)!;
    answer(host);
    const answers = host.conn.all('answer').length;
    host.send({ type: 'answer', seq: first.seq, input: '1' });
    expect(host.conn.all('answer')).toHaveLength(answers);
  });

  it('limita a 20 respuestas por segundo', () => {
    const { h, host } = family(100_000);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    for (let i = 0; i < 21; i++) answer(host, '-1');
    expect(host.conn.last('error')?.code).toBe('rate-limited');
    expect(host.conn.all('answer')).toHaveLength(20);
  });
});

describe('compensación de latencia', () => {
  /** Measures RTTs with one ping, then starts a race where everyone plays level 1. */
  function withRtts(rtts: number[]) {
    const h = harness({ distance: 10_000 });
    const { host, code } = roomWithHost(h, 'P0', 1);
    const clients = [host];
    for (let i = 1; i < rtts.length; i++) {
      const c = h.client();
      c.send({ type: 'join', code, name: `P${i}`, level: 1 });
      clients.push(c);
    }
    h.advance(2000); // ping to everyone
    const order = rtts.map((rtt, i) => ({ rtt, c: clients[i]! })).sort((a, b) => a.rtt - b.rtt);
    let elapsed = 0;
    for (const { rtt, c } of order) {
      h.advance(rtt - elapsed);
      elapsed = rtt;
      c.send({ type: 'pong', id: c.conn.last('ping')!.id });
    }
    host.send({ type: 'start' });
    h.advance(COUNTDOWN);
    return { h, code, clients };
  }

  const speedOf = (h: ReturnType<typeof harness>, code: string, id: string) =>
    roomRace(h, code)!.runners.find((r) => r.id === id)!.speed;

  it('conexiones distintas: mismo impulso para el mismo tiempo de pensamiento', () => {
    const { h, code, clients } = withRtts([20, 120]);
    const [fast, slow] = clients as [(typeof clients)[0], (typeof clients)[0]];
    // Ambos piensan 2 s; la respuesta llega 2 s + su ida y vuelta después de emitido el desafío.
    h.advance(2000 + 20);
    answer(fast);
    const fastSpeed = speedOf(h, code, fast.id!);
    h.advance(100);
    answer(slow);
    const slowSpeed = speedOf(h, code, slow.id!);
    expect(slowSpeed).toBeCloseTo(fastSpeed, 9);
  });

  it('latencia exagerada: solo se descuentan 150 ms', () => {
    const { h, code, clients } = withRtts([900]);
    const [player] = clients as [(typeof clients)[0]];
    h.advance(2000 + 900);
    answer(player);
    const cfg = DEFAULT_RACE_CONFIG;
    const target = getLevelDefinition(1).targetTimeMs;
    const responseMs = 2900 - 150;
    const q = Math.min(cfg.quicknessMax, Math.max(cfg.quicknessMin, target / responseMs));
    expect(speedOf(h, code, player.id!)).toBeCloseTo(cfg.boostPerTargetSecond * (target / 1000) * q, 9);
  });

  it('sin pong medido no hay descuento', () => {
    const { h, code, clients } = withRtts([0]);
    const [player] = clients as [(typeof clients)[0]];
    h.advance(2000);
    answer(player);
    const cfg = DEFAULT_RACE_CONFIG;
    const target = getLevelDefinition(1).targetTimeMs;
    expect(speedOf(h, code, player.id!)).toBeCloseTo(cfg.boostPerTargetSecond * (target / 1000) * (target / 2000), 9);
  });
});

describe('desconexión y reconexión', () => {
  it('vuelve a tiempo: retoma su auto con el progreso intacto', () => {
    const { h, host, guest, code } = family(1000);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    race(h, [guest], 3000);
    const token = guest.conn.last('joined')!.token;
    const before = roomRace(h, code)!.runners.find((r) => r.id === guest.id)!;
    guest.disconnect();
    h.advance(100);
    expect(host.conn.last('state')!.runners.find((r) => r.id === guest.id)!.presence).toBe('disconnected');
    h.advance(10_000);

    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    expect(back.conn.last('joined')!.playerId).toBe(guest.id);
    expect(back.conn.last('raceStart')).toBeDefined();
    expect(currentChallenge(back)).not.toBeNull();
    const state = back.conn.last('state')!.runners.find((r) => r.id === guest.id)!;
    expect(state).toMatchObject({ correct: before.correct, wrong: before.wrong, presence: 'connected' });
    expect(state.distance).toBeGreaterThanOrEqual(before.distance);
    answer(back);
    expect(back.conn.last('answer')!.outcome.correct).toBe(true);
  });

  it('no vuelve: pasados 30 s no puede volver y figura desconectado en la clasificación', () => {
    const { h, host, guest, code } = family(60);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    const token = guest.conn.last('joined')!.token;
    guest.disconnect();
    race(h, [host], 5000);
    expect(host.conn.last('results')).toBeUndefined();
    h.advance(26_000);
    const results = host.conn.last('results')!;
    expect(results.results.find((r) => r.id === guest.id)!.presence).toBe('disconnected');
    const late = h.client();
    late.send({ type: 'rejoin', code, token });
    expect(late.conn.last('error')?.code).toBe('rejoin-failed');
  });
});

describe('fin de carrera', () => {
  it('las personas ya llegaron: resultados completos de inmediato', () => {
    const { h, host, guest } = family(60);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    race(h, [host, guest], 3000, 100);
    const results = host.conn.last('results')!;
    expect(results).toEqual(guest.conn.last('results'));
    expect(results.results).toHaveLength(4);
    expect(results.results.map((r) => r.position)).toEqual([1, 2, 3, 4]);
    expect(Object.fromEntries(results.results.map((r) => [r.name, r.chosenLevel]))).toMatchObject({ Papá: 8, Lucía: 2 });
    expect(host.conn.last('room')!.phase).toBe('lobby');
  });

  it('una persona sigue corriendo: quien llegó espera y la carrera continúa', () => {
    const { h, host } = family(60);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    race(h, [host], 3000, 100);
    expect(host.conn.last('state')!.runners.find((r) => r.id === host.id)!.finishTimeMs).not.toBeNull();
    h.advance(5000);
    expect(host.conn.last('results')).toBeUndefined();
    expect(host.conn.last('state')!.phase).toBe('racing');
  });

  it('desconexión reciente: la carrera sigue; pasados 30 s termina', () => {
    const { h, host, guest } = family(60);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    guest.disconnect();
    race(h, [host], 3000, 100);
    h.advance(7_000);
    expect(host.conn.last('results')).toBeUndefined();
    h.advance(21_000);
    expect(host.conn.last('results')).toBeDefined();
  });

  it('salir a mitad de carrera: vuelve al lobby, su auto queda detenido y no recibe resultados', () => {
    const { h, host, guest } = family(60);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    race(h, [guest], 1000);
    guest.send({ type: 'abandon' });
    expect(currentChallenge(guest)).toBeNull();
    expect(host.conn.last('room')!.players.find((p) => p.id === guest.id)!.status).toBe('waiting');
    h.advance(100);
    const runner = host.conn.last('state')!.runners.find((r) => r.id === guest.id)!;
    expect(runner.presence).toBe('left');
    race(h, [host], 3000, 100);
    expect(host.conn.last('results')!.results.find((r) => r.id === guest.id)!.presence).toBe('left');
    expect(guest.conn.last('results')).toBeUndefined();
    expect(host.conn.last('room')!.players.find((p) => p.id === guest.id)!.status).toBe('lobby');
  });

  it('llegada tardía: espera en el lobby y entra en la siguiente', () => {
    const { h, host, code } = family(60);
    host.send({ type: 'start' });
    const late = h.client();
    late.send({ type: 'join', code, name: 'Abuela', level: 1 });
    expect(late.conn.last('room')!.players.find((p) => p.id === late.id)!.status).toBe('waiting');
    h.advance(COUNTDOWN + 50);
    expect(late.conn.last('raceStart')).toBeUndefined();
    expect(late.conn.last('state')).toBeUndefined();
    expect(host.conn.last('raceStart')!.runners.some((r) => r.name === 'Abuela')).toBe(false);
  });
});

describe('volver a la sala', () => {
  it('revancha: nueva carrera con quienes volvieron al lobby y otra semilla', () => {
    const { h, host, guest } = family(60);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    race(h, [host, guest], 3000, 100);
    const firstSeed = host.conn.last('raceStart')!.seed;
    expect(host.conn.last('room')!.players.map((p) => p.status)).toEqual(['results', 'results']);

    host.send({ type: 'backToRoom' });
    guest.send({ type: 'setLevel', level: 3 });
    guest.send({ type: 'backToRoom' });
    host.send({ type: 'start' });
    const rematch = guest.conn.last('raceStart')!;
    expect(rematch.seed).not.toBe(firstSeed);
    expect(rematch.runners.filter((r) => r.kind === 'human').map((r) => [r.name, r.chosenLevel])).toEqual([
      ['Papá', 8],
      ['Lucía', 3],
    ]);
  });

  it('quien sigue mirando resultados no entra en la revancha y luego espera', () => {
    const { h, host, guest } = family(60);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    race(h, [host, guest], 3000, 100);
    host.send({ type: 'backToRoom' });
    host.send({ type: 'start' });
    expect(host.conn.last('raceStart')!.runners.some((r) => r.id === guest.id)).toBe(false);
    guest.send({ type: 'backToRoom' });
    expect(host.conn.last('room')!.players.find((p) => p.id === guest.id)!.status).toBe('waiting');
  });
});

describe('rejoin repetido', () => {
  it('dos rejoin seguidos por la misma conexión no sacan al jugador de la carrera', () => {
    const { h, host, guest, code } = family(1000);
    host.send({ type: 'start' });
    h.advance(COUNTDOWN + 50);
    const token = guest.conn.last('joined')!.token;
    guest.disconnect();
    const back = h.client();
    back.send({ type: 'rejoin', code, token });
    back.send({ type: 'rejoin', code, token });
    expect(back.conn.last('error')).toBeUndefined();
    h.advance(100);
    expect(host.conn.last('state')!.runners.find((r) => r.id === guest.id)!.presence).toBe('connected');
    answer(back);
    expect(back.conn.last('answer')!.outcome.correct).toBe(true);
  });
});
