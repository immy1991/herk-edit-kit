#!/usr/bin/env node
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const brandAt = args.indexOf('--brand');
const brand = brandAt >= 0 ? args[brandAt + 1] : undefined;
const rest = args.filter((_, i) => brandAt < 0 || (i !== brandAt && i !== brandAt + 1));
if (rest.length > 1 || args.filter(a => a === '--brand').length > 1) throw new Error('Usage: npm run new-video -- <lowercase-project-slug> [--brand <brand-slug>]');
const slug = rest[0] === '--help' || args.includes('--help') ? '--help' : rest[0];
if (!slug || slug === '--help') {
  console.log('Usage: npm run new-video -- <lowercase-project-slug> [--brand <brand-slug>]');
  process.exit(slug ? 0 : 1);
}
const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
if (!kebab.test(slug)) throw new Error('Use a lowercase kebab-case slug, not a path.');
if (brandAt >= 0 && !kebab.test(brand ?? '')) throw new Error('--brand needs a lowercase kebab-case brand slug.');
// Profiles live in brands/<slug>/ unless HERK_BRANDS points somewhere else (relative paths resolve from the kit root).
const brandsDir = resolve(root, process.env.HERK_BRANDS || 'brands');
const brandDir = brand && join(brandsDir, brand);
if (brandDir && !existsSync(join(brandDir, 'DESIGN.md'))) throw new Error(`No brand profile at ${brandDir}. Copy brands/_template there and fill it in.`);
const dest = join(root, 'video-projects', slug);
if (existsSync(dest)) throw new Error(`Project already exists: ${slug}. Choose a new name.`);
const gsap = join(root, 'node_modules/gsap/dist/gsap.min.js');
if (!existsSync(gsap)) throw new Error('Run npm ci in the kit root first.');
cpSync(join(root, 'examples/starter'), dest, { recursive: true, errorOnExist: true });
mkdirSync(join(dest, 'assets'), { recursive: true });
mkdirSync(join(dest, 'compositions'), { recursive: true });
mkdirSync(join(dest, 'renders'), { recursive: true });
copyFileSync(gsap, join(dest, 'assets/gsap.min.js'));
if (brandDir) {
  copyFileSync(join(brandDir, 'DESIGN.md'), join(dest, 'DESIGN.md'));
  if (existsSync(join(brandDir, 'tokens.css'))) copyFileSync(join(brandDir, 'tokens.css'), join(dest, 'assets/brand-tokens.css'));
  for (const f of readdirSync(brandDir)) if (/^logo\.(png|svg|webp)$/.test(f)) copyFileSync(join(brandDir, f), join(dest, 'assets', f));
}
const meta = JSON.parse(readFileSync(join(dest, 'meta.json'), 'utf8'));
meta.name = slug;
if (brandDir) meta.brand = brand;
writeFileSync(join(dest, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`Created video-projects/${slug}${brand ? ` with brand ${brand}` : ''}. Run HyperFrames from that folder.`);
