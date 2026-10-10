import { useCallback, useState } from 'react';
import { randomSeed, type RaceSnapshot } from '@mind-racer/engine';
import { LocalRaceController, type LocalRaceControllerOptions } from './game/LocalRaceController';
import { applyRaceResult, type Profile, type ProgressUpdate } from './progress/profile';
import { loadProfile, saveProfile } from './progress/storage';
import { RaceScreen } from './race/RaceScreen';
import { Menu } from './screens/Menu';
import { Onboarding } from './screens/Onboarding';
import { Results } from './screens/Results';
import { MultiplayerApp } from './multiplayer/MultiplayerApp';
import { MultiplayerSession } from './net/MultiplayerSession';

type Screen =
  | { name: 'onboarding' }
  | { name: 'menu' }
  | { name: 'multiplayer'; session: MultiplayerSession }
  | { name: 'race'; controller: LocalRaceController }
  | { name: 'results'; controller: LocalRaceController; snapshot: RaceSnapshot; update: ProgressUpdate };

export interface AppProps {
  /** Injectable for tests (fake clock, tiny races). */
  createController?: (options: LocalRaceControllerOptions) => LocalRaceController;
  makeSeed?: () => number;
  createMultiplayerSession?: () => MultiplayerSession;
}

const defaultCreateController = (options: LocalRaceControllerOptions) => new LocalRaceController(options);

export function App({
  createController = defaultCreateController,
  makeSeed = randomSeed,
  createMultiplayerSession = () => new MultiplayerSession(),
}: AppProps) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [screen, setScreen] = useState<Screen>(() => {
    if (!profile) return { name: 'onboarding' };
    // A reload while in a room goes straight back to it.
    const session = createMultiplayerSession();
    if (session.canResume()) return { name: 'multiplayer', session };
    session.dispose();
    return { name: 'menu' };
  });
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

  if (screen.name === 'multiplayer') {
    return (
      <MultiplayerApp
        session={screen.session}
        profile={profile}
        onProfile={(updated) => {
          saveProfile(updated);
          setProfile(updated);
        }}
        onExit={() => setScreen({ name: 'menu' })}
      />
    );
  }

  return (
    <Menu
      profile={profile}
      initialLevel={lastLevel}
      onStart={startRace}
      onMultiplayer={() => setScreen({ name: 'multiplayer', session: createMultiplayerSession() })}
    />
  );
}
