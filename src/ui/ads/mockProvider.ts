import { useAdStore } from './store';
import type { AdProvider } from './types';

let nextId = 1;

/**
 * The provider used until a real ad SDK is added: shows an in-tree, clearly labelled test
 * ad (MockAdHost) with a countdown and a close button. Claiming after the countdown
 * resolves 'rewarded', closing early 'dismissed'. Always available, one at a time.
 */
export const mockProvider: AdProvider = {
  name: 'mock',
  isAvailable: () => useAdStore.getState().mock === null,
  show(placement, info) {
    return new Promise((resolve) => {
      if (useAdStore.getState().mock) {
        resolve('unavailable');
        return;
      }
      useAdStore.setState({
        mock: {
          id: nextId++,
          placement,
          reward: info.reward,
          startedAt: Date.now(),
          resolve: (result) => {
            useAdStore.setState({ mock: null });
            resolve(result);
          },
        },
      });
    });
  },
};
