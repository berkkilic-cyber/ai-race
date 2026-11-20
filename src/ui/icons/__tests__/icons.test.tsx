/**
 * The icon set: every name has a drawing, the game's ids are covered, and every drawing
 * renders to clean SVG (finite numbers, drawable paths, no colours of its own).
 */
import type { ReactElement, ReactNode } from 'react';
import { Fragment, isValidElement } from 'react';

import nodes from '@/content/packs/ai-lab/nodes.json';

import { isDrawablePath } from '../../map/svgSafe';
import { hasIcon, Icon, iconGroups, iconNames, type IconName } from '../Icon';
import { channelIconNames, interfaceIconNames, mapObjectIconNames, momentIconNames, resourceIconNames, upgradeIconNames } from '../names';
import { registry } from '../registry';

// Primitives become plain host elements so the tree keeps the props exactly as written.
jest.mock('react-native-svg', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const host = (type: string) => {
    const C = (props: Record<string, unknown>) => React.createElement(type, props);
    C.displayName = type;
    return C;
  };
  const names = ['Svg', 'G', 'Path', 'Circle', 'Rect', 'Ellipse', 'Line', 'Polyline', 'Polygon'];
  const mod: Record<string, unknown> = { __esModule: true, default: host('Svg') };
  for (const n of names) mod[n] = host(n);
  return mod;
});

interface JsonNode {
  type: string;
  props: Record<string, unknown>;
  children: JsonNode[];
}

/**
 * Renders a tree of pure function components to JSON (the icons use no hooks), stopping at
 * the host elements the mock produces.
 */
function toJson(node: ReactNode): JsonNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(toJson);
  if (!isValidElement(node)) throw new Error(`unexpected child: ${String(node)}`);
  const el = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === Fragment) return toJson(el.props.children);
  if (typeof el.type === 'function') return toJson((el.type as (p: unknown) => ReactNode)(el.props));
  if (typeof el.type !== 'string') throw new Error('unexpected element type');
  const { children, ...props } = el.props;
  return [{ type: el.type, props, children: toJson(children) }];
}

function walk(nodes: JsonNode[], visit: (n: JsonNode) => void) {
  for (const n of nodes) {
    visit(n);
    walk(n.children, visit);
  }
}

const MAIN = 'main-ink';
const ACCENT = 'accent-ink';
const COLOUR_PROPS = ['fill', 'stroke', 'color', 'stopColor', 'floodColor', 'lightingColor'];
const NUMERIC_PROPS = ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'strokeWidth', 'x1', 'y1', 'x2', 'y2', 'opacity'];
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(black|white|red|green|blue|gray|grey|orange|yellow|currentColor)\b/i;

function problemsOf(tree: JsonNode[], allowed: Set<string>): string[] {
  const problems: string[] = [];
  walk(tree, (n) => {
    for (const [key, value] of Object.entries(n.props)) {
      if (typeof value === 'number' && !Number.isFinite(value)) problems.push(`${n.type}.${key} = ${value}`);
      if (value === undefined && NUMERIC_PROPS.includes(key)) problems.push(`${n.type}.${key} is undefined`);
      if (typeof value === 'string') {
        if (/NaN|undefined|Infinity/.test(value)) problems.push(`${n.type}.${key} = "${value}"`);
        if (COLOUR_PROPS.includes(key) ? !allowed.has(value) : COLOUR_LITERAL.test(value)) problems.push(`${n.type}.${key} = "${value}" (colour)`);
      }
      if (key === 'd' && !isDrawablePath(value as string)) problems.push(`${n.type}.d not drawable: ${String(value)}`);
    }
    if (['Svg', 'G', 'Path', 'Circle', 'Rect', 'Ellipse', 'Line'].indexOf(n.type) < 0) problems.push(`unexpected element ${n.type}`);
  });
  return problems;
}

describe('icon names', () => {
  it('every name in the union has a registered drawing, and nothing else is registered', () => {
    const registered = Object.keys(registry).sort();
    expect(registered).toEqual([...iconNames].sort());
    for (const name of iconNames) expect(typeof registry[name]).toBe('function');
  });

  it('names are unique and each group lists the expected count', () => {
    expect(new Set(iconNames).size).toBe(iconNames.length);
    expect(resourceIconNames).toHaveLength(10);
    expect(upgradeIconNames).toHaveLength(36);
    expect(momentIconNames).toHaveLength(16);
    expect(mapObjectIconNames).toHaveLength(8);
    expect(channelIconNames).toHaveLength(5);
    expect(interfaceIconNames).toHaveLength(11);
    expect(iconGroups.flatMap((g) => g.names)).toHaveLength(86);
  });

  it('covers every upgrade node in the pack, by node id', () => {
    const ids = nodes.map((n: { id: string }) => n.id);
    expect(ids).toHaveLength(36);
    for (const id of ids) expect(hasIcon(id)).toBe(true);
  });

  it('covers the moments and resources the game uses', () => {
    for (const name of ['megaphone', 'star', 'cash', 'chip', 'document', 'gavel', 'recruiter', 'thermometer', 'camera', 'speech', 'crowd', 'trophy', 'mortarboard', 'heart', 'bug', 'bolt']) {
      expect(hasIcon(name)).toBe(true);
    }
    for (const name of ['hype', 'cash', 'compute', 'tier', 'users', 'datacentre', 'regulation', 'backlash', 'rival-agi', 'world-share']) {
      expect(hasIcon(name)).toBe(true);
    }
  });

  it('hasIcon rejects unknown names', () => {
    expect(hasIcon('no-such-icon')).toBe(false);
    expect(hasIcon('')).toBe(false);
    expect(hasIcon('toString')).toBe(false);
  });
});

describe('icon rendering', () => {
  const both = new Set([MAIN, ACCENT, 'none', 'transparent']);
  const mainOnly = new Set([MAIN, 'none', 'transparent']);

  it.each(iconNames.map((n) => [n]))('%s renders clean SVG with only the given colours', (name) => {
    const tree = toJson(<Icon name={name as IconName} size={28} color={MAIN} accent={ACCENT} />);
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('Svg');
    expect(tree[0].props.viewBox).toBe('0 0 24 24');
    let shapes = 0;
    walk(tree, (n) => {
      if (n.type !== 'Svg' && n.type !== 'G') shapes += 1;
    });
    expect(shapes).toBeGreaterThan(0);
    expect(problemsOf(tree, both)).toEqual([]);
    // Without an accent everything falls back to the main colour.
    expect(problemsOf(toJson(<Icon name={name as IconName} color={MAIN} />), mainOnly)).toEqual([]);
  });

  it('draws the fallback for an unknown name', () => {
    const tree = toJson(<Icon name="no-such-icon" color={MAIN} />);
    expect(problemsOf(tree, mainOnly)).toEqual([]);
    expect(JSON.stringify(tree)).toContain('strokeDasharray');
  });

  it('guards bad sizes and stroke widths', () => {
    const tree = toJson(<Icon name="cash" size={Number.NaN} strokeWidth={Number.NaN} color={MAIN} />);
    expect(tree[0].props.width).toBe(0);
    expect(problemsOf(tree, mainOnly)).toEqual([]);
    const g = tree[0].children[0];
    expect(g.props.strokeWidth).toBe(1.75);
  });
});
