import type { MouseEvent, PointerEvent } from 'react';
import { Backspace, KeyReturn } from '@phosphor-icons/react';
import type { KeypadKey } from './useAnswerEntry';
import styles from './Keypad.module.css';

interface KeypadProps {
  onKey: (key: KeypadKey) => void;
  disabled?: boolean;
}

/** Four columns: digits on the left, delete and sign on the right. */
const ROWS: KeypadKey[][] = [
  ['1', '2', '3', 'backspace'],
  ['4', '5', '6', '-'],
  ['7', '8', '9', '0'],
];

export function Keypad({ onKey, disabled = false }: KeypadProps) {
  // pointerdown keeps the text input focused and feels instant on touch screens.
  const bind = (key: KeypadKey) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      if (!disabled) onKey(key);
    },
    onClick: (e: MouseEvent) => {
      // Keyboard activation (Enter/Space on a focused key) arrives as a click with detail 0.
      if (e.detail === 0 && !disabled) onKey(key);
    },
    disabled,
  });

  return (
    <div className={styles.keypad} role="group" aria-label="Teclado numérico">
      {ROWS.flat().map((key) => (
        <button
          key={key}
          type="button"
          className={styles.key}
          aria-label={key === '-' ? 'Signo menos' : key === 'backspace' ? 'Borrar' : undefined}
          {...bind(key)}
        >
          {key === 'backspace' ? <Backspace size={24} aria-hidden /> : key === '-' ? '−' : key}
        </button>
      ))}
      <button type="button" className={`${styles.key} ${styles.enter}`} {...bind('enter')}>
        <KeyReturn size={24} aria-hidden />
        Enviar
      </button>
    </div>
  );
}
