'use strict';
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const os = require('node:os');
const { createServer } = require('node:http');
const { setGlow } = require('../src/glow');
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
    const css = await fs.readFile(path.join(__dirname, '../assets/glow.css'), 'utf8');
    const html = `<div class="monaco-workbench ${themeClass}" style="background:#000;min-height:100vh;padding:40px;font:18px monospace"><div class="monaco-editor"><div class="view-line"><span id="keyword" style="color:${theme.semanticTokenColors.keyword}">const</span> <span id="string" style="color:${theme.semanticTokenColors.string}">'neon'</span></div></div><div class="monaco-menu"><div class="action-item focused" style="color:#69e5ff">Menu item</div></div></div>`;
    await page.setContent(html);
    const before = await page.locator('#keyword').evaluate(e => getComputedStyle(e).color);
    const beforeImage = await page.screenshot();
    await page.addStyleTag({ content: css });
    const styles = p => p.locator('#keyword').evaluate(e => ({ color: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow }));
    const main = await styles(page);
    assert.equal(main.color, before, 'Glow preserves foreground');
    assert.notEqual(main.shadow, 'none', 'Main editor has glow');
    assert.notDeepEqual(await page.screenshot(), beforeImage, 'Glow changes visible pixels on black');
    const haloColor = async id => page.locator(id).evaluate(e => {
      const reference = document.createElement('span');
      reference.style.color = `color-mix(in srgb, ${getComputedStyle(e).color} 70%, transparent)`;
      document.body.append(reference);
      const color = getComputedStyle(reference).color;
      reference.remove();
      return color;
    });
    assert.ok(main.shadow.includes(await haloColor('#keyword')), 'Halo follows token color');
    const green = await page.locator('#string').evaluate(e => ({ color: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow }));
    assert.notEqual(green.color, main.color, 'Token categories remain distinct');
    assert.ok(green.shadow.includes(await haloColor('#string')), 'String halo follows green');
    assert.notEqual(await page.locator('.action-item').evaluate(e => getComputedStyle(e).boxShadow), 'none');
    // Match VS Code auxiliary-window behavior: clone head stylesheets and body classes.
    const child = await context.newPage();
    await child.setContent(html);
    for (const content of await page.locator('head style').allTextContents()) await child.addStyleTag({ content });
    assert.deepEqual(await styles(child), main, 'Copied stylesheet works in detached document');
    await child.locator('.monaco-workbench').evaluate((e, cls) => e.classList.remove(cls), themeClass);
    assert.equal((await styles(child)).shadow, 'none', 'Other themes have no glow');
    await page.emulateMedia({ forcedColors: 'active' });
    assert.equal((await styles(page)).shadow, 'none', 'Forced colors suppress glow');
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
        const filename = { '/workbench.html': 'workbench.html', '/neondreams-glow.css': 'neondreams-glow.css' }[request.url];
        if (!filename) { response.writeHead(404).end(); return; }
        try {
          const contents = await fs.readFile(path.join(dir, filename));
          response.writeHead(200, { 'Content-Type': filename.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(contents);
        } catch { response.writeHead(404).end(); }
      });
      try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        await installed.goto(`http://127.0.0.1:${server.address().port}/workbench.html`);
        assert.deepEqual(await styles(installed), main, 'Installed external stylesheet loads under CSP');
        await setGlow(appRoot, css, false);
        await installed.reload();
        assert.equal((await styles(installed)).shadow, 'none', 'Removing glow removes its rendered effect');
      } finally {
        await installed.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
    } finally { await fs.rm(appRoot, { recursive: true, force: true }); }
    console.log('Browser checks passed: visible pixels on black, foreground preservation, token-specific halos, menus, detached-document styles, theme switching, accessibility overrides, and installed stylesheet loading/removal under CSP.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
