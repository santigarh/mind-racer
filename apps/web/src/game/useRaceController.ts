import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { RaceViewSource, RaceViewState } from './RaceViewSource';

const HIDDEN = 'hidden';

/** Subscribes to a controller and pauses the race while the tab is hidden. */
export function useRaceController(controller: RaceViewSource): RaceViewState {
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

  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller]);
  const getState = useCallback(() => controller.getState(), [controller]);
  return useSyncExternalStore(subscribe, getState, getState);
}
