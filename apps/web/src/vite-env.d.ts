/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL of the game server, e.g. ws://192.168.1.20:8787. */
  readonly VITE_SERVER_URL?: string;
}
