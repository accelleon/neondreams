'use strict';
// Render real Monaco editors with an earlier release's glow and the working tree's glow.
const { chromium } = require('@playwright/test');
const { renderGlow } = require('../src/glow-style');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createServer } = require('node:http');
async function run() {
  const previousPath = process.argv[2];
  if (!previousPath) throw new Error('Usage: node scripts/glow-preview.js /absolute/path/to/previous-glow-style.js');
  const previous = require(path.resolve(previousPath));
  const root = path.join(__dirname, '../node_modules/monaco-editor/min');
  const template = await fs.readFile(path.join(__dirname, '../assets/glow.css'), 'utf8');
  const samples = {
    html: '<!DOCTYPE html>\n<html lang="en">\n<!-- Neon Dreams color and glow comparison -->\n<head>\n  <meta charset="UTF-8" />\n  <title>Neon Dreams</title>\n</head>\n<body>\n<script>\nfunction highlightCode(block) {\n  const message = "Neon colors stay distinct";\n  return processBlock(block, true, 0xff);\n}\n</script>\n</body>\n</html>',
    rust: 'pub(crate) use {map_key, make_key, with_key, key_enum, with_backend};\n\npub(crate) trait AeadBackend: \'static {\n    type Aead: Send;\n    fn aead_key(mode: Mode, key: &[u8]) -> Result<Self::Aead, Error>;\n    fn seal(ops: &mut [SealOp<\'_>]);\n}\n\nfn neon_dreams(name: &str) -> String {\n    let message = "Every token keeps its color";\n    format!("{}: {}", name, message)\n}'
  };
  const payload = JSON.stringify(samples).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#000;color:#e5def5;font:14px system-ui}main{display:grid;grid-template-columns:1fr 1fr}
    section{min-width:0;border:1px solid #252525}header{padding:12px 20px;background:#101010}h1{font-size:17px;margin:0 0 4px}p{margin:0;color:#aaa}.editor{height:450px}
    </style></head><body><main>
    ${['html','rust'].map(lang => ['before','after'].map(side => `<section><header><h1>${side === 'before' ? '0.1.5 — previous glow' : 'New — wider, color-matched halo'}</h1><p>${lang.toUpperCase()} · ${lang === 'rust' ? 13 : 20}px font · Strength 100 · Editor boost 2×</p></header><div id="${lang}-${side}" class="monaco-workbench accelleon-neondreams-themes-neon-dreams-color-theme-json"><div class="editor"></div></div></section>`).join('')).join('')}
    </main><script src="/vs/loader.js"></script><script>
    require.config({paths:{vs:'/vs'}});require(['vs/editor/editor.main'],function(){
      monaco.editor.defineTheme('neon',{base:'vs-dark',inherit:true,rules:[
        {token:'keyword',foreground:'FF70BD'},{token:'string',foreground:'A5E880'},
        {token:'identifier',foreground:'69E5FF'},{token:'number',foreground:'FFBB78'},
        {token:'tag',foreground:'FF70BD'},{token:'attribute.name',foreground:'FFE08A'},
        {token:'metatag',foreground:'BD93FF'},{token:'comment',foreground:'9B8CAB'}
      ],colors:{'editor.background':'#000000','editor.foreground':'#E5DEF5'}});
      const samples=${payload};window.editors=[];
      for(const language of ['html','rust'])for(const side of ['before','after']){
        window.editors.push(monaco.editor.create(document.querySelector('#'+language+'-'+side+' .editor'),{
          value:samples[language],language,theme:'neon',fontSize:language==='rust'?13:20,lineHeight:language==='rust'?23:25,
          disableLayerHinting:true,minimap:{enabled:false},lineNumbers:'off',renderLineHighlight:'none',readOnly:true,experimentalGpuAcceleration:'off',padding:{top:20}
        }));
      }window.ready=true;
    });</script></body></html>`;
  const server = createServer(async (request, response) => {
    if (request.url === '/') { response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(html); return; }
    const file = path.resolve(root, '.' + new URL(request.url,'http://localhost').pathname);
    if (!file.startsWith(root+path.sep)) { response.writeHead(404).end(); return; }
    try { response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');response.end(await fs.readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let browser;
  try {
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}),headless:true });
    const page = await browser.newPage({viewport:{width:1800,height:1040},deviceScaleFactor:1});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>window.ready);
    await page.waitForFunction(()=>['html','rust'].every(l=>['before','after'].every(s=>[...document.querySelectorAll('#'+l+'-'+s+' .view-line [class*=mtk]')].some(e=>getComputedStyle(e).color==='rgb(255, 112, 189)'))));
    const scoped = (css, side) => css.replaceAll('.monaco-workbench.accelleon-neondreams-themes-neon-dreams-color-theme-json', `:is(#html-${side}, #rust-${side}).monaco-workbench.accelleon-neondreams-themes-neon-dreams-color-theme-json`);
    await page.addStyleTag({content:scoped(previous.renderGlow(template,{strength:100,editorBoost:2}),'before')});
    await page.addStyleTag({content:scoped(renderGlow(template,{strength:100,editorBoost:2}),'after')});
    await page.evaluate(async()=>{await document.fonts.ready;window.editors.forEach(e=>e.render(true));window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    await page.screenshot({path:path.join(__dirname,'../docs/glow-comparison.png'),fullPage:true,animations:'disabled'});
    console.log('Saved real Monaco visual comparison to docs/glow-comparison.png (standalone tokenization, not a VS Code screenshot).');
  } finally {
    if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
