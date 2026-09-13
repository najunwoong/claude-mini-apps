'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const IGNORED = new Set(['tests', 'node_modules', '.github']);

/** 저장소 최상위에서 index.html을 가진 폴더 = 하나의 미니 앱 */
const APPS = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !IGNORED.has(d.name))
  .filter(d => fs.existsSync(path.join(ROOT, d.name, 'index.html')))
  .map(d => d.name)
  .sort();

const appDir = name => path.join(ROOT, name);
const appPath = name => path.join(appDir(name), 'index.html');
const readApp = name => fs.readFileSync(appPath(name), 'utf8');

/** index.html 안의 인라인 <script> 본문을 꺼낸다. */
function extractScript(name) {
  const m = readApp(name).match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`${name}: 인라인 <script>를 찾지 못했습니다`);
  return m[1];
}

module.exports = { ROOT, APPS, appDir, appPath, readApp, extractScript };
