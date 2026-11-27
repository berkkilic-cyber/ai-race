import { setCurrentLocale } from '../../locale/current';
import { SHARE_LINK } from '../link';
import { buildShareText, raceLine, type ShareInput } from '../text';

const daily: ShareInput = { daily: { number: 25, streak: 3 }, trigger: 'agi', days: 212, race: ['you', 'you', 'rival', 'you', 'you'], score: 4210 };
const run: ShareInput = { trigger: 'banned', days: 1301, race: ['rival', 'rival', 'you', 'none', 'rival'], score: 980 };

afterEach(() => setCurrentLocale('en'));

describe('share text', () => {
  it('reads as a short Wordle-style result in English', () => {
    expect(buildShareText(daily)).toBe(['Benchmaxxing Daily #25', 'Reached AGI first · day 212', 'AGI race ■■□■■', 'Score 4,210 · Streak 3', SHARE_LINK].join('\n'));
  });

  it('drops the daily line and the streak after a normal run', () => {
    expect(buildShareText(run)).toBe(['Benchmaxxing', 'Banned worldwide · day 1,301', 'AGI race □□■·□', 'Score 980', SHARE_LINK].join('\n'));
  });

  it('is in Turkish with Turkish numbers', () => {
    setCurrentLocale('tr');
    expect(buildShareText(daily)).toBe(['Benchmaxxing Günlük #25', "AGI'ya ilk biz ulaştık · 212. gün", 'AGI yarışı ■■□■■', 'Skor 4.210 · Seri 3', SHARE_LINK].join('\n'));
    expect(buildShareText(run)).toBe(['Benchmaxxing', 'Dünya çapında yasaklandık · 1.301. gün', 'AGI yarışı □□■·□', 'Skor 980', SHARE_LINK].join('\n'));
  });

  it('has a phrase for every ending family and stays tweet-sized, emoji-free', () => {
    for (const locale of ['en', 'tr'] as const) {
      setCurrentLocale(locale);
      for (const trigger of ['agi', 'dependence', 'monopoly', 'banned', 'revolt', 'rivalAgi']) {
        const text = buildShareText({ ...daily, trigger, score: 123456, days: 9999 });
        expect(text).not.toMatch(/\{|share\.ending/);
        expect(text.length).toBeLessThanOrEqual(200);
        expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(text.split('\n')).toHaveLength(5);
      }
    }
  });

  it('draws one symbol per fifth', () => {
    expect(raceLine(['you', 'rival', 'none'])).toBe('■□·');
  });
});
