import { useState, type ReactNode } from 'react';
import { CarProfile, FlagCheckered, Lock, Timer, Trophy, Gauge, Target } from '@phosphor-icons/react';
import { MATH_LEVELS, getLevelDefinition } from '@mind-racer/engine';
import { Button } from '../ui/Button';
import { formatDecimal, formatPercent, formatTime } from '../ui/format';
import { UNLOCK_MIN_ACCURACY, isLevelUnlocked, statsFor, type Profile } from '../progress/profile';
import styles from './Menu.module.css';

interface MenuProps {
  profile: Profile;
  initialLevel?: number;
  onStart: (level: number) => void;
}

export function Menu({ profile, initialLevel, onStart }: MenuProps) {
  const [level, setLevel] = useState(() =>
    initialLevel && isLevelUnlocked(profile, initialLevel) ? initialLevel : profile.unlockedLevel,
  );
  const def = getLevelDefinition(level);
  const stats = statsFor(profile, level);

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <CarProfile size={24} weight="fill" aria-hidden />
          <span>Mind Racer</span>
        </div>
        <span className={styles.pilot}>Piloto: {profile.name}</span>
      </header>

      <section className={styles.hero} aria-labelledby="menu-title">
        <h1 id="menu-title" className={styles.title}>
          Elige tu pista,
          <br />
          {profile.name}
        </h1>
        <p className={styles.lead}>
          Termina 1.º o 2.º con al menos {formatPercent(UNLOCK_MIN_ACCURACY)} de precisión en tu nivel más alto para
          desbloquear el siguiente.
        </p>
      </section>

      <div className={styles.layout}>
        <section aria-label="Niveles" className={styles.levels}>
          {MATH_LEVELS.map((l) => {
            const unlocked = isLevelUnlocked(profile, l.level);
            const selected = l.level === level;
            return (
              <button
                key={l.level}
                type="button"
                className={styles.level}
                data-selected={selected}
                disabled={!unlocked}
                aria-pressed={selected}
                aria-label={`Nivel ${l.level}: ${l.description}${unlocked ? '' : ' (bloqueado)'}`}
                onClick={() => setLevel(l.level)}
              >
                <span className={styles.levelNumber}>{l.level}</span>
                <span className={styles.levelText}>{l.description}</span>
                {!unlocked && <Lock size={16} weight="bold" className={styles.lock} aria-hidden />}
              </button>
            );
          })}
        </section>

        <aside className={styles.detail} aria-label={`Nivel ${level}`}>
          <span className={styles.detailKicker}>Nivel {level}</span>
          <h2 className={styles.detailTitle}>{def.description}</h2>
          <p className={styles.detailHint}>Tiempo objetivo por respuesta: {formatDecimal(def.targetTimeMs / 1000)} s</p>

          {stats.races === 0 ? (
            <p className={styles.empty}>Todavía no corres en este nivel. Tu primera carrera marcará tus récords.</p>
          ) : (
            <dl className={styles.stats}>
              <Stat icon={<FlagCheckered size={18} aria-hidden />} label="Carreras" value={String(stats.races)} />
              <Stat icon={<Trophy size={18} aria-hidden />} label="Victorias" value={String(stats.wins)} />
              <Stat
                icon={<Timer size={18} aria-hidden />}
                label="Mejor tiempo"
                value={stats.bestTimeMs === null ? 'Sin llegada' : formatTime(stats.bestTimeMs)}
              />
              <Stat
                icon={<Gauge size={18} aria-hidden />}
                label="Correctas por minuto"
                value={formatDecimal(stats.bestCorrectPerMinute)}
              />
              <Stat icon={<Target size={18} aria-hidden />} label="Precisión" value={formatPercent(stats.bestAccuracy)} />
            </dl>
          )}

          <Button size="large" className={styles.start} onClick={() => onStart(level)}>
            Correr en nivel {level}
          </Button>
        </aside>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
