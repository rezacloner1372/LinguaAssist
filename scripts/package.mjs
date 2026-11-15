/**
 * Build everything needed to publish a release into release/:
 *
 *   linguaassist-chrome-vX.Y.Z.zip   → Chrome Web Store (also Edge / Opera / Brave)
 *   linguaassist-firefox-vX.Y.Z.zip  → addons.mozilla.org (extension package)
 *   linguaassist-source-vX.Y.Z.zip   → addons.mozilla.org ("Source code" upload;
 *                                      required because the bundle is minified)
 *
 * Usage: npm run package
 * Cross-platform: needs only Node, npm and git.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'release');
const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

const pkg = read('package.json');
const manifest = read('manifest.json');
if (pkg.version !== manifest.version) {
  console.error(`Version mismatch: package.json is ${pkg.version} but manifest.json is ${manifest.version}.`);
  process.exit(1);
}
const v = manifest.version;

// 1. Clean build of both browsers
console.log(`\n▶ Building LinguaAssist v${v} for Chrome and Firefox…`);
const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

const { default: webExt } = await import('web-ext');
const quiet = { shouldExitProgram: false };

// 2. Lint the Firefox build the same way AMO will
console.log('\n▶ Linting the Firefox build (web-ext lint)…');
const lint = await webExt.cmd.lint(
  { sourceDir: resolve(root, 'dist/firefox'), artifactsDir: out, selfHosted: false, warningsAsErrors: false, output: 'text', pretty: true },
  quiet,
);
if (lint && lint.exitCode) {
  console.error('Lint reported errors; fix them before submitting.');
  process.exit(1);
}

// 3. Zip each browser build
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const browser of ['chrome', 'firefox']) {
  console.log(`\n▶ Packaging ${browser}…`);
  await webExt.cmd.build(
    {
      sourceDir: resolve(root, 'dist', browser),
      artifactsDir: out,
      filename: `linguaassist-${browser}-v${v}.zip`,
      overwriteDest: true,
    },
    quiet,
  );
}

// 4. Source package for AMO reviewers: tracked files at HEAD (no node_modules/dist)
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
if (dirty) {
  console.warn('\n⚠ Uncommitted changes detected. The source zip is built from HEAD, so it will NOT include them:\n' + dirty);
}
console.log('\n▶ Packaging source for AMO…');
execFileSync('git', ['archive', '--format=zip', '-o', resolve(out, `linguaassist-source-v${v}.zip`), 'HEAD'], { cwd: root });

console.log(`\n✔ Done. Upload files are in ${out}`);
