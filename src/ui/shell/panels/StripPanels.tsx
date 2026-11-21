import { Sheet } from '../../components/Sheet';
import { t } from '../../i18n';
import { IncomeSheetBody } from './IncomeSheet';
import { ModelSheetBody } from './ModelSheet';
import { useStripPanel } from './store';

/**
 * Host for the panels the top strip opens (Hype and Cash breakdowns, the model readout),
 * mounted last inside the main area so the shared Sheet covers it like any side panel.
 * Renders nothing while closed, so it never sits above the map's touch view.
 */
export function StripPanels() {
  const open = useStripPanel((s) => s.open);
  const close = useStripPanel((s) => s.close);
  if (!open) return null;
  const title = open === 'model' ? t('ui.explain.model.title') : t(`ui.explain.income.title.${open}`);
  return (
    <Sheet visible onClose={close} title={title} maxHeight="90%" testID="strip-panel">
      {open === 'model' ? <ModelSheetBody /> : <IncomeSheetBody kind={open} />}
    </Sheet>
  );
}
