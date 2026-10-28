// Shared, line-safe .env reading for the provider scripts. Never echoes values.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Parse one KEY from .env text, one line at a time: no match ever crosses a newline.
// Supports KEY=value, KEY="value", KEY='value', `export KEY=...` and trailing ` # comments` on unquoted values.
export function parseEnvValue(text, key) {
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/);
    if (!m || m[1] !== key) continue;
    let v = m[2];
    if (/^"/.test(v)) { const q = v.match(/^"([^"]*)"/); v = q ? q[1] : ''; }
    else if (/^'/.test(v)) { const q = v.match(/^'([^']*)'/); v = q ? q[1] : ''; }
    else v = v.replace(/[ \t]+#.*$/, '');
    v = v.trim();
    return v || undefined;
  }
  return undefined;
}

// Walk up from `start` to the nearest .env holding `key`. HERK_NO_DOTENV=1 disables the walk (tests).
export function findEnvValue(start, key, env = process.env) {
  if (env.HERK_NO_DOTENV === '1') return undefined;
  let dir = start;
  for (let i = 0; i < 8; i++, dir = dirname(dir)) {
    const f = join(dir, '.env');
    if (existsSync(f)) {
      const v = parseEnvValue(readFileSync(f, 'utf8'), key);
      if (v) return v;
    }
  }
  return undefined;
}

// Remove anything that looks like a credential before a message reaches the terminal or a log.
export function redact(text, secrets = []) {
  let s = String(text);
  for (const k of secrets) if (k && k.length >= 6) s = s.split(k).join('[redacted]');
  return s.replace(/\b(Key|Bearer)\s+[A-Za-z0-9._:\-]{8,}/g, '$1 [redacted]');
}
