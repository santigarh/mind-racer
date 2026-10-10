import { useId, useState, type FormEvent } from 'react';
import { ArrowRight, CarProfile } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import {
  NAME_MAX_LENGTH,
  STARTING_POINTS,
  createProfile,
  normalizeName,
  type Profile,
  type StartingPoint,
} from '../progress/profile';
import styles from './Onboarding.module.css';

interface OnboardingProps {
  onDone: (profile: Profile) => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const nameId = useId();
  const errorId = useId();
  const [name, setName] = useState('');
  const [start, setStart] = useState<StartingPoint>('beginner');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (normalizeName(name) === null) {
      setError(`Escribe un nombre de 1 a ${NAME_MAX_LENGTH} caracteres.`);
      return;
    }
    onDone(createProfile(name, start));
  };

  return (
    <main id="main" className={styles.page}>
      <form className={styles.card} onSubmit={submit} noValidate>
        <div className={styles.brand}>
          <CarProfile size={32} weight="fill" aria-hidden />
          <span>Mind Racer</span>
        </div>
        <h1 className={styles.title}>Acelera con cada respuesta correcta</h1>
        <p className={styles.lead}>Resuelve cálculos mentales para ganarle a tus rivales. Primero, cuéntanos quién corre.</p>

        <label className={styles.label} htmlFor={nameId}>
          Tu nombre de piloto
        </label>
        <input
          id={nameId}
          className={styles.input}
          value={name}
          maxLength={NAME_MAX_LENGTH + 10}
          autoComplete="nickname"
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        {error && (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>¿Desde dónde quieres empezar?</legend>
          <div className={styles.options}>
            {STARTING_POINTS.map((point) => (
              <label key={point.id} className={styles.option} data-selected={start === point.id}>
                <input
                  type="radio"
                  name="start"
                  value={point.id}
                  checked={start === point.id}
                  onChange={() => setStart(point.id)}
                  className="visually-hidden"
                />
                <span className={styles.optionTitle}>{point.label}</span>
                <span className={styles.optionLevel}>Nivel {point.level}</span>
                <span className={styles.optionHint}>{point.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" size="large" className={styles.submit}>
          Empezar a correr
          <ArrowRight size={20} weight="bold" aria-hidden />
        </Button>
      </form>
    </main>
  );
}
