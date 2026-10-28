import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
function newVideo(args, env = {}) {
  return spawnSync(process.execPath, [join(root, 'scripts/new-video.mjs'), ...args], { encoding: 'utf8', cwd: root, env: { ...process.env, ...env } });
}
function slug(name) { return `zz-brand-test-${name}-${process.pid}`; }
function cleanup(s) { rmSync(join(root, 'video-projects', s), { recursive: true, force: true }); }

test('--brand copies the profile into the project and records the slug', (t) => {
  const brands = mkdtempSync(join(tmpdir(), 'herk-brands-'));
  mkdirSync(join(brands, 'acme'));
  writeFileSync(join(brands, 'acme/DESIGN.md'), '# Acme profile\n');
  writeFileSync(join(brands, 'acme/tokens.css'), ':root { --brand-accent: #123456; }\n');
  writeFileSync(join(brands, 'acme/logo.svg'), '<svg/>');
  const s = slug('copy'); t.after(() => cleanup(s));
  const r = newVideo([s, '--brand', 'acme'], { HERK_BRANDS: brands });
  assert.equal(r.status, 0, r.stderr);
  const dest = join(root, 'video-projects', s);
  assert.equal(readFileSync(join(dest, 'DESIGN.md'), 'utf8'), '# Acme profile\n');
  assert.match(readFileSync(join(dest, 'assets/brand-tokens.css'), 'utf8'), /#123456/);
  assert.ok(existsSync(join(dest, 'assets/logo.svg')));
  assert.equal(JSON.parse(readFileSync(join(dest, 'meta.json'))).brand, 'acme');
});

test('without --brand the starter DESIGN.md is kept and no brand is recorded', (t) => {
  const s = slug('none'); t.after(() => cleanup(s));
  const r = newVideo([s]);
  assert.equal(r.status, 0, r.stderr);
  const dest = join(root, 'video-projects', s);
  assert.equal(readFileSync(join(dest, 'DESIGN.md'), 'utf8'), readFileSync(join(root, 'examples/starter/DESIGN.md'), 'utf8'));
  assert.equal(JSON.parse(readFileSync(join(dest, 'meta.json'))).brand, undefined);
});

test('a missing profile stops before any project is created', () => {
  const s = slug('missing');
  const r = newVideo([s, '--brand', 'nope'], { HERK_BRANDS: mkdtempSync(join(tmpdir(), 'herk-brands-')) });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /No brand profile at/);
  assert.equal(existsSync(join(root, 'video-projects', s)), false);
});

test('a brand slug that is a path is refused', () => {
  const s = slug('path');
  const r = newVideo([s, '--brand', '../etc']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /kebab-case brand slug/);
  assert.equal(existsSync(join(root, 'video-projects', s)), false);
});

test('the unfilled template cannot be picked as a brand', (t) => {
  const s = slug('template'); t.after(() => cleanup(s));
  const r = newVideo([s, '--brand', '_template']);
  assert.notEqual(r.status, 0);
  assert.equal(existsSync(join(root, 'video-projects', s)), false);
});
