import { useCallback, useEffect, useState } from 'react';
import { randomSeed, type RaceSnapshot, type TablesSelection } from '@mind-racer/engine';
import { LocalRaceController, type LocalRaceControllerOptions } from './game/LocalRaceController';
import { applyRaceResult, type Profile, type ProgressUpdate } from './progress/profile';
import { loadProfile, saveProfile } from './progress/storage';
import { RaceScreen } from './race/RaceScreen';
import { Menu, type MenuMode } from './screens/Menu';
import { Onboarding } from './screens/Onboarding';
import { Results } from './screens/Results';
import { MultiplayerApp } from './multiplayer/MultiplayerApp';
import { MultiplayerSession } from './net/MultiplayerSession';
import { clearRoomLink, readRoomLink } from './multiplayer/roomLink';
import { dailySeed, loadDaily, recordDaily, saveDaily, todayKey, type DailyData } from './daily/daily';
import { dailyShareText } from './daily/shareText';
import { Garage } from './garage/Garage';
import { effectiveCar, garageStore } from './garage/choice';
import { newlyUnlocked, progressOf } from './garage/unlocks';

type Screen =
  | { name: 'onboarding' }
  | { name: 'menu' }
  | { name: 'garage' }
  | { name: 'multiplayer'; session: MultiplayerSession; autoJoinCode?: string | null }
  | { name: 'race'; controller: LocalRaceController; daily?: { dateKey: string } }
  | {
      name: 'results';
      controller: LocalRaceController;
      snapshot: RaceSnapshot;
      /** Absent for a tables practice, which does not count for progress. */
      update?: ProgressUpdate;
      garageUnlocks: string[];
      daily?: { streak: number; shareText: string };
    };

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
  // Opened with a room link (`?sala=K7QF`): go to that room, after creating a profile if needed.
  const [linkCode] = useState(() => readRoomLink());
  const [screen, setScreen] = useState<Screen>(() => {
    if (!profile) return { name: 'onboarding' };
    const session = createMultiplayerSession();
    if (linkCode) return { name: 'multiplayer', session, autoJoinCode: linkCode };
    // A reload while in a room goes straight back to it.
    if (session.canResume()) return { name: 'multiplayer', session };
    session.dispose();
    return { name: 'menu' };
  });
  useEffect(() => {
    if (linkCode) clearRoomLink();
  }, [linkCode]);
  const [lastLevel, setLastLevel] = useState<number | undefined>(undefined);
  const [lastTables, setLastTables] = useState<TablesSelection | undefined>(undefined);
  const [menuMode, setMenuMode] = useState<MenuMode>('levels');
  const [daily, setDaily] = useState<DailyData>(() => loadDaily());

  const startRace = useCallback(
    (level: number) => {
      if (!profile) return;
      setLastLevel(level);
      setMenuMode('levels');
      const car = effectiveCar(garageStore.get(), progressOf(profile, daily));
      setScreen({ name: 'race', controller: createController({ seed: makeSeed(), level, playerName: profile.name, car }) });
    },
    [profile, daily, createController, makeSeed],
  );

  // A tables practice: the chosen tables against the bots, without adaptation and without counting (spec tables-practice).
  const startTables = useCallback(
    (tables: TablesSelection) => {
      if (!profile) return;
      setLastTables(tables);
      setMenuMode('tables');
      const car = effectiveCar(garageStore.get(), progressOf(profile, daily));
      setScreen({
        name: 'race',
        controller: createController({ seed: makeSeed(), level: 1, tables, playerName: profile.name, car }),
      });
    },
    [profile, daily, createController, makeSeed],
  );

  // Today's challenge: the same race for everyone at this level today, without adaptation (design D1, D2).
  const startDaily = useCallback(
    (level: number) => {
      if (!profile) return;
      const dateKey = todayKey();
      if (daily.results[dateKey]) return;
      const controller = createController({
        seed: dailySeed(dateKey, level),
        level,
        playerName: profile.name,
        car: effectiveCar(garageStore.get(), progressOf(profile, daily)),
        config: { adaptiveDifficulty: false },
      });
      setScreen({ name: 'race', controller, daily: { dateKey } });
    },
    [profile, daily, createController],
  );

  if (screen.name === 'onboarding' || !profile) {
    return (
      <Onboarding
        onDone={(created) => {
          saveProfile(created);
          setProfile(created);
          setScreen(
            linkCode
              ? { name: 'multiplayer', session: createMultiplayerSession(), autoJoinCode: linkCode }
              : { name: 'menu' },
          );
        }}
      />
    );
  }

  if (screen.name === 'race') {
    const { controller, daily: dailyRace } = screen;
    return (
      <RaceScreen
        key={controller.seed}
        controller={controller}
        title={dailyRace ? `Desafío diario · nivel ${controller.level}` : undefined}
        exitNote={dailyRace ? 'Esta carrera no contará y podrás intentar el desafío de nuevo hoy.' : undefined}
        onAbandon={() => {
          controller.dispose();
          setScreen({ name: 'menu' });
        }}
        onFinish={(snapshot) => {
          controller.dispose();
          const mine = snapshot.results?.find((r) => r.id === controller.playerId);
          if (!mine) return setScreen({ name: 'menu' });
          if (controller.tables) return setScreen({ name: 'results', controller, snapshot, garageUnlocks: [] });
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
          const before = progressOf(profile, daily);
          if (!dailyRace) {
            const garageUnlocks = newlyUnlocked(before, progressOf(update.profile, daily));
            return setScreen({ name: 'results', controller, snapshot, update, garageUnlocks });
          }
          // The day it started counts, even if midnight passed during the race (design D4).
          const result = {
            level: snapshot.level,
            position: mine.position,
            finished: mine.finished,
            finishTimeMs: mine.finishTimeMs,
            correct: mine.correct,
            wrong: mine.wrong,
          };
          const recorded = recordDaily(daily, dailyRace.dateKey, result);
          saveDaily(recorded);
          setDaily(recorded);
          setScreen({
            name: 'results',
            controller,
            snapshot,
            update,
            garageUnlocks: newlyUnlocked(before, progressOf(update.profile, recorded)),
            daily: { streak: recorded.streak, shareText: dailyShareText(dailyRace.dateKey, result, recorded.streak) },
          });
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
        cars={screen.controller.getState().cars}
        update={screen.update}
        {...(screen.controller.tables ? { practice: screen.controller.tables } : {})}
        garageUnlocks={screen.garageUnlocks}
        daily={screen.daily}
        onPlayAgain={() =>
          screen.controller.tables ? startTables(screen.controller.tables) : startRace(screen.snapshot.level)
        }
        onMenu={() => setScreen({ name: 'menu' })}
      />
    );
  }

  if (screen.name === 'garage') {
    return <Garage profile={profile} daily={daily} onBack={() => setScreen({ name: 'menu' })} />;
  }

  if (screen.name === 'multiplayer') {
    return (
      <MultiplayerApp
        session={screen.session}
        autoJoinCode={screen.autoJoinCode}
        car={effectiveCar(garageStore.get(), progressOf(profile, daily))}
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
      onStartTables={startTables}
      initialMode={menuMode}
      {...(lastTables ? { initialTables: lastTables } : {})}
      onMultiplayer={() => setScreen({ name: 'multiplayer', session: createMultiplayerSession() })}
      onGarage={() => setScreen({ name: 'garage' })}
      daily={{ data: daily, onStart: startDaily }}
    />
  );
}
