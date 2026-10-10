import { afterEach, describe, expect, it } from 'vitest';
import type { ServerMessage } from '@mind-racer/protocol';
import { startServer, type RunningServer } from './server';
import { solve } from './test-helpers';
import { TestClient } from './ws-client';

let server: RunningServer | null = null;
const clients: TestClient[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await server?.close();
  server = null;
});

type Challenge = NonNullable<Extract<ServerMessage, { type: 'challenge' }>['challenge']>;

/** Keeps answering the latest challenge correctly until results arrive. */
async function play(client: TestClient): Promise<void> {
  let answered = -1;
  while (!client.last('results')) {
    let latest: Challenge | null = null;
    for (const m of client.inbox) if (m.type === 'challenge' || m.type === 'answer') latest = m.challenge;
    if (latest && latest.seq !== answered) {
      answered = latest.seq;
      client.send({ type: 'answer', seq: latest.seq, input: solve(latest.prompt) });
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('punta a punta', () => {
  it('familia: crear, unirse, niveles 8 y 2, carrera corta y resultados con bots', async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', raceConfig: { distance: 40, countdownMs: 500 } });
    const papa = await TestClient.connect(server.port);
    const lucia = await TestClient.connect(server.port);
    clients.push(papa, lucia);

    papa.send({ type: 'create', name: 'Papá', level: 5 });
    const { code } = await papa.waitFor('joined');
    papa.send({ type: 'setLevel', level: 8 });
    lucia.send({ type: 'join', code, name: 'Lucía', level: 2 });
    await papa.waitFor('room', (m) => m.players.length === 2 && m.players[0]!.level === 8);

    papa.send({ type: 'start' });
    const start = await lucia.waitFor('raceStart');
    expect(start.runners.map((r) => [r.kind, r.chosenLevel])).toEqual([
      ['human', 8],
      ['human', 2],
      ['bot', 2],
      ['bot', 2],
    ]);

    await Promise.all([play(papa), play(lucia)]);
    const { results } = papa.last('results')!;
    expect(lucia.last('results')!.results).toEqual(results);
    expect(results).toHaveLength(4);
    const byName = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(byName['Papá']).toMatchObject({ chosenLevel: 8, finished: true, wrong: 0, presence: 'connected' });
    expect(byName['Lucía']).toMatchObject({ chosenLevel: 2, finished: true, wrong: 0, presence: 'connected' });
    expect(results.filter((r) => r.kind === 'bot').every((r) => r.chosenLevel === 2)).toBe(true);
    expect((await papa.waitFor('room', (m) => m.phase === 'lobby' && m.players.every((p) => p.status === 'results'))).code).toBe(code);
  }, 20_000);
});
