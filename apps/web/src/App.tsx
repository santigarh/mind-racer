import { useCallback, useState } from 'react';
import { randomSeed, type RaceSnapshot } from '@mind-racer/engine';
import { RaceController, type RaceControllerOptions } from './game/RaceController';
import { applyRaceResult, type Profile, type ProgressUpdate } from './progress/profile';
import { loadProfile, saveProfile } from './progress/storage';
import { RaceScreen } from './race/RaceScreen';
import { Menu } from './screens/Menu';
import { Onboarding } from './screens/Onboarding';
import { Results } from './screens/Results';

type Screen =
  | { name: 'onboarding' }
  | { name: 'menu' }
  | { name: 'race'; controller: RaceController }
  | { name: 'results'; controller: RaceController; snapshot: RaceSnapshot; update: ProgressUpdate };

export interface AppProps {
  /** Injectable for tests (fake clock, tiny races). */
  createController?: (options: RaceControllerOptions) => RaceController;
  makeSeed?: () => number;
}

const defaultCreateController = (options: RaceControllerOptions) => new RaceController(options);

export function App({ createController = defaultCreateController, makeSeed = randomSeed }: AppProps) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [screen, setScreen] = useState<Screen>(() => (profile ? { name: 'menu' } : { name: 'onboarding' }));
  const [lastLevel, setLastLevel] = useState<number | undefined>(undefined);

  const startRace = useCallback(
    (level: number) => {
      if (!profile) return;
      setLastLevel(level);
      setScreen({ name: 'race', controller: createController({ seed: makeSeed(), level, playerName: profile.name }) });
    },
    [profile, createController, makeSeed],
  );

  if (screen.name === 'onboarding' || !profile) {
    return (
      <Onboarding
        onDone={(created) => {
          saveProfile(created);
          setProfile(created);
          setScreen({ name: 'menu' });
        }}
      />
    );
  }

  if (screen.name === 'race') {
    const { controller } = screen;
    return (
      <RaceScreen
        key={controller.seed}
        controller={controller}
        onAbandon={() => {
          controller.dispose();
          setScreen({ name: 'menu' });
        }}
        onFinish={(snapshot) => {
          controller.dispose();
          const mine = snapshot.results?.find((r) => r.id === controller.playerId);
          if (!mine) return setScreen({ name: 'menu' });
          const update = applyRaceResult(profile, {
            level: snapshot.level,
            position: mine.position,
            finished: mine.finished,
            finishTimeMs: mine.finishTimeMs,
            accuracy: mine.accuracy,
            correctPerMinute: mine.correctPerMinute,
          });
          saveProfile(update.profile);
          setProfile(update.profile);
          setScreen({ name: 'results', controller, snapshot, update });
        }}
      />
    );
  }

  if (screen.name === 'results') {
    return (
      <Results
        snapshot={screen.snapshot}
        playerId={screen.controller.playerId}
        botProfiles={screen.controller.getState().botProfiles}
        update={screen.update}
        onPlayAgain={() => startRace(screen.snapshot.level)}
        onMenu={() => setScreen({ name: 'menu' })}
      />
    );
  }

  return <Menu profile={profile} initialLevel={lastLevel} onStart={startRace} />;
}
