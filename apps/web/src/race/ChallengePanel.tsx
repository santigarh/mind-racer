import { useEffect, useRef } from 'react';
import { Check, Lightning, X } from '@phosphor-icons/react';
import type { AnswerOutcome, PublicChallenge } from '@mind-racer/engine';
import { Keypad } from './Keypad';
import { useAnswerEntry } from './useAnswerEntry';
import styles from './ChallengePanel.module.css';

interface ChallengePanelProps {
  challenge: PublicChallenge | null;
  lastAnswer: AnswerOutcome | null;
  disabled: boolean;
  showKeypad: boolean;
  onSubmit: (value: string) => void;
}

export function ChallengePanel({ challenge, lastAnswer, disabled, showKeypad, onSubmit }: ChallengePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const entry = useAnswerEntry(disabled ? null : challenge, onSubmit);

  // Keep the field focused for every new challenge and after pauses.
  const seq = challenge?.seq ?? null;
  useEffect(() => {
    if (!disabled && seq !== null) inputRef.current?.focus({ preventScroll: true });
  }, [seq, disabled]);

  return (
    <section className={styles.panel} aria-label="Desafío">
      <div className={styles.promptRow}>
        <span className={styles.level}>Nivel {challenge?.level ?? '·'}</span>
        <p key={challenge?.seq} className={styles.prompt} aria-live="polite" data-testid="challenge-prompt">
          {challenge ? challenge.prompt : '·'}
        </p>
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          entry.commit();
        }}
      >
        <label htmlFor="answer" className="visually-hidden">
          Tu respuesta
        </label>
        <input
          ref={inputRef}
          id="answer"
          className={styles.input}
          value={entry.value}
          onChange={(e) => entry.change(e.target.value)}
          inputMode={showKeypad ? 'none' : 'numeric'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          disabled={disabled}
          data-length={challenge?.answerLength ?? 0}
          placeholder={challenge ? '?'.repeat(challenge.answerLength) : ''}
        />
      </form>

      <Feedback outcome={lastAnswer} />

      {showKeypad && <Keypad onKey={entry.press} disabled={disabled} />}
    </section>
  );
}

function Feedback({ outcome }: { outcome: AnswerOutcome | null }) {
  if (!outcome) return <p className={styles.feedback} aria-hidden />;
  return (
    <p
      key={outcome.seq}
      className={styles.feedback}
      data-result={outcome.correct ? 'ok' : 'error'}
      role="status"
      data-testid="answer-feedback"
    >
      {outcome.correct ? (
        <>
          <Check size={20} weight="bold" aria-hidden />
          Correcto
          {outcome.nitro && (
            <span className={styles.nitro}>
              <Lightning size={18} weight="fill" aria-hidden />
              Nitro
            </span>
          )}
        </>
      ) : (
        <>
          <X size={20} weight="bold" aria-hidden />
          Era {outcome.expected}
        </>
      )}
    </p>
  );
}
