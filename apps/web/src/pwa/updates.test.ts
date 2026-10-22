import { describe, expect, it, vi } from 'vitest';
import type { RegisterSWOptions } from 'virtual:pwa-register';
import { UPDATE_CHECK_INTERVAL_MS, createUpdateStore, type RegisterSW } from './updates';

function setup({ withServiceWorker = true } = {}) {
  let options: RegisterSWOptions | null = null;
  const updateSW = vi.fn(() => Promise.resolve());
  const registerSW = vi.fn<RegisterSW>((o) => {
    options = o;
    return updateSW;
  });
  let clock = 0;
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    listeners: [] as Array<() => void>,
    addEventListener(_type: string, listener: () => void) {
      this.listeners.push(listener);
    },
  };
  const intervals: Array<() => void> = [];
  const store = createUpdateStore({
    registerSW,
    navigator: withServiceWorker ? { serviceWorker: {} } : {},
    document: doc as unknown as Pick<Document, 'visibilityState' | 'addEventListener'>,
    now: () => clock,
    setInterval: (fn) => intervals.push(fn),
  });
  const registration = { update: vi.fn(() => Promise.resolve()) };
  return {
    store,
    registerSW,
    updateSW,
    registration,
    options: () => options!,
    registered: () => options!.onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration),
    advance: (ms: number) => (clock += ms),
    becomeVisible: () => doc.listeners.forEach((l) => l()),
    tick: () => intervals.forEach((fn) => fn()),
    doc,
  };
}

describe('versión nueva del juego', () => {
  it('avisa cuando una versión nueva queda esperando (Aviso en el menú)', () => {
    const t = setup();
    const listener = vi.fn();
    t.store.subscribe(listener);
    expect(t.store.get().needRefresh).toBe(false);

    t.options().onNeedRefresh?.();

    expect(t.store.get().needRefresh).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('"Actualizar" activa la versión nueva y recarga', () => {
    const t = setup();
    t.options().onNeedRefresh?.();
    t.store.applyUpdate();
    expect(t.updateSW).toHaveBeenCalledWith(true);
  });

  it('busca una versión nueva al volver a la app, como máximo una vez por hora', () => {
    const t = setup();
    t.registered();

    t.advance(10 * 60 * 1000);
    t.becomeVisible();
    expect(t.registration.update).not.toHaveBeenCalled();

    t.advance(UPDATE_CHECK_INTERVAL_MS);
    t.becomeVisible();
    t.becomeVisible();
    t.tick();
    expect(t.registration.update).toHaveBeenCalledOnce();
  });

  it('busca cada hora mientras la app sigue abierta y visible, no en segundo plano', () => {
    const t = setup();
    t.registered();

    t.advance(UPDATE_CHECK_INTERVAL_MS);
    t.doc.visibilityState = 'hidden';
    t.tick();
    expect(t.registration.update).not.toHaveBeenCalled();

    t.doc.visibilityState = 'visible';
    t.tick();
    expect(t.registration.update).toHaveBeenCalledOnce();
  });

  it('sin conexión, una búsqueda fallida no rompe nada', async () => {
    const t = setup();
    t.registration.update.mockRejectedValueOnce(new Error('offline'));
    t.registered();
    t.advance(UPDATE_CHECK_INTERVAL_MS);
    expect(() => t.becomeVisible()).not.toThrow();
    await Promise.resolve();
  });

  it('sin service workers (http en la red de casa) no registra nada y no falla', () => {
    const t = setup({ withServiceWorker: false });
    expect(t.registerSW).not.toHaveBeenCalled();
    expect(t.store.get().needRefresh).toBe(false);
    expect(() => t.store.applyUpdate()).not.toThrow();
  });

  it('un registro que falla deja el juego funcionando igual', () => {
    const store = createUpdateStore({
      registerSW: () => {
        throw new Error('SecurityError');
      },
      navigator: { serviceWorker: {} },
    });
    expect(store.get().needRefresh).toBe(false);
    expect(() => store.applyUpdate()).not.toThrow();
  });
});
