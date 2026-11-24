/**
 * A minimal, deterministic PNG writer on Node's built-in zlib (no dependency).
 *
 * Writes palette-indexed PNGs (colour type 3, 8 bits per pixel) with a tRNS chunk for
 * transparency: the art is flat colour, so indexed files are small, and the same input
 * always gives the same bytes (fixed compression level, no time or text chunks).
 */
const zlib = require('node:zlib');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** '#rrggbb' -> [r, g, b]. */
function hexRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad colour ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Encodes an indexed image.
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} pixels  one palette index per pixel, row by row; 0 is transparent
 * @param {string[]} colours   palette, '#rrggbb'; entry 0 is the transparent colour
 * @param {number} scale       integer nearest-neighbour factor
 */
function encodeIndexed(width, height, pixels, colours, scale = 1) {
  if (!Number.isInteger(scale) || scale < 1) throw new Error('scale must be a positive integer');
  if (colours.length > 256) throw new Error('at most 256 colours');
  const W = width * scale;
  const H = height * scale;
  const raw = Buffer.alloc((W + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W + 1);
    raw[row] = 0; // filter: none (flat colour compresses well without filters)
    const src = Math.floor(y / scale) * width;
    for (let x = 0; x < W; x++) raw[row + 1 + x] = pixels[src + Math.floor(x / scale)];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // colour type: palette
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const plte = Buffer.alloc(colours.length * 3);
  colours.forEach((c, i) => plte.set(hexRgb(c), i * 3));
  const trns = Buffer.from([0]); // only entry 0 is transparent
  const idat = zlib.deflateSync(raw, { level: 9, memLevel: 9, strategy: zlib.constants.Z_DEFAULT_STRATEGY });
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/** Decodes the PNGs this module writes (indexed, filter 0) back to indices and palette: used by tests. */
function decodeIndexed(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let palette = [];
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'PLTE') {
      palette = [];
      for (let i = 0; i < data.length; i += 3) palette.push('#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''));
    } else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) pixels.set(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)), y * width);
  return { width, height, pixels, palette };
}

module.exports = { encodeIndexed, decodeIndexed, hexRgb, crc32 };
