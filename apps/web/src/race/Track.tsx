import type { CSSProperties } from 'react';
import { CarProfile, FlagCheckered } from '@phosphor-icons/react';
import type { BotProfileId, RunnerState } from '@mind-racer/engine';
import { ordinal } from '../ui/format';
import styles from './Track.module.css';

interface TrackProps {
  runners: readonly RunnerState[];
  distance: number;
  playerId: string;
  botProfiles: Readonly<Record<string, BotProfileId>>;
}

export function laneColor(runnerId: string, playerId: string, botProfiles: Readonly<Record<string, BotProfileId>>) {
  if (runnerId === playerId) return 'var(--lane-player)';
  const profile = botProfiles[runnerId];
  return profile ? `var(--lane-${profile})` : 'var(--text-muted)';
}

export function Track({ runners, distance, playerId, botProfiles }: TrackProps) {
  return (
    <ol className={styles.track} aria-label="Pista">
      {runners.map((runner) => {
        const progress = Math.min(1, runner.distance / distance);
        const isPlayer = runner.id === playerId;
        const style = {
          '--progress': progress.toFixed(4),
          '--lane-color': laneColor(runner.id, playerId, botProfiles),
        } as CSSProperties;
        return (
          <li
            key={runner.id}
            className={styles.lane}
            data-player={isPlayer}
            style={style}
            aria-label={`${runner.name}, ${ordinal(runner.position)} lugar, ${Math.round(progress * 100)} % del recorrido`}
          >
            <span className={styles.name}>
              <span className={styles.position}>{ordinal(runner.position)}</span>
              {runner.name}
              {isPlayer && <span className={styles.you}>Tú</span>}
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
