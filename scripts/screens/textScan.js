/**
 * Scans the text a screenshot shows for strings that should never reach the screen: raw
 * string keys ("node.x.name", "term.hype", "ui.region.build", "engine.news...") and
 * unreplaced placeholders ("{model}"). The screenshot scripts call `scanText(page, name)`
 * after each shot and `textScanSummary()` at the end (non-zero exit code when anything
 * was found). Reads the visible text and accessibility labels.
 */
const KEY = /\b(?:ui|term|node|engine|stat|barrier|channel|moment|headline|event|ending|achievement|region|brand|founder|rival|tutorial)\.[a-z][\w-]*(?:\.[\w-]+)*/;
const PLACEHOLDER = /\{[A-Za-z_]\w*\}/;

const found = new Map();

async function scanText(page, name) {
  let texts;
  try {
    texts = await page.evaluate(() => {
      const out = [document.body ? document.body.innerText : ''];
      for (const el of document.querySelectorAll('[aria-label]')) out.push(el.getAttribute('aria-label') || '');
      return out;
    });
  } catch {
    return [];
  }
  const hits = [];
  for (const text of texts) {
    for (const line of text.split('\n')) {
      const key = KEY.exec(line);
      const ph = PLACEHOLDER.exec(line);
      if (key || ph) hits.push(`${(key || ph)[0]}  in "${line.trim().slice(0, 100)}"`);
    }
  }
  for (const h of hits) {
    if (!found.has(h)) found.set(h, name);
  }
  return hits;
}

function textScanSummary() {
  if (found.size === 0) {
    console.log('text scan: no raw keys or placeholders on screen');
    return 0;
  }
  console.log(`text scan: ${found.size} raw key(s) or placeholder(s) on screen:`);
  for (const [hit, name] of found) console.log(`  [${name}] ${hit}`);
  process.exitCode = 1;
  return found.size;
}

module.exports = { scanText, textScanSummary };
