import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RaceSnapshot } from '@mind-racer/engine';
import { applyRaceResult, type Profile, type ProgressUpdate } from '../progress/profile';
import { RaceScreen } from '../race/RaceScreen';
import { Results } from '../screens/Results';
import type { MultiplayerSession } from '../net/MultiplayerSession';
import { Entry } from './Entry';
import { Lobby } from './Lobby';

interface MultiplayerAppProps {
  session: MultiplayerSession;
  profile: Profile;
  /** Called with the updated profile after each finished online race. */
  onProfile: (profile: Profile) => void;
  onExit: () => void;
}

interface Finished {
  seed: number;
  snapshot: RaceSnapshot;
  update: ProgressUpdate;
}

/**
 * Online play. The server's status for this player picks the screen:
 * not in a room → Entry; racing → RaceScreen; results → Results; otherwise → Lobby.
 */
export function MultiplayerApp({ session, profile, onProfile, onExit }: MultiplayerAppProps) {
  const view = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const [finished, setFinished] = useState<Finished | null>(null);
  const reconnecting = view.connection === 'reconnecting';

  // Back from a reload while in a room: rejoin it.
  useEffect(() => {
    if (session.canResume() && !session.getState().playerId) session.resume();
  }, [session]);

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
      const update = applyRaceResult(profileRef.current, {
        level: mine.chosenLevel,
        position: mine.position,
        finished: mine.finished,
        finishTimeMs: mine.finishTimeMs,
        accuracy: mine.accuracy,
        correctPerMinute: mine.correctPerMinute,
      });
      onProfileRef.current(update.profile);
      setFinished({ seed: race.seed, snapshot, update });
    };
    check();
    return race.subscribe(check);
  }, [race]);

  const leave = () => {
    session.leave();
    onExit();
  };

  const me = view.room?.players.find((p) => p.id === view.playerId);

  if (!view.playerId || !view.room) {
    return (
      <Entry
        pending={view.pending}
        error={view.error?.message ?? null}
        offlineSince={view.offlineSince}
        onCreate={() => session.create(profile.name, profile.unlockedLevel)}
        onJoin={(code) => session.join(code, profile.name, profile.unlockedLevel)}
        onBack={() => {
          session.dispose();
          onExit();
        }}
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
        presence={race.getState().presence}
        update={finished.update}
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
