import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Shown under a Share button when the text was copied instead of shared. */
export const COPIED_NOTICE = 'Copied. Paste it into WhatsApp or an email.';
export const SHARE_FAILED = 'This could not be shared or copied from this browser. Select the text and copy it by hand.';

/**
 * Share a piece of text through the device's share sheet.
 * Most desktop browsers have no share sheet, so on the web this falls back to
 * copying the text, and says which of the two happened so the screen can tell
 * the person. It never fails silently.
 */
export async function shareText(message: string): Promise<ShareOutcome> {
  if (Platform.OS !== 'web') {
    try {
      const result = await Share.share({ message });
      return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch {
      return 'failed';
    }
  }

  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ text: message });
      return 'shared';
    } catch (e) {
      // Closing the share sheet is not an error.
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Anything else: fall through and copy instead.
    }
  }

  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(message);
      return 'copied';
    }
  } catch {
    // Blocked by the browser; try the older way below.
  }

  try {
    const area = document.createElement('textarea');
    area.value = message;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
