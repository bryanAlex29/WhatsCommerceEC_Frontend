/* global __dirname */
/** Approved monochrome variants: full canvas and transparent-margin-only compact. Never writes logo.png. */
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
// PNG tooling already present in the Expo/Jest development dependency tree.
const { PNG } = require('pngjs');

function monochromeLogo(input) {
  const source = PNG.sync.read(input);
  const output = new PNG({ width: source.width, height: source.height });
  for (let i = 0; i < source.data.length; i += 4) {
    // Remove near-white background, keep dark/green artwork and soft edge coverage.
    const ink = Math.min(source.data[i], source.data[i + 1], source.data[i + 2]);
    const coverage = Math.max(0, Math.min(1, (235 - ink) / 100));
    output.data[i] = output.data[i + 1] = output.data[i + 2] = 255;
    output.data[i + 3] = Math.round(source.data[i + 3] * coverage);
  }
  return PNG.sync.write(output);
}
function compactLogo(input) {
  const source = PNG.sync.read(input);
  let left = source.width, top = source.height, right = -1, bottom = -1;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.data[(y * source.width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error('EMPTY_LOGO');
  const padding = 16;
  const width = right - left + 1, height = bottom - top + 1;
  const output = new PNG({ width: width + padding * 2, height: height + padding * 2 });
  PNG.bitblt(source, output, left, top, width, height, padding, padding);
  return PNG.sync.write(output);
}
module.exports = { monochromeLogo, compactLogo };
if (require.main === module) {
  const assets = resolve(__dirname, '../assets');
  const mono = monochromeLogo(readFileSync(resolve(assets, 'logo.png')));
  writeFileSync(resolve(assets, 'logo-monochrome.png'), mono);
  const compact = compactLogo(mono);
  writeFileSync(resolve(assets, 'logo-monochrome-compact.png'), compact);
  const { width, height } = PNG.sync.read(compact);
  writeFileSync(resolve(assets, 'logo-monochrome-compact.json'), JSON.stringify({ width, height }) + '\n');
  console.log('Variantes monocromáticas creadas; logo.png original intacto.');
}
