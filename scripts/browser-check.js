'use strict';
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
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
    const html = `<div class="monaco-workbench ${themeClass}"><div class="monaco-editor"><div class="view-line"><span id="keyword" style="color:${theme.semanticTokenColors.keyword}">const</span> <span id="string" style="color:${theme.semanticTokenColors.string}">'neon'</span></div></div><div class="monaco-menu"><div class="action-item focused">Menu item</div></div></div>`;
    await page.setContent(html);
    const before = await page.locator('#keyword').evaluate(e => getComputedStyle(e).color);
    await page.addStyleTag({ content: css });
    const styles = p => p.locator('#keyword').evaluate(e => ({ color: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow }));
    const main = await styles(page);
    assert.equal(main.color, before, 'Glow preserves foreground');
    assert.notEqual(main.shadow, 'none', 'Main editor has glow');
    assert.ok(main.shadow.includes(before), 'Halo follows token color');
    const green = await page.locator('#string').evaluate(e => ({ color: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow }));
    assert.notEqual(green.color, main.color, 'Token categories remain distinct');
    assert.ok(green.shadow.includes(green.color), 'String halo follows green');
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
    console.log('Browser checks passed: foreground preservation, token-specific halos, menus, detached-document styles, theme switching, and forced colors.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
