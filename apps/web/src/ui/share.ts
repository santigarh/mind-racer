export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'unavailable' | 'failed';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

type ShareNavigator = Partial<Pick<Navigator, 'share' | 'clipboard'>>;

/** Whether this browser can share or copy at all; both need HTTPS or localhost. */
export function canShareOrCopy(nav: ShareNavigator = navigator): boolean {
  return typeof nav.share === 'function' || typeof nav.clipboard?.writeText === 'function';
}

/**
 * The device's share menu where there is one, the clipboard otherwise.
 * `copyText` is what gets copied (by default the text and the URL).
 */
export async function shareOrCopy(
  payload: SharePayload,
  copyText = `${payload.text}\n${payload.url}`,
  nav: ShareNavigator = navigator,
): Promise<ShareOutcome> {
  const canCopy = typeof nav.clipboard?.writeText === 'function';
  if (typeof nav.share === 'function') {
    try {
      await nav.share(payload);
      return 'shared';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelled'; // The person closed the menu.
      if (!canCopy) return 'failed';
    }
  }
  if (!canCopy) return 'unavailable';
  try {
    await nav.clipboard!.writeText(copyText);
    return 'copied';
  } catch {
    return 'failed';
  }
}
