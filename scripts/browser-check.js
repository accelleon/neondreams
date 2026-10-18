'use strict';
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const os = require('node:os');
const { createServer } = require('node:http');
const { setGlow } = require('../src/glow');
const { renderGlow } = require('../src/glow-style');
const theme = require('../themes/neon-dreams-color-theme.json');

async function run() {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const themeClass = 'accelleon-neondreams-themes-neon-dreams-color-theme-json';
    const template = await fs.readFile(path.join(__dirname, '../assets/glow.css'), 'utf8');
    const css = renderGlow(template);
    const html = `<div class="monaco-workbench ${themeClass}" style="background:#000;color:#e5def5;min-height:100vh;padding:40px;font:18px monospace">
      <div class="monaco-editor"><div class="view-line"><span id="keyword" style="color:${theme.semanticTokenColors.keyword}">const</span> <span id="string" style="color:${theme.semanticTokenColors.string}">'neon'</span>
      <span><span id="functionA" class="mtk12" style="color:#69e5ff">first()</span> <span><span id="functionB" class="mtk27" style="color:#69e5ff;text-shadow:none">second()</span></span></span></div>
      <div class="sticky-widget"><span class="sticky-line-number" id="stickyNumber">66</span><span class="sticky-line-content"><span><span id="stickyFunction" class="mtk12" style="color:#69e5ff">first()</span></span></span></div></div>
      <div class="xterm"><div class="xterm-rows"><div><span id="terminal" style="color:#a5e880">terminal output</span><span id="terminalAnsi" style="color:#ff70bd">pink ANSI text</span></div></div></div>
      <div class="explorer-folders"><div class="monaco-list-row"><div class="monaco-icon-label"><span class="codicon" id="fileIcon">icon</span><span id="file" class="label-name">index.js <span id="fileMatch" style="color:#69e5ff">match</span></span></div></div></div>
      <div class="repl"><div class="output expression"><span class="value"><span id="debug" style="color:#ffbb78">debug output</span></span></div></div>
      <div class="monaco-menu"><div class="action-item focused" style="color:#69e5ff">Menu item</div></div></div>`;
    await page.setContent(html);
    const before = await page.locator('#keyword').evaluate(e => getComputedStyle(e).color);
    const beforeImage = await page.screenshot();
    const sheet = await page.addStyleTag({ content: css });
    const styles = p => p.locator('#keyword').evaluate(e => ({ color: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow }));
    const main = await styles(page);
    assert.equal(main.color, before, 'Glow preserves foreground');
    assert.notEqual(main.shadow, 'none', 'Main editor has glow');
    assert.notDeepEqual(await page.screenshot(), beforeImage, 'Glow changes visible pixels on black');
    const haloColor = async (id, opacity = 70) => page.locator(id).evaluate((e, alpha) => {
      const reference = document.createElement('span');
      reference.style.color = `color-mix(in srgb, ${getComputedStyle(e).color} ${alpha}%, transparent)`;
      document.body.append(reference);
      const color = getComputedStyle(reference).color;
      reference.remove();
      return color;
    }, opacity);
    assert.ok(main.shadow.includes(await haloColor('#keyword', 60)), 'Halo follows token color');
    const green = await page.locator('#string').evaluate(e => ({ color: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow }));
    assert.notEqual(green.color, main.color, 'Token categories remain distinct');
    assert.ok(green.shadow.includes(await haloColor('#string', 60)), 'String halo follows green');
    const shadow = id => page.locator(id).evaluate(e => getComputedStyle(e).textShadow);
    assert.equal(await shadow('#functionA'), await shadow('#functionB'), 'Nested function tokens glow consistently regardless of token class');
    assert.equal(await shadow('#functionA'), await shadow('#stickyFunction'), 'Pinned function header matches the body token glow');
    assert.equal(await shadow('#stickyNumber'), 'none', 'Sticky line numbers remain sharp');
    for (const id of ['#terminal', '#terminalAnsi', '#file', '#fileMatch', '#debug']) {
      assert.notEqual(await shadow(id), 'none', `${id} receives glow`);
      assert.ok((await shadow(id)).includes(await haloColor(id)), `${id} keeps its own color`);
    }
    assert.equal(await shadow('#fileIcon'), 'none', 'File icons remain sharp');
    assert.notEqual(await page.locator('.action-item').evaluate(e => getComputedStyle(e).boxShadow), 'none');

    const rewrite = options => sheet.evaluate((e, contents) => { e.textContent = contents; }, renderGlow(template, options));
    await rewrite({ strength: 25 });
    const subtle = (await styles(page)).shadow;
    await rewrite({ strength: 100 });
    const strong = (await styles(page)).shadow;
    assert.notEqual(subtle, strong, 'Strength changes the rendered shadow');
    assert.equal((await styles(page)).color, before, 'Strength leaves foreground unchanged');
    await rewrite({ strength: 100, editorBoost: 1 });
    const unboostedEditor = (await styles(page)).shadow;
    const unboostedTerminal = await shadow('#terminal');
    await rewrite({ strength: 100, editorBoost: 4 });
    assert.notEqual((await styles(page)).shadow, unboostedEditor, 'Editor boost increases editor halo layers');
    assert.equal(await shadow('#terminal'), unboostedTerminal, 'Editor boost leaves terminal glow unchanged');
    assert.equal((await styles(page)).color, before, 'Boost preserves text foreground');
    for (const [option, target] of [['editor', '#functionA'], ['terminal', '#terminal'], ['explorer', '#file'], ['debugConsole', '#debug']]) {
      await rewrite({ [option]: false });
      assert.equal(await shadow(target), 'none', `${option} can be disabled`);
      if (option === 'editor') assert.equal(await shadow('#stickyFunction'), 'none', 'Editor toggle disables pinned headers too');
      for (const other of ['#functionA', '#terminal', '#file', '#debug'].filter(id => id !== target)) {
        assert.notEqual(await shadow(other), 'none', `Disabling ${option} preserves ${other}`);
      }
    }
    await rewrite({ strength: 0 });
    for (const id of ['#keyword', '#functionB', '#terminal', '#file', '#debug']) assert.equal(await shadow(id), 'none', 'Zero disables all text glow');
    assert.equal(await page.locator('.action-item').evaluate(e => getComputedStyle(e).boxShadow), 'none');
    await rewrite({});
    // Match VS Code auxiliary-window behavior: clone head stylesheets and body classes.
    const child = await context.newPage();
    await child.setContent(html);
    for (const content of await page.locator('head style').allTextContents()) await child.addStyleTag({ content });
    assert.deepEqual(await styles(child), main, 'Copied stylesheet works in detached document');
    await child.locator('.monaco-workbench').evaluate((e, cls) => e.classList.remove(cls), themeClass);
    assert.equal((await styles(child)).shadow, 'none', 'Other themes have no glow');
    for (const id of ['#terminal', '#file', '#debug']) assert.equal(await child.locator(id).evaluate(e => getComputedStyle(e).textShadow), 'none');
    await page.emulateMedia({ forcedColors: 'active' });
    assert.equal((await styles(page)).shadow, 'none', 'Forced colors suppress glow');
    assert.equal(await shadow('#stickyFunction'), 'none', 'Forced colors suppress sticky-header glow');
    await page.emulateMedia({ forcedColors: 'none' });
    await page.emulateMedia({ contrast: 'more' });
    assert.equal((await styles(page)).shadow, 'none', 'High contrast suppresses glow');

    // Exercise the real installer and relative CSS link under a workbench-style CSP.
    const appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'neondreams-browser-'));
    try {
      const dir = path.join(appRoot, 'out/vs/code/electron-browser/workbench');
      await fs.mkdir(dir, { recursive: true });
      const workbench = path.join(dir, 'workbench.html');
      await fs.writeFile(workbench, `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'"></head><body>${html}</body></html>`);
      await setGlow(appRoot, css, true);
      const installed = await context.newPage();
      const server = createServer(async (request, response) => {
        const filename = request.url === '/workbench.html' ? 'workbench.html' : /^\/neondreams-glow(?:-[a-f0-9]{16})?\.css$/.test(request.url) ? request.url.slice(1) : undefined;
        if (!filename) { response.writeHead(404).end(); return; }
        try {
          const contents = await fs.readFile(path.join(dir, filename));
          response.writeHead(200, { 'Content-Type': filename.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': filename.endsWith('.css') ? 'public, max-age=31536000, immutable' : 'no-store' }).end(contents);
        } catch { response.writeHead(404).end(); }
      });
      try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        await installed.goto(`http://127.0.0.1:${server.address().port}/workbench.html`);
        assert.deepEqual(await styles(installed), main, 'Installed external stylesheet loads under CSP');
        await setGlow(appRoot, renderGlow(template, { strength: 0 }), true);
        const nextWindow = await context.newPage();
        await nextWindow.goto(`http://127.0.0.1:${server.address().port}/workbench.html`);
        assert.equal((await styles(nextWindow)).shadow, 'none', 'Strength 0 reaches a new renderer even when old CSS is cached');
        await setGlow(appRoot, renderGlow(template, { strength: 100 }), true);
        const onAgain = await context.newPage();
        await onAgain.goto(`http://127.0.0.1:${server.address().port}/workbench.html`);
        assert.notEqual((await styles(onAgain)).shadow, 'none', 'Strength 100 replaces the cached zero-strength style');
        await nextWindow.close();
        await onAgain.close();
        await setGlow(appRoot, css, false);
        await installed.reload();
        assert.equal((await styles(installed)).shadow, 'none', 'Removing glow removes its rendered effect');
      } finally {
        await installed.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
    } finally { await fs.rm(appRoot, { recursive: true, force: true }); }
    console.log('Browser checks passed: visible glow, strength levels and zero, per-surface controls, nested functions, ANSI DOM terminal, explorer labels, debug console, foreground preservation, detached-document styles, theme switching, accessibility, and installed stylesheet loading/removal under CSP.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
