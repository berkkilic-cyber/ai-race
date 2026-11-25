/**
 * Outside links of the demo's call to action. PLACEHOLDERS: the owner fills these in before
 * the demo is uploaded (docs/marketing/README.md, "Fill the three link constants"). No share
 * feature with its own link constant existed when this was written; if one lands under
 * src/ui/share, point WAITLIST_URL at it so there is one source.
 *
 * An empty string hides nothing: the button still shows and opens nothing (logged), so a
 * build with placeholders is visibly unfinished in testing, never broken.
 */

/** The itch.io page of the browser demo, e.g. https://<account>.itch.io/<game>. */
export const DEMO_URL = 'https://example.com/ai-race-demo';

/** The waitlist form (a free form service), where "Join the waitlist" goes. */
export const WAITLIST_URL = 'https://example.com/ai-race-waitlist';

/** The Discord invite link. */
export const DISCORD_URL = 'https://example.com/ai-race-discord';

/** True while a link is still a placeholder (example.com), for the build script's warning. */
export function isPlaceholderLink(url: string): boolean {
  return url === '' || /^https?:\/\/example\.com\//.test(url);
}
