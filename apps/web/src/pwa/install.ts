import { useSyncExternalStore } from 'react';

/** Chromium's install offer; not in the DOM typings. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** The browser offers to install the game right now. */
  canInstall: boolean;
}

export interface InstallStore {
  get(): InstallState;
  subscribe(listener: () => void): () => void;
  /** Opens the browser's install dialog. */
  install(): Promise<void>;
}

export interface InstallWindow {
  addEventListener(type: string, listener: (event: Event) => void): void;
  matchMedia(query: string): Pick<MediaQueryList, 'matches'>;
  navigator: { standalone?: boolean };
}

const NO: InstallState = Object.freeze({ canInstall: false });
const YES: InstallState = Object.freeze({ canInstall: true });

/** True when the game runs as an installed app (Android, desktop, or iOS home screen). */
export function isStandalone(win: InstallWindow): boolean {
  return win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true;
}

/**
 * "Instalar app" (design D4): keeps the browser's install offer for the menu's own button. Created
 * before React mounts, since the offer can arrive before the first render.
 */
export function createInstallStore(win: InstallWindow = window as unknown as InstallWindow): InstallStore {
  let state = NO;
  let offer: BeforeInstallPromptEvent | null = null;
  const listeners = new Set<() => void>();
  const set = (next: InstallState) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  if (!isStandalone(win)) {
    win.addEventListener('beforeinstallprompt', (event) => {
      // Our button replaces Chrome's mini bar; the address bar still offers to install.
      event.preventDefault();
      offer = event as BeforeInstallPromptEvent;
      set(YES);
    });
    win.addEventListener('appinstalled', () => {
      offer = null;
      set(NO);
    });
  }

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async install() {
      const pending = offer;
      if (!pending) return;
      // An offer works once; the browser sends a new one if installing becomes possible again.
      offer = null;
      set(NO);
      try {
        await pending.prompt();
        await pending.userChoice;
      } catch {
        // The browser refused to show the dialog.
      }
    },
  };
}

export function useInstall(store: InstallStore): InstallState {
  return useSyncExternalStore(store.subscribe, store.get);
}
