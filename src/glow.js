'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const marker = '<!-- Neon Dreams optional glow -->';
const tag = `${marker}\n<link rel="stylesheet" href="./neondreams-glow.css">`;
const header = '/* Neon Dreams optional glow — managed by accelleon.neondreams */';

async function findWorkbench(appRoot) {
  for (const directory of ['electron-browser', 'electron-sandbox']) {
    const candidate = path.join(appRoot, 'out', 'vs', 'code', directory, 'workbench', 'workbench.html');
    try {
      if ((await fs.lstat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error('No supported desktop workbench found. Glow is unavailable on this VS Code installation.');
}

async function atomicWrite(file, contents) {
  const info = await fs.lstat(file);
  if (!info.isFile()) throw new Error('Refusing to replace a nonregular file.');
  const temporary = `${file}.neondreams-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(temporary, contents, { flag: 'wx', mode: info.mode & 0o777 });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function ownedStylesheet(file) {
  try {
    if (!(await fs.lstat(file)).isFile()) throw new Error('Glow stylesheet must be a regular file.');
    const contents = await fs.readFile(file, 'utf8');
    if (!contents.startsWith(header)) throw new Error('Refusing to overwrite an unmanaged glow stylesheet.');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function setGlow(appRoot, css, enabled) {
  const htmlPath = await findWorkbench(appRoot);
  const cssPath = path.join(path.dirname(htmlPath), 'neondreams-glow.css');
  const original = await fs.readFile(htmlPath, 'utf8');
  const owned = await ownedStylesheet(cssPath);
  if (enabled) {
    if (!css.startsWith(header)) throw new Error('Invalid bundled glow stylesheet.');
    if (!original.includes('</head>')) throw new Error('Unsupported workbench markup; no files changed.');
    if (original.includes(marker) && !original.includes(tag)) throw new Error('Unexpected glow marker; no files changed.');
    // Write the asset first so the workbench never references a missing file.
    if (owned) await atomicWrite(cssPath, css);
    else await fs.writeFile(cssPath, css, { flag: 'wx' });
    if (!original.includes(tag)) {
      try { await atomicWrite(htmlPath, original.replace('</head>', `${tag}\n</head>`)); }
      catch (error) {
        if (!owned) await fs.rm(cssPath, { force: true });
        throw error;
      }
    }
  } else {
    if (original.includes(marker) && !original.includes(tag)) throw new Error('Unexpected glow marker; no files changed.');
    if (original.includes(tag)) await atomicWrite(htmlPath, original.replace(`${tag}\n`, '').replace(tag, ''));
    if (owned) await fs.rm(cssPath);
  }
}

module.exports = { findWorkbench, setGlow };
