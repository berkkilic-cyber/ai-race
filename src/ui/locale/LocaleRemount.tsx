import { Fragment, useEffect, type ReactNode } from 'react';

import { markMounted, useLocale } from './store';

/**
 * Re-renders a screen's text when the language changes: text is looked up during render
 * (and some of it inside memoised selectors), so the screen's content is remounted under
 * a key per locale. Game and Garage state live in their stores and survive; navigation is
 * untouched because this wraps each screen (the root Stack's `screenLayout`), not the
 * navigator.
 */
export function LocaleRemount({ children }: { children: ReactNode }) {
  const locale = useLocale();
  useEffect(markMounted, []);
  return <Fragment key={locale}>{children}</Fragment>;
}

/** For a navigator's `screenLayout` prop. */
export function localeScreenLayout({ children }: { children: ReactNode }) {
  return <LocaleRemount>{children}</LocaleRemount>;
}
