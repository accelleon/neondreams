'use strict';
const { chromium } = require('@playwright/test');
const { renderGlow } = require('../src/glow-style');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function run() {
  const root = path.join(__dirname, '../node_modules/monaco-editor/min');
  const template = await fs.readFile(path.join(__dirname, '../assets/glow.css'), 'utf8');
  const html = `<!doctype html><html><head><style>body{margin:0;background:#000}#editor{width:1000px;height:500px}</style></head><body>
    <div class="monaco-workbench accelleon-neondreams-themes-neon-dreams-color-theme-json"><div id="editor"></div></div>
    <script src="/vs/loader.js"></script><script>
      require.config({paths:{vs:'/vs'}});
      require(['vs/editor/editor.main'],function(){
        monaco.editor.defineTheme('neon',{base:'vs-dark',inherit:true,rules:[
          {token:'keyword',foreground:'FF70BD'},{token:'string',foreground:'A5E880'},
          {token:'identifier',foreground:'69E5FF'},{token:'number',foreground:'FFBB78'}
        ],colors:{'editor.background':'#000000','editor.foreground':'#E5DEF5'}});
        window.editor=monaco.editor.create(document.getElementById('editor'),{
          value:'function neonDreams(name) {\\n  const message = "Hello, " + name;\\n  return message;\\n}\\nneonDreams("world");',
          language:'javascript',theme:'neon',fontSize:16,lineHeight:24,minimap:{enabled:false},
          lineNumbers:'off',renderLineHighlight:'none',readOnly:true,experimentalGpuAcceleration:'off',padding:{top:24}
        });
      });
    </script></body></html>`;
  const server = createServer(async (request, response) => {
    if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
    const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) { response.writeHead(404).end(); return; }
    try {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      response.end(await fs.readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let browser;
  try {
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 500 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => [...document.querySelectorAll('.view-line span')].some(e => e.textContent === 'function' && getComputedStyle(e).color === 'rgb(255, 112, 189)'));
    const colors = () => page.locator('.view-line span[class*="mtk"]').evaluateAll(elements => elements.map(e => getComputedStyle(e).color));
    const originalColors = await colors();
    assert.ok(originalColors.length > 10, 'Actual Monaco token spans rendered');
    const sheet = await page.addStyleTag({ content: renderGlow(template, { strength: 0 }) });
    const noGlow = await page.screenshot();
    let defaultGlow;
    let maxGlow;
    for (const strength of [60, 100]) {
      await sheet.evaluate((element, css) => { element.textContent = css; }, renderGlow(template, { strength }));
      assert.deepEqual(await colors(), originalColors, 'Rendered token colors do not change');
      const shadows = await page.locator('.view-line span[class*="mtk"]').evaluateAll(elements => elements.map(e => getComputedStyle(e).textShadow));
      assert.ok(shadows.every(shadow => shadow !== 'none'), 'Every rendered token receives glow');
      const image = await page.screenshot();
      assert.notDeepEqual(image, noGlow, `Strength ${strength} changes rendered editor pixels`);
      if (strength === 60) defaultGlow = image;
      else {
        assert.notDeepEqual(image, defaultGlow, 'Strength 100 differs from 60 in actual editor rendering');
        maxGlow = image;
      }
    }
    await sheet.evaluate((element, css) => { element.textContent = css; }, renderGlow(template, { strength: 100, editorBoost: 1 }));
    assert.notDeepEqual(await page.screenshot(), maxGlow, 'Editor-only boost changes actual Monaco pixels at strength 100');
    assert.deepEqual(await colors(), originalColors, 'Boost preserves actual token foregrounds');
    await page.evaluate(() => window.editor.updateOptions({ fontSize: 13, lineHeight: 20 }));
    await sheet.evaluate((element, css) => { element.textContent = css; }, renderGlow(template, { strength: 0 }));
    const smallFontOff = await page.screenshot();
    await sheet.evaluate((element, css) => { element.textContent = css; }, renderGlow(template, { strength: 100, editorBoost: 2 }));
    assert.notDeepEqual(await page.screenshot(), smallFontOff, 'Halo changes actual editor pixels at a normal 13px font size');
    assert.deepEqual(await colors(), originalColors, 'Small-font glow preserves token foregrounds');
    // Sticky scroll re-renders tokens under .sticky-line-content, outside .view-line.
    await page.evaluate(() => {
      const body = Array.from({ length: 50 }, (_, i) => `  const value${i} = "hello";`);
      window.editor.setValue(['function neonDreams(name) {', ...body, '  return name;', '}'].join('\n'));
      monaco.languages.registerDocumentSymbolProvider('javascript', {
        provideDocumentSymbols: () => [{
          name: 'neonDreams', kind: monaco.languages.SymbolKind.Function,
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 53, endColumn: 2 },
          selectionRange: { startLineNumber: 1, startColumn: 10, endLineNumber: 1, endColumn: 20 }
        }]
      });
      window.editor.updateOptions({ stickyScroll: { enabled: true } });
      window.editor.setScrollTop(240);
    });
    await page.waitForSelector('.sticky-line-content span[class*="mtk"]');
    const stickyTokens = page.locator('.sticky-line-content span[class*="mtk"]');
    const stickyStyles = await stickyTokens.evaluateAll(elements => elements.map(e => ({ text: e.textContent, color: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow })));
    assert.ok(stickyStyles.length > 2, 'Actual editor sticky header contains rendered tokens');
    assert.ok(stickyStyles.every(token => token.shadow !== 'none'), 'Pinned function header receives the same glow as editor tokens');
    await sheet.evaluate((element, css) => { element.textContent = css; }, renderGlow(template, { editor: false }));
    assert.ok((await stickyTokens.evaluateAll(elements => elements.map(e => getComputedStyle(e).textShadow))).every(shadow => shadow === 'none'), 'Editor switch also disables sticky-header glow');
    assert.deepEqual(errors, [], 'Actual editor loads without renderer errors');
    console.log('Real Monaco checks passed: DOM tokenization, glow at 60 and 100, editor boost, actual sticky-scroll headers, editor toggle, visible pixel changes, and unchanged foregrounds. This is not a Windows VS Code integration test.');
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
