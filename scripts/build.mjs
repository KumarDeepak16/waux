// Build WAUX into dist/ (load unpacked from there).
//   node scripts/build.mjs          production build
//   node scripts/build.mjs --watch  rebuild on change
//   node scripts/build.mjs --zip    production build + release/waux-<version>.zip
import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { buildCipherFont } from './cipher-font.mjs';
import { avatarsCss } from './avatars.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const zip = process.argv.includes('--zip');

// Phosphor SVG -> array of path `d` strings (rendered as elements, no innerHTML).
const svgPaths = {
  name: 'svg-paths',
  setup(build) {
    build.onLoad({ filter: /\.svg$/ }, async (args) => {
      const src = await readFile(args.path, 'utf8');
      if (/<(circle|rect|line|polyline|polygon|ellipse)\b/.test(src)) {
        throw new Error(`Icon uses unsupported shapes: ${args.path}`);
      }
      const ds = [...src.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
      if (!ds.length) throw new Error(`No paths in ${args.path}`);
      return { contents: JSON.stringify(ds), loader: 'json' };
    });
  },
};

const js = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.css': 'text' },
  plugins: [svgPaths],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'warning',
  entryPoints: {
    content: 'src/content/index.ts',
    'main-world': 'src/content/main-world.ts',
    sw: 'src/background/sw.ts',
    popup: 'src/popup/main.tsx',
    studio: 'src/studio/main.tsx',
  },
  outdir: out,
};

const css = {
  bundle: true,
  target: 'chrome120',
  minify: !watch,
  logLevel: 'warning',
  external: ['/fonts/*', 'chrome-extension://*'],
  entryPoints: {
    skin: 'src/content/skin.css',
    popup: 'src/popup/popup.css',
    studio: 'src/studio/studio.css',
  },
  outdir: out,
};

async function copyStatic() {
  await cp(path.join(root, 'static'), out, { recursive: true });
  await cp(path.join(root, 'assets/icon.svg'), path.join(out, 'icons/icon.svg'));
  await cp(path.join(root, 'assets/icon-small.svg'), path.join(out, 'icons/icon-small.svg'));
  const fonts = path.join(root, 'node_modules/geist/dist/fonts');
  await mkdir(path.join(out, 'fonts'), { recursive: true });
  await cp(path.join(fonts, 'geist-sans/Geist-Variable.woff2'), path.join(out, 'fonts/Geist-Variable.woff2'));
  await cp(path.join(fonts, 'geist-mono/GeistMono-Variable.woff2'), path.join(out, 'fonts/GeistMono-Variable.woff2'));
  await writeFile(path.join(out, 'fonts/WauxCipher.ttf'), buildCipherFont());
  await writeFile(path.join(out, 'avatars.css'), avatarsCss());
  // The OFL requires the license to travel with the fonts.
  await cp(path.join(root, 'node_modules/geist/LICENSE.txt'), path.join(out, 'fonts/OFL.txt'));
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await copyStatic();

if (watch) {
  const a = await esbuild.context(js);
  const b = await esbuild.context(css);
  await Promise.all([a.watch(), b.watch()]);
  console.log('Watching. Reload the extension in chrome://extensions after changes.');
} else {
  await Promise.all([esbuild.build(js), esbuild.build(css)]);
  const files = await list(out);
  let total = 0;
  for (const f of files) total += (await stat(f)).size;
  console.log(`Built dist/ (${files.length} files, ${(total / 1024).toFixed(0)} KB)`);
  if (zip) await makeZip(files);
}

async function list(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? list(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return nested.flat().sort();
}

// Minimal ZIP writer (deflate), so packaging needs no extra tools.
async function makeZip(files) {
  const { version } = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(path.relative(out, file).split(path.sep).join('/'));
    const data = await readFile(file);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(0x00210000, 10); // fixed DOS date/time for reproducible zips
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0x00210000, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(head, name, packed);
    centrals.push(central, name);
    offset += head.length + name.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  await mkdir(path.join(root, 'release'), { recursive: true });
  const target = path.join(root, 'release', `waux-${version}.zip`);
  await writeFile(target, Buffer.concat([...locals, cd, end]));
  console.log(`Packed ${path.relative(root, target)}`);
}
