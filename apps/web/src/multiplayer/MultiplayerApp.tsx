import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RaceSnapshot } from '@mind-racer/engine';
import { DEFAULT_CAR, isRoomCode, type Car } from '@mind-racer/protocol';
import { applyRaceResult, type Profile, type ProgressUpdate } from '../progress/profile';
import { RaceScreen } from '../race/RaceScreen';
import { Results } from '../screens/Results';
import type { MultiplayerSession } from '../net/MultiplayerSession';
import { newlyUnlocked, progressOf } from '../garage/unlocks';
import { BoardLobby, BoardRace, BoardResults } from '../classroom/TeacherBoard';
import { Entry } from './Entry';
import { Lobby } from './Lobby';

interface MultiplayerAppProps {
  session: MultiplayerSession;
  profile: Profile;
  /** Called with the updated profile after each finished online race. */
  onProfile: (profile: Profile) => void;
  onExit: () => void;
  /** Room code from a `?sala=` link: join it right away instead of showing the entry screen (design D1). */
  autoJoinCode?: string | null;
  /** The garage car this person races with; sent when creating or joining a room. */
  car?: Car;
}

interface Finished {
  seed: number;
  snapshot: RaceSnapshot;
  /** Absent for a tables race, which does not count for progress. */
  update?: ProgressUpdate;
  garageUnlocks: string[];
}

/** Places a student sees in the standings of a class race (spec classroom-mode). */
const CLASS_TOP_PLACES = 10;

/** Online races never change the daily streak, so it plays no part in what they unlock. */
const NO_STREAK = { bestStreak: 0 };

/**
 * Online play. The server's status for this player picks the screen:
 * not in a room → Entry; racing → RaceScreen; results → Results; otherwise → Lobby.
 */
export function MultiplayerApp({
  session,
  profile,
  onProfile,
  onExit,
  autoJoinCode = null,
  car = DEFAULT_CAR,
}: MultiplayerAppProps) {
  const view = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const [finished, setFinished] = useState<Finished | null>(null);
  const reconnecting = view.connection === 'reconnecting';

  // Opened from a room link: join that room (join ignores repeats, e.g. StrictMode effects).
  // Otherwise, back from a reload while in a room: rejoin it.
  // Decided once on mount: after being removed or a closed class, the link must not join again.
  const [joinCode] = useState(() =>
    autoJoinCode !== null && autoJoinCode !== session.resumeCode() ? autoJoinCode : null,
  );
  const profileForJoin = useRef(profile);
  const carForJoin = useRef(car);
  useEffect(() => {
    if (joinCode !== null) {
      if (isRoomCode(joinCode)) session.join(joinCode, profileForJoin.current.name, profileForJoin.current.unlockedLevel, carForJoin.current);
      return;
    }
    if (session.canResume() && !session.getState().playerId) session.resume();
  }, [session, joinCode]);

  // Apply progress as soon as the server sends results, whatever screen is showing:
  // the `room` update that follows can unmount the race screen before it reports the finish.
  const race = view.race;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const onProfileRef = useRef(onProfile);
  onProfileRef.current = onProfile;
  const processedSeed = useRef<number | null>(null);
  useEffect(() => {
    if (!race) return;
    const check = () => {
      const snapshot = race.getState().snapshot;
      const mine = snapshot.results?.find((r) => r.id === race.playerId);
      if (!mine || processedSeed.current === race.seed) return;
      processedSeed.current = race.seed;
      // A tables race is practice: it never touches the profile (spec multiplayer-race).
      if (race.tables) return setFinished({ seed: race.seed, snapshot, garageUnlocks: [] });
      const update = applyRaceResult(profileRef.current, {
        level: mine.chosenLevel,
        position: mine.position,
        finished: mine.finished,
        finishTimeMs: mine.finishTimeMs,
        accuracy: mine.accuracy,
        correctPerMinute: mine.correctPerMinute,
      });
      onProfileRef.current(update.profile);
      const garageUnlocks = newlyUnlocked(progressOf(profileRef.current, NO_STREAK), progressOf(update.profile, NO_STREAK));
      setFinished({ seed: race.seed, snapshot, update, garageUnlocks });
    };
    check();
    return race.subscribe(check);
  }, [race]);

  const leave = () => {
    session.leave();
    onExit();
  };

  // Teacher board: the race whose results she already closed with "Nueva carrera", and how many races ran
  // (only used when an older server does not number its races).
  const [boardSeed, setBoardSeed] = useState<number | null>(null);
  const seenSeeds = useRef(new Set<number>());
  if (race) seenSeeds.current.add(race.seed);
  const raceCount = seenSeeds.current.size;
  // Re-render when the race gets its results (the board switches to the standings).
  const [resultsSeed, setResultsSeed] = useState<number | null>(null);
  useEffect(() => {
    if (!race) return;
    const check = () => {
      if (race.getState().snapshot.results) setResultsSeed(race.seed);
    };
    check();
    return race.subscribe(check);
  }, [race]);

  const me = view.room?.players.find((p) => p.id === view.playerId);

  if (!view.playerId || !view.room) {
    return (
      <Entry
        pending={view.pending}
        error={view.error?.message ?? null}
        offlineSince={view.offlineSince}
        deviceOffline={view.deviceOffline}
        initialCode={autoJoinCode ?? undefined}
        onCreate={() => session.create(profile.name, profile.unlockedLevel, car)}
        onCreateClass={() => session.create(profile.name, profile.unlockedLevel, car, 'class')}
        onJoin={(code) => session.join(code, profile.name, profile.unlockedLevel, car)}
        onBack={() => {
          session.dispose();
          onExit();
        }}
      />
    );
  }

  // The teacher of a class room never races: she gets the board for the projector (design D6).
  if (me?.role === 'teacher') {
    const closeRoom = () => {
      session.closeRoom();
      session.dispose();
      onExit();
    };
    const raceResults = race && resultsSeed === race.seed ? race.getState().snapshot.results : null;
    if (race && boardSeed !== race.seed && !raceResults) {
      return <BoardRace room={view.room} race={race} onClose={closeRoom} />;
    }
    if (race && boardSeed !== race.seed && raceResults) {
      return (
        <BoardResults
          room={view.room}
          results={raceResults}
          presence={race.getState().presence}
          distance={race.getState().snapshot.distance}
          raceNumber={race.raceNumber ?? raceCount}
          startedAt={race.startedAt}
          tables={race.tables}
          onClose={closeRoom}
          onNext={() => setBoardSeed(race.seed)}
        />
      );
    }
    return (
      <BoardLobby
        room={view.room}
        onClose={closeRoom}
        onStart={() => session.start()}
        onKick={(id) => session.kick(id)}
        onSetTables={(tables) => session.setTables(tables)}
      />
    );
  }

  if (race && finished?.seed !== race.seed && (me?.status === 'racing' || me?.status === 'results')) {
    return (
      <RaceScreen
        key={race.seed}
        controller={race}
        onAbandon={() => session.abandon()}
        // Results are handled by the effect above.
        onFinish={() => {}}
      />
    );
  }

  if (race && finished?.seed === race.seed && (me?.status === 'results' || me?.status === 'racing')) {
    return (
      <Results
        online
        snapshot={finished.snapshot}
        playerId={race.playerId}
        botProfiles={race.getState().botProfiles}
        cars={race.getState().cars}
        presence={race.getState().presence}
        update={finished.update}
        {...(race.tables ? { practice: race.tables } : {})}
        garageUnlocks={finished.garageUnlocks}
        topPlaces={view.room?.mode === 'class' ? CLASS_TOP_PLACES : undefined}
        onPlayAgain={() => session.backToRoom()}
        onMenu={leave}
      />
    );
  }

  return (
    <Lobby
      room={view.room}
      playerId={view.playerId}
      unlockedLevel={profile.unlockedLevel}
      reconnecting={reconnecting}
      onSetLevel={(level) => session.setLevel(level)}
      onStart={() => session.start()}
      onLeave={leave}
    />
  );
}
