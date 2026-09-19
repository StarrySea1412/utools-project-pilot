// 生成 256x256 logo.png：圆角方块 + 纸飞机图形（无依赖）
const zlib = require('zlib');
const fs = require('fs');
const S = 256, R = 56; // 尺寸与圆角半径
const px = Buffer.alloc(S * S * 4);
function inRounded(x, y) {
  const cx = Math.min(Math.max(x, R), S - R), cy = Math.min(Math.max(y, R), S - R);
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
}
// 纸飞机三角形集合（相对坐标 0-1），白/半透明白
const tris = [
  { p: [[0.14, 0.52], [0.86, 0.18], [0.52, 0.56]], a: 255 },       // 上翼
  { p: [[0.14, 0.52], [0.52, 0.56], [0.44, 0.80]], a: 210 },       // 下翼
  { p: [[0.52, 0.56], [0.86, 0.18], [0.60, 0.78]], a: 160 },       // 折面
];
function alphaAt(nx, ny) {
  let a = 0;
  for (const t of tris) {
    const [[x1, y1], [x2, y2], [x3, y3]] = t.p;
    const s = (x2 - x1) * (ny - y1) - (y2 - y1) * (nx - x1);
    const s2 = (x3 - x2) * (ny - y2) - (y3 - y2) * (nx - x2);
    const s3 = (x1 - x3) * (ny - y3) - (y1 - y3) * (nx - x3);
    if ((s >= 0 && s2 >= 0 && s3 >= 0) || (s <= 0 && s2 <= 0 && s3 <= 0)) a = Math.max(a, t.a);
  }
  return a;
}
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    if (!inRounded(x, y)) { px[i + 3] = 0; continue; }
    const t = (x + y) / (2 * S);
    px[i] = Math.round(46 + 22 * t);      // R
    px[i + 1] = Math.round(96 + 40 * t);  // G
    px[i + 2] = Math.round(214 + 30 * t); // B
    px[i + 3] = 255;
    const na = alphaAt(x / S, y / S);
    if (na) { // 白色飞机与背景混合
      px[i] = Math.round(px[i] * (1 - na / 255) + 255 * (na / 255));
      px[i + 1] = Math.round(px[i + 1] * (1 - na / 255) + 255 * (na / 255));
      px[i + 2] = Math.round(px[i + 2] * (1 - na / 255) + 255 * (na / 255));
    }
  }
}
// PNG 编码
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(require('zlib').crc32 ? zlib.crc32(td) : crc32(td));
  return Buffer.concat([len, td, crc]);
}
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync('logo.png', png);
console.log('logo.png', png.length, 'bytes');
