import type { ReactNode } from 'react';
import { Brain, Fire, Gauge, Medal, Timer } from '@phosphor-icons/react';
import type { RunnerState } from '@mind-racer/engine';
import { formatTime, ordinal, toKmh } from '../ui/format';
import styles from './Hud.module.css';

interface HudProps {
  player: RunnerState;
  runnerCount: number;
  elapsedMs: number;
}

export function Hud({ player, runnerCount, elapsedMs }: HudProps) {
  return (
    <dl className={styles.hud} aria-label="Indicadores">
      <Item icon={<Medal size={20} aria-hidden />} label="Posición" testId="hud-position">
        {ordinal(player.position)} <span className={styles.of}>de {runnerCount}</span>
      </Item>
      <Item icon={<Gauge size={20} aria-hidden />} label="Velocidad" testId="hud-speed">
        {toKmh(player.speed)} <span className={styles.of}>km/h</span>
      </Item>
      <Item icon={<Fire size={20} aria-hidden />} label="Racha" testId="hud-streak" highlight={player.nitroActive}>
        {player.nitroActive ? 'Nitro' : player.streak}
      </Item>
      <Item icon={<Timer size={20} aria-hidden />} label="Tiempo" testId="hud-time">
        {formatTime(player.finishTimeMs ?? Math.max(0, elapsedMs))}
      </Item>
      <Item icon={<Brain size={20} aria-hidden />} label="Nivel" testId="hud-level">
        {player.level}
      </Item>
    </dl>
  );
}

function Item({
  icon,
  label,
  testId,
  highlight = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  testId: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.item} data-highlight={highlight}>
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd data-testid={testId}>{children}</dd>
    </div>
  );
}
