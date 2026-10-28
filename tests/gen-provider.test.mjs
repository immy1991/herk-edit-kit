import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const dir = '.agents/skills/motion-showreel/scripts';
const { resolveProvider } = await import(join(root, dir, 'gen.mjs'));
const { buildRequest, aspectToSize, MODELS, parse, prepareOut, resolveResultModel, jobFor, appId, download, imageInfo, recoveryCommand } = await import(join(root, dir, 'fal.mjs'));
const { parseEnvValue, redact } = await import(join(root, dir, 'env.mjs'));
const noFile = () => undefined;
// Every subprocess: no .env discovery, no inherited keys or provider, and fal pointed at a dead local port,
// so a bug can never reach the real API or spend credits.
const SAFE = { HERK_NO_DOTENV: '1', FAL_KEY: '', GEN_PROVIDER: '', FAL_QUEUE_URL: 'http://127.0.0.1:9' };
function run(script, args, env = {}) {
  return spawnSync(process.execPath, [join(root, dir, script), ...args], { encoding: 'utf8', cwd: tmpdir(), env: { ...process.env, ...SAFE, ...env } });
}
const scratch = () => mkdtempSync(join(tmpdir(), 'gen-provider-test-'));
// A PNG header with the given size: enough for type and dimension checks.
function png(w, h) { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; }

test('provider: flag beats environment beats .env beats the fal default', () => {
  assert.equal(resolveProvider([], {}, noFile).provider, 'fal');
  assert.equal(resolveProvider([], {}, () => 'kie').provider, 'kie');
  assert.equal(resolveProvider([], { GEN_PROVIDER: 'kie' }, () => 'fal').provider, 'kie');
  assert.equal(resolveProvider(['--provider', 'fal'], { GEN_PROVIDER: 'kie' }, noFile).provider, 'fal');
  assert.equal(resolveProvider(['--provider=KIE'], {}, noFile).provider, 'kie');
  assert.equal(resolveProvider([], { GEN_PROVIDER: '  ' }, noFile).provider, 'fal');
  assert.deepEqual(resolveProvider(['image', '--provider', 'kie', '--prompt', 'x'], {}, noFile).rest, ['image', '--prompt', 'x']);
});

test('provider: malformed or repeated flags fail closed with exact messages', () => {
  assert.throws(() => resolveProvider(['image', '--provider'], {}, noFile), { message: '--provider needs a value (fal or kie)' });
  assert.throws(() => resolveProvider(['--provider', '--dry-run'], {}, noFile), { message: '--provider needs a value (fal or kie)' });
  assert.throws(() => resolveProvider(['--provider='], {}, noFile), { message: '--provider needs a value (fal or kie)' });
  assert.throws(() => resolveProvider(['--provider', '   '], {}, noFile), { message: '--provider needs a value (fal or kie)' });
  assert.throws(() => resolveProvider(['--provider', 'fal', '--provider', 'kie'], {}, noFile), { message: '--provider given more than once' });
  assert.throws(() => resolveProvider(['--provider', 'higgsfield'], {}, noFile), { message: 'unknown provider "higgsfield" (use fal or kie)' });
  const r = run('gen.mjs', ['image', '--provider', 'nope', '--dry-run']);
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), 'unknown provider "nope" (use fal or kie)');
});

test('.env parsing never crosses lines and never echoes a value it rejects', () => {
  const text = 'GEN_PROVIDER=\nFAL_KEY=abc123secretvalue\n';
  assert.equal(parseEnvValue(text, 'GEN_PROVIDER'), undefined);
  assert.equal(parseEnvValue(text, 'FAL_KEY'), 'abc123secretvalue');
  assert.equal(parseEnvValue("FAL_KEY='q v'\n", 'FAL_KEY'), 'q v');
  assert.equal(parseEnvValue('export FAL_KEY="x y" # c\n', 'FAL_KEY'), 'x y');
  assert.equal(parseEnvValue('FAL_KEY=plain # note\n', 'FAL_KEY'), 'plain');
  assert.equal(parseEnvValue('FAL_KEY=\nKIE_API_KEY=other\n', 'FAL_KEY'), undefined);
  assert.throws(() => resolveProvider([], {}, () => 'FAL_KEY=abc123secretvalue'), { message: 'unknown provider (value hidden) (use fal or kie)' });
});

test('API diagnostics are redacted', () => {
  assert.equal(redact('{"echo":"Key abcdef123456:zzz"}'), '{"echo":"Key [redacted]"}');
  assert.equal(redact('token=supersecret99 here', ['supersecret99']), 'token=[redacted] here');
});

test('fal requests map to the same jobs kie.mjs runs', () => {
  const d = scratch(); const logo = join(d, 'logo.png'); writeFileSync(logo, png(800, 600));
  const t2i = buildRequest('image', { prompt: 'p', aspect: '9:16', dryRun: true });
  assert.equal(t2i.model, MODELS.image);
  assert.equal(t2i.input.image_size, 'portrait_16_9');
  assert.equal(t2i.input.image_urls, undefined);
  const edit = buildRequest('image', { prompt: 'p', ref: logo, dryRun: true });
  assert.equal(edit.model, MODELS.imageEdit);
  assert.deepEqual(edit.input.image_urls, [`<data URI of ${logo}>`]);
  const vid = buildRequest('video', { image: logo, prompt: 'orbit', dryRun: true });
  assert.equal(vid.model, MODELS.video);
  assert.equal(vid.input.duration, '5');
  const mus = buildRequest('music', { title: 'Reel', seconds: '30', dryRun: true });
  assert.equal(mus.model, MODELS.music);
  assert.equal(mus.input.force_instrumental, true);
  assert.equal(mus.input.music_length_ms, 30000);
});

test('bad inputs are refused before anything is spent', () => {
  const d = scratch(); const webp = join(d, 'a.webp'); writeFileSync(webp, 'x');
  assert.throws(() => buildRequest('image', { dryRun: true }), { message: 'image needs --prompt' });
  assert.throws(() => buildRequest('video', { dryRun: true }), { message: 'video needs --image' });
  assert.throws(() => aspectToSize('21:9'), /unsupported --aspect "21:9"/);
  assert.throws(() => buildRequest('music', { seconds: 'oops', dryRun: true }), { message: '--seconds must be a number from 3 to 600' });
  assert.throws(() => buildRequest('music', { seconds: '2', dryRun: true }), { message: '--seconds must be a number from 3 to 600' });
  assert.throws(() => buildRequest('video', { image: webp, duration: '5', dryRun: true }), /unsupported image type/);
  assert.throws(() => buildRequest('video', { image: join(d, 'missing.png'), dryRun: true }), /file not found/);
  const ok = join(d, 'ok.png'); writeFileSync(ok, png(1280, 720));
  assert.throws(() => buildRequest('video', { image: ok, duration: '20', dryRun: true }), { message: '--duration must be a whole number of seconds from 3 to 15' });
  assert.throws(() => parse(['--prompt', '--out', 'x'], 'image'), { message: '--prompt needs a value' });
  assert.throws(() => parse(['--promt', 'x'], 'image'), { message: '--promt is not an option for image' });
  assert.throws(() => parse(['--duration', '30'], 'music'), { message: '--duration is not an option for music' });
  assert.throws(() => parse(['-dry-run'], 'image'), { message: 'unexpected argument "-dry-run"' });
  const fake = join(d, 'fake.png'); writeFileSync(fake, 'not a png');
  assert.throws(() => buildRequest('image', { prompt: 'p', ref: fake, dryRun: true }), /is not a valid PNG image/);
  const tiny = join(d, 'tiny.png'); writeFileSync(tiny, png(200, 200));
  assert.throws(() => buildRequest('video', { image: tiny, dryRun: true }), /needs at least 300 pixels per side/);
  const wide = join(d, 'wide.png'); writeFileSync(wide, png(3000, 500));
  assert.throws(() => buildRequest('video', { image: wide, dryRun: true }), /aspect ratio between 1:2.5 and 2.5:1/);
  assert.deepEqual(imageInfo(png(640, 480)), { type: 'png', w: 640, h: 480 });
});

test('outputs are checked before a paid call, and never overwrite inputs', () => {
  const d = scratch(); const ref = join(d, 'logo.png'); writeFileSync(ref, 'x');
  assert.throws(() => prepareOut(ref, [ref]), /would overwrite an input file/);
  const existing = join(d, 'out.png'); writeFileSync(existing, 'x');
  assert.throws(() => prepareOut(existing, []), /already exists \(add --force to overwrite\)/);
  assert.equal(prepareOut(existing, [], true), existing);
  assert.equal(prepareOut(join(d, 'new/dir/clip.mp4'), []), join(d, 'new/dir/clip.mp4'));
  mkdirSync(join(d, 'afolder'));
  assert.throws(() => prepareOut(join(d, 'afolder'), [], true), /is a folder/);
});

test('download publishes atomically and never replaces a file that appeared during the job', async () => {
  const http = await import('node:http');
  const server = http.createServer((req, res) => { res.writeHead(200); res.end('MEDIA'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/file`;
  try {
    const d = scratch(); const out = join(d, 'clip.mp4');
    assert.equal(await download(url, out), out);
    assert.equal(readFileSync(out, 'utf8'), 'MEDIA');
    writeFileSync(out, 'MINE');
    await assert.rejects(download(url, out), /appeared while the job ran/);
    assert.equal(readFileSync(out, 'utf8'), 'MINE');
    assert.deepEqual(readdirSync(d).filter((f) => f.endsWith('.part')), []);
    await download(url, out, true);
    assert.equal(readFileSync(out, 'utf8'), 'MEDIA');
  } finally { server.closeAllConnections?.(); server.close(); }
});

test('result recovery builds the queue URLs for an existing job', () => {
  assert.deepEqual(resolveResultModel('video'), { kind: 'video', model: MODELS.video });
  assert.deepEqual(resolveResultModel(MODELS.imageEdit), { kind: 'image', model: MODELS.imageEdit });
  assert.throws(() => resolveResultModel('image'), /ambiguous/);
  // fal's queue URLs use the app id (owner/app), never the full endpoint (fal queue docs).
  assert.equal(appId(MODELS.video), 'fal-ai/kling-video');
  assert.equal(appId(MODELS.imageEdit), 'bytedance/seedream');
  assert.equal(appId(MODELS.music), 'elevenlabs/music');
  const id = '764cabcf-b745-4b3e-ae38-1200304cf45b';
  const j = jobFor(MODELS.video, id);
  assert.ok(j.status_url.endsWith(`/fal-ai/kling-video/requests/${id}/status`));
  assert.ok(j.response_url.endsWith(`/fal-ai/kling-video/requests/${id}`));
  assert.throws(() => jobFor(MODELS.video, '../x'), /--request must be the request id/);
  const dry = run('fal.mjs', ['result', '--model', 'video', '--request', id, '--dry-run']);
  assert.equal(dry.status, 1);
  assert.equal(dry.stderr.trim(), 'result has no dry run: it only downloads a job you already paid for');
});

test('dry runs print the request and spend nothing', () => {
  const fal = run('gen.mjs', ['image', '--prompt', 'p', '--dry-run']);
  assert.equal(fal.status, 0, fal.stderr);
  assert.equal(JSON.parse(fal.stdout).model, MODELS.image);
  const kie = run('gen.mjs', ['video', '--image', 'h.png', '--dry-run', '--provider', 'kie']);
  assert.equal(kie.status, 0, kie.stderr);
  const plan = JSON.parse(kie.stdout);
  assert.equal(plan.provider, 'kie');
  assert.deepEqual(plan.args, ['video', '--image', 'h.png']);
});

test('a missing FAL_KEY fails with the setup message, with .env discovery off and the network blocked', () => {
  const r = run('fal.mjs', ['image', '--prompt', 'p', '--out', join(scratch(), 'still.png')]);
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), 'FAL_KEY is not set. Add it to .env (see docs/TOOLS-AND-API-KEYS.md).');
});

test('a fal HTTP failure surfaces fast and redacted, never as a silent timeout', () => {
  const r = run('fal.mjs', ['image', '--prompt', 'p', '--out', join(scratch(), 'still.png')], { FAL_KEY: 'testkey-123456789' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /fetch failed|ECONNREFUSED|create .* failed/);
  assert.doesNotMatch(r.stderr, /testkey-123456789/);
});

test('polling stops on a hard HTTP error and honours its deadline against a hung server', async () => {
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/unauth')) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"detail":"unauthorized"}'); }
    else if (req.url.startsWith('/busy')) { res.writeHead(503); res.end('busy'); }
    // anything else: never answer
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const prev = process.env.FAL_KEY; process.env.FAL_KEY = 'testkey-123456789';
  try {
    const { poll } = await import(join(root, dir, 'fal.mjs'));
    const t0 = Date.now();
    await assert.rejects(poll({ request_id: 'r1', status_url: `${base}/unauth`, response_url: `${base}/unauth` }, 50, 5000), /status check failed \(401\)/);
    assert.ok(Date.now() - t0 < 1000, 'a 401 must fail at once, not wait for the timeout');
    const t1 = Date.now();
    await assert.rejects(poll({ request_id: 'r2', status_url: `${base}/busy`, response_url: `${base}/busy` }, 50, 400), /timeout waiting for r2/);
    let hits = 0;
    const flaky = http.createServer((req, res) => {
      if (req.url.endsWith('/status')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"status":"COMPLETED"}'); return; }
      hits++; if (hits === 1) { res.writeHead(503); res.end('busy'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"video":{"url":"x"}}');
    });
    await new Promise((r) => flaky.listen(0, '127.0.0.1', r));
    const fb = `http://127.0.0.1:${flaky.address().port}`;
    const got = await poll({ request_id: 'r4', status_url: `${fb}/q/status`, response_url: `${fb}/q` }, 20, 3000);
    assert.equal(got.video.url, 'x'); assert.equal(hits, 2);
    flaky.closeAllConnections?.(); flaky.close();
    const t2 = Date.now();
    await assert.rejects(poll({ request_id: 'r3', status_url: `${base}/hang`, response_url: `${base}/hang` }, 50, 400), /timeout waiting for r3/);
    assert.ok(Date.now() - t2 < 2000, 'a hung server must not outlive the deadline');
    assert.ok(t2 - t1 < 2000);
  } finally { process.env.FAL_KEY = prev; server.closeAllConnections?.(); server.close(); }
});

test('a dropped download leaves no partial file and keeps the existing target', async () => {
  const http = await import('node:http');
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Length': '1000' }); res.write('PART'); setTimeout(() => res.destroy(), 20); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const d = scratch(); const out = join(d, 'clip.mp4'); writeFileSync(out, 'MINE');
    await assert.rejects(download(`http://127.0.0.1:${server.address().port}/f`, out, true));
    assert.equal(readFileSync(out, 'utf8'), 'MINE');
    assert.deepEqual(readdirSync(d).filter((f) => f.endsWith('.part')), []);
  } finally { server.closeAllConnections?.(); server.close(); }
});

test('recovery with no key fails at once with the setup message', () => {
  const t0 = Date.now();
  const r = run('fal.mjs', ['result', '--model', 'video', '--request', '764cabcf-b745-4b3e-ae38-1200304cf45b', '--out', join(scratch(), 'c.mp4')]);
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), 'FAL_KEY is not set. Add it to .env (see docs/TOOLS-AND-API-KEYS.md).');
  assert.ok(Date.now() - t0 < 5000);
});

test('the printed recovery command keeps the absolute destination and --force', async () => {
  assert.match(recoveryCommand('video', MODELS.video, 'abcdefgh', '/tmp/x y/clip.mp4', true), /result --model fal-ai\/kling-video\/v3\/turbo\/pro\/image-to-video --request abcdefgh --out '\/tmp\/x y\/clip\.mp4' --force$/);
  assert.match(recoveryCommand('music', MODELS.music, 'abcdefgh', '/tmp/a/take-0.mp3'), / --out '\/tmp\/a'$/);
  // End to end: a local fake queue accepts the job, then refuses the status check, so the run stops
  // right after printing the command. Run from another folder with a relative --out.
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ request_id: '764cabcf-b745-4b3e-ae38-1200304cf45b', status_url: `http://127.0.0.1:${server.address().port}/s`, response_url: `http://127.0.0.1:${server.address().port}/r` })); }
    else { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"detail":"nope"}'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const work = scratch(); writeFileSync(join(work, 'still.png'), 'old');
    const r = await new Promise((res) => {
      import('node:child_process').then(({ spawn }) => {
        const p = spawn(process.execPath, [join(root, dir, 'fal.mjs'), 'image', '--prompt', 'p', '--out', 'still.png', '--force'],
          { cwd: work, env: { ...process.env, ...SAFE, FAL_KEY: 'testkey-123456789', FAL_QUEUE_URL: `http://127.0.0.1:${server.address().port}` } });
        let out = '', err = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
        p.on('close', (code) => res({ code, out, err }));
      });
    });
    assert.equal(r.code, 1, r.err);
    const line = r.out.split('\n').find((l) => l.includes('recover without paying again'));
    assert.ok(line, r.out);
    assert.ok(line.includes(`--out '${join(realpathSync(work), 'still.png')}'`) || line.includes(`--out '${join(work, 'still.png')}'`), line);
    assert.ok(line.endsWith(' --force'), line);
    assert.doesNotMatch(r.err + r.out, /testkey-123456789/);
  } finally { server.closeAllConnections?.(); server.close(); }
});
