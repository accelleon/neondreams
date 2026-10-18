'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setGlow, findWorkbench, inspectGlow } = require('../src/glow');
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
    const filename = (await inspectGlow(f.root, f.css)).stylesheetFile;
    assert.match(filename, /^neondreams-glow-[a-f0-9]{16}\.css$/);
    assert.equal(enabled.split(`href="./${filename}"`).length, 2);
    assert.equal(await fs.readFile(path.join(f.dir, filename), 'utf8'), f.css);
    await fs.writeFile(f.html, enabled.replace('<body>', '<body data-unrelated="keep">'));
    await setGlow(f.root, f.css, false);
    await setGlow(f.root, f.css, false);
    assert.equal(await fs.readFile(f.html, 'utf8'), original.replace('<body>', '<body data-unrelated="keep">'));
    await assert.rejects(fs.access(path.join(f.dir, filename)), { code: 'ENOENT' });
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

test('status distinguishes missing, current, outdated and removed glow', async t => {
  const f = await fixture(t);
  const missing = await inspectGlow(f.root, f.css);
  assert.equal(missing.linked, false);
  assert.equal(missing.stylesheetPresent, false);
  assert.equal(missing.stylesheetCurrent, false);
  await setGlow(f.root, f.css, true);
  const installed = await inspectGlow(f.root, f.css);
  assert.equal(installed.linked, true);
  assert.equal(installed.stylesheetCurrent, true);
  await fs.appendFile(path.join(f.dir, installed.stylesheetFile), '\n/* previous revision */');
  assert.equal((await inspectGlow(f.root, f.css)).stylesheetCurrent, false);
  await setGlow(f.root, f.css, true);
  assert.equal((await inspectGlow(f.root, f.css)).stylesheetCurrent, true);
  await setGlow(f.root, f.css, false);
  assert.equal((await inspectGlow(f.root, f.css)).linked, false);
});

test('changed profiles use new CSS URLs without altering assets loaded by old windows', async t => {
  const f = await fixture(t);
  await setGlow(f.root, f.css, true);
  const original = await inspectGlow(f.root, f.css);
  const updatedCss = `${f.css}\n/* another strength */`;
  await setGlow(f.root, updatedCss, true);
  const updated = await inspectGlow(f.root, updatedCss);
  assert.notEqual(updated.stylesheetFile, original.stylesheetFile);
  assert.equal(await fs.readFile(path.join(f.dir, original.stylesheetFile), 'utf8'), f.css);
  assert.equal(updated.stylesheetCurrent, true);
  assert.equal((await fs.readFile(f.html, 'utf8')).split('<!-- Neon Dreams optional glow -->').length, 2);
  await setGlow(f.root, updatedCss, false);
  assert.deepEqual((await fs.readdir(f.dir)).filter(name => name.endsWith('.css')), []);
});

test('legacy fixed stylesheet links migrate without duplicating the patch', async t => {
  const f = await fixture(t);
  const legacy = '<!-- Neon Dreams optional glow -->\n<link rel="stylesheet" href="./neondreams-glow.css">';
  const original = await fs.readFile(f.html, 'utf8');
  await fs.writeFile(f.html, original.replace('</head>', `${legacy}\n</head>`));
  await fs.writeFile(path.join(f.dir, 'neondreams-glow.css'), f.css);
  assert.equal((await inspectGlow(f.root, f.css)).stylesheetCurrent, false, 'Legacy URL needs migration even when contents match');
  await setGlow(f.root, f.css, true);
  assert.equal((await inspectGlow(f.root, f.css)).stylesheetCurrent, true);
  assert.ok(!(await fs.readFile(f.html, 'utf8')).includes('href="./neondreams-glow.css"'));
  await setGlow(f.root, f.css, false);
  assert.equal(await fs.readFile(f.html, 'utf8'), original);
  await assert.rejects(fs.access(path.join(f.dir, 'neondreams-glow.css')), { code: 'ENOENT' });
});
