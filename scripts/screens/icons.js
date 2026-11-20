#!/usr/bin/env node
/**
 * Contact sheets of the icon set (src/ui/icons) from the debug route app/dev/icons.tsx.
 *
 *   npx expo export --platform web && node scripts/screens/icons.js [outDir]
 *
 * Shoots every icon at 20, 28 and 56 px on the light (paper) and dark (night) palettes with
 * each name under it, plus a 20 px sheet without names (to judge recognisability), into
 * docs/screenshots/icons/. Serves dist/ inside this process; the server and browser are
 * closed before exiting. Env: CHROME (default /usr/bin/google-chrome), PORT (default 8767).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots', 'icons'));
const PORT = Number(process.env.PORT || 8767);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const WIDTH = 1100;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    for (const c of [url, `${url}.html`, path.join(url, 'index.html')]) {
      const file = path.join(DIST, c);
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    fs.createReadStream(path.join(DIST, 'index.html')).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

const SHEETS = [
  { size: 20, bg: 'light' },
  { size: 28, bg: 'light' },
  { size: 56, bg: 'light' },
  { size: 20, bg: 'dark' },
  { size: 28, bg: 'dark' },
  { size: 56, bg: 'dark' },
  { size: 20, bg: 'light', labels: false },
];

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewport({ width: WIDTH, height: 800, deviceScaleFactor: 2 });
    for (const s of SHEETS) {
      const labels = s.labels !== false;
      await page.goto(`http://127.0.0.1:${PORT}/dev/icons?debug=1&size=${s.size}&bg=${s.bg}&labels=${labels ? 1 : 0}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="icon-gallery-ready"]', { timeout: 15000 });
      const el = await page.$('[data-testid="icon-gallery-ready"]');
      const box = await el.boundingBox();
      await page.setViewport({ width: WIDTH, height: Math.ceil(box.y + box.height + 16), deviceScaleFactor: 2 });
      const name = `icons-${s.size}-${s.bg}${labels ? '' : '-nolabels'}.png`;
      await page.screenshot({ path: path.join(OUT, name), fullPage: true });
      console.log(`saved ${name}`);
      await page.setViewport({ width: WIDTH, height: 800, deviceScaleFactor: 2 });
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
