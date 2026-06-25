#!/usr/bin/env node
/**
 * Standalone GLB/glTF optimizer for the RotorFPV drone viewer.
 *
 * Usage:
 *   1. npm install                 (once)
 *   2. drop your .glb (or .gltf + .bin) into ./input
 *   3. npm run optimize
 *   4. grab the web-ready file from ./output and upload it in the admin → Drones tab
 *
 * It runs the same pipeline used for the site's models:
 *   1. dedup + weld + simplify + prune  — KEEPS every part separate (no join /
 *      no flatten), so each named part stays individually clickable in the viewer.
 *   2. Draco geometry compression — shrinks the file a lot with no visible loss.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, parse } from 'node:path';

const INPUT = 'input';
const OUTPUT = 'output';
const TMP = '.tmp-optimize';

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2);
const quote = (s) => (/\s/.test(s) ? `"${s}"` : s);

function run(parts) {
  const cmd = 'gltf-transform ' + parts.map(quote).join(' ');
  const res = spawnSync(cmd, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    throw new Error(`Step failed: gltf-transform ${parts[0]}`);
  }
}

mkdirSync(INPUT, { recursive: true });
mkdirSync(OUTPUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const files = readdirSync(INPUT).filter((f) => /\.(glb|gltf)$/i.test(f));

if (files.length === 0) {
  console.log('\nNo .glb or .gltf files found in ./input');
  console.log('Drop your exported model there and run `npm run optimize` again.\n');
  process.exit(0);
}

console.log(`\nFound ${files.length} model(s) to optimize.\n`);

for (const file of files) {
  const { name } = parse(file);
  const src = join(INPUT, file);
  const tmp = join(TMP, `${name}.glb`);
  const out = join(OUTPUT, `${name}-optimized.glb`);

  console.log('──────────────────────────────────────────────');
  console.log(`▶ ${file}  (${mb(src)} MB)`);

  try {
    // 1. Clean + simplify, but KEEP parts separate (no join, no flatten) so the
    //    named nodes survive for the interactive component picker/viewer.
    run([
      'optimize', src, tmp,
      '--join', 'false',
      '--flatten', 'false',
      '--compress', 'false',
      '--texture-compress', 'false',
      '--simplify-error', '0.005',
    ]);

    // 2. Draco geometry compression.
    run(['draco', tmp, out]);

    console.log(`✓ ${out}  (${mb(out)} MB)\n`);
  } catch (err) {
    console.error(`✗ Failed on ${file}: ${err.message}\n`);
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log('Done. Upload the file(s) from ./output in the admin → Drones tab.\n');
console.log('Tip: name your parts meaningfully in the CAD/export so the component');
console.log('list in the admin is readable (e.g. "Front Left Motor", not "Solid001").\n');
