import { useId, useState } from 'react';
import { CalendarCheck, CheckCircle, Fire } from '@phosphor-icons/react';
import { MATH_LEVELS } from '@mind-racer/engine';
import type { Profile } from '../progress/profile';
import { Button } from '../ui/Button';
import { formatTime, ordinal } from '../ui/format';
import { currentStreak, msUntilNextDay, todayKey, type DailyData, type DailyResult } from './daily';
import { dailyShareText, longDate, streakText } from './shareText';
import { ShareResult } from './ShareResult';
import { useClock } from './useClock';
import styles from './Daily.module.css';

interface DailyCardProps {
  profile: Profile;
  daily: DailyData;
  onStart: (level: number) => void;
}

/** "Desafío de hoy" in the menu: pending (pick a level and race) or done today (design D5). */
export function DailyCard({ profile, daily, onStart }: DailyCardProps) {
  const now = useClock();
  const today = todayKey(now);
  const done = daily.results[today];
  const streak = currentStreak(daily, today);
  const [level, setLevel] = useState(profile.unlockedLevel);
  const levelId = useId();

  return (
    <section className={styles.card} aria-labelledby="daily-title" data-done={done !== undefined}>
      <div className={styles.heading}>
        <span className={styles.kicker}>
          <CalendarCheck size={18} aria-hidden />
          {longDate(today)}
        </span>
        <h2 id="daily-title" className={styles.title}>
          Desafío de hoy
        </h2>
      </div>

      {done ? (
        <>
          <p className={styles.done}>
            <CheckCircle size={20} weight="fill" aria-hidden />
            Hecho hoy
          </p>
          <p className={styles.summary}>{summary(done)}</p>
          <p className={styles.streak}>
            <Fire size={18} weight="fill" aria-hidden />
            {streakText(streak)}
            {daily.bestStreak > streak && <span className={styles.best}> · mejor {daily.bestStreak}</span>}
          </p>
          <p className={styles.next}>Nuevo desafío en {untilTomorrow(now)}</p>
          <ShareResult text={dailyShareText(today, done, streak)} />
        </>
      ) : (
        <>
          <p className={styles.lead}>La misma carrera para todos los que la corran hoy en tu nivel. Una vez por día.</p>
          <p className={styles.streak}>
            <Fire size={18} weight="fill" aria-hidden />
            {streak > 0 ? `${streakText(streak)}: córrelo hoy para mantenerla` : 'Empieza tu racha hoy'}
          </p>
          <div className={styles.actions}>
            <label className={styles.levelLabel} htmlFor={levelId}>
              Nivel
            </label>
            <select id={levelId} className={styles.select} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {MATH_LEVELS.filter((l) => l.level <= profile.unlockedLevel).map((l) => (
                <option key={l.level} value={l.level}>
                  {l.level} · {l.description}
                </option>
              ))}
            </select>
            <Button onClick={() => onStart(level)}>Correr el desafío</Button>
          </div>
        </>
      )}
    </section>
  );
}

function summary(result: DailyResult): string {
  const outcome =
    result.finished && result.finishTimeMs !== null
      ? `${ordinal(result.position)} · ${formatTime(result.finishTimeMs)}`
      : 'Sin llegar';
  return `Nivel ${result.level} · ${outcome} · ${result.correct}/${result.correct + result.wrong} correctas`;
}

/** "5 h 12 min", or "12 min" in the last hour. */
function untilTomorrow(now: Date): string {
  const minutes = Math.max(1, Math.ceil(msUntilNextDay(now) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
