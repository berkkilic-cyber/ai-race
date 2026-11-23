import { useShallow } from 'zustand/react/shallow';

import { selectModelStatus, type ModelStatus } from '../explain/useModelStatus';
import { useTabStore } from '../shell/tabActive';

/** useModelStatus for the Trees tab: holds still while the tab is hidden (useTabSelector). */
export function useTabModelStatus(): ModelStatus {
  return useTabStore(useShallow(selectModelStatus));
}
