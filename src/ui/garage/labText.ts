import { traitDef, type GarageContent, type ModelCandidate, type ModelStat } from '@/idle';

import { t } from '../i18n';
import { garageContent } from './content';
import { gt } from './text';

/** A model's name: "VibeOracle 3.5". */
export function modelName(m: ModelCandidate, content: GarageContent = garageContent()): string {
  const cfg = content.training;
  if (!cfg) return '';
  const version = Number.isInteger(m.version) ? String(m.version) : m.version.toFixed(1);
  return t('ui.garage.lab.modelName', { prefix: gt(cfg.prefixKeys[m.prefix] ?? ''), suffix: gt(cfg.suffixKeys[m.suffix] ?? ''), version });
}

export function modelDesc(m: ModelCandidate, content: GarageContent = garageContent()): string {
  const cfg = content.training;
  const lead = m.boons[0] ? traitDef(content, m.boons[0].trait)?.stat : undefined;
  const list = cfg && lead ? (cfg.descKeys[lead] ?? []) : [];
  return list.length ? gt(list[m.desc % list.length]) : '';
}

export function rarityName(id: string, content: GarageContent = garageContent()): string {
  const r = content.training?.rarities.find((x) => x.id === id);
  return r ? gt(r.nameKey) : id;
}

/** Rarity rank (0 = commonest), for colouring. */
export function rarityRank(id: string, content: GarageContent = garageContent()): number {
  return Math.max(0, content.training?.rarities.findIndex((x) => x.id === id) ?? 0);
}

/** A stat value in words: "+6%", "-20%", "+0.5 h". */
export function statValue(stat: ModelStat, value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  if (stat === 'offlineCap') return `${sign}${Math.abs(Math.round(value * 10) / 10)} h`;
  return `${sign}${Math.abs(Math.round(value * 1000) / 10)}%`;
}

/** Whether a stat change helps the player (fewer incidents help). */
export function statGood(stat: ModelStat, value: number): boolean {
  return stat === 'incident' ? value < 0 : value > 0;
}

/** One trait line: "+6% production". */
export function traitLine(traitId: string, value: number, content: GarageContent = garageContent()): { text: string; good: boolean } {
  const def = traitDef(content, traitId);
  if (!def) return { text: '', good: true };
  return { text: gt(def.labelKey, { value: statValue(def.stat, value) }), good: statGood(def.stat, value) };
}
