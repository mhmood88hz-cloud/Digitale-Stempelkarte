// Runs the dev server over plain HTTP for the in-app browser preview -- the DEV_HTTPS_* vars in
// .env are only meant for testing camera scanning from a phone over the LAN, but the preview
// browser's sandbox refuses to trust that self-signed cert, so strip them here rather than in
// .env itself.
process.env.DEV_HTTPS_CERT_PATH = '';
process.env.DEV_HTTPS_KEY_PATH = '';

const { spawn } = require('node:child_process');
const path = require('node:path');
// Spawn the local tsx binary. On Windows the installed shim is a .cmd file, which needs a shell
// to execute -- pass the whole invocation as one string (no user-controlled input here) so
// Node doesn't warn about unescaped argv entries.
const isWindows = process.platform === 'win32';
const tsxBin = path.join(__dirname, '..', 'node_modules', '.bin', isWindows ? 'tsx.cmd' : 'tsx');
const child = isWindows
  ? spawn(`"${tsxBin}" watch src/server.ts`, { stdio: 'inherit', env: process.env, shell: true })
  : spawn(tsxBin, ['watch', 'src/server.ts'], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
