#!/usr/bin/env node
// Provider switch for showreel assets: runs fal.mjs or kie.mjs with the same commands.
//
//   node gen.mjs image --ref logo.png --prompt "..." --out assets/img/hero.png              (fal, the default)
//   node gen.mjs video --image hero.png --prompt "..." --provider kie                       (Kie.ai for this call)
//   GEN_PROVIDER=kie node gen.mjs music --title "Reel" --out assets/audio                    (Kie.ai via the environment)
//
// Choice order: --provider flag (or --provider=name), then GEN_PROVIDER in the environment, then
// GEN_PROVIDER in the nearest workspace .env, then fal. A missing, repeated or unknown provider stops
// the run before anything is spent. Every command is a PAID call on that provider's credits.
// --dry-run: fal prints the exact request; kie prints only the script and arguments it would run.
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { findEnvValue } from './env.mjs';

export const PROVIDERS = ['fal', 'kie'];
const here = dirname(fileURLToPath(import.meta.url));
const set = (v) => (v && String(v).trim()) || undefined; // empty values count as unset

// Returns { provider, rest }: rest is the argument list with every provider flag removed.
export function resolveProvider(args, env = process.env, fromFile = () => findEnvValue(here, 'GEN_PROVIDER', env)) {
  const flags = [];
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--provider') {
      const v = args[i + 1];
      if (!v || !v.trim() || v.startsWith('--')) throw new Error('--provider needs a value (fal or kie)');
      flags.push(v); i++;
    } else if (a.startsWith('--provider=')) {
      const v = a.slice('--provider='.length);
      if (!v.trim()) throw new Error('--provider needs a value (fal or kie)');
      flags.push(v);
    } else rest.push(a);
  }
  if (flags.length > 1) throw new Error('--provider given more than once');
  const choice = set(flags[0]) ?? set(env.GEN_PROVIDER) ?? set(fromFile()) ?? 'fal';
  const p = String(choice).toLowerCase().trim();
  if (!PROVIDERS.includes(p)) {
    const shown = /^[a-z0-9_-]{1,20}$/i.test(choice) ? `"${choice}"` : '(value hidden)';
    throw new Error(`unknown provider ${shown} (use fal or kie)`);
  }
  return { provider: p, rest };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { provider, rest } = resolveProvider(process.argv.slice(2));
    const script = join(here, `${provider}.mjs`);
    if (provider === 'kie' && rest.includes('--dry-run')) {
      console.log(JSON.stringify({ provider, script, args: rest.filter((a) => a !== '--dry-run'), note: 'kie.mjs has no dry run: this is the command only, not the API request' }, null, 2));
    } else {
      console.error(`provider: ${provider}`);
      const r = spawnSync(process.execPath, [script, ...rest], { stdio: 'inherit' });
      process.exitCode = r.status ?? 1;
    }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
