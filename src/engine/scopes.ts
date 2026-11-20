import type { EngineContext } from './context';
import { adoptionIn, isPresent } from './derived';
import { pickDistinct, type RngHolder } from './rng';
import type { LabState, RegionDef, RegionScope } from './types';
import { max } from './natives';

function presentRegions(lab: LabState, context: EngineContext, tag?: string): RegionDef[] {
  return context.pack.regions.filter((region) => isPresent(lab, region.id) && (tag === undefined || region.tags.includes(tag)));
}

function topRegions(lab: LabState, context: EngineContext, count: number): RegionDef[] {
  return presentRegions(lab, context)
    .sort((a, b) => adoptionIn(lab, b.id) - adoptionIn(lab, a.id))
    .slice(0, max(0, count));
}

/** Regions a scope selects for `lab`. 'random' consumes randomness from `rng`. */
export function resolveScope(scope: RegionScope, lab: LabState, context: EngineContext, rng: RngHolder): RegionDef[] {
  switch (scope.kind) {
    case 'home': {
      const home = context.regions.get(lab.homeRegion);
      return home ? [home] : [];
    }
    case 'region': {
      const region = context.regions.get(scope.id);
      return region ? [region] : [];
    }
    case 'tag':
      return context.pack.regions.filter((region) => region.tags.includes(scope.tag));
    case 'all':
      return context.pack.regions.slice();
    case 'random':
      return pickDistinct(rng, presentRegions(lab, context, scope.tag), scope.count);
    case 'top':
      return topRegions(lab, context, scope.count);
    default:
      return assertNever(scope);
  }
}

/**
 * Whether `lab` is present in a scope, without randomness: for 'random' and 'top'
 * the lab must be present in at least `count` regions (matching the tag).
 */
export function isPresentInScope(scope: RegionScope, lab: LabState, context: EngineContext): boolean {
  switch (scope.kind) {
    case 'home':
      return isPresent(lab, lab.homeRegion);
    case 'region':
      return isPresent(lab, scope.id);
    case 'tag':
      return presentRegions(lab, context, scope.tag).length > 0;
    case 'all':
      return presentRegions(lab, context).length > 0;
    case 'random':
      return presentRegions(lab, context, scope.tag).length >= max(1, scope.count);
    case 'top':
      return presentRegions(lab, context).length >= max(1, scope.count);
    default:
      return assertNever(scope);
  }
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
