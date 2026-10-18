'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { renderGlow } = require('../src/glow-style');

function host(installed = false) {
  const values = new Map([
    ['neondreams.glow.strength', 60], ['workbench.colorTheme', 'Neon Dreams'],
    ['editor.experimentalGpuAcceleration', 'on'], ['terminal.integrated.gpuAcceleration', 'auto']
  ]);
  const commands = new Map();
  const listeners = [];
  const writes = [];
  const errors = [];
  let linked = installed;
  let installedCss = installed ? 'old CSS' : undefined;
  const state = { warningAnswer: undefined, picked: undefined, values, writes, errors };
  const disposable = { dispose() {} };
  const vscode = {
    version: 'test', UIKind: { Desktop: 1 }, ConfigurationTarget: { Global: 1 }, env: { uiKind: 1, appRoot: '/fake/vscode' },
    window: {
      createOutputChannel: () => ({ ...disposable, appendLine() {} }),
      showInformationMessage: async () => undefined,
      showErrorMessage: async message => errors.push(message),
      showWarningMessage: async () => state.warningAnswer,
      showQuickPick: async () => state.picked
    },
    workspace: {
      getConfiguration: section => ({
        get: (key, fallback) => values.has(`${section}.${key}`) ? values.get(`${section}.${key}`) : fallback,
        update: async (key, value, target) => {
          assert.equal(target, 1, 'Writes must explicitly target user settings');
          values.set(`${section}.${key}`, value);
          for (const listener of listeners) listener({ affectsConfiguration: prefix => `${section}.${key}`.startsWith(`${prefix}.`) });
        }
      }),
      onDidChangeConfiguration: listener => { listeners.push(listener); return disposable; }
    },
    commands: {
      registerCommand: (id, handler) => { commands.set(id, handler); return disposable; },
      executeCommand: async () => undefined
    }
  };
  const glow = {
    inspectGlow: async (_root, css) => ({ linked, stylesheetPresent: installedCss !== undefined, stylesheetCurrent: css === installedCss, workbenchPath: '/fake/workbench.html' }),
    setGlow: async (_root, css, enabled) => { writes.push({ css, enabled }); linked = enabled; installedCss = enabled ? css : undefined; }
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/extension.js'), 'utf8');
  const sandbox = { module: { exports: {} }, process, require: name => name === 'vscode' ? vscode : name === './glow' ? glow : name === './glow-style' ? { renderGlow } : require(name) };
  vm.runInNewContext(source, sandbox);
  sandbox.module.exports.activate({ extensionPath: path.join(__dirname, '..'), subscriptions: [] });
  state.command = name => commands.get(`neondreams.${name}`)();
  state.setStrength = value => vscode.workspace.getConfiguration('neondreams.glow').update('strength', value, 1);
  state.flush = () => state.command('glowStatus');
  return state;
}

test('startup and strength changes never enable a previously disabled patch', async () => {
  const h = host();
  await h.flush();
  await h.setStrength(80);
  await h.flush();
  assert.equal(h.writes.length, 0);
  assert.equal(h.values.get('terminal.integrated.gpuAcceleration'), 'auto');
  assert.equal(h.errors.length, 0);
});

test('an enabled patch updates after settings changes and disabling stays disabled', async () => {
  const h = host(true);
  await h.flush();
  assert.equal(h.writes.length, 1, 'An existing patch upgrades on activation');
  const initial = h.writes[0].css;
  await h.setStrength(100);
  await h.flush();
  assert.equal(h.writes.length, 2);
  assert.notEqual(h.writes[1].css, initial);
  await h.command('disableGlow');
  await h.setStrength(25);
  await h.flush();
  assert.equal(h.writes.length, 3);
  assert.equal(h.writes[2].enabled, false);
  assert.equal(h.errors.length, 0);
});

test('GPU settings change only after the compatible rendering option is chosen', async () => {
  const h = host();
  await h.command('enableGlow');
  assert.equal(h.writes.length, 0, 'Cancelling does not install');
  h.warningAnswer = 'Enable Glow Only';
  await h.command('enableGlow');
  assert.equal(h.values.get('terminal.integrated.gpuAcceleration'), 'auto');
  assert.equal(h.values.get('editor.experimentalGpuAcceleration'), 'on');
  h.warningAnswer = 'Enable Glow + DOM Rendering';
  await h.command('enableGlow');
  assert.equal(h.values.get('terminal.integrated.gpuAcceleration'), 'off');
  assert.equal(h.values.get('editor.experimentalGpuAcceleration'), 'off');
  assert.equal(h.errors.length, 0);
});

test('strength picker persists the selected value and refreshes an installed patch', async () => {
  const h = host(true);
  await h.flush();
  h.picked = { value: 0 };
  await h.command('configureGlow');
  await h.flush();
  assert.equal(h.values.get('neondreams.glow.strength'), 0);
  assert.ok(h.writes.at(-1).css.includes('--nd-text-glow: none;'));
  assert.equal(h.errors.length, 0);
});
