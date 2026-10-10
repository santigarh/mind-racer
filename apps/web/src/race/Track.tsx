import type { CSSProperties } from 'react';
import { CarProfile, FlagCheckered } from '@phosphor-icons/react';
import type { BotProfileId, RunnerState } from '@mind-racer/engine';
import type { Presence } from '@mind-racer/protocol';
import { ordinal } from '../ui/format';
import styles from './Track.module.css';

interface TrackProps {
  runners: readonly RunnerState[];
  distance: number;
  playerId: string;
  botProfiles: Readonly<Record<string, BotProfileId>>;
  /** Show each runner's chosen level next to the name (online races). */
  showLevels?: boolean;
  presence?: Readonly<Record<string, Presence>>;
}

export const PRESENCE_TEXT: Partial<Record<Presence, string>> = {
  disconnected: 'Desconectado',
  left: 'Salió',
};

const OTHER_PEOPLE_COLORS = 3;

/**
 * Lane color: amber for me, one per bot profile, and a separate palette for the other people,
 * assigned by sorted id so the track and the results agree.
 */
export function laneColor(
  runnerId: string,
  playerId: string,
  botProfiles: Readonly<Record<string, BotProfileId>>,
  allIds: readonly string[] = [],
) {
  if (runnerId === playerId) return 'var(--lane-player)';
  const profile = botProfiles[runnerId];
  if (profile) return `var(--lane-${profile})`;
  const others = allIds.filter((id) => id !== playerId && !botProfiles[id]).sort();
  const index = others.indexOf(runnerId);
  return index >= 0 ? `var(--lane-human-${(index % OTHER_PEOPLE_COLORS) + 1})` : 'var(--text-muted)';
}

export function Track({ runners, distance, playerId, botProfiles, showLevels = false, presence = {} }: TrackProps) {
  const ids = runners.map((r) => r.id);
  return (
    <ol className={styles.track} aria-label="Pista">
      {runners.map((runner) => {
        const progress = Math.min(1, runner.distance / distance);
        const isPlayer = runner.id === playerId;
        const away = presence[runner.id] ? PRESENCE_TEXT[presence[runner.id]!] : undefined;
        const style = {
          '--progress': progress.toFixed(4),
          '--lane-color': laneColor(runner.id, playerId, botProfiles, ids),
        } as CSSProperties;
        return (
          <li
            key={runner.id}
            className={styles.lane}
            data-player={isPlayer}
            style={style}
            data-away={away !== undefined}
            aria-label={[
              runner.name,
              showLevels ? `nivel ${runner.chosenLevel}` : null,
              `${ordinal(runner.position)} lugar`,
              `${Math.round(progress * 100)} % del recorrido`,
              away?.toLowerCase(),
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <span className={styles.name}>
              <span className={styles.position}>{ordinal(runner.position)}</span>
              <span className={styles.runnerName}>{runner.name}</span>
              {showLevels && <span className={styles.level}>N{runner.chosenLevel}</span>}
              {isPlayer && <span className={styles.you}>Tú</span>}
              {away && <span className={styles.away}>{away}</span>}
            </span>
            <div className={styles.road}>
              <div className={styles.rail}>
                <div
                  className={styles.car}
                  data-testid={`car-${runner.id}`}
                  data-nitro={runner.nitroActive}
                  data-finished={runner.finishTimeMs !== null}
                >
                  <span className={styles.flame} aria-hidden />
                  <CarProfile size={32} weight="fill" aria-hidden />
                </div>
              </div>
              <FlagCheckered className={styles.finish} size={20} weight="fill" aria-hidden />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
