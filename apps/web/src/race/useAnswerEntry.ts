import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicChallenge } from '@mind-racer/engine';

/** Keeps digits and a single leading minus sign. */
export function sanitizeAnswer(raw: string): string {
  const trimmed = raw.replace(/\s+/g, '').replace(/−/g, '-');
  const negative = trimmed.startsWith('-');
  const digits = trimmed.replace(/\D/g, '');
  return negative ? `-${digits}` : digits;
}

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '-' | 'backspace' | 'enter';

/**
 * Shared state for the keyboard input and the on-screen keypad.
 * Submits automatically once as many characters as the answer has are typed.
 */
export function useAnswerEntry(challenge: PublicChallenge | null, submit: (value: string) => void) {
  const [value, setValueState] = useState('');
  const valueRef = useRef('');
  const challengeRef = useRef(challenge);
  challengeRef.current = challenge;
  const seq = challenge?.seq ?? null;

  const setValue = useCallback((next: string) => {
    valueRef.current = next;
    setValueState(next);
  }, []);

  useEffect(() => {
    setValue('');
  }, [seq, setValue]);

  const commit = useCallback(
    (raw: string) => {
      const answer = sanitizeAnswer(raw);
      if (!challengeRef.current || answer === '' || answer === '-') return;
      setValue('');
      submit(answer);
    },
    [submit, setValue],
  );

  /** New full value from the text input. */
  const change = useCallback(
    (raw: string) => {
      const next = sanitizeAnswer(raw);
      const current = challengeRef.current;
      if (current && next !== '-' && next.length >= current.answerLength) commit(next);
      else setValue(next);
    },
    [commit, setValue],
  );

  /** One key from the on-screen keypad. */
  const press = useCallback(
    (key: KeypadKey) => {
      const prev = valueRef.current;
      if (key === 'enter') return commit(prev);
      if (key === 'backspace') return setValue(prev.slice(0, -1));
      if (key === '-') return setValue(prev.startsWith('-') ? prev.slice(1) : `-${prev}`);
      change(prev + key);
    },
    [change, commit, setValue],
  );

  return { value, change, press, commit: () => commit(valueRef.current) };
}
