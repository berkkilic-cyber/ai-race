import type { NewsItem } from '@/engine';

import { t } from '../i18n';

/** Text of a news item; lab/rival/region params are ids resolved to names by t(). */
export function newsText(item: NewsItem): string {
  return t(item.textKey, item.params);
}
