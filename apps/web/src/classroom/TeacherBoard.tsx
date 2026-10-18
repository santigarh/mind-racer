import { useState, type CSSProperties } from 'react';
import { ArrowCounterClockwise, DownloadSimple, FlagCheckered, Play, UserMinus, WifiSlash, X } from '@phosphor-icons/react';
import type { RunnerResult } from '@mind-racer/engine';
import type { Presence, RoomPlayer } from '@mind-racer/protocol';
import type { NetworkRaceController } from '../game/NetworkRaceController';
import { useRaceController } from '../game/useRaceController';
import { CarIcon } from '../garage/CarIcon';
import { paintInfo } from '../garage/catalog';
import { RoomQr } from '../multiplayer/RoomQr';
import { roomLink } from '../multiplayer/roomLink';
import type { RoomMessage } from '../net/MultiplayerSession';
import { Button } from '../ui/Button';
import { formatTime, ordinal } from '../ui/format';
import { csvFileName, downloadCsv, toCsv } from './csv';
import { STANDINGS_HEADERS, standingsRows } from './standings';
import styles from './TeacherBoard.module.css';

interface Common {
  room: RoomMessage;
  /** "Cerrar sala": ends the class for everyone. */
  onClose: () => void;
}

/** Two-step button: the first press asks, the second does it. */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  variant = 'ghost',
  icon,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: 'ghost' | 'secondary';
  icon?: React.ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant={variant} size="small" onClick={() => setAsking(true)} aria-label={label}>
        {icon}
        {label}
      </Button>
    );
  }
  return (
    <span className={styles.confirm}>
      <Button variant="secondary" size="small" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="ghost" size="small" onClick={() => setAsking(false)} aria-label="Cancelar">
        <X size={16} aria-hidden />
      </Button>
    </span>
  );
}

function BoardHeader({ room, onClose, title }: Common & { title: string }) {
  return (
    <header className={styles.header}>
      <div>
        <span className={styles.kicker}>Sala de clase · {room.code}</span>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <ConfirmButton label="Cerrar sala" confirmLabel="Sí, cerrar la sala" onConfirm={onClose} variant="secondary" />
    </header>
  );
}

const ready = (p: RoomPlayer) => p.role !== 'teacher' && p.connected && (p.status === 'lobby' || p.status === 'results');

/** Lobby on the projector: big code and QR, the students, and the start button (design D6). */
export function BoardLobby({
  room,
  onClose,
  onStart,
  onKick,
}: Common & { onStart: () => void; onKick: (playerId: string) => void }) {
  const students = room.players.filter((p) => p.role !== 'teacher');
  const canStart = students.some(ready) && room.phase === 'lobby';
  return (
    <main id="main" className={styles.page}>
      <BoardHeader room={room} onClose={onClose} title="Entren con el código" />

      <div className={styles.lobby}>
        <section className={styles.join} aria-label="Cómo entrar">
          <strong className={styles.code} data-testid="room-code">
            {room.code}
          </strong>
          <div className={styles.qr}>
            <RoomQr url={roomLink(room.code)} />
          </div>
          <p className={styles.muted}>Escaneen el QR o entren a Jugar con amigos → Unirse.</p>
        </section>

        <section className={styles.students} aria-labelledby="students-title">
          <h2 id="students-title" className={styles.sectionTitle}>
            Alumnos <span className={styles.muted}>{students.length} de 40</span>
          </h2>
          {students.length === 0 ? (
            <p className={styles.empty}>Todavía no entra nadie. Cuando escaneen el QR aparecerán aquí.</p>
          ) : (
            <ul className={styles.studentList}>
              {students.map((s) => (
                <li key={s.id} className={styles.student} aria-label={`${s.name}, nivel ${s.level}`}>
                  {s.car && <CarIcon car={s.car} size={20} />}
                  <span className={styles.studentName}>{s.name}</span>
                  <span className={styles.level}>N{s.level}</span>
                  {!s.connected && <WifiSlash size={16} className={styles.offline} aria-label="Desconectado" />}
                  <ConfirmButton
                    label={`Quitar a ${s.name}`}
                    confirmLabel="Quitar"
                    icon={<UserMinus size={16} aria-hidden />}
                    onConfirm={() => onKick(s.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          <Button size="large" className={styles.start} onClick={onStart} disabled={!canStart}>
            <Play size={20} weight="fill" aria-hidden />
            Iniciar carrera
          </Button>
        </section>
      </div>
    </main>
  );
}

/** Columns that keep the whole class on a 720 px projector: up to 12 rows in one, 26 in two, 40 in three. */
export function boardColumns(count: number): number {
  return count <= 12 ? 1 : count <= 26 ? 2 : 3;
}

/** The race on the projector: every student by position, top to bottom then the next column (design D6). */
export function BoardRace({ room, onClose, race }: Common & { race: NetworkRaceController }) {
  const state = useRaceController(race);
  const { snapshot } = state;
  const rows = [...snapshot.runners].sort((a, b) => a.position - b.position);
  const counting = snapshot.phase === 'countdown' || snapshot.phase === 'waiting';
  return (
    <main id="main" className={styles.page}>
      <BoardHeader room={room} onClose={onClose} title="Carrera en curso" />
      <p className={styles.clock} aria-live="off">
        {counting ? `Empieza en ${Math.ceil(snapshot.countdownRemainingMs / 1000)}` : formatTime(Math.max(0, snapshot.elapsedMs))}
      </p>
      <ol
        className={styles.board}
        aria-label="Avance de la clase"
        style={{ '--cols': boardColumns(rows.length), '--rows': Math.ceil(rows.length / boardColumns(rows.length)) } as CSSProperties}
      >
        {rows.map((r) => {
          const car = state.cars[r.id];
          const progress = Math.min(1, r.distance / snapshot.distance);
          const away = state.presence[r.id] === 'left' || state.presence[r.id] === 'disconnected';
          return (
            <li
              key={r.id}
              className={styles.row}
              data-away={away}
              aria-label={`${ordinal(r.position)} ${r.name}, ${Math.round(progress * 100)} %`}
              style={{ '--progress': progress.toFixed(4), '--paint': car ? paintInfo(car.paint).color : 'var(--accent)' } as CSSProperties}
            >
              <span className={styles.pos}>{ordinal(r.position)}</span>
              <span className={styles.rowName}>{r.name}</span>
              <span className={styles.level}>N{r.chosenLevel}</span>
              <span className={styles.bar}>
                <span className={styles.fill} />
                {car && <CarIcon car={car} size={20} className={styles.barCar} painted={false} />}
              </span>
              {r.finishTimeMs !== null && <FlagCheckered size={18} weight="fill" aria-label="Llegó" />}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/** Final standings on the projector, with the CSV download and the next race (design D6, D7). */
export function BoardResults({
  room,
  onClose,
  results,
  presence,
  distance,
  raceNumber,
  startedAt,
  onNext,
}: Common & {
  results: readonly RunnerResult[];
  presence: Readonly<Record<string, Presence>>;
  /** Length of the race, for each student's progress. */
  distance: number;
  raceNumber: number;
  /** Unix ms when the race started; null with an older server (the download date is used then). */
  startedAt: number | null;
  onNext: () => void;
}) {
  const rows = standingsRows(results, presence, distance);
  const download = () =>
    downloadCsv(toCsv(results, presence, distance), csvFileName(room.code, new Date(startedAt ?? Date.now()), raceNumber));
  return (
    <main id="main" className={styles.page}>
      <BoardHeader room={room} onClose={onClose} title="Resultados" />
      <div className={styles.actions}>
        <Button variant="secondary" size="large" onClick={download}>
          <DownloadSimple size={20} weight="bold" aria-hidden />
          Descargar CSV
        </Button>
        <Button size="large" onClick={onNext}>
          <ArrowCounterClockwise size={20} weight="bold" aria-hidden />
          Nueva carrera
        </Button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {STANDINGS_HEADERS.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {r.cells.map((c, i) => (
                  <td key={STANDINGS_HEADERS[i]}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
