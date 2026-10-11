import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestClient } from './ws-client';

/** Builds dist/main.js and runs it the way Render does: plain node, settings from env. */
const serverDir = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://mind-racer.pages.dev';

let child: ChildProcess | null = null;
let port = 0;
const clients: TestClient[] = [];

beforeAll(async () => {
  execSync('pnpm build:prod', { cwd: serverDir, stdio: 'pipe' });
  expect(existsSync(`${serverDir}/dist/main.js`)).toBe(true);
  child = spawn(process.execPath, ['dist/main.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', ALLOWED_ORIGINS: SITE, TRUST_PROXY_HOPS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  port = await new Promise<number>((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Server did not start:\n${output}`)), 10_000);
    child!.stdout!.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/localhost:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child!.stderr!.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child!.once('exit', (code) => reject(new Error(`Server exited with ${code}:\n${output}`)));
  });
}, 60_000);

afterAll(() => {
  for (const c of clients.splice(0)) c.close();
  child?.kill();
});

describe('build de producción (node dist/main.js)', () => {
  it('responde /health', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', rooms: 0 });
  });

  it('crea una sala desde el origen permitido', async () => {
    const c = await TestClient.connect(port, { origin: SITE });
    clients.push(c);
    c.send({ type: 'create', name: 'Ana', level: 3 });
    expect((await c.waitFor('joined')).code).toMatch(/^[A-Z2-9]{4}$/);
  });

  it('rechaza otro origen con 403', async () => {
    await expect(TestClient.connect(port, { origin: 'https://otro-sitio.example' })).rejects.toThrow('HTTP 403');
  });
});
