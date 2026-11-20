/** Width the crawl is laid out in before it is measured (explicit, so native never constrains the text to the viewport). */
export const MEASURE_WIDTH = 8000;

/**
 * Pure crawl geometry. `segment` is the measured width of one run of headlines, `box` the
 * visible width. Returns whether the crawl can run, how many copies fill the box plus one
 * run, and the explicit track width. A missing, zero or oversized measurement means no
 * crawl: the ticker then shows the newest headline statically, truncated.
 */
export function crawlGeometry(segment: number, box: number, reduced: boolean): { crawl: boolean; copies: number; trackWidth: number } {
  const measured = Number.isFinite(segment) && segment > 0 && segment < MEASURE_WIDTH - 1;
  if (!measured || reduced || !(box > 0)) return { crawl: false, copies: 1, trackWidth: MEASURE_WIDTH };
  const copies = Math.max(2, Math.ceil(box / segment) + 1);
  return { crawl: true, copies, trackWidth: Math.ceil(segment * copies) + 1 };
}

