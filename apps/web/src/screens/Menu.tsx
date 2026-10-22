import { useState, type ReactNode } from 'react';
import { CarProfile, FlagCheckered, Garage, Lock, Timer, Trophy, Gauge, Target, UsersThree } from '@phosphor-icons/react';
import { MATH_LEVELS, getLevelDefinition, type TablesSelection } from '@mind-racer/engine';
import { Button } from '../ui/Button';
import { SoundToggle } from '../ui/SoundToggle';
import { DailyCard } from '../daily/DailyCard';
import type { DailyData } from '../daily/daily';
import { formatDecimal, formatPercent, formatTime, tablesTitle } from '../ui/format';
import { EMPTY_TABLES, TablesPicker, toSelection, type TablesDraft } from '../tables/TablesPicker';
import { UNLOCK_MIN_ACCURACY, isLevelUnlocked, statsFor, type Profile } from '../progress/profile';
import { InstallButton, UpdateBanner } from '../pwa/PwaMenu';
import type { InstallStore } from '../pwa/install';
import type { UpdateStore } from '../pwa/updates';
import styles from './Menu.module.css';

interface MenuProps {
  profile: Profile;
  initialLevel?: number;
  onStart: (level: number) => void;
  /** Starts a multiplication tables practice against the bots. */
  onStartTables?: (tables: TablesSelection) => void;
  /** Tab and tables to show first (the last practice, while the app is open). */
  initialMode?: MenuMode;
  initialTables?: TablesSelection;
  /** Opens "Jugar con amigos". */
  onMultiplayer?: () => void;
  /** Opens the garage. */
  onGarage?: () => void;
  /** "Desafío de hoy": saved daily data and how to start today's race. */
  daily?: { data: DailyData; onStart: (level: number) => void };
  /** Shows "Hay una versión nueva" when one is waiting (spec installable-app). */
  update?: UpdateStore;
  /** Shows "Instalar app" while the browser offers it. */
  install?: InstallStore;
}

export type MenuMode = 'levels' | 'tables';

export function Menu({
  profile,
  initialLevel,
  onStart,
  onStartTables,
  initialMode = 'levels',
  initialTables,
  onMultiplayer,
  onGarage,
  daily,
  update,
  install,
}: MenuProps) {
  const [level, setLevel] = useState(() =>
    initialLevel && isLevelUnlocked(profile, initialLevel) ? initialLevel : profile.unlockedLevel,
  );
  const [mode, setMode] = useState<MenuMode>(onStartTables ? initialMode : 'levels');
  const [tables, setTables] = useState<TablesDraft>(initialTables ?? EMPTY_TABLES);
  const def = getLevelDefinition(level);
  const stats = statsFor(profile, level);
  const selection = toSelection(tables);

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <CarProfile size={24} weight="fill" aria-hidden />
          <span>Mind Racer</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.pilot}>Piloto: {profile.name}</span>
          {install && <InstallButton store={install} />}
          <SoundToggle />
          {onGarage && (
            <Button variant="secondary" size="small" onClick={onGarage} aria-label="Garaje">
              <Garage size={18} aria-hidden />
              <span className={styles.garageLabel}>Garaje</span>
            </Button>
          )}
          {onMultiplayer && (
            <Button variant="secondary" size="small" onClick={onMultiplayer}>
              <UsersThree size={18} aria-hidden />
              Jugar con amigos
            </Button>
          )}
        </div>
      </header>

      {update && <UpdateBanner store={update} />}

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

      {daily && <DailyCard profile={profile} daily={daily.data} onStart={daily.onStart} />}

      {onStartTables && (
        <div className={styles.modes} role="group" aria-label="Qué practicar">
          <button type="button" className={styles.mode} aria-pressed={mode === 'levels'} onClick={() => setMode('levels')}>
            Niveles
          </button>
          <button type="button" className={styles.mode} aria-pressed={mode === 'tables'} onClick={() => setMode('tables')}>
            Tablas
          </button>
        </div>
      )}

      {mode === 'tables' && onStartTables ? (
        <div className={styles.layout}>
          <section aria-label="Elegir tablas" className={styles.tablesPanel}>
            <TablesPicker value={tables} onChange={setTables} />
          </section>
          <aside className={styles.detail} aria-label="Práctica de tablas">
            <span className={styles.detailKicker}>Práctica de tablas</span>
            <h2 className={styles.detailTitle}>{selection ? tablesTitle(selection) : 'Elige una o más tablas'}</h2>
            <p className={styles.detailHint}>
              Del ×1 al ×10, en los dos órdenes. Es solo práctica: no cuenta para tu progreso.
            </p>
            <Button
              size="large"
              className={styles.start}
              disabled={!selection}
              onClick={() => selection && onStartTables(selection)}
            >
              Correr tablas
            </Button>
          </aside>
        </div>
      ) : (
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
      )}
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
