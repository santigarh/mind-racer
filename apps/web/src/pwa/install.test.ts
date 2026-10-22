import { describe, expect, it, vi } from 'vitest';
import { createInstallStore, type BeforeInstallPromptEvent, type InstallWindow } from './install';

function fakeWindow({ standalone = false, iosStandalone = false } = {}) {
  const listeners = new Map<string, Array<(event: Event) => void>>();
  const win: InstallWindow & { fire(type: string, event?: Event): void } = {
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    matchMedia: (query) => ({ matches: standalone && query === '(display-mode: standalone)' }),
    navigator: iosStandalone ? { standalone: true } : {},
    fire(type, event = new Event(type)) {
      listeners.get(type)?.forEach((listener) => listener(event));
    },
  };
  return win;
}

function installOffer(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  });
  return event;
}

describe('instalar la app', () => {
  it('ofrece instalar cuando el navegador lo permite (Navegador con instalación)', async () => {
    const win = fakeWindow();
    const store = createInstallStore(win);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.get().canInstall).toBe(false);

    const offer = installOffer();
    win.fire('beforeinstallprompt', offer);
    expect(offer.defaultPrevented).toBe(true);
    expect(store.get().canInstall).toBe(true);
    expect(listener).toHaveBeenCalledOnce();

    await store.install();
    expect(offer.prompt).toHaveBeenCalledOnce();
    expect(store.get().canInstall).toBe(false);
  });

  it('deja de ofrecer instalar cuando el juego queda instalado', () => {
    const win = fakeWindow();
    const store = createInstallStore(win);
    win.fire('beforeinstallprompt', installOffer());
    win.fire('appinstalled');
    expect(store.get().canInstall).toBe(false);
  });

  it('sin la oferta del navegador, no ofrece instalar (Navegador sin instalación propia)', async () => {
    const store = createInstallStore(fakeWindow());
    expect(store.get().canInstall).toBe(false);
    await expect(store.install()).resolves.toBeUndefined();
  });

  it('una oferta rechazada se usa una sola vez; el navegador puede volver a ofrecer', async () => {
    const win = fakeWindow();
    const store = createInstallStore(win);
    win.fire('beforeinstallprompt', installOffer('dismissed'));
    await store.install();
    expect(store.get().canInstall).toBe(false);

    win.fire('beforeinstallprompt', installOffer());
    expect(store.get().canInstall).toBe(true);
  });

  it.each([
    ['Android o escritorio', { standalone: true }],
    ['iOS', { iosStandalone: true }],
  ])('ya instalada en %s, no ofrece instalar (Ya instalada)', (_name, options) => {
    const win = fakeWindow(options);
    const store = createInstallStore(win);
    win.fire('beforeinstallprompt', installOffer());
    expect(store.get().canInstall).toBe(false);
  });
});
