'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setGlow } = require('./glow');

let busy = false;
function activate(context) {
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
          `Neon Dreams glow ${enabled ? 'enabled' : 'removed'}. Quit and reopen all VS Code windows to apply the change.`);
      } catch (error) {
        await vscode.window.showErrorMessage(`Neon Dreams: ${error.message} The native theme remains available. Do not run VS Code as administrator to enable glow.`);
      } finally { busy = false; }
    }));
  }
}
module.exports = { activate };
