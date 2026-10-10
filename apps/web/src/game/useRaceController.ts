import { useEffect, useSyncExternalStore } from 'react';
import type { RaceController, RaceViewState } from './RaceController';

const HIDDEN = 'hidden';

/** Subscribes to a controller and pauses the race while the tab is hidden. */
export function useRaceController(controller: RaceController): RaceViewState {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') controller.hold(HIDDEN);
      else controller.release(HIDDEN);
    };
    document.addEventListener('visibilitychange', onVisibility);
    controller.start();
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [controller]);

  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}
