#!/usr/bin/env node
/**
 * Translation coverage: for every English strings file, lists the keys that have no Turkish
 * value yet, plus a count per file. Always exits 0: other tasks add English keys in parallel
 * and a follow-up pass translates them (the UI falls back to English meanwhile). Problems
 * that must not ship (extra keys, changed placeholders) fail the Jest test instead.
 *
 *   npm run i18n:check            # summary and the missing keys
 *   npm run i18n:check -- --brief # summary only
 */
const path = require('node:path');
const { stringPairs, readJson } = require('./pairs');

const brief = process.argv.includes('--brief');
let total = 0;
let done = 0;
const missing = [];
const rows = [];
for (const pair of stringPairs()) {
  const en = readJson(pair.en);
  const tr = readJson(pair.tr);
  const keys = Object.keys(en);
  const absent = keys.filter((k) => typeof tr[k] !== 'string' || !tr[k].trim());
  total += keys.length;
  done += keys.length - absent.length;
  rows.push(`${String(keys.length - absent.length).padStart(5)} / ${String(keys.length).padEnd(5)} ${pair.name}`);
  for (const k of absent) missing.push(`  ${path.basename(pair.tr)}  ${k}`);
}
console.log('Turkish coverage (translated / English keys):');
for (const r of rows) console.log(r);
console.log(`${String(done).padStart(5)} / ${String(total).padEnd(5)} total`);
if (missing.length === 0) console.log('\nNo English keys without a Turkish value.');
else {
  console.log(`\n${missing.length} English key(s) without a Turkish value (shown in English until translated):`);
  if (!brief) for (const m of missing) console.log(m);
}
process.exitCode = 0;
