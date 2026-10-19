import { TABLES_MAX, TABLES_MIN, type TablesSelection } from '@mind-racer/engine';
import styles from './TablesPicker.module.css';

const TABLES = Array.from({ length: TABLES_MAX - TABLES_MIN + 1 }, (_, i) => TABLES_MIN + i);

/** What is being chosen; unlike a TablesSelection it may still have no table. */
export type TablesDraft = TablesSelection;

export const EMPTY_TABLES: TablesDraft = { tables: [], divisions: false };

/** The draft as a practice, or null while no table is chosen. */
export function toSelection(draft: TablesDraft): TablesSelection | null {
  return draft.tables.length > 0 ? { tables: [...draft.tables].sort((a, b) => a - b), divisions: draft.divisions } : null;
}

interface TablesPickerProps {
  value: TablesDraft;
  onChange: (next: TablesDraft) => void;
  /** Bigger buttons for the projector. */
  size?: 'normal' | 'large';
}

/** Tables 2–10 (several at once) and the "Con divisiones" switch, off by default (spec tables-practice). */
export function TablesPicker({ value, onChange, size = 'normal' }: TablesPickerProps) {
  const toggle = (n: number) => {
    const tables = value.tables.includes(n) ? value.tables.filter((t) => t !== n) : [...value.tables, n];
    onChange({ ...value, tables: tables.sort((a, b) => a - b) });
  };
  return (
    <div className={styles.picker} data-size={size}>
      <div className={styles.tables} role="group" aria-label="Tablas">
        {TABLES.map((n) => {
          const selected = value.tables.includes(n);
          return (
            <button
              key={n}
              type="button"
              className={styles.table}
              aria-pressed={selected}
              aria-label={`Tabla del ${n}`}
              onClick={() => toggle(n)}
            >
              {n}
            </button>
          );
        })}
      </div>
      <label className={styles.divisions}>
        <input
          type="checkbox"
          role="switch"
          checked={value.divisions}
          onChange={(e) => onChange({ ...value, divisions: e.target.checked })}
        />
        Con divisiones
      </label>
    </div>
  );
}
