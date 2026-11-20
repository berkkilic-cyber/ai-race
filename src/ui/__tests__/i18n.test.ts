import { createGame, type ContentPack } from '@/engine';

import { failureText, hasString, humanizeKey, labColor, labName, regionName, setI18nContext, t, visibleFlags } from '../i18n';
import { getPackEntry } from '../packs';
import { colors } from '../theme';
import uiStrings from '../strings/en.json';

const base = getPackEntry().pack;

function packWith(strings: Record<string, string>): ContentPack {
  return { ...base, strings: { en: { ...base.strings.en, ...strings } } };
}

afterEach(() => {
  setI18nContext(base, null);
  jest.restoreAllMocks();
});

describe('t', () => {
  it('looks in the pack first, then the UI strings', () => {
    setI18nContext(packWith({ 'ui.tab.map': 'World' }), null);
    expect(t('ui.tab.map')).toBe('World');
    expect(t('ui.tab.news')).toBe('News');
  });

  it('uses UI fallbacks for term keys the pack lacks', () => {
    const strings = { ...base.strings.en };
    delete strings['term.hype'];
    setI18nContext({ ...base, strings: { en: strings } }, null);
    expect(t('term.hype')).toBe((uiStrings as Record<string, string>)['term.hype']);
  });

  it('fills params and leaves unknown placeholders alone', () => {
    setI18nContext(packWith({ 'x.test': '{amount} of {thing}, {missing}' }), null);
    expect(t('x.test', { amount: 3, thing: 'cake' })).toBe('3 of cake, {missing}');
  });

  it('resolves lab, rival, region and achievement ids to names', () => {
    const pack = packWith({ 'x.news': '{lab} beat {rival} in {region} ({achievement})' });
    const state = createGame(pack, { playerName: 'Moon Lab', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed: 1 });
    setI18nContext(pack, state.labs);
    const rival = pack.rivals[0];
    const region = pack.regions[1];
    const achievement = pack.achievements[0];
    expect(t('x.news', { lab: 'player', rival: rival.id, region: region.id, achievement: achievement.id })).toBe(
      `Moon Lab beat ${t(rival.nameKey)} in ${t(region.nameKey)} (${t(achievement.nameKey)})`,
    );
  });

  it('resolves rival ids from the pack when no labs are set', () => {
    const rival = base.rivals[0];
    setI18nContext(packWith({ 'x.r': '{lab}' }), null);
    expect(t('x.r', { lab: rival.id })).toBe(t(rival.nameKey));
    expect(t('x.r', { lab: 'nobody' })).toBe('nobody');
  });

  it('falls back to a readable key and warns once for missing keys', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(t('ui.region.buildDataCentreNow')).toBe('Build data centre now');
    t('ui.region.buildDataCentreNow');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(hasString('ui.region.buildDataCentreNow')).toBe(false);
  });

  it('humanizes name/title keys by their parent segment', () => {
    expect(humanizeKey('event.rigged-benchmark.title')).toBe('Rigged benchmark');
    expect(humanizeKey('single')).toBe('Single');
  });
});

describe('lab helpers', () => {
  const state = createGame(base, { playerName: 'Moon Lab', founderId: base.founders[0].id, homeRegion: base.regions[0].id, seed: 1 });
  const player = state.labs[state.playerLabId];
  const rival = state.labs[base.rivals[0].id];

  it('labName uses the typed name for the player and translates rival keys', () => {
    expect(labName(player)).toBe('Moon Lab');
    expect(rival.name).toBe(base.rivals[0].nameKey);
    expect(labName(rival)).toBe(t(base.rivals[0].nameKey));
  });

  it('labColor gives the player the theme accent and rivals their colour', () => {
    expect(labColor(player)).toBe(colors.player);
    expect(labColor(rival)).toBe(base.rivals[0].color);
  });

  it('regionName translates ids and passes unknown ids through', () => {
    expect(regionName(base.regions[0].id)).toBe(t(base.regions[0].nameKey));
    expect(regionName('atlantis')).toBe('atlantis');
  });

  it('visibleFlags hides engine flags', () => {
    expect(visibleFlags({ flags: ['$internal', 'canAcquire'] })).toEqual(['canAcquire']);
  });

  it('failureText names the currency', () => {
    expect(failureText('notEnoughCash')).toContain(t('term.cash'));
    expect(failureText('regionBanned')).toBe(t('ui.failure.regionBanned'));
  });
});
