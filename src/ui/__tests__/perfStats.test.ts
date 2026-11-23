/** The performance readout's counters (src/ui/diagnostics/perfStats.ts). */
describe('perfStats', () => {
  it('counts commits through the DevTools hook, leaves out the overlay, reports ticks', () => {
    jest.isolateModules(() => {
      const g = globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { onCommitFiberRoot: () => string } };
      const saved = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const original = jest.fn(() => 'ok');
      g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { onCommitFiberRoot: original };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const stats = require('../diagnostics/perfStats') as typeof import('../diagnostics/perfStats');
      stats.startPerfSampling();
      stats.takePerfSnapshot();
      for (let i = 0; i < 5; i++) expect(g.__REACT_DEVTOOLS_GLOBAL_HOOK__!.onCommitFiberRoot()).toBe('ok');
      stats.noteOverlayCommit();
      stats.noteTick(0.5, 1.5);
      stats.noteTick(0.2, 0.7);
      const snap = stats.takePerfSnapshot();
      expect(original).toHaveBeenCalledTimes(5);
      expect(snap.commitsPerSec).not.toBeNull();
      // 5 commits, 1 of them the overlay's, over the time since the first snapshot.
      expect(snap.commitsPerSec! > 0).toBe(true);
      expect(snap.tickMs).toBe(0.7);
      expect(snap.stepMs).toBe(0.2);
      expect(snap.maxTickMs).toBe(1.5);
      expect(stats.takePerfSnapshot().maxTickMs).toBe(0);
      stats.stopPerfSampling();
      g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = saved;
    });
  });

  it('shows no commit rate without a DevTools hook', () => {
    jest.isolateModules(() => {
      const g = globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown };
      const saved = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      delete g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const stats = require('../diagnostics/perfStats') as typeof import('../diagnostics/perfStats');
      stats.startPerfSampling();
      stats.takePerfSnapshot();
      expect(stats.takePerfSnapshot().commitsPerSec).toBeNull();
      stats.stopPerfSampling();
      g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = saved;
    });
  });
});
