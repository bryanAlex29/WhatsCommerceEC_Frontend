/* global __dirname */
const { Buffer } = require('node:buffer');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { monochromeLogo, compactLogo } = require('./prepare-monochrome-logo.cjs');

test('mantiene proporciones, transforma fondo en transparencia y no pierde tinta verde/oscura', () => {
  const source = new PNG({ width: 4, height: 1 });
  source.data.set([255, 255, 255, 255, 5, 150, 105, 255, 15, 23, 42, 255, 200, 200, 200, 255]);
  const before = Buffer.from(source.data);
  const output = PNG.sync.read(monochromeLogo(PNG.sync.write(source)));
  assert.equal(output.width, 4); assert.equal(output.height, 1);
  assert.deepEqual(source.data, before);
  assert.equal(output.data[3], 0);
  assert.equal(output.data[7], 255); assert.equal(output.data[11], 255);
  assert.ok(output.data[15] > 0 && output.data[15] < 255);
  for (let i = 0; i < output.data.length; i += 4) assert.deepEqual([...output.data.subarray(i, i + 3)], [255, 255, 255]);
});
test('preserva píxeles ya transparentes', () => {
  const source = new PNG({ width: 1, height: 1 }); source.data.set([0, 0, 0, 0]);
  assert.equal(PNG.sync.read(monochromeLogo(PNG.sync.write(source))).data[3], 0);
});
test('variante incluida es reproducible desde el original y mantiene su lienzo', () => {
  const assets = resolve(__dirname, '../assets');
  const source = readFileSync(resolve(assets, 'logo.png'));
  const variant = readFileSync(resolve(assets, 'logo-monochrome.png'));
  assert.deepEqual(variant, monochromeLogo(source));
  const original = PNG.sync.read(source); const output = PNG.sync.read(variant);
  assert.equal(output.width, original.width); assert.equal(output.height, original.height);
  assert.equal(output.data[3], 0);
});
test('compacta solo márgenes transparentes sin perder ni cambiar un píxel visible', () => {
  const assets = resolve(__dirname, '../assets');
  const mono = readFileSync(resolve(assets, 'logo-monochrome.png'));
  const compact = readFileSync(resolve(assets, 'logo-monochrome-compact.png'));
  assert.deepEqual(compact, compactLogo(mono));
  const source = PNG.sync.read(mono), output = PNG.sync.read(compact);
  const dimensions = JSON.parse(readFileSync(resolve(assets, 'logo-monochrome-compact.json'), 'utf8'));
  assert.deepEqual(dimensions, { width: output.width, height: output.height });
  assert.ok(output.width < source.width && output.height < source.height);
  const ink = image => {
    const pixels = [];
    for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 3] > 0) pixels.push(...image.data.subarray(i, i + 4));
    return Buffer.from(pixels);
  };
  assert.deepEqual(ink(output), ink(source));
});
test('rechaza compactar un lienzo completamente transparente', () => {
  assert.throws(() => compactLogo(PNG.sync.write(new PNG({ width: 2, height: 2 }))), /EMPTY_LOGO/);
});
