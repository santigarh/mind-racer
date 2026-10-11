import { Crown, Lock, SignOut, WifiSlash } from '@phosphor-icons/react';
import { MATH_LEVELS } from '@mind-racer/engine';
import type { RoomPlayer } from '@mind-racer/protocol';
import { Button } from '../ui/Button';
import { SoundToggle } from '../ui/SoundToggle';
import { ShareRoom } from './ShareRoom';
import type { RoomMessage } from '../net/MultiplayerSession';
import styles from './Multiplayer.module.css';

interface LobbyProps {
  room: RoomMessage;
  playerId: string;
  /** Highest level this device's profile has unlocked. */
  unlockedLevel: number;
  reconnecting: boolean;
  onSetLevel: (level: number) => void;
  onStart: () => void;
  onLeave: () => void;
}

const STATUS_TEXT: Partial<Record<RoomPlayer['status'], string>> = {
  waiting: 'Espera la siguiente carrera',
  results: 'Viendo resultados',
  racing: 'Corriendo',
};

export function Lobby({ room, playerId, unlockedLevel, reconnecting, onSetLevel, onStart, onLeave }: LobbyProps) {
  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const raceInProgress = room.phase === 'racing';

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>Sala</span>
        <div className={styles.headerActions}>
          <SoundToggle />
          <Button variant="ghost" size="small" onClick={onLeave}>
            <SignOut size={18} aria-hidden />
            Salir de la sala
          </Button>
        </div>
      </header>

      {reconnecting && (
        <p className={styles.banner} role="status">
          Reconectando…
        </p>
      )}

      <section className={styles.codeBlock} aria-label="Código de la sala">
        <span className={styles.muted}>Comparte este código</span>
        <strong className={styles.code} data-testid="room-code">
          {room.code}
        </strong>
        <ShareRoom code={room.code} />
      </section>

      <div className={styles.lobbyGrid}>
        <section className={styles.card} aria-labelledby="players-title">
          <h2 id="players-title" className={styles.cardTitle}>
            Jugadores <span className={styles.muted}>{room.players.length} de 4</span>
          </h2>
          <ul className={styles.players}>
            {room.players.map((p) => (
              <li key={p.id} className={styles.player} data-me={p.id === playerId} aria-label={playerLabel(p, room.hostId)}>
                <span className={styles.playerLevel}>N{p.level}</span>
                <span className={styles.playerName}>
                  {p.name}
                  {p.id === playerId && <span className={styles.you}>Tú</span>}
                </span>
                {p.id === room.hostId && <Crown size={18} weight="fill" className={styles.host} aria-hidden />}
                {!p.connected && <WifiSlash size={18} className={styles.offline} aria-hidden />}
                {STATUS_TEXT[p.status] && <span className={styles.status}>{STATUS_TEXT[p.status]}</span>}
              </li>
            ))}
          </ul>
          <p className={styles.muted}>Los carriles libres se llenan con bots.</p>
        </section>

        <section className={styles.card} aria-labelledby="level-title">
          <h2 id="level-title" className={styles.cardTitle}>
            Tu nivel
          </h2>
          <div className={styles.levelGrid} role="group" aria-label="Tu nivel">
            {MATH_LEVELS.map((l) => {
              const locked = l.level > unlockedLevel;
              const selected = me?.level === l.level;
              return (
                <button
                  key={l.level}
                  type="button"
                  className={styles.levelButton}
                  data-selected={selected}
                  disabled={locked || me?.status === 'racing'}
                  aria-pressed={selected}
                  aria-label={`Nivel ${l.level}: ${l.description}${locked ? ' (bloqueado)' : ''}`}
                  title={l.description}
                  onClick={() => onSetLevel(l.level)}
                >
                  {locked ? <Lock size={16} weight="bold" aria-hidden /> : l.level}
                </button>
              );
            })}
          </div>
          {me && <p className={styles.muted}>{MATH_LEVELS[me.level - 1]?.description}</p>}

          <div className={styles.lobbyAction}>
            {raceInProgress && me?.status === 'waiting' ? (
              <p className={styles.notice} role="status">
                Hay una carrera en curso; entrarás en la siguiente.
              </p>
            ) : isHost ? (
              <Button size="large" onClick={onStart} disabled={raceInProgress || me?.status !== 'lobby'}>
                Iniciar carrera
              </Button>
            ) : (
              <p className={styles.notice} role="status">
                Esperando a que el anfitrión inicie.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function playerLabel(p: RoomPlayer, hostId: string | null): string {
  const parts = [`${p.name}, nivel ${p.level}`];
  if (p.id === hostId) parts.push('anfitrión');
  if (!p.connected) parts.push('desconectado');
  const status = STATUS_TEXT[p.status];
  if (status) parts.push(status.toLowerCase());
  return parts.join(', ');
}
