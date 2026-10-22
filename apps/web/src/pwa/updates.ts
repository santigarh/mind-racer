import { useSyncExternalStore } from 'react';
import type { RegisterSWOptions } from 'virtual:pwa-register';

/** A long-lived installed app looks for a new version at most this often (design D3). */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface UpdateState {
  /** A new version is installed and waiting for "Actualizar". */
  needRefresh: boolean;
}

export interface UpdateStore {
  get(): UpdateState;
  subscribe(listener: () => void): () => void;
  /** Activates the waiting version and reloads the page. */
  applyUpdate(): void;
}

export type RegisterSW = (options: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

export interface UpdateStoreOptions {
  /** `registerSW` from `virtual:pwa-register`. */
  registerSW: RegisterSW;
  /** Without service workers (plain http on the home network) nothing is registered. */
  navigator?: object;
  document?: Pick<Document, 'visibilityState' | 'addEventListener'>;
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
}

const IDLE: UpdateState = Object.freeze({ needRefresh: false });
const WAITING: UpdateState = Object.freeze({ needRefresh: true });

/**
 * Registers the service worker and tells the menu when a new version is waiting. The page never
 * reloads on its own: only `applyUpdate()` does, and only the menu offers it (spec installable-app).
 */
export function createUpdateStore({
  registerSW,
  navigator = globalThis.navigator,
  document = globalThis.document,
  now = () => Date.now(),
  setInterval = (fn, ms) => globalThis.setInterval(fn, ms),
}: UpdateStoreOptions): UpdateStore {
  let state = IDLE;
  const listeners = new Set<() => void>();
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

  const watchForUpdates = (registration: ServiceWorkerRegistration) => {
    let lastCheck = now();
    const check = () => {
      if (document.visibilityState !== 'visible' || now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheck = now();
      registration.update().catch(() => {
        // Offline or the server is unreachable: try again on the next check.
      });
    };
    document.addEventListener('visibilitychange', check);
    setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  };

  if (navigator && 'serviceWorker' in navigator) {
    try {
      updateSW = registerSW({
        onNeedRefresh() {
          state = WAITING;
          listeners.forEach((listener) => listener());
        },
        onRegisteredSW(_url, registration) {
          if (registration) watchForUpdates(registration);
        },
        onRegisterError() {
          // The game works the same without offline support.
        },
      });
    } catch {
      updateSW = null;
    }
  }

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    applyUpdate() {
      updateSW?.(true).catch(() => {
        // Keeps running the current version.
      });
    },
  };
}

export function useUpdate(store: UpdateStore): UpdateState {
  return useSyncExternalStore(store.subscribe, store.get);
}
