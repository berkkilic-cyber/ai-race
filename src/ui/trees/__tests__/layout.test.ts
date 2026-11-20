import { getPackEntry } from '../../packs';
import { layoutTree } from '../layout';
import { TREES, treeNodes } from '../status';

const pack = getPackEntry().pack;

describe('layoutTree', () => {
  it.each(TREES)('fits %s into 390 px wide without overlaps', (tree) => {
    const nodes = treeNodes(pack, tree);
    const layout = layoutTree(nodes, 390);
    const rects = Object.values(layout.tiles);
    expect(rects).toHaveLength(nodes.length);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(390);
      expect(r.y + r.h).toBeLessThanOrEqual(layout.height);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    expect(layout.edges).toHaveLength(nodes.reduce((sum, n) => sum + n.requires.length, 0));
  });

  it('puts higher rows above lower ones', () => {
    const nodes = treeNodes(pack, 'capability');
    const layout = layoutTree(nodes, 390);
    const root = nodes.find((n) => n.row === 1)!;
    const leaf = nodes.find((n) => n.row === 5)!;
    expect(layout.tiles[root.id].y).toBeLessThan(layout.tiles[leaf.id].y);
  });

  it('curves edges between adjacent rows and routes longer ones through the column gap', () => {
    for (const tree of TREES) {
      const nodes = treeNodes(pack, tree);
      const layout = layoutTree(nodes, 390);
      const rowOf = (id: string) => nodes.find((n) => n.id === id)!.row;
      for (const e of layout.edges) {
        if (rowOf(e.to) - rowOf(e.from) === 1) expect(e.d).toContain('C');
        else expect(e.d).toContain('L');
      }
    }
  });

  it.each(TREES)('lays %s out left to right in a 780x256 landscape area without scrolling', (tree) => {
    const nodes = treeNodes(pack, tree);
    const layout = layoutTree(nodes, 780, { orientation: 'horizontal', height: 256 });
    expect(layout.width).toBe(780);
    expect(layout.height).toBe(256);
    const rects = Object.values(layout.tiles);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(780);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(256);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
    const root = nodes.find((n) => n.row === 1)!;
    const leaf = nodes.find((n) => n.row === 5)!;
    expect(layout.tiles[root.id].x).toBeLessThan(layout.tiles[leaf.id].x);
    const rowOf = (id: string) => nodes.find((n) => n.id === id)!.row;
    for (const e of layout.edges) expect(e.d).toContain(rowOf(e.to) - rowOf(e.from) === 1 ? 'C' : 'L');
  });

  it('grows wider than the area (horizontal scroll) instead of shrinking tiles below their minimum', () => {
    const nodes = treeNodes(pack, 'capability');
    const layout = layoutTree(nodes, 400, { orientation: 'horizontal', height: 100 });
    expect(layout.width).toBeGreaterThan(400);
    expect(layout.height).toBeGreaterThan(100);
  });
});
