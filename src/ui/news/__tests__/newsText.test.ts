import { runHeadless, type NewsItem } from '@/engine';

import { regionName, setI18nContext, t } from '../../i18n';
import { getPackEntry } from '../../packs';
import { newsText } from '../newsText';

const { pack } = getPackEntry();

/** A whole headless run: launches, channel entries and expiring moments all reach the news. */
const final = runHeadless(pack, { playerName: 'Test Lab', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed: 3 }, { policy: 'sensible', maxTicks: 3600 });
setI18nContext(pack, final.labs);

describe('news text', () => {
  it('names the model in launch news, and resolves channel, from and via in entry news', () => {
    const launches = final.news.filter((n: NewsItem) => n.kind === 'launch');
    expect(launches.length).toBeGreaterThan(0);
    for (const n of launches) {
      const text = newsText(n);
      expect(text).toContain(t(String(n.params?.model)));
      expect(text).not.toMatch(/\{\w+\}/);
    }
    for (const n of final.news.filter((x: NewsItem) => x.kind === 'entry' && x.params?.from)) {
      const text = newsText(n);
      expect(text).not.toMatch(/\{\w+\}/);
      if (t(n.textKey).includes('{from}')) expect(text).toContain(regionName(String(n.params?.from)));
    }
  });

  it('never shows a raw key or placeholder for anything in a full run', () => {
    for (const n of final.news) {
      const text = newsText(n);
      expect(text).not.toMatch(/\{\w+\}/);
      expect(text).not.toMatch(/\b(ui|term|engine|node|channel|barrier|moment|headline)\.[a-z]/);
    }
  });
});
