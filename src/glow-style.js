'use strict';
const scope = '.monaco-workbench.accelleon-neondreams-themes-neon-dreams-color-theme-json';
function renderGlow(template, options = {}) {
  const strength = typeof options.strength === 'number' && Number.isFinite(options.strength)
    ? Math.min(100, Math.max(0, options.strength)) : 60;
  const scale = strength / 60;
  const number = value => Number(value.toFixed(2));
  const shadow = strength === 0 ? 'none' : [[2, 70], [6, 60], [14, 40]].map(([radius, alpha]) =>
    `0 0 ${number(radius * Math.sqrt(scale))}px color-mix(in srgb, currentColor ${number(Math.min(100, alpha * scale))}%, transparent)`
  ).join(', ');
  const declarations = [`--nd-text-glow: ${shadow}`];
  for (const [option, property] of [['editor', 'editor'], ['terminal', 'terminal'], ['explorer', 'explorer'], ['debugConsole', 'debug']]) {
    declarations.push(`--nd-${property}-glow: ${options[option] === false ? 'none' : 'var(--nd-text-glow)'}`);
  }
  const tint = (hex, alpha) => `color-mix(in srgb, ${hex} ${number(Math.min(100, alpha * scale))}%, transparent)`;
  declarations.push(`--nd-cursor-glow: ${strength === 0 || options.editor === false ? 'none' : `0 0 ${number(5 * Math.sqrt(scale))}px ${tint('#ff70bd', 60)}, 0 0 ${number(12 * Math.sqrt(scale))}px ${tint('#ff70bd', 40)}`}`);
  declarations.push(`--nd-row-glow: ${strength === 0 ? 'none' : `inset 2px 0 0 ${tint('#69e5ff', 100)}, inset 5px 0 ${number(8 * Math.sqrt(scale))}px ${tint('#69e5ff', 7)}`}`);
  declarations.push(`--nd-status-glow: ${strength === 0 ? 'none' : `0 -1px ${number(8 * Math.sqrt(scale))}px ${tint('#bd93ff', 13)}`}`);
  return `${template}\n/* Generated from application settings; shared by windows using this installation. */\n${scope} {\n  ${declarations.join(';\n  ')};\n}\n`;
}
module.exports = { renderGlow };
