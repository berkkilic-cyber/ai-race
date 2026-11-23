import { createGame, getBalance, runHeadless } from '@/engine';

import { aiLabPack } from '..';

const SETUP = { playerName: 'Pace Lab', founderId: 'researcher', homeRegion: 'canada', seed: 11 };

describe('ai-lab run lengths', () => {
  it('Full is the standard game: the same run as naming no length', () => {
    const a = runHeadless(aiLabPack, SETUP, { policy: 'sensible', maxTicks: 1500 });
    const b = runHeadless(aiLabPack, { ...SETUP, runLength: 'full' }, { policy: 'sensible', maxTicks: 1500 });
    expect(b).toEqual(a);
    expect(a.runLength).toBe('full');
  });

  it('a Sprint is deterministic and plays a whole run in about a third of the ticks', () => {
    const run = () => runHeadless(aiLabPack, { ...SETUP, runLength: 'sprint' }, { policy: 'sensible', maxTicks: 8000 });
    const sprint = run();
    expect(run()).toEqual(sprint);
    expect(sprint.status).toBe('ended');
    expect(sprint.tick).toBeLessThan(1400);
    expect(getBalance(createGame(aiLabPack, { ...SETUP, runLength: 'sprint' }), aiLabPack).pace).toBeGreaterThan(2.5);
  });
});
