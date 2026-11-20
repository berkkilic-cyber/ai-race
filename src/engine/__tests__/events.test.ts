import { applyAction, defaultBalance, step, type ContentPack, type EventDef } from '@/engine';
import { edit, editLab, mustApply, newGame, PLAYER, quietPack, stepN } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

function eventPack(events: EventDef[], extra: Partial<ContentPack> = {}): ContentPack {
  return quietPack({ events, ...extra });
}

const simple: EventDef = {
  id: 'simple', titleKey: 't', bodyKey: 'b', tone: 'neutral', weight: 1, once: false, conditions: [],
  choices: [{ id: 'ok', labelKey: 'l', effects: [{ type: 'resource', resource: 'hype', amount: 1 }] }, { id: 'no', labelKey: 'l2', effects: [] }],
};

describe('event scheduling', () => {
  it('draws the first card at firstEventTick and pauses the run while it is pending', () => {
    const pack = eventPack([simple]);
    let state = stepN(newGame(pack), pack, defaultBalance.firstEventTick - 1);
    expect(state.pendingEvent).toBeNull();
    state = step(state, pack);
    expect(state.tick).toBe(defaultBalance.firstEventTick);
    expect(state.pendingEvent).toEqual({ eventId: 'simple', labId: PLAYER });
    expect(step(state, pack)).toBe(state);
  });

  it('schedules the next card eventIntervalMin..Max ticks after the previous one is resolved', () => {
    const pack = eventPack([simple]);
    let state = stepN(newGame(pack), pack, defaultBalance.firstEventTick);
    for (let round = 0; round < 5; round++) {
      state = mustApply(state, pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'ok' });
      const resolvedAt = state.tick;
      const gap = state.nextEventTick - resolvedAt;
      expect(gap).toBeGreaterThanOrEqual(defaultBalance.eventIntervalMin);
      expect(gap).toBeLessThanOrEqual(defaultBalance.eventIntervalMax);
      while (!state.pendingEvent) state = step(state, pack);
      expect(state.tick).toBe(resolvedAt + gap);
    }
  });

  it('respects once and conditions, and retries later when nothing is eligible', () => {
    const once: EventDef = { ...simple, id: 'once', once: true };
    const late: EventDef = { ...simple, id: 'late', conditions: [{ type: 'tickAtLeast', value: 100_000 }] };
    const pack = eventPack([once, late]);
    let state = stepN(newGame(pack), pack, defaultBalance.firstEventTick);
    expect(state.pendingEvent?.eventId).toBe('once');
    expect(state.seenEvents).toEqual(['once']);
    state = mustApply(state, pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'ok' });
    state = stepN(state, pack, defaultBalance.eventIntervalMax + 1);
    expect(state.pendingEvent).toBeNull();
    expect(state.nextEventTick).toBeGreaterThan(state.tick - defaultBalance.eventRetryTicks);
  });

  it('never draws a card with no available choice', () => {
    const locked: EventDef = { ...simple, id: 'locked', choices: [{ id: 'pay', labelKey: 'l', cost: { cash: 1e9 }, effects: [] }] };
    const pack = eventPack([locked]);
    expect(stepN(newGame(pack), pack, 200).pendingEvent).toBeNull();
  });

  it('draws by weight among eligible cards', () => {
    const heavy: EventDef = { ...simple, id: 'heavy', weight: 99 };
    const light: EventDef = { ...simple, id: 'light', weight: 1 };
    const pack = eventPack([heavy, light]);
    let heavyCount = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const state = stepN(newGame(pack, { seed }), pack, defaultBalance.firstEventTick);
      if (state.pendingEvent?.eventId === 'heavy') heavyCount++;
    }
    expect(heavyCount).toBeGreaterThanOrEqual(25);
  });

  it('AI labs never get choice events', () => {
    let state = newGame(testPack);
    for (let i = 0; i < 1500 && state.status === 'running'; i++) {
      if (state.pendingEvent) {
        expect(state.pendingEvent.labId).toBe(PLAYER);
        const event = testPack.events.find((e) => e.id === state.pendingEvent!.eventId)!;
        for (const choice of event.choices) {
          const result = applyAction(state, testPack, { type: 'resolveEvent', labId: PLAYER, choiceId: choice.id });
          if (result.ok) {
            state = result.state;
            break;
          }
        }
      }
      state = step(state, testPack);
    }
  });
});

describe('event risk', () => {
  const risky = (chance: number): EventDef => ({
    ...simple,
    id: 'risky',
    choices: [
      { id: 'bet', labelKey: 'l', resultKey: 'calm', effects: [{ type: 'agiProgress', amount: 3 }], risk: { chance, effects: [{ type: 'meter', meter: 'regulation', amount: 10 }], resultKey: 'boom' } },
      { id: 'no', labelKey: 'l2', effects: [] },
    ],
  });
  const pendingRisk = (pack: ContentPack, founder = 'thinker') => edit(newGame(pack, { founderId: founder }), (s) => (s.pendingEvent = { eventId: 'risky', labId: PLAYER }));

  it('a risk with chance 1 always fires its effects and reports it', () => {
    const pack = eventPack([risky(1)]);
    const state = mustApply(pendingRisk(pack), pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'bet' });
    expect(state.labs[PLAYER].regulation).toBe(10);
    expect(state.labs[PLAYER].agiProgress).toBe(3);
    expect(state.lastEventResult).toEqual({ eventId: 'risky', choiceId: 'bet', resultKey: 'boom', riskFired: true });
  });

  it('a risk with chance 0 never fires', () => {
    const pack = eventPack([risky(0)]);
    const state = mustApply(pendingRisk(pack), pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'bet' });
    expect(state.labs[PLAYER].regulation).toBe(0);
    expect(state.lastEventResult).toEqual({ eventId: 'risky', choiceId: 'bet', resultKey: 'calm', riskFired: false });
  });

  it('the riskChance stat scales the chance', () => {
    const base = eventPack([risky(0.5)]);
    const safe = { ...base, founders: base.founders.map((f) => ({ ...f, modifiers: [{ stat: 'riskChance' as const, op: 'mul' as const, value: 0 }] })) };
    const reckless = { ...base, founders: base.founders.map((f) => ({ ...f, modifiers: [{ stat: 'riskChance' as const, op: 'mul' as const, value: 2 }] })) };
    for (let seed = 1; seed <= 10; seed++) {
      const s1 = mustApply(edit(pendingRisk(safe), (s) => (s.rng = seed)), safe, { type: 'resolveEvent', labId: PLAYER, choiceId: 'bet' });
      expect(s1.lastEventResult?.riskFired).toBe(false);
      const s2 = mustApply(edit(pendingRisk(reckless), (s) => (s.rng = seed)), reckless, { type: 'resolveEvent', labId: PLAYER, choiceId: 'bet' });
      expect(s2.lastEventResult?.riskFired).toBe(true);
    }
  });

  it('a 50% risk fires sometimes, depending on the seed', () => {
    const pack = eventPack([risky(0.5)]);
    const fired = Array.from({ length: 40 }, (_, seed) =>
      mustApply(edit(pendingRisk(pack), (s) => (s.rng = seed * 7919)), pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'bet' }).lastEventResult?.riskFired,
    );
    expect(fired).toContain(true);
    expect(fired).toContain(false);
  });

  it('lastEventResult persists until the next resolution', () => {
    const pack = eventPack([risky(0)]);
    let state = mustApply(pendingRisk(pack), pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'no' });
    expect(state.lastEventResult).toEqual({ eventId: 'risky', choiceId: 'no' });
    state = step(state, pack);
    expect(state.lastEventResult).toEqual({ eventId: 'risky', choiceId: 'no' });
  });
});

describe('requirements', () => {
  it('a choice with unmet requirements cannot be taken', () => {
    const pack = testPack;
    const state = editLab(edit(newGame(pack), (s) => (s.pendingEvent = { eventId: 'deal', labId: PLAYER })), PLAYER, (l) => (l.cash = 100));
    expect(applyAction(state, pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'sign' })).toEqual({ ok: false, reason: 'missingRequirement' });
    expect(applyAction(state, pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'pass' }).ok).toBe(true);
  });
});
