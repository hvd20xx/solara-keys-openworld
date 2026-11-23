// Entrypoint for SOLARA KEYS: HEATLINE (make.fun gta6-01, Node 22 standard library only).
// Copies the offline static Three.js open-world game and verified browser screenshots to /output,
// validates screenshot caps, normalizes POSIX modes, and writes /output/dossier.json via buildDossier.

import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const SCREENSHOT_MIN_COUNT = 3;
const SCREENSHOT_MAX_COUNT = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: SCREENSHOT_MAX_COUNT, max_bytes: SCREENSHOT_MAX_BYTES },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function validateScreenshots(dir: string): void {
  if (!existsSync(dir)) {
    throw new Error(`Missing screenshots directory: ${dir}`);
  }
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  if (files.length < SCREENSHOT_MIN_COUNT || files.length > SCREENSHOT_MAX_COUNT) {
    throw new Error(`Expected ${SCREENSHOT_MIN_COUNT}-${SCREENSHOT_MAX_COUNT} screenshots, found ${files.length}`);
  }
  for (const name of files) {
    const size = lstatSync(join(dir, name)).size;
    if (size === 0 || size > SCREENSHOT_MAX_BYTES) {
      throw new Error(`Screenshot ${name} size ${size} bytes is outside 1..${SCREENSHOT_MAX_BYTES}`);
    }
  }
}

function normalizePosixModes(rootDir: string): void {
  if (process.platform === 'win32') return;
  const walk = (dir: string): void => {
    chmodSync(dir, 0o755);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) chmodSync(fullPath, 0o644);
    }
  };
  walk(rootDir);
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const srcGame = join(here, 'game');
const srcShots = join(here, 'screenshots');

validateScreenshots(srcShots);

mkdirSync(out, { recursive: true });
cpSync(srcGame, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(srcShots, join(out, 'screenshots'), { recursive: true });

const dossierBytes = buildDossier(out, DOSSIER_CAPS);
writeFileSync(join(out, 'dossier.json'), dossierBytes);

normalizePosixModes(join(out, 'game'));
normalizePosixModes(join(out, 'screenshots'));
if (process.platform !== 'win32') {
  chmodSync(join(out, 'dossier.json'), 0o644);
}
