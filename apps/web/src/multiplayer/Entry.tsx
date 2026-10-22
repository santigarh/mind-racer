import { useEffect, useId, useState, type FormEvent } from 'react';
import { ArrowLeft, Plus, SignIn, ChalkboardTeacher } from '@phosphor-icons/react';
import { ROOM_CODE_LENGTH, isRoomCode, normalizeRoomCode } from '@mind-racer/protocol';
import { Button } from '../ui/Button';
import styles from './Multiplayer.module.css';

/** After this long without a connection, assume the free server is waking up. */
export const WAKING_AFTER_MS = 5000;

export const DEVICE_OFFLINE_MESSAGE =
  'Sin conexión a internet. Jugar con amigos necesita internet; mientras tanto puedes correr contra los bots.';

interface EntryProps {
  pending: boolean;
  error: string | null;
  /** When the connection stopped being open; null while open. */
  offlineSince: number | null;
  /** The device has no internet: say so instead of blaming a sleeping server (design D5). */
  deviceOffline?: boolean;
  /** Code from a room link, shown in the field. */
  initialCode?: string;
  onCreate: () => void;
  /** Creates a class room where this person is the teacher (spec classroom-mode). */
  onCreateClass?: () => void;
  onJoin: (code: string) => void;
  onBack: () => void;
}

const codeFormatError = () => `El código tiene ${ROOM_CODE_LENGTH} letras o números, por ejemplo K7QF.`;

/** "Jugar con amigos": create a room or join one with its code. */
export function Entry({
  pending,
  error,
  offlineSince,
  deviceOffline = false,
  initialCode = '',
  onCreate,
  onCreateClass,
  onJoin,
  onBack,
}: EntryProps) {
  const codeId = useId();
  const errorId = useId();
  const [code, setCode] = useState(initialCode);
  // A malformed code from a room link gets the same message as one typed by hand.
  const [localError, setLocalError] = useState<string | null>(() =>
    initialCode && !isRoomCode(normalizeRoomCode(initialCode)) ? codeFormatError() : null,
  );
  const shownError = localError ?? error;
  const connecting = pending && offlineSince !== null;
  const waking = useElapsed(connecting ? offlineSince : null, WAKING_AFTER_MS);

  const join = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isRoomCode(normalized)) {
      setLocalError(codeFormatError());
      return;
    }
    setLocalError(null);
    onJoin(normalized);
  };

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <Button variant="ghost" size="small" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden />
          Volver al menú
        </Button>
      </header>

      <section className={styles.hero} aria-labelledby="mp-title">
        <h1 id="mp-title" className={styles.title}>
          Jugar con amigos
        </h1>
        <p className={styles.lead}>Crea una sala y comparte el código, o escribe el código que te pasaron.</p>
      </section>

      {connecting && (
        <p className={styles.banner} role="status">
          {deviceOffline
            ? DEVICE_OFFLINE_MESSAGE
            : waking
              ? 'Despertando el servidor, puede tardar hasta un minuto'
              : 'Conectando con el servidor…'}
        </p>
      )}

      <div className={styles.entryGrid}>
        <section className={styles.card} aria-labelledby="create-title">
          <h2 id="create-title" className={styles.cardTitle}>
            Crear sala
          </h2>
          <p className={styles.muted}>Serás el anfitrión: tú inicias cada carrera.</p>
          <Button size="large" onClick={onCreate} disabled={pending}>
            <Plus size={20} weight="bold" aria-hidden />
            Crear sala
          </Button>
        </section>

        {onCreateClass && (
          <section className={styles.card} aria-labelledby="class-title">
            <h2 id="class-title" className={styles.cardTitle}>
              Sala de clase
            </h2>
            <p className={styles.muted}>Para profesoras: proyecta el código y tus alumnos corren desde su celular.</p>
            <Button variant="secondary" size="large" onClick={onCreateClass} disabled={pending}>
              <ChalkboardTeacher size={20} aria-hidden />
              Crear sala de clase
            </Button>
          </section>
        )}

        <form className={styles.card} onSubmit={join} noValidate aria-labelledby="join-title">
          <h2 id="join-title" className={styles.cardTitle}>
            Unirse
          </h2>
          <label htmlFor={codeId} className={styles.label}>
            Código de la sala
          </label>
          <input
            id={codeId}
            className={styles.codeInput}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setLocalError(null);
            }}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="K7QF"
            aria-invalid={shownError !== null}
            aria-describedby={shownError ? errorId : undefined}
          />
          {shownError && (
            <p id={errorId} className={styles.error} role="alert">
              {shownError}
            </p>
          )}
          <Button type="submit" variant="secondary" size="large" disabled={pending}>
            <SignIn size={20} aria-hidden />
            Unirse
          </Button>
        </form>
      </div>
    </main>
  );
}

/** True once `ms` have passed since `since` (re-renders when the moment arrives). */
function useElapsed(since: number | null, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (since === null) {
      setElapsed(false);
      return;
    }
    const remaining = since + ms - Date.now();
    if (remaining <= 0) {
      setElapsed(true);
      return;
    }
    setElapsed(false);
    const timer = setTimeout(() => setElapsed(true), remaining);
    return () => clearTimeout(timer);
  }, [since, ms]);
  return elapsed;
}
