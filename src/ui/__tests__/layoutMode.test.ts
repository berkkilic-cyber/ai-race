import { layoutModeFor } from '../hooks/useLayoutMode';

describe('layoutModeFor', () => {
  it('is wide for landscape windows at least 600 wide', () => {
    expect(layoutModeFor(844, 390)).toBe('wide');
    expect(layoutModeFor(600, 599)).toBe('wide');
    expect(layoutModeFor(1920, 1080)).toBe('wide');
  });

  it('is narrow for portrait, square or small windows', () => {
    expect(layoutModeFor(390, 844)).toBe('narrow');
    expect(layoutModeFor(700, 700)).toBe('narrow');
    expect(layoutModeFor(599, 300)).toBe('narrow');
  });
});
