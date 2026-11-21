import { createGame, type EventChoiceDef, type GameState } from '@/engine';

import { setI18nContext } from '../../i18n';
import { getPackEntry } from '../../packs';
import { explainChoice, hintMeaning } from '../choiceInfo';
import { channelFlagHints, effectHints } from '../hints';

const pack = getPackEntry().pack;

/** A state with the given event pending for the player. */
function pending(eventId: string, patch: Partial<GameState['labs'][string]> = {}): GameState {
  const state = createGame(pack, { playerName: 'Test Lab', founderId: pack.founders[0].id, homeRegion: 'usa', seed: 2 });
  const me = { ...state.labs[state.playerLabId], ...patch };
  return { ...state, labs: { ...state.labs, [me.id]: me }, pendingEvent: { eventId, labId: me.id } };
}

function choiceOf(eventId: string, choiceId: string): EventChoiceDef {
  const choice = pack.events.find((e) => e.id === eventId)?.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`no ${eventId}/${choiceId}`);
  return choice;
}

beforeAll(() => setI18nContext(pack, null));

describe('explainChoice', () => {
  const patch = choiceOf('sandbox-escape', 'patch');

  it('puts the missing requirement before the missing cost', () => {
    const info = explainChoice(pending('sandbox-escape', { cash: 12 }), pack, patch);
    expect(info.blocker).toBe('Needs the Safety Team upgrade (Capability tree)');
    expect(info.requirements).toEqual([{ text: 'Needs the Safety Team upgrade (Capability tree)', met: false, help: 'Buy Safety Team in the Capability tree' }]);
    expect(info.costs).toEqual([{ resource: 'cash', text: '$30M', have: '$12M', short: true }]);
  });

  it('names the cost once the requirement is met', () => {
    const info = explainChoice(pending('sandbox-escape', { cash: 12, ownedNodes: ['cap-model-1', 'cap-safety-team'] }), pack, patch);
    expect(info.requirements[0].met).toBe(true);
    expect(info.blocker).toBe('Needs $30M, you have $12M');
  });

  it('has no blocker when the choice can be taken', () => {
    const info = explainChoice(pending('sandbox-escape', { cash: 100, ownedNodes: ['cap-model-1', 'cap-safety-team'] }), pack, patch);
    expect(info.blocker).toBeNull();
    expect(info.effects.length).toBeGreaterThan(0);
  });

  it('explains a gamble with its base chance and what happens if it backfires', () => {
    const risky = pack.events.flatMap((e) => e.choices.map((c) => ({ e, c }))).find(({ c }) => c.risk && !c.requirements?.length);
    expect(risky).toBeDefined();
    if (!risky) return;
    const info = explainChoice(pending(risky.e.id), pack, risky.c);
    expect(info.risk?.text).toMatch(/^It can backfire: \d+(\.\d)?% base chance/);
    expect(info.risk?.effects.length).toBeGreaterThan(0);
  });

  it('describes every choice in the pack without placeholders', () => {
    for (const event of pack.events) {
      const state = pending(event.id);
      for (const choice of event.choices) {
        const info = explainChoice(state, pack, choice);
        const texts = [info.blocker ?? '', ...info.requirements.map((r) => r.text), ...info.effects.map((l) => l.text), ...info.hints.map((h) => h.text), info.risk?.text ?? ''];
        for (const text of texts) expect(text).not.toMatch(/[{}]/);
      }
    }
  });
});

describe('channel flag hints', () => {
  it('gives the open-source choice a spread chip and a rivals chip', () => {
    const effect = { type: 'setFlag', flag: 'channel:open', durationTicks: 600 } as const;
    expect(channelFlagHints(effect, pack.channels)).toEqual([
      { subject: 'spread', dir: 'up', good: true },
      { subject: 'rivals', dir: 'up', good: false },
    ]);
    expect(effectHints([effect], pack.channels).map((h) => h.subject)).toEqual(['spread', 'rivals']);
    expect(channelFlagHints({ type: 'setFlag', flag: 'podbay' }, pack.channels)).toEqual([]);
  });

  it('says what an arrow means', () => {
    expect(hintMeaning({ subject: 'hype', dir: 'up', good: true })).toBe('Hype goes up: good for you');
    expect(hintMeaning({ subject: 'regulation', dir: 'up', good: false })).toBe('Regulation goes up: bad for you');
    expect(hintMeaning({ subject: 'rivals', dir: 'down', good: true })).toBe('Rivals are held back: good for you');
  });
});
