import fs from 'node:fs';
import path from 'node:path';

import { hasString, setI18nContext } from '../i18n';
import { getPackEntry } from '../packs';

/**
 * Every literal key passed to t() in the UI exists in the pack or the UI strings. A missing
 * key would otherwise reach the screen as a humanised fallback ("Build data centre") with
 * no error in a production build.
 */
const ROOTS = [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'app')];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...files(full));
    } else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('UI string keys', () => {
  it('exist for every literal t() call', () => {
    setI18nContext(getPackEntry().pack, null);
    const missing: string[] = [];
    for (const file of ROOTS.flatMap(files)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'((?:ui|term)\.[A-Za-z0-9_.-]+)'/g)) {
        if (!hasString(m[1])) missing.push(`${path.relative(process.cwd(), file)}: ${m[1]}`);
      }
      // Ternaries of two literal keys: t(cond ? 'ui.a' : 'ui.b').
      for (const m of src.matchAll(/\bt\([^()'`]*\?\s*'((?:ui|term)\.[A-Za-z0-9_.-]+)'\s*:\s*'((?:ui|term)\.[A-Za-z0-9_.-]+)'/g)) {
        for (const k of [m[1], m[2]]) if (!hasString(k)) missing.push(`${path.relative(process.cwd(), file)}: ${k}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
