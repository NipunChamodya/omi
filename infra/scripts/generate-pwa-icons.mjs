// Original geometric OMI spade. PNG encoder uses only Node built-ins.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crc = (data) => {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc(body));
  return Buffer.concat([length, body, checksum]);
}
for (const [size, name] of [
  [180, 'apple-touch-icon'],
  [192, 'omi-192'],
  [512, 'omi-512'],
]) {
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5,
        dy = y / size;
      // Artwork stays inside the central safe area of a maskable icon.
      const tip = dy >= 0.24 && dy < 0.48 && Math.abs(dx) < (dy - 0.24) * 0.85;
      const lobes =
        (dx + 0.1) ** 2 + (dy - 0.49) ** 2 < 0.125 ** 2 ||
        (dx - 0.1) ** 2 + (dy - 0.49) ** 2 < 0.125 ** 2;
      const stem =
        dy >= 0.51 && dy <= 0.72 && Math.abs(dx) < 0.025 + (dy - 0.51) * 0.28;
      const color = tip || lobes || stem ? [240, 205, 125] : [7, 59, 48];
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      color.forEach((value, channel) => (pixels[offset + channel] = value));
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  writeFileSync(
    new URL(`../../apps/web/public/icons/${name}.png`, import.meta.url),
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(pixels)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
