import { useId, useState, type FormEvent } from 'react';
import { ArrowLeft, Plus, SignIn } from '@phosphor-icons/react';
import { ROOM_CODE_LENGTH, isRoomCode, normalizeRoomCode } from '@mind-racer/protocol';
import { Button } from '../ui/Button';
import styles from './Multiplayer.module.css';

interface EntryProps {
  pending: boolean;
  error: string | null;
  reconnecting: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onBack: () => void;
}

/** "Jugar con amigos": create a room or join one with its code. */
export function Entry({ pending, error, reconnecting, onCreate, onJoin, onBack }: EntryProps) {
  const codeId = useId();
  const errorId = useId();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;

  const join = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isRoomCode(normalized)) {
      setLocalError(`El código tiene ${ROOM_CODE_LENGTH} letras o números, por ejemplo K7QF.`);
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

      {reconnecting && <p className={styles.banner} role="status">Conectando con el servidor…</p>}

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
