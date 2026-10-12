import type { CSSProperties } from 'react';
import { ArrowCounterClockwise, Fire, House, LockOpen, SignOut, Star, UsersThree } from '@phosphor-icons/react';
import type { BotProfileId, RaceSnapshot } from '@mind-racer/engine';
import type { Presence } from '@mind-racer/protocol';
import { Button } from '../ui/Button';
import { formatDecimal, formatPercent, formatTime, ordinal } from '../ui/format';
import type { ProgressUpdate } from '../progress/profile';
import { PRESENCE_TEXT, laneColor } from '../race/Track';
import { ShareResult } from '../daily/ShareResult';
import { streakText } from '../daily/shareText';
import styles from './Results.module.css';

interface ResultsProps {
  snapshot: RaceSnapshot;
  playerId: string;
  botProfiles: Readonly<Record<string, BotProfileId>>;
  update: ProgressUpdate;
  /** Local: "Correr de nuevo". Online: "Volver a la sala". */
  onPlayAgain: () => void;
  /** Local: "Volver al menú". Online: "Salir de la sala". */
  onMenu: () => void;
  online?: boolean;
  presence?: Readonly<Record<string, Presence>>;
  /** Daily challenge: the streak and the text to share; replaces "Correr de nuevo" with "Compartir resultado". */
  daily?: { streak: number; shareText: string };
}

export function Results({
  snapshot,
  playerId,
  botProfiles,
  update,
  onPlayAgain,
  onMenu,
  online = false,
  presence = {},
  daily,
}: ResultsProps) {
  const results = snapshot.results ?? [];
  const me = results.find((r) => r.id === playerId)!;
  const headline = me.position === 1 ? 'Ganaste la carrera' : `Terminaste ${ordinal(me.position)}`;
  const highlights: string[] = [];
  if (update.records.time) highlights.push('Nuevo récord de tiempo');
  if (update.records.correctPerMinute) highlights.push('Nuevo récord de correctas por minuto');
  if (update.records.accuracy) highlights.push('Nuevo récord de precisión');

  return (
    <main id="main" className={styles.page}>
      <section className={styles.hero} aria-labelledby="results-title">
        <span className={styles.kicker}>{daily ? `Desafío diario · Nivel ${snapshot.level}` : `Nivel ${snapshot.level}`}</span>
        <h1 id="results-title" className={styles.title}>
          {headline}
        </h1>
        <p className={styles.lead}>
          {me.finished
            ? `Cruzaste la meta en ${formatTime(me.finishTimeMs!)}.`
            : `Se acabó el tiempo con ${Math.round(me.distance)} de ${snapshot.distance} metros recorridos.`}
        </p>
      </section>

      {(daily || update.unlockedLevel !== null || highlights.length > 0) && (
        <ul className={styles.badges} aria-label="Logros">
          {daily && (
            <li className={styles.badge} data-kind="streak">
              <Fire size={20} weight="fill" aria-hidden />
              {streakText(daily.streak)}
            </li>
          )}
          {update.unlockedLevel !== null && (
            <li className={styles.badge} data-kind="unlock">
              <LockOpen size={20} weight="bold" aria-hidden />
              Desbloqueaste el nivel {update.unlockedLevel}
            </li>
          )}
          {highlights.map((text) => (
            <li key={text} className={styles.badge}>
              <Star size={20} weight="fill" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      )}

      <dl className={styles.stats} aria-label="Tus estadísticas">
        <Stat label="Posición" value={ordinal(me.position)} />
        <Stat label="Tiempo" value={me.finishTimeMs === null ? 'Sin llegada' : formatTime(me.finishTimeMs)} />
        <Stat label="Aciertos" value={String(me.correct)} />
        <Stat label="Errores" value={String(me.wrong)} />
        <Stat label="Precisión" value={formatPercent(me.accuracy)} />
        <Stat label="Correctas por minuto" value={formatDecimal(me.correctPerMinute)} />
        <Stat label="Nivel máximo" value={String(me.maxLevel)} />
      </dl>

      <section className={styles.tableWrap} aria-labelledby="ranking-title">
        <h2 id="ranking-title" className={styles.tableTitle}>
          Clasificación
        </h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Pos.</th>
              <th scope="col">Corredor</th>
              {online && <th scope="col">Nivel</th>}
              <th scope="col">Tiempo</th>
              <th scope="col" className={styles.optional}>
                Aciertos
              </th>
              <th scope="col" className={styles.optional}>
                Precisión
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.id}
                data-player={r.id === playerId}
                style={{ '--lane-color': laneColor(r.id, playerId, botProfiles, results.map((x) => x.id)) } as CSSProperties}
              >
                <td className={styles.pos}>{ordinal(r.position)}</td>
                <td>
                  {r.name}
                  {presence[r.id] && PRESENCE_TEXT[presence[r.id]!] && (
                    <span className={styles.away}> · {PRESENCE_TEXT[presence[r.id]!]}</span>
                  )}
                </td>
                {online && <td className={styles.num}>N{r.chosenLevel}</td>}
                <td className={styles.num}>
                  {r.finishTimeMs === null ? `${Math.round(r.distance)} m` : formatTime(r.finishTimeMs)}
                </td>
                <td className={`${styles.num} ${styles.optional}`}>{r.correct}</td>
                <td className={`${styles.num} ${styles.optional}`}>{formatPercent(r.accuracy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className={styles.actions}>
        <Button variant="secondary" size="large" onClick={onMenu}>
          {online ? <SignOut size={20} aria-hidden /> : <House size={20} aria-hidden />}
          {online ? 'Salir de la sala' : 'Volver al menú'}
        </Button>
        {daily ? (
          <ShareResult text={daily.shareText} size="large" />
        ) : (
        <Button size="large" onClick={onPlayAgain} autoFocus>
          {online ? (
            <UsersThree size={20} weight="bold" aria-hidden />
          ) : (
            <ArrowCounterClockwise size={20} weight="bold" aria-hidden />
          )}
          {online ? 'Volver a la sala' : 'Correr de nuevo'}
        </Button>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
