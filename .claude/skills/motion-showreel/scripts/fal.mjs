#!/usr/bin/env node
// Minimal fal.ai client for showreel assets, matching kie.mjs command for command:
// instrumental music (ElevenLabs Music v2.5), hero stills (Seedream 5 Pro, edit from your
// logo or text-to-image), and camera moves (Kling v3 Turbo Pro image-to-video).
// Every command except --dry-run is a PAID call on your own fal.ai credits. Confirm with the user first.
//
//   node fal.mjs music --title "Broadcast" --style "punchy electronic showreel, 128 bpm, big drop" --seconds 30 --out assets/audio
//   node fal.mjs image --ref logo.png --prompt "photoreal 3D sculpture of this exact icon..." --out assets/img/hero.png
//   node fal.mjs video --image assets/img/hero.png --prompt "slow orbit, object stays rigid..." --out assets/video/hero-raw.mp4
//   node fal.mjs result --model video --request <request id> --out assets/video/hero-raw.mp4   (recover a paid job, no new charge)
//   --dry-run prints the request without calling fal; --force allows overwriting an existing output file.
//
// Reads FAL_KEY from the environment or the nearest workspace .env. Queue API: https://fal.ai/docs/documentation/model-apis/inference/queue
// Kling returns 24fps. Speed it up and re-encode all-intra for seek-safe rendering, e.g.
//   ffmpeg -i hero-raw.mp4 -an -vf "setpts=PTS/3,fps=60" -c:v libx264 -crf 16 -g 1 -keyint_min 1 -bf 0 -pix_fmt yuv420p hero-60.mp4
import { readFileSync, existsSync, mkdirSync, statSync, renameSync, openSync, writeFileSync, closeSync, linkSync, unlinkSync, accessSync, realpathSync, constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findEnvValue, redact } from './env.mjs';

export const MODELS = {
  image: 'bytedance/seedream/v5/pro/text-to-image',
  imageEdit: 'bytedance/seedream/v5/pro/edit',
  video: 'fal-ai/kling-video/v3/turbo/pro/image-to-video',
  music: 'elevenlabs/music/v2.5',
};
// FAL_QUEUE_URL exists only so tests can point every request at a dead local port.
const QUEUE = process.env.FAL_QUEUE_URL || 'https://queue.fal.run';
const here = dirname(fileURLToPath(import.meta.url));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const VIDEO_MIME = new Set(['.png', '.jpg', '.jpeg']); // Kling documents JPEG and PNG only
const INLINE_MAX = 10 * 1024 * 1024; // our own conservative cap for base64-inlined images, not a fal limit
export const ASPECT = { '16:9': 'landscape_16_9', '9:16': 'portrait_16_9', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3', '1:1': 'square_hd' };
const REQUEST_TIMEOUT = 60_000;

export function loadKey(env = process.env) {
  const k = (env.FAL_KEY && env.FAL_KEY.trim()) || findEnvValue(here, 'FAL_KEY', env);
  if (!k) throw new Error('FAL_KEY is not set. Add it to .env (see docs/TOOLS-AND-API-KEYS.md).');
  return k;
}
let KEY;
const key = () => (KEY ??= loadKey());
const headers = () => ({ Authorization: `Key ${key()}`, 'Content-Type': 'application/json' });
const clean = (x) => redact(typeof x === 'string' ? x : JSON.stringify(x), [KEY]).slice(0, 300);

export function aspectToSize(aspect) {
  const s = ASPECT[aspect];
  if (!s) throw new Error(`unsupported --aspect "${aspect}" (use ${Object.keys(ASPECT).join(', ')})`);
  return s;
}

// Width and height from the file bytes (PNG IHDR or JPEG SOF); undefined when unreadable.
export function imageInfo(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { type: 'jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { type: 'jpeg' };
  }
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { type: 'webp' };
  return undefined;
}
function checkImage(file, forVideo) {
  const ext = extname(file).toLowerCase();
  if (!MIME[ext] || (forVideo && !VIDEO_MIME.has(ext))) throw new Error(`unsupported image type for ${file} (${forVideo ? 'png, jpg, jpeg' : 'png, jpg, jpeg, webp'})`);
  if (!existsSync(file)) throw new Error(`file not found: ${file}`);
  if (statSync(file).size > INLINE_MAX) throw new Error(`${file} is over 10 MB; resize it before sending (images are inlined as base64)`);
  const info = imageInfo(readFileSync(file));
  const want = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' }[ext];
  if (!info || info.type !== want) throw new Error(`${file} is not a valid ${want.toUpperCase()} image`);
  if (forVideo) {
    // Kling's documented limits; checked here so a bad still is refused before paying.
    if (!info.w || !info.h) throw new Error(`could not read the size of ${file}`);
    if (Math.min(info.w, info.h) < 300) throw new Error(`${file} is ${info.w}x${info.h}; Kling needs at least 300 pixels per side`);
    const r = info.w / info.h;
    if (r < 1 / 2.5 || r > 2.5) throw new Error(`${file} is ${info.w}x${info.h}; Kling needs an aspect ratio between 1:2.5 and 2.5:1`);
  }
  return ext;
}
// fal accepts base64 data URIs wherever it takes a file URL, so no separate upload step.
export function upload(file, forVideo = false) {
  const ext = checkImage(file, forVideo);
  return `data:${MIME[ext]};base64,${readFileSync(file).toString('base64')}`;
}

export function buildRequest(cmd, opt) {
  if (cmd === 'image') {
    if (!opt.prompt) throw new Error('image needs --prompt');
    const input = { prompt: opt.prompt, image_size: aspectToSize(opt.aspect ?? '16:9'), output_format: 'png', num_images: 1 };
    if (opt.ref) { if (opt.dryRun) checkImage(opt.ref, false); input.image_urls = [opt.dryRun ? `<data URI of ${opt.ref}>` : upload(opt.ref)]; }
    return { model: opt.ref ? MODELS.imageEdit : MODELS.image, input };
  }
  if (cmd === 'video') {
    if (!opt.image) throw new Error('video needs --image');
    const d = Number(opt.duration ?? 5);
    if (!Number.isInteger(d) || d < 3 || d > 15) throw new Error('--duration must be a whole number of seconds from 3 to 15');
    if (opt.dryRun) checkImage(opt.image, true);
    const input = { image_url: opt.dryRun ? `<data URI of ${opt.image}>` : upload(opt.image, true), duration: String(d) };
    if (opt.prompt) input.prompt = opt.prompt;
    return { model: MODELS.video, input };
  }
  if (cmd === 'music') {
    const style = opt.style ?? 'punchy modern electronic motion-design showreel, instrumental, 128 bpm, starts instantly, riser into a big drop, clean modern mix, no vocals';
    const negative = opt.negative ?? 'vocals, singing, lyrics, choir, lo-fi, sad, acoustic, orchestral';
    const input = { prompt: `${opt.title ? `${opt.title}. ` : ''}${style}. Avoid: ${negative}.`, force_instrumental: true, output_format: 'mp3_44100_128' };
    if (opt.seconds !== undefined) {
      const s = Number(opt.seconds);
      if (!Number.isFinite(s) || s < 3 || s > 600) throw new Error('--seconds must be a number from 3 to 600');
      input.music_length_ms = Math.round(s * 1000);
    }
    return { model: MODELS.music, input };
  }
  throw new Error(`unknown command ${cmd}`);
}

async function call(url, init = {}, timeout = REQUEST_TIMEOUT) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, ok: r.ok, body };
}
const transient = (status) => status === 429 || status >= 500;

// Submission is never retried: a retry could pay twice.
export async function create(model, input) {
  const r = await call(`${QUEUE}/${model}`, { method: 'POST', headers: headers(), body: JSON.stringify(input) });
  if (!r.ok || !r.body?.request_id) throw new Error(`create ${model} failed (${r.status}): ${clean(r.body)}`);
  return r.body;
}
// Queue status and result URLs use the app id (the first two path segments), never the full endpoint.
export function appId(model) { return model.split('/').slice(0, 2).join('/'); }
export function jobFor(model, requestId) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(requestId))) throw new Error('--request must be the request id printed when the job started');
  const base = `${QUEUE}/${appId(model)}/requests/${requestId}`;
  return { request_id: requestId, status_url: `${base}/status`, response_url: base };
}
export async function poll(job, every = 8000, max = 1_800_000) {
  const h = headers(); // a missing key fails here, at once, never inside the retry loop
  const deadline = Date.now() + max;
  const left = () => deadline - Date.now();
  // One GET under the transient-error policy: 429, 5xx and network errors return undefined (try again);
  // any other HTTP failure throws at once. Every timeout stays inside the remaining deadline.
  const get = async (url, what) => {
    if (left() <= 0) return undefined;
    let r;
    try { r = await call(url, { headers: h }, Math.max(1, Math.min(REQUEST_TIMEOUT, left()))); }
    catch { return undefined; }
    if (r.ok) return r;
    if (transient(r.status)) return undefined;
    throw new Error(`${what} failed (${r.status}): ${clean(r.body)}`);
  };
  let completed = false;
  while (left() > 0) {
    if (!completed) {
      const s = await get(job.status_url, 'status check');
      if (s?.body?.error) throw new Error(`task failed: ${clean(s.body)}`);
      if (s?.body?.status === 'COMPLETED') completed = true;
    }
    if (completed) {
      const out = await get(job.response_url, 'result fetch');
      if (out) {
        if (out.body?.detail || out.body?.error) throw new Error(`task failed: ${clean(out.body)}`);
        return out.body;
      }
    }
    await new Promise((res) => setTimeout(res, Math.max(0, Math.min(every, left()))));
  }
  throw new Error(`timeout waiting for ${job.request_id}; recover later with the result command printed when it started`);
}
// Write to an exclusively created temp file next to the target, then publish. Without --force the
// publish refuses to replace anything that appeared while the job ran.
export async function download(url, out, force = false) {
  const r = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  const data = Buffer.from(await r.arrayBuffer()); // a dropped connection fails here, before any file exists
  const tmp = join(dirname(out), `.${randomBytes(6).toString('hex')}.part`);
  try {
    const fd = openSync(tmp, 'wx', 0o644);
    try { writeFileSync(fd, data); } finally { closeSync(fd); } // writeFileSync loops until every byte is written
    if (statSync(tmp).size !== data.length) throw new Error('incomplete write');
    if (force) renameSync(tmp, out);
    else { linkSync(tmp, out); unlinkSync(tmp); }
  } catch (e) {
    try { unlinkSync(tmp); } catch {}
    throw new Error(e.code === 'EEXIST' ? `${out} appeared while the job ran; the result was not saved (recover it with the result command)` : `could not save ${out}: ${e.code ?? e.message}`);
  }
  return out;
}

// Check the output path before anything is spent: never an input (even through a link), never a
// directory, never an existing file without --force, and the folder must be writable.
export function prepareOut(out, inputs = [], force = false) {
  const target = resolve(out);
  const real = (f) => { try { return realpathSync(f); } catch { return resolve(f); } };
  if (inputs.filter(Boolean).some((f) => real(f) === real(target))) throw new Error(`--out ${out} would overwrite an input file`);
  if (existsSync(target)) {
    if (statSync(target).isDirectory()) throw new Error(`--out ${out} is a folder; give a file name`);
    if (!force) throw new Error(`${out} already exists (add --force to overwrite)`);
  }
  mkdirSync(dirname(target), { recursive: true });
  try { accessSync(dirname(target), constants.W_OK); } catch { throw new Error(`cannot write to ${dirname(target)}`); }
  return target;
}

const ALLOWED = {
  image: ['prompt', 'ref', 'aspect', 'out'],
  video: ['image', 'prompt', 'duration', 'out'],
  music: ['title', 'style', 'negative', 'seconds', 'out'],
  result: ['model', 'request', 'out'],
  credit: [],
};
export function parse(args, cmd) {
  const opt = { dryRun: false, force: false };
  const allowed = ALLOWED[cmd] ?? [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') opt.dryRun = true;
    else if (a === '--force') opt.force = true;
    else if (a.startsWith('--') && allowed.includes(a.slice(2))) {
      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      opt[a.slice(2)] = v; i++;
    } else if (a.startsWith('--')) throw new Error(`${a} is not an option for ${cmd ?? 'this command'}`);
    else throw new Error(`unexpected argument "${a}"`);
  }
  return opt;
}

// --model for `result`: a short name (image, video, music) or one of the full endpoints above.
export function resolveResultModel(name) {
  if (['video', 'music'].includes(name)) return { kind: name, model: MODELS[name] };
  if (name === 'image') throw new Error('--model image is ambiguous: pass the full endpoint printed when the job started');
  const hit = Object.entries(MODELS).find(([, m]) => m === name);
  if (!hit) throw new Error('result needs --model (video, music, or the full endpoint printed when the job started)');
  return { kind: hit[0] === 'imageEdit' ? 'image' : hit[0], model: name };
}

// The exact command that downloads this job later: absolute script and output paths (the folder for
// music, which always saves take-0.mp3), and --force when the original run had it.
export function recoveryCommand(cmd, model, requestId, outAbs, force = false) {
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const dest = cmd === 'music' ? dirname(outAbs) : outAbs;
  return `node ${q(fileURLToPath(import.meta.url))} result --model ${model} --request ${requestId} --out ${q(dest)}${force ? ' --force' : ''}`;
}

const OUT = { image: (o) => o.out ?? 'still.png', video: (o) => o.out ?? 'clip-raw.mp4', music: (o) => join(o.out ?? '.', 'take-0.mp3') };
function pick(cmd, r) { return cmd === 'image' ? r.images?.[0]?.url : cmd === 'video' ? r.video?.url : r.audio?.url; }

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    const opt = parse(rest, cmd);
    if (cmd === 'credit') {
      console.log('Balance lookup is not implemented in this client. Check https://fal.ai/dashboard/usage (fal also documents GET /v1/account/billing?expand=credits).');
    } else if (cmd === 'result') {
      if (opt.dryRun) throw new Error('result has no dry run: it only downloads a job you already paid for');
      const { kind, model } = resolveResultModel(opt.model);
      if (!opt.request) throw new Error('result needs --request');
      const out = prepareOut(OUT[kind](opt), [], opt.force);
      key();
      const r = await poll(jobFor(model, opt.request), 5000, 120_000);
      const url = pick(kind, r); if (!url) throw new Error('no output file in the result');
      console.log('saved', await download(url, out, opt.force));
    } else if (['image', 'video', 'music'].includes(cmd)) {
      const req = buildRequest(cmd, opt);
      if (opt.dryRun) { console.log(JSON.stringify({ provider: 'fal', ...req, note: 'image inputs are shown as placeholders; nothing was sent' }, null, 2)); }
      else {
        const out = prepareOut(OUT[cmd](opt), [opt.ref, opt.image], opt.force);
        key();
        const job = await create(req.model, req.input);
        console.log('task', job.request_id, 'model', req.model);
        console.log(`if this stops early, recover without paying again: ${recoveryCommand(cmd, req.model, job.request_id, out, opt.force)}`);
        const r = await poll(job, cmd === 'image' ? 6000 : 10000);
        const url = pick(cmd, r); if (!url) throw new Error('no output file in the result');
        console.log('saved', await download(url, out, opt.force));
      }
    } else {
      console.error('Commands: credit | music | image | video | result (see the header of this file)');
      process.exitCode = 1;
    }
  } catch (e) { console.error(redact(e.message, [KEY])); process.exitCode = 1; }
}
