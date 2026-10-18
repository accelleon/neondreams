'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setGlow, findWorkbench } = require('../src/glow');
const { validate } = require('../scripts/validate-theme');
const cssFile = path.join(__dirname, '..', 'assets', 'glow.css');

async function fixture(t, folder = 'electron-browser') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'neondreams-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dir = path.join(root, 'out/vs/code', folder, 'workbench');
  await fs.mkdir(dir, { recursive: true });
  const html = path.join(dir, 'workbench.html');
  await fs.writeFile(html, '<html><head><meta charset="utf-8"></head><body></body></html>');
  return { root, dir, html, css: await fs.readFile(cssFile, 'utf8') };
}

test('theme palette, readable syntax, and glow selector agree with manifest', validate);
for (const folder of ['electron-browser', 'electron-sandbox']) {
  test(`${folder}: enable is repeatable and disable preserves unrelated edits`, async t => {
    const f = await fixture(t, folder);
    const original = await fs.readFile(f.html, 'utf8');
    await setGlow(f.root, f.css, true);
    await setGlow(f.root, f.css, true);
    const enabled = await fs.readFile(f.html, 'utf8');
    assert.equal(enabled.split('href="./neondreams-glow.css"').length, 2);
    assert.equal(await fs.readFile(path.join(f.dir, 'neondreams-glow.css'), 'utf8'), f.css);
    await fs.writeFile(f.html, enabled.replace('<body>', '<body data-unrelated="keep">'));
    await setGlow(f.root, f.css, false);
    await setGlow(f.root, f.css, false);
    assert.equal(await fs.readFile(f.html, 'utf8'), original.replace('<body>', '<body data-unrelated="keep">'));
    await assert.rejects(fs.access(path.join(f.dir, 'neondreams-glow.css')), { code: 'ENOENT' });
  });
}
test('unsupported installation and unexpected markup remain untouched', async t => {
  const f = await fixture(t);
  await assert.rejects(findWorkbench(path.join(f.root, 'missing')), /No supported/);
  await fs.writeFile(f.html, '<html>unknown layout</html>');
  await assert.rejects(setGlow(f.root, f.css, true), /Unsupported/);
  assert.equal(await fs.readFile(f.html, 'utf8'), '<html>unknown layout</html>');
  await assert.rejects(fs.access(path.join(f.dir, 'neondreams-glow.css')), { code: 'ENOENT' });
});
test('does not overwrite unrelated files or symlinks', async t => {
  const f = await fixture(t);
  const asset = path.join(f.dir, 'neondreams-glow.css');
  await fs.writeFile(asset, 'user-owned');
  await assert.rejects(setGlow(f.root, f.css, true), /unmanaged/);
  assert.equal(await fs.readFile(asset, 'utf8'), 'user-owned');
  await fs.rm(asset);
  const target = path.join(f.root, 'keep.css');
  await fs.writeFile(target, 'keep');
  await fs.symlink(target, asset);
  await assert.rejects(setGlow(f.root, f.css, true), /regular file/);
  assert.equal(await fs.readFile(target, 'utf8'), 'keep');
});
test('refuses a modified marker without altering the workbench', async t => {
  const f = await fixture(t);
  const html = '<head><!-- Neon Dreams optional glow --><link href="custom.css"></head>';
  await fs.writeFile(f.html, html);
  await assert.rejects(setGlow(f.root, f.css, false), /Unexpected glow marker/);
  assert.equal(await fs.readFile(f.html, 'utf8'), html);
});
