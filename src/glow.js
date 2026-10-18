'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const marker = '<!-- Neon Dreams optional glow -->';
const assetPattern = /^neondreams-glow(?:-[a-f0-9]{16})?\.css$/;
const assetName = css => `neondreams-glow-${crypto.createHash('sha256').update(css).digest('hex').slice(0, 16)}.css`;
const linkTag = file => `${marker}\n<link rel="stylesheet" href="./${file}">`;

function installedLink(html) {
  if (!html.includes(marker)) return undefined;
  const matches = [...html.matchAll(/<!-- Neon Dreams optional glow -->\r?\n<link rel="stylesheet" href="\.\/(neondreams-glow(?:-[a-f0-9]{16})?\.css)">/g)];
  if (matches.length !== 1 || html.split(marker).length !== 2) throw new Error('Unexpected glow marker; no files changed.');
  return { tag: matches[0][0], file: matches[0][1] };
}
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

async function managedAssets(directory) {
  const names = (await fs.readdir(directory)).filter(name => assetPattern.test(name));
  for (const name of names) await ownedStylesheet(path.join(directory, name));
  return names;
}

async function setGlow(appRoot, css, enabled) {
  const htmlPath = await findWorkbench(appRoot);
  const directory = path.dirname(htmlPath);
  const original = await fs.readFile(htmlPath, 'utf8');
  const previous = installedLink(original);
  const assets = await managedAssets(directory);
  if (enabled) {
    if (!css.startsWith(header)) throw new Error('Invalid bundled glow stylesheet.');
    if (!original.includes('</head>')) throw new Error('Unsupported workbench markup; no files changed.');
    const filename = assetName(css);
    const cssPath = path.join(directory, filename);
    const owned = assets.includes(filename);
    // Every distinct profile gets a distinct URL, so renderer caches cannot reuse
    // an older strength. Retain earlier managed assets for still-open windows.
    if (owned) {
      if (await fs.readFile(cssPath, 'utf8') !== css) await atomicWrite(cssPath, css);
    } else await fs.writeFile(cssPath, css, { flag: 'wx' });
    const next = previous ? original.replace(previous.tag, linkTag(filename)) : original.replace('</head>', `${linkTag(filename)}\n</head>`);
    if (next !== original) {
      try { await atomicWrite(htmlPath, next); }
      catch (error) {
        if (!owned) await fs.rm(cssPath, { force: true });
        throw error;
      }
    }
  } else {
    if (previous) await atomicWrite(htmlPath, original.replace(`${previous.tag}\n`, '').replace(previous.tag, ''));
    for (const filename of assets) await fs.rm(path.join(directory, filename));
  }
}

async function inspectGlow(appRoot, expectedCss) {
  const htmlPath = await findWorkbench(appRoot);
  const link = installedLink(await fs.readFile(htmlPath, 'utf8'));
  const cssPath = link ? path.join(path.dirname(htmlPath), link.file) : undefined;
  const owned = cssPath ? await ownedStylesheet(cssPath) : false;
  const css = owned ? await fs.readFile(cssPath, 'utf8') : undefined;
  return {
    workbenchPath: htmlPath,
    stylesheetFile: link?.file,
    linked: Boolean(link),
    stylesheetPresent: owned,
    stylesheetCurrent: Boolean(link && link.file === assetName(expectedCss) && css === expectedCss)
  };
}

module.exports = { findWorkbench, setGlow, inspectGlow };
