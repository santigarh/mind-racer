import { useCallback, useEffect, useRef, useState } from 'react';
import { ChartBar, FlagCheckered, SignOut, WifiSlash } from '@phosphor-icons/react';
import type { RaceSnapshot } from '@mind-racer/engine';
import type { RaceViewSource } from '../game/RaceViewSource';
import { useRaceController } from '../game/useRaceController';
import { Button } from '../ui/Button';
import { SoundToggle } from '../ui/SoundToggle';
import { formatTime, ordinal } from '../ui/format';
import { ChallengePanel } from './ChallengePanel';
import { Hud } from './Hud';
import { Overlay } from './Overlay';
import { Track } from './Track';
import { useCoarsePointer } from './useCoarsePointer';
import { useNarrowScreen } from './useNarrowScreen';
import { useRaceFeedback, type RaceFeedbackOptions } from './useRaceFeedback';
import { useSettings } from '../settings/settings';
import styles from './RaceScreen.module.css';

const EXIT_DIALOG = 'exit-dialog';
const GO_SIGNAL_MS = 800;
/** Leaders a student sees on a phone in a class race (spec classroom-mode › Vista del alumno). */
const PHONE_LEADERS = 3;

interface RaceScreenProps {
  controller: RaceViewSource;
  onFinish: (snapshot: RaceSnapshot) => void;
  onAbandon: () => void;
  /** Header title; "Carrera · nivel N" by default. */
  title?: string;
  /** Exit dialog text for a local race, when it differs from the default. */
  exitNote?: string;
  /** Injected sound and vibration, for tests. */
  feedback?: Omit<RaceFeedbackOptions, 'enabled'>;
}

export function RaceScreen({ controller, onFinish, onAbandon, title, exitNote, feedback }: RaceScreenProps) {
  const state = useRaceController(controller);
  const { sound } = useSettings();
  useRaceFeedback(state, controller.playerId, { ...feedback, enabled: sound });
  const { snapshot } = state;
  const coarse = useCoarsePointer();
  const narrow = useNarrowScreen();
  const [confirmExit, setConfirmExit] = useState(false);
  const player = snapshot.runners.find((r) => r.id === controller.playerId)!;
  const finished = snapshot.phase === 'finished';
  const online = controller.mode === 'network';
  // Class races only send you and the leaders; on phones show the first 3 so the race still fits.
  const visible = state.visibleRunnerIds;
  const trackRunners = visible
    ? snapshot.runners.filter(
        (r) => visible.includes(r.id) && (r.id === controller.playerId || !narrow || r.position <= PHONE_LEADERS),
      )
    : snapshot.runners;

  const openExit = useCallback(() => {
    if (finished) return;
    controller.hold(EXIT_DIALOG);
    setConfirmExit(true);
  }, [controller, finished]);

  const keepRacing = useCallback(() => {
    setConfirmExit(false);
    controller.release(EXIT_DIALOG);
  }, [controller]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (confirmExit) keepRacing();
      else openExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmExit, keepRacing, openExit]);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  useEffect(() => {
    if (!finished) return;
    const final = controller.getState().snapshot;
    const timer = setTimeout(() => onFinishRef.current(final), controller.resultsDelayMs);
    return () => clearTimeout(timer);
  }, [finished, controller]);

  const submit = useCallback((value: string) => controller.submit(value), [controller]);

  const overlay = (() => {
    if (confirmExit || finished) return null;
    if (state.resumeRemainingMs > 0) {
      return <Overlay title={String(Math.ceil(state.resumeRemainingMs / 1000))} subtitle="Volvemos a correr" />;
    }
    if (state.paused) return <Overlay title="Pausa" tone="pause" subtitle="La carrera sigue cuando vuelvas" />;
    if (snapshot.phase === 'countdown' || snapshot.phase === 'waiting') {
      return <Overlay title={String(Math.ceil(snapshot.countdownRemainingMs / 1000))} subtitle="Prepárate" />;
    }
    if (snapshot.phase === 'racing' && snapshot.elapsedMs < GO_SIGNAL_MS) return <Overlay title="¡Ya!" tone="go" />;
    return null;
  })();

  const playerDone = player.finishTimeMs !== null;
  const canAnswer = snapshot.phase === 'racing' && !state.paused && !playerDone;

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title ?? `Carrera · nivel ${snapshot.level}`}</h1>
        <div className={styles.headerActions}>
          <SoundToggle />
          <Button variant="ghost" size="small" onClick={openExit} disabled={finished}>
            <SignOut size={18} aria-hidden />
            Salir
          </Button>
        </div>
      </header>

      {state.reconnecting && (
        <p className={styles.reconnecting} role="status">
          <WifiSlash size={18} aria-hidden />
          Reconectando…
        </p>
      )}

      <Hud player={player} runnerCount={snapshot.runners.length} elapsedMs={snapshot.elapsedMs} />

      <div className={styles.arena}>
        <Track
          runners={trackRunners}
          distance={snapshot.distance}
          playerId={controller.playerId}
          botProfiles={state.botProfiles}
          cars={state.cars}
          showLevels={online}
          presence={state.presence}
        />
        {overlay}
      </div>

      {playerDone ? (
        <section className={styles.done} role="status">
          <FlagCheckered size={32} weight="fill" aria-hidden />
          <p className={styles.doneTitle}>
            Llegaste {ordinal(player.position)} en {formatTime(player.finishTimeMs!)}
          </p>
          <p className={styles.doneHint}>{finished ? 'Carrera terminada' : 'Esperando a los demás corredores'}</p>
          {!finished && controller.canFinishNow() && (
            <Button
              className={styles.doneAction}
              onClick={() => {
                const final = controller.finishNow();
                if (final) onFinishRef.current(final);
              }}
              autoFocus
            >
              <ChartBar size={20} weight="bold" aria-hidden />
              Ver resultados
            </Button>
          )}
        </section>
      ) : (
        <ChallengePanel
          challenge={snapshot.phase === 'racing' && !state.paused ? player.challenge : null}
          lastAnswer={player.lastAnswer}
          disabled={!canAnswer}
          showKeypad={coarse}
          onSubmit={submit}
        />
      )}

      {confirmExit && (
        <div className={styles.backdrop}>
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="exit-title">
            <h2 id="exit-title" className={styles.dialogTitle}>
              ¿Salir de la carrera?
            </h2>
            <p className={styles.dialogText}>
              {online
                ? 'Tu auto quedará detenido y esta carrera no contará para tus estadísticas ni desbloqueos.'
                : (exitNote ?? 'Esta carrera no contará para tus estadísticas ni desbloqueos.')}
            </p>
            <div className={styles.dialogActions}>
              <Button variant="secondary" onClick={onAbandon}>
                {online ? 'Volver a la sala' : 'Salir al menú'}
              </Button>
              <Button onClick={keepRacing} autoFocus>
                Seguir corriendo
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
