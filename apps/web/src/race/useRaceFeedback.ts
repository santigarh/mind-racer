import { useEffect, useRef } from 'react';
import { haptics as defaultHaptics, type HapticName, type Haptics } from '../audio/haptics';
import { sfx as defaultSfx, type Sfx, type SoundName } from '../audio/sfx';
import type { RaceViewState } from '../game/RaceViewSource';

/** What the feedback cares about, from one view state (design D6). */
export interface FeedbackView {
  /** Second shown by the start or resume countdown; 0 when none is running. */
  tick: number;
  racing: boolean;
  paused: boolean;
  answerSeq: number;
  answer: { correct: boolean; nitro: boolean } | null;
  finished: boolean;
}

export function feedbackView(state: RaceViewState, playerId: string): FeedbackView {
  const { snapshot } = state;
  const player = snapshot.runners.find((r) => r.id === playerId);
  const counting = snapshot.phase === 'countdown' || snapshot.phase === 'waiting';
  const tick =
    state.resumeRemainingMs > 0
      ? Math.ceil(state.resumeRemainingMs / 1000)
      : counting
        ? Math.ceil(snapshot.countdownRemainingMs / 1000)
        : 0;
  return {
    tick,
    racing: snapshot.phase === 'racing',
    paused: state.paused,
    answerSeq: player?.lastAnswer?.seq ?? 0,
    answer: player?.lastAnswer ? { correct: player.lastAnswer.correct, nitro: player.lastAnswer.nitro } : null,
    finished: player?.finishTimeMs != null,
  };
}

/**
 * Sounds for the change from one view to the next; only the player's own events and the countdown.
 * Without a previous view (mounting, or rejoining a race) only the current countdown second plays,
 * so old answers or an old finish are never replayed.
 */
export function feedbackEvents(before: FeedbackView | null, next: FeedbackView): SoundName[] {
  const events: SoundName[] = [];
  if (next.tick > 0 && next.tick !== before?.tick) events.push('countdown');
  if (!before) return events;
  const started = !before.racing && next.racing;
  const resumed = before.tick > 0 && next.tick === 0 && next.racing && !next.paused;
  if (started || resumed) events.push('go');
  if (next.answerSeq > before.answerSeq && next.answer) {
    events.push(next.answer.nitro ? 'nitro' : next.answer.correct ? 'correct' : 'wrong');
  }
  if (!before.finished && next.finished) events.push('finish');
  return events;
}

const HAPTICS: Partial<Record<SoundName, HapticName>> = { wrong: 'wrong', nitro: 'nitro', finish: 'finish' };

export interface RaceFeedbackOptions {
  /** The player's sound preference; when false nothing sounds or vibrates. */
  enabled: boolean;
  sfx?: Sfx;
  haptics?: Haptics;
}

export function useRaceFeedback(
  state: RaceViewState,
  playerId: string,
  { enabled, sfx = defaultSfx, haptics = defaultHaptics }: RaceFeedbackOptions,
) {
  const previous = useRef<FeedbackView | null>(null);
  useEffect(() => {
    const next = feedbackView(state, playerId);
    const before = previous.current;
    previous.current = next;
    if (!enabled) return;
    for (const event of feedbackEvents(before, next)) {
      sfx.play(event);
      const haptic = HAPTICS[event];
      if (haptic) haptics.vibrate(haptic);
    }
  }, [state, playerId, enabled, sfx, haptics]);
}
