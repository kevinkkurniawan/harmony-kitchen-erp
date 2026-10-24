// Builds dist/hk-sync.exe: the sync agent and Node in one Windows program (Node single executable
// application), plus the files the store PC needs. Run on Windows with the Node version to embed:
//
//   npm install
//   npm run build

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');

await build({
  entryPoints: ['sync.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/build/hk-sync.cjs',
  external: ['pg-native', 'msnodesqlv8'], // optional drivers, not used
  logOverride: { 'empty-import-meta': 'silent' }, // only read when not packaged, see env.mjs
});

writeFileSync(
  'dist/build/sea-config.json',
  JSON.stringify({ main: 'dist/build/hk-sync.cjs', output: 'dist/build/sea-prep.blob', disableExperimentalSEAWarning: true }),
);
execFileSync(process.execPath, ['--experimental-sea-config', 'dist/build/sea-config.json'], { stdio: 'inherit' });
copyFileSync(process.execPath, 'dist/hk-sync.exe');
execFileSync(
  'npx',
  ['postject', 'dist/hk-sync.exe', 'NODE_SEA_BLOB', 'dist/build/sea-prep.blob',
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'],
  { stdio: 'inherit', shell: true },
);
rmSync('dist/build', { recursive: true });

// cmd.exe and Notepad want CRLF line endings
const crlf = (from, to) => writeFileSync(to, readFileSync(from, 'utf8').replace(/\r?\n/g, '\r\n'));
crlf('store/install.bat', 'dist/install.bat');
crlf('store/uninstall.bat', 'dist/uninstall.bat');
crlf('store/README.txt', 'dist/README.txt');
crlf('.env.example', 'dist/hk-sync.env.example');
console.log('dist/ is ready to copy to the store PC');
