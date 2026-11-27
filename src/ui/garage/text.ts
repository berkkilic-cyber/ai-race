import { generatorDef, upgradeDef, type GarageContent, type Requirement, type UpgradeEffect } from '@/idle';

import { fmtAmount, fmtDuration, fmtHours, fmtNum, pctText } from '../format';
import { hasString, t, type Params } from '../i18n';
import { garageContent } from './content';

/**
 * Translates a key from the Garage content's strings, falling back to the pack and UI
 * strings (t). String params that are themselves Garage keys (a tier's name key in an
 * incident line, an achievement's name key) are translated too.
 */
export function gt(key: string, params?: Params, content: GarageContent = garageContent()): string {
  const own = content.strings[key];
  let text = own ?? t(key);
  if (!params) return text;
  if (own === undefined) return t(key, resolve(params, content));
  const p = resolve(params, content);
  text = text.replace(/\{(\w+)\}/g, (whole, name: string) => (p[name] === undefined ? whole : String(p[name])));
  return text;
}

function resolve(params: Params, content: GarageContent): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) out[k] = typeof v === 'string' && content.strings[v] !== undefined ? content.strings[v] : v;
  return out;
}

export function hasGarageString(key: string): boolean {
  return garageContent().strings[key] !== undefined || hasString(key);
}

/** Token amounts: "12.3K". */
export const fmt = (n: number) => fmtAmount(n);
export const fmtTime = (ms: number) => fmtDuration(ms);

function mult(m: number): string {
  return fmtNum(Math.round(m * 100) / 100, 2);
}

function pct(share: number): string {
  return pctText(Math.round(share * 1000) / 10);
}

/** One effect in words: "Rented GPU ×2", "Taps +2% of production". */
export function effectText(e: UpgradeEffect, content: GarageContent = garageContent()): string {
  switch (e.kind) {
    case 'tapMult':
      return t('ui.garage.effect.tapMult', { mult: mult(e.mult) });
    case 'tapFromRate':
      return t('ui.garage.effect.tapFromRate', { pct: pct(e.share) });
    case 'generatorMult': {
      const def = generatorDef(content, e.generator);
      return t('ui.garage.effect.generatorMult', { name: def ? gt(def.nameKey) : e.generator, mult: mult(e.mult) });
    }
    case 'crewBonus': {
      const def = generatorDef(content, e.generator);
      return t('ui.garage.effect.crewBonus', { name: def ? gt(def.nameKey) : e.generator, pct: pct(e.add) });
    }
    case 'globalMult':
      return t('ui.garage.effect.globalMult', { mult: mult(e.mult) });
    case 'offlineCap':
      return t('ui.garage.effect.offlineCap', { hours: fmtHours(e.hours) });
    case 'offlineRate':
      return t('ui.garage.effect.offlineRate', { pct: pct(e.add) });
    case 'comboStacks':
      return t('ui.garage.effect.comboStacks', { count: e.add });
    case 'goldenMult':
      return t('ui.garage.effect.goldenMult', { mult: mult(e.mult) });
    case 'goldenInterval':
      return t('ui.garage.effect.goldenInterval', { pct: pct(1 / e.mult - 1) });
  }
}

/** A requirement in words: "Own 25 Rented GPU". */
export function requirementText(r: Requirement, content: GarageContent = garageContent()): string {
  switch (r.type) {
    case 'owned': {
      const def = generatorDef(content, r.generator);
      return t('ui.garage.req.owned', { count: r.count, name: def ? gt(def.nameKey) : r.generator });
    }
    case 'lifetime':
      return t('ui.garage.req.lifetime', { amount: fmt(r.tokens) });
    case 'allTime':
      return t('ui.garage.req.allTime', { amount: fmt(r.tokens) });
    case 'taps':
      return t('ui.garage.req.taps', { count: r.count });
    case 'generation':
      return t('ui.garage.req.generation', { model: generationLabel(r.min, content) });
    case 'upgrade': {
      const def = upgradeDef(content, r.id);
      return t('ui.garage.req.upgrade', { name: def ? gt(def.nameKey) : r.id });
    }
  }
}

/** A generation's display name ("Model 2: Chatty", "Model 14"). */
export function generationLabel(n: number, content: GarageContent = garageContent()): string {
  const named = content.generations[n];
  return named ? gt(named.nameKey) : gt(content.endlessNameKey, { n: n + 1 });
}

export { mult as fmtMult, pct as fmtPct };
export { fmtFixed, pctText } from '../format';
