'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setGlow, inspectGlow } = require('./glow');

let busy = false;
function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('neondreams.glowStatus', async () => {
    try {
      const css = await fs.readFile(path.join(context.extensionPath, 'assets', 'glow.css'), 'utf8');
      const status = await inspectGlow(vscode.env.appRoot, css);
      const theme = vscode.workspace.getConfiguration('workbench').get('colorTheme');
      const gpu = vscode.workspace.getConfiguration('editor').get('experimentalGpuAcceleration', 'off');
      const installed = status.linked && status.stylesheetPresent;
      const detail = [
        `VS Code: ${vscode.version} (${process.platform})`,
        `Selected theme: ${theme}`,
        `Glow link: ${status.linked ? 'installed' : 'missing'}`,
        `Stylesheet: ${status.stylesheetPresent ? (status.stylesheetCurrent ? 'current' : 'outdated — run Enable Glow again') : 'missing — run Enable Glow'}`,
        `Editor GPU acceleration: ${gpu}`,
        `Workbench: ${status.workbenchPath}`,
        '',
        installed ? 'The patch exists on disk. This does not confirm it loaded in the renderer. Restart every VS Code window after enabling or updating it.' : 'Enable glow to install the patch.',
        'Canvas-rendered editor text cannot use CSS text shadows. If GPU acceleration is on, set editor.experimentalGpuAcceleration to off and reload.',
        'OS high contrast / forced colors intentionally suppress glow.'
      ].join('\n');
      await vscode.window.showInformationMessage('Neon Dreams Glow Status', { modal: true, detail });
    } catch (error) {
      await vscode.window.showErrorMessage(`Neon Dreams: ${error.message}`);
    }
  }));
  for (const [command, enabled] of [['enableGlow', true], ['disableGlow', false]]) {
    context.subscriptions.push(vscode.commands.registerCommand(`neondreams.${command}`, async () => {
      if (busy) return;
      busy = true;
      try {
        if (vscode.env.uiKind !== vscode.UIKind.Desktop) {
          await vscode.window.showInformationMessage('The Neon Dreams theme works on the web; optional glow requires desktop VS Code.');
          return;
        }
        if (enabled) {
          const answer = await vscode.window.showWarningMessage(
            'Experimental glow modifies the VS Code installation. It may trigger an integrity warning, needs writable installation files, and must be re-enabled after updates. Disable glow before uninstalling. All VS Code windows must restart to apply it.',
            { modal: true }, 'Enable Glow');
          if (answer !== 'Enable Glow') return;
        }
        const css = await fs.readFile(path.join(context.extensionPath, 'assets', 'glow.css'), 'utf8');
        await setGlow(vscode.env.appRoot, css, enabled);
        await vscode.window.showInformationMessage(
          `Neon Dreams glow ${enabled ? 'enabled' : 'removed'}. Quit and reopen all VS Code windows to apply the change.${enabled ? ' If it remains invisible, run Neon Dreams: Check Glow Status.' : ''}`);
      } catch (error) {
        await vscode.window.showErrorMessage(`Neon Dreams: ${error.message} The native theme remains available. Do not run VS Code as administrator to enable glow.`);
      } finally { busy = false; }
    }));
  }
}
module.exports = { activate };
