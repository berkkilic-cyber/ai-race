import type { RegionId } from '@/engine';

describe('test pipeline', () => {
  it('resolves the @/ alias and runs', () => {
    const id: RegionId = 'smoke';
    expect(id).toBe('smoke');
    expect(true).toBe(true);
  });
});
