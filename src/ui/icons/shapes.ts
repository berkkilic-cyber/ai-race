/**
 * Path builders for shapes that repeat across the set (the spark, stars, arcs).
 * Pure functions of their arguments; every number is rounded to two decimals so the
 * path strings stay short and stable.
 */

const f = (n: number): string => String(Math.round(n * 100) / 100);
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Point on a circle; 0° points right and angles grow clockwise (screen coordinates). */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  return [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
}

/**
 * The set's signature mark: a four-pointed spark with concave sides, used wherever the
 * lab's model (or any AI) appears. Meant to be filled.
 */
export function spark(cx: number, cy: number, r: number): string {
  const k = r * 0.2;
  return (
    `M${f(cx)} ${f(cy - r)}` +
    `Q${f(cx + k)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}` +
    `Q${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + r)}` +
    `Q${f(cx - k)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}` +
    `Q${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - r)}Z`
  );
}

/** A regular star with `points` tips, the first pointing straight up. */
export function star(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const [x, y] = polar(cx, cy, i % 2 === 0 ? outer : inner, -90 + (i * 180) / points);
    d += `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`;
  }
  return `${d}Z`;
}

/** An open arc drawn clockwise from `fromDeg` to `toDeg`. */
export function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  let sweep = toDeg - fromDeg;
  while (sweep <= 0) sweep += 360;
  const [x0, y0] = polar(cx, cy, r, fromDeg);
  const [x1, y1] = polar(cx, cy, r, fromDeg + sweep);
  return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

/**
 * An open arrowhead (two strokes) whose tip is at (x, y), pointing along `deg`
 * (0° right, clockwise). `len` is the length of each barb.
 */
export function arrowHead(x: number, y: number, deg: number, len = 3, spread = 40): string {
  const [x0, y0] = polar(x, y, len, deg + 180 - spread);
  const [x1, y1] = polar(x, y, len, deg + 180 + spread);
  return `M${f(x0)} ${f(y0)}L${f(x)} ${f(y)}L${f(x1)} ${f(y1)}`;
}
