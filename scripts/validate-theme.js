'use strict';
const assert = require('node:assert/strict');
const theme = require('../themes/neon-dreams-color-theme.json');
const manifest = require('../package.json');
const fs = require('node:fs');

function luminance(hex) {
  const channels = hex.slice(1, 7).match(/../g).map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
function validate() {
  assert.equal(manifest.contributes.themes[0].label, theme.name);
  for (const value of Object.values(theme.colors)) assert.match(value, /^#[\da-f]{6}([\da-f]{2})?$/i);
  for (const token of theme.tokenColors) {
    assert.ok(contrast(token.settings.foreground, theme.colors['editor.background']) >= 4.5,
      `${token.name} needs at least 4.5:1 contrast`);
  }
  for (const [name, color] of Object.entries(theme.semanticTokenColors)) {
    assert.ok(contrast(color, theme.colors['editor.background']) >= 4.5, name);
  }
  for (const [fore, back] of [
    ['editor.foreground', 'editor.background'], ['sideBar.foreground', 'sideBar.background'],
    ['input.foreground', 'input.background'], ['menu.foreground', 'menu.background'],
    ['editorSuggestWidget.foreground', 'editorSuggestWidget.background'],
    ['statusBar.foreground', 'statusBar.background'], ['button.foreground', 'button.background'],
    ['descriptionForeground', 'editorWidget.background']
  ]) assert.ok(contrast(theme.colors[fore], theme.colors[back]) >= 4.5, `${fore} contrast`);
  const css = fs.readFileSync(require.resolve('../assets/glow.css'), 'utf8');
  const themeClass = `${manifest.publisher}.${manifest.name}-${manifest.contributes.themes[0].path.replace(/^\.\//, '')}`.replace(/[^_a-zA-Z0-9-]/g, '-');
  assert.ok(css.includes(`.monaco-workbench.${themeClass}`), 'Glow must match VS Code theme class');
  assert.ok(!/(?:^|[;{])\s*(?:color|filter|opacity)\s*:/m.test(css), 'Glow must not replace or blur token colors');
  console.log(`Validated ${Object.keys(theme.colors).length} UI colors and ${theme.tokenColors.length} token groups; syntax and primary surfaces meet 4.5:1 contrast.`);
}
if (require.main === module) validate();
module.exports = { validate, contrast };
