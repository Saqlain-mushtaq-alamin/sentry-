const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPng(width, height, pixelFn) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const toCrc = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw Sentry shield logo with neural network / core motif
function shieldPixel(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1 to 1
  const ny = (y / h) * 2 - 1; // -1 to 1

  // Outer shield boundary
  // Top is flat with rounded corners: y around -0.8
  // Bottom tapers to a point: y around 0.85
  const shieldWidth = 0.75 * (1 - Math.max(0, ny - 0.1) * 0.7);
  const inShield = Math.abs(nx) <= shieldWidth && ny >= -0.75 && ny <= 0.85;

  if (!inShield) {
    // Transparent outside
    return [0, 0, 0, 0];
  }

  // Border check
  const borderMargin = 0.08;
  const innerShieldWidth = 0.75 * (1 - Math.max(0, ny - 0.1) * 0.7) - borderMargin;
  const isBorder = Math.abs(nx) >= innerShieldWidth || ny <= -0.75 + borderMargin || ny >= 0.85 - borderMargin;

  if (isBorder) {
    // Glowing cyan border
    return [6, 182, 212, 255]; // #06b6d4
  }

  // Inner shield background: deep gradient slate
  const grad = (ny + 0.75) / 1.6;
  const bgR = Math.floor(15 + grad * 15);
  const bgG = Math.floor(23 + grad * 25);
  const bgB = Math.floor(42 + grad * 40);

  // Center emblem: AI core / neural circle
  const distCenter = Math.sqrt(nx * nx + (ny + 0.05) * (ny + 0.05));
  if (distCenter < 0.22) {
    if (distCenter < 0.12) {
      // White glowing core
      return [255, 255, 255, 255];
    }
    // Emerald energy ring
    return [16, 185, 129, 255]; // #10b981
  }

  // Horizontal / diagonal circuit traces
  if (Math.abs(ny + 0.05) < 0.02 && Math.abs(nx) < 0.45) {
    return [6, 182, 212, 220];
  }
  if (Math.abs(nx) < 0.02 && ny > -0.4 && ny < 0.5) {
    return [6, 182, 212, 220];
  }

  return [bgR, bgG, bgB, 255];
}

function trayPixel(x, y, w, h) {
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  const shieldWidth = 0.75 * (1 - Math.max(0, ny - 0.1) * 0.7);
  const inShield = Math.abs(nx) <= shieldWidth && ny >= -0.75 && ny <= 0.85;
  if (!inShield) return [0, 0, 0, 0];
  return [255, 255, 255, 255]; // White monochrome for tray
}

function createBmp(width, height) {
  // 24-bit RGB BMP (bottom-up)
  const rowBytes = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowBytes * height;
  const headerSize = 54;
  const fileSize = headerSize + imageSize;

  const buf = Buffer.alloc(fileSize);
  // BITMAPFILEHEADER
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(headerSize, 10);

  // BITMAPINFOHEADER
  buf.writeUInt32LE(40, 14); // Header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26); // Planes
  buf.writeUInt16LE(24, 28); // 24 bpp
  buf.writeUInt32LE(0, 30); // BI_RGB
  buf.writeUInt32LE(imageSize, 34);

  let offset = headerSize;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      // Vertical gradient from deep navy to cyan
      const ratio = y / height;
      const b = Math.floor(42 + (1 - ratio) * 100);
      const g = Math.floor(23 + (1 - ratio) * 80);
      const r = Math.floor(15 + (1 - ratio) * 40);
      buf[offset++] = b;
      buf[offset++] = g;
      buf[offset++] = r;
    }
    // Row padding
    for (let p = 0; p < rowBytes - width * 3; p++) {
      buf[offset++] = 0;
    }
  }

  return buf;
}

function createIco(pngBuffersBySize) {
  // ICONDIR: idReserved (2), idType (2 = 1 for icon), idCount (2)
  const count = pngBuffersBySize.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let imageOffset = 6 + count * 16;

  for (const item of pngBuffersBySize) {
    const entry = Buffer.alloc(16);
    entry[0] = item.size >= 256 ? 0 : item.size; // width (0 = 256)
    entry[1] = item.size >= 256 ? 0 : item.size; // height (0 = 256)
    entry[2] = 0; // color count
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(item.buf.length, 8); // size of image
    entry.writeUInt32LE(imageOffset, 12); // offset
    entries.push(entry);
    imageOffset += item.buf.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffersBySize.map((i) => i.buf)]);
}

function createIcns(pngBuffersByType) {
  // ICNS format: 'icns' (4 bytes), totalLength (4 bytes), chunks: [type (4), len (4), data]
  let totalLen = 8;
  const chunks = [];
  for (const item of pngBuffersByType) {
    const chunkLen = 8 + item.buf.length;
    totalLen += chunkLen;
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(item.ostype, 0, 4, 'ascii');
    chunkHeader.writeUInt32BE(chunkLen, 4);
    chunks.push(Buffer.concat([chunkHeader, item.buf]));
  }

  const fileHeader = Buffer.alloc(8);
  fileHeader.write('icns', 0, 4, 'ascii');
  fileHeader.writeUInt32BE(totalLen, 4);

  return Buffer.concat([fileHeader, ...chunks]);
}

function main() {
  const outDir = path.join(__dirname, '..', 'assets', 'icons');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Generating PNG icons...');
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const pngs = {};

  for (const s of sizes) {
    const buf = createPng(s, s, shieldPixel);
    pngs[s] = buf;
    if (s === 1024) {
      fs.writeFileSync(path.join(outDir, 'icon.png'), buf);
    } else {
      fs.writeFileSync(path.join(outDir, `icon-${s}.png`), buf);
    }
  }

  // Tray icons
  const tray16 = createPng(16, 16, trayPixel);
  const tray32 = createPng(32, 32, trayPixel);
  fs.writeFileSync(path.join(outDir, 'tray-icon.png'), tray16);
  fs.writeFileSync(path.join(outDir, 'tray-icon@2x.png'), tray32);

  // Installer sidebar BMP (164x314)
  console.log('Generating NSIS installer sidebar BMP...');
  const bmp = createBmp(164, 314);
  fs.writeFileSync(path.join(outDir, 'installer-sidebar.bmp'), bmp);

  // Windows ICO
  console.log('Generating Windows ICO...');
  const ico = createIco([
    { size: 16, buf: pngs[16] },
    { size: 32, buf: pngs[32] },
    { size: 48, buf: pngs[48] },
    { size: 64, buf: pngs[64] },
    { size: 128, buf: pngs[128] },
    { size: 256, buf: pngs[256] },
  ]);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

  // macOS ICNS
  console.log('Generating macOS ICNS...');
  const icns = createIcns([
    { ostype: 'icp4', buf: pngs[16] },
    { ostype: 'icp5', buf: pngs[32] },
    { ostype: 'icp6', buf: pngs[64] },
    { ostype: 'ic07', buf: pngs[128] },
    { ostype: 'ic08', buf: pngs[256] },
    { ostype: 'ic09', buf: pngs[512] },
    { ostype: 'ic10', buf: pngs[1024] },
  ]);
  fs.writeFileSync(path.join(outDir, 'icon.icns'), icns);

  console.log('Icons generated successfully in', outDir);
}

main();
