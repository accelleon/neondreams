'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setGlow, inspectGlow } = require('./glow');
const { renderGlow } = require('./glow-style');

function activate(context) {
  const output = vscode.window.createOutputChannel('Neon Dreams');
  context.subscriptions.push(output);
  let pending = Promise.resolve();
  const run = (task, silent = false) => {
    pending = pending.then(task).catch(async error => {
      output.appendLine(error.message);
      if (!silent) await vscode.window.showErrorMessage(`Neon Dreams: ${error.message} Do not run VS Code as administrator to enable glow.`);
    });
    return pending;
  };
  const settings = () => {
    const config = vscode.workspace.getConfiguration('neondreams.glow');
    return Object.fromEntries(['strength', 'editorBoost', 'editor', 'terminal', 'explorer', 'debugConsole'].map(key => [key, config.get(key)]));
  };
  const stylesheet = async () => renderGlow(await fs.readFile(path.join(context.extensionPath, 'assets/glow.css'), 'utf8'), settings());
  const desktop = () => vscode.env.uiKind === vscode.UIKind.Desktop;
  const notifyReload = message => {
    // An ignored notification can stay pending indefinitely. Never hold the
    // installation/update queue while waiting for its UI action.
    void vscode.window.showInformationMessage(`${message} Reload each VS Code window to apply.`, 'Reload This Window')
      .then(choice => choice ? vscode.commands.executeCommand('workbench.action.reloadWindow') : undefined)
      .catch(error => output.appendLine(error.message));
  };
  const useDomRendering = async () => {
    await vscode.workspace.getConfiguration('editor').update('experimentalGpuAcceleration', 'off', vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration('terminal.integrated').update('gpuAcceleration', 'off', vscode.ConfigurationTarget.Global);
  };
  const refresh = async () => {
    if (!desktop()) return;
    const css = await stylesheet();
    const status = await inspectGlow(vscode.env.appRoot, css);
    // Settings and upgrades may update an existing patch, never install one without consent.
    if (status.linked && status.stylesheetPresent && !status.stylesheetCurrent) {
      await setGlow(vscode.env.appRoot, css, true);
      await notifyReload('Neon Dreams glow updated.');
    }
  };
  const command = (name, handler) => context.subscriptions.push(vscode.commands.registerCommand(`neondreams.${name}`, () => run(handler)));

  command('configureGlow', async () => {
    const picked = await vscode.window.showQuickPick([
      { label: 'Off', description: '0', value: 0 },
      { label: 'Subtle', description: '25', value: 25 },
      { label: 'Balanced', description: '60 (default)', value: 60 },
      { label: 'Strong', description: '80', value: 80 },
      { label: 'Maximum', description: '100', value: 100 },
      { label: 'Open Glow Settings', description: 'Custom strength and individual surfaces', value: 'settings' }
    ], { title: 'Neon Dreams Glow Strength', placeHolder: `Current strength: ${settings().strength ?? 60}` });
    if (!picked) return;
    if (picked.value === 'settings') await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:accelleon.neondreams');
    else {
      await vscode.workspace.getConfiguration('neondreams.glow').update('strength', picked.value, vscode.ConfigurationTarget.Global);
      // Run directly here; the configuration listener queues a harmless no-op after this task.
      await refresh();
    }
  });

  command('compatibleRendering', async () => {
    const answer = await vscode.window.showWarningMessage('Use DOM rendering for consistent editor and terminal glow?', {
      modal: true,
      detail: 'This sets editor.experimentalGpuAcceleration and terminal.integrated.gpuAcceleration to off in user settings. Terminal rendering may be slower. Workspace overrides can still take precedence. You can restore the previous rendering mode in Settings.'
    }, 'Use DOM Rendering');
    if (!answer) return;
    await useDomRendering();
    await notifyReload('Compatible text rendering configured.');
  });

  command('glowStatus', async () => {
    const css = await stylesheet();
    const status = await inspectGlow(vscode.env.appRoot, css);
    const detail = [
      `VS Code: ${vscode.version} (${process.platform})`,
      `Neon Dreams extension: ${context.extension?.packageJSON?.version ?? 'unknown'}`,
      `Selected theme: ${vscode.workspace.getConfiguration('workbench').get('colorTheme')}`,
      `Glow strength: ${settings().strength ?? 60} / 100`,
      `Editor boost: ${settings().editorBoost ?? 2}x`,
      `Surfaces: ${JSON.stringify(settings())}`,
      `Glow link: ${status.linked ? 'installed' : 'missing'}`,
      `Stylesheet: ${status.stylesheetPresent ? (status.stylesheetCurrent ? 'current' : 'outdated — run Enable Glow again') : 'missing — run Enable Glow'}`,
      `Stylesheet file: ${status.stylesheetFile ?? 'none'}`,
      `Editor GPU acceleration: ${vscode.workspace.getConfiguration('editor').get('experimentalGpuAcceleration', 'off')}`,
      `Terminal GPU acceleration: ${vscode.workspace.getConfiguration('terminal.integrated').get('gpuAcceleration', 'auto')}`,
      `Workbench: ${status.workbenchPath}`, '',
      'This checks the patch on disk, not the renderer. Reload every window after changes.',
      'Editor and terminal canvas/WebGL text cannot use CSS text shadows. Run Neon Dreams: Use Compatible Text Rendering, then check for workspace overrides.',
      'OS high contrast / forced colors intentionally suppress glow. Settings apply to all windows using this installation; profiles can overwrite the installed strength.'
    ].join('\n');
    const choice = await vscode.window.showInformationMessage('Neon Dreams Glow Status', { modal: true, detail }, 'Copy Status');
    if (choice === 'Copy Status') await vscode.env.clipboard.writeText(detail);
  });

  for (const [name, enabled] of [['enableGlow', true], ['disableGlow', false]]) {
    command(name, async () => {
      if (!desktop()) {
        await vscode.window.showInformationMessage('The Neon Dreams theme works on the web; optional glow requires desktop VS Code.');
        return;
      }
      let compatible = false;
      if (enabled) {
        const answer = await vscode.window.showWarningMessage('Enable experimental Neon Dreams glow?', {
          modal: true,
          detail: 'This modifies the writable VS Code installation and may trigger an integrity warning. Disable glow before uninstalling. The DOM rendering option also turns off editor and terminal GPU rendering in user settings so text shadows work; terminal rendering may be slower.'
        }, 'Enable Glow + DOM Rendering', 'Enable Glow Only');
        if (!answer) return;
        compatible = answer === 'Enable Glow + DOM Rendering';
      }
      await setGlow(vscode.env.appRoot, await stylesheet(), enabled);
      if (compatible) await useDomRendering();
      await notifyReload(`Neon Dreams glow ${enabled ? 'enabled' : 'removed'}.`);
    });
  }
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('neondreams.glow')) void run(refresh);
  }));
  void run(refresh, true);
}
module.exports = { activate };
