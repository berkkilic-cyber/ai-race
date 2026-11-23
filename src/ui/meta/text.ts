/** Words for Lab Rep perks and rewards (all through the strings files). */
import type { GarageContent, LabPerkDef } from '@/idle';

import { fmtCash, fmtPct } from '../format';
import { garageContent } from '../garage/content';
import { gt } from '../garage/text';
import { t } from '../i18n';
import { isPowerPerk, perkTotals } from './logic';

const pct = (share: number) => fmtPct(share);

export function perkName(p: LabPerkDef, content: GarageContent = garageContent()): string {
  return p.nameKey ? gt(p.nameKey, undefined, content) : p.id;
}

export function perkQuip(p: LabPerkDef, content: GarageContent = garageContent()): string {
  return p.quipKey ? gt(p.quipKey, undefined, content) : '';
}

/** A perk's effect in a few words: "+$15M Cash", "+3% Hype income", "Looks only". */
export function perkEffectShort(p: LabPerkDef): string {
  const a = p.effect.amount;
  switch (p.effect.kind) {
    case 'startCash':
      return t('ui.meta.sum.cash', { amount: fmtCash(a), cash: t('term.cash') });
    case 'startHype':
      return t('ui.meta.sum.hype', { amount: String(a), hype: t('term.hype') });
    case 'hypeIncome':
      return t('ui.meta.sum.income', { pct: pct(a), what: t('term.hype') });
    case 'cashIncome':
      return t('ui.meta.sum.income', { pct: pct(a), what: t('term.cash') });
    default:
      return t('ui.meta.sheet.looks');
  }
}

/** The active race perks added up, at most `max` parts then "+n": "+$30M Cash, +8 Hype +2". */
export function perkSummary(perks: readonly LabPerkDef[], max = 2): string {
  const power = perks.filter(isPowerPerk);
  if (power.length === 0) return t('ui.meta.chip.looks');
  const tot = perkTotals(power);
  const parts: string[] = [];
  if (tot.cash) parts.push(t('ui.meta.sum.cash', { amount: fmtCash(tot.cash), cash: t('term.cash') }));
  if (tot.hype) parts.push(t('ui.meta.sum.hype', { amount: String(tot.hype), hype: t('term.hype') }));
  if (tot.hypeIncome) parts.push(t('ui.meta.sum.income', { pct: pct(tot.hypeIncome), what: t('term.hype') }));
  if (tot.cashIncome) parts.push(t('ui.meta.sum.income', { pct: pct(tot.cashIncome), what: t('term.cash') }));
  const shown = parts.slice(0, max).join(', ');
  return parts.length > max ? `${shown} +${parts.length - max}` : shown;
}

/** Rep with one decimal, no trailing ".0": 1.6, 2. */
export function fmtRep(rep: number): string {
  return String(Math.round(rep * 10) / 10);
}
