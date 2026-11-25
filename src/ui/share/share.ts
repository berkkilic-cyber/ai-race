/**
 * Shares text with the platform's own tools, no new dependency: React Native's Share sheet on
 * iOS and Android; on web the Web Share API when the browser has it, else the clipboard (the
 * caller shows "Copied").
 */
import { Platform, Share } from 'react-native';

import { logError } from '../diagnostics/log';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

interface WebNavigator {
  share?: (data: { text: string }) => Promise<void>;
  canShare?: (data: { text: string }) => boolean;
  clipboard?: { writeText(text: string): Promise<void> };
}

function webNavigator(): WebNavigator | null {
  return typeof navigator !== 'undefined' ? (navigator as unknown as WebNavigator) : null;
}

async function copyOnWeb(text: string): Promise<boolean> {
  const nav = webNavigator();
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the old way
  }
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Opens the share sheet (or copies on web without one). Never throws. */
export async function shareText(text: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const nav = webNavigator();
    if (nav?.share && (!nav.canShare || nav.canShare({ text }))) {
      try {
        await nav.share({ text });
        return 'shared';
      } catch (e) {
        // The user closed the sheet: nothing to report. Anything else: copy instead.
        if ((e as { name?: string })?.name === 'AbortError') return 'dismissed';
      }
    }
    return (await copyOnWeb(text)) ? 'copied' : 'failed';
  }
  try {
    const result = await Share.share({ message: text });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (e) {
    logError('share', e);
    return 'failed';
  }
}
