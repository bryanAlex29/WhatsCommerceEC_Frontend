/* global __dirname */
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { setupLocal } = require('./setup-local.cjs');

function fixture(t) {
  // Directorio aislado e ignorado dentro del checkout, nunca el .env real.
  mkdirSync(path.join(__dirname, '../.expo'), { recursive: true });
  const directory = mkdtempSync(path.join(__dirname, '../.expo/setup-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('copia exactamente la configuración pública de ejemplo y es idempotente', (t) => {
  const directory = fixture(t);
  const example = readFileSync(path.join(__dirname, '../.env.example'));
  writeFileSync(path.join(directory, '.env.example'), example);
  assert.deepEqual(setupLocal(directory), { created: true });
  assert.deepEqual(readFileSync(path.join(directory, '.env')), example);
  assert.deepEqual(setupLocal(directory), { created: false });
});

test('conserva un .env existente sin sobrescribir su URL', (t) => {
  const directory = fixture(t);
  const original = 'EXPO_PUBLIC_API_URL=http://localhost:3000\n';
  writeFileSync(path.join(directory, '.env'), original);
  writeFileSync(path.join(directory, '.env.example'), 'EXPO_PUBLIC_API_URL=http://10.0.2.2:3000\n');
  assert.deepEqual(setupLocal(directory), { created: false });
  assert.equal(readFileSync(path.join(directory, '.env'), 'utf8'), original);
});

test('sin plantilla falla y no crea un .env parcial', (t) => {
  const directory = fixture(t);
  assert.throws(() => setupLocal(directory), { code: 'ENOENT' });
  assert.throws(() => readFileSync(path.join(directory, '.env')), { code: 'ENOENT' });
});
