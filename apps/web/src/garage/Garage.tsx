import { ArrowLeft, Lock } from '@phosphor-icons/react';
import type { Car } from '@mind-racer/protocol';
import type { DailyData } from '../daily/daily';
import type { Profile } from '../progress/profile';
import { Button } from '../ui/Button';
import { BODIES, PAINTS, bodyInfo, paintInfo } from './catalog';
import { CarIcon } from './CarIcon';
import { effectiveCar, garageStore, useGarageChoice, type GarageStore } from './choice';
import { isUnlocked, progressOf, requirementText } from './unlocks';
import styles from './Garage.module.css';

interface GarageProps {
  profile: Profile;
  daily: Pick<DailyData, 'bestStreak'>;
  onBack: () => void;
  store?: GarageStore;
}

/** Pick a vehicle and a paint among the ones earned by playing (design D6). */
export function Garage({ profile, daily, onBack, store = garageStore }: GarageProps) {
  const saved = useGarageChoice(store);
  const progress = progressOf(profile, daily);
  const car = effectiveCar(saved, progress);
  // Read the store at click time: two quick clicks must not overwrite each other with a stale car.
  const choose = (change: Partial<Car>) => store.set({ ...effectiveCar(store.get(), progress), ...change });

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <Button variant="ghost" size="small" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden />
          Volver al menú
        </Button>
      </header>

      <section className={styles.hero} aria-labelledby="garage-title">
        <h1 id="garage-title" className={styles.title}>
          Garaje
        </h1>
        <p className={styles.lead}>Corre, gana y mantén tu racha del desafío diario para desbloquear vehículos y pinturas.</p>
      </section>

      <div className={styles.layout}>
        <figure className={styles.preview} aria-label="Tu auto">
          <div className={styles.road}>
            <CarIcon car={car} size={96} className={styles.previewCar} />
          </div>
          <figcaption className={styles.caption}>
            {bodyInfo(car.body).name} · {paintInfo(car.paint).name}
          </figcaption>
        </figure>

        <div className={styles.choices}>
          <section aria-labelledby="bodies-title">
            <h2 id="bodies-title" className={styles.groupTitle}>
              Vehículos
            </h2>
            <div className={styles.grid} role="group" aria-labelledby="bodies-title">
              {BODIES.map((body) => {
                const unlocked = isUnlocked(body, progress);
                const hint = requirementText(body, progress);
                return (
                  <button
                    key={body.id}
                    type="button"
                    className={styles.option}
                    aria-pressed={car.body === body.id}
                    disabled={!unlocked}
                    aria-label={unlocked ? body.name : `${body.name} (bloqueado): ${hint}`}
                    onClick={() => choose({ body: body.id })}
                  >
                    <CarIcon car={{ body: body.id, paint: unlocked ? car.paint : 'white' }} size={40} />
                    <span className={styles.optionName}>{body.name}</span>
                    {!unlocked && (
                      <span className={styles.locked}>
                        <Lock size={14} weight="bold" aria-hidden />
                        {hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="paints-title">
            <h2 id="paints-title" className={styles.groupTitle}>
              Pinturas
            </h2>
            <div className={styles.grid} role="group" aria-labelledby="paints-title">
              {PAINTS.map((paint) => {
                const unlocked = isUnlocked(paint, progress);
                const hint = requirementText(paint, progress);
                return (
                  <button
                    key={paint.id}
                    type="button"
                    className={styles.option}
                    aria-pressed={car.paint === paint.id}
                    disabled={!unlocked}
                    aria-label={unlocked ? paint.name : `${paint.name} (bloqueado): ${hint}`}
                    onClick={() => choose({ paint: paint.id })}
                  >
                    <span className={styles.swatch} style={{ background: paint.color }} aria-hidden />
                    <span className={styles.optionName}>{paint.name}</span>
                    {!unlocked && (
                      <span className={styles.locked}>
                        <Lock size={14} weight="bold" aria-hidden />
                        {hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
