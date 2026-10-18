# Neon Dreams

A true black (`#000000`) VS Code theme with neutral near-black panels and distinct, readable syntax colors, inspired by the synthwave aesthetic. No washed-out white text, broad blur filters, forced italics, or animation. The theme works independently of the experimental glow.

| Syntax | Color |
| --- | --- |
| Keywords / tags | Pink `#FF70BD` |
| Functions / methods | Cyan `#69E5FF` |
| Strings | Green `#A5E880` |
| Types / classes | Lavender `#BD93FF` |
| Numbers / constants | Peach `#FFBB78` |
| Properties | Yellow `#FFE08A` |
| Variables | Soft white `#E5DEF5` |

TextMate and semantic tokens share the palette. Every syntax color has at least 4.5:1 contrast against the editor background. Selections and diagnostics keep their own colors. Terminal ANSI colors, suggestions, hovers, menus, notifications, sidebars, panels, and inactive windows are themed too. Webviews controlled by other extensions can choose their own colors.

## Try it

[Download Neon Dreams 0.1.4 (.vsix)](https://github.com/accelleon/neondreams/raw/refs/heads/main/releases/neondreams-0.1.4.vsix), then run **Extensions: Install from VSIX…** in VS Code and select the downloaded file.

Open this folder in desktop VS Code and press **F5** to launch the Extension Development Host. Select **Preferences: Color Theme → Neon Dreams**. No dependency installation is required to run the theme or extension source.

To install a packaged build:

```sh
npm ci
npm run check
npm test
npm run package
code --install-extension neondreams-0.1.4.vsix
```

Select Neon Dreams separately in any profile or workspace that overrides `workbench.colorTheme`. The default user theme applies to ordinary new windows. Native colors also follow detached editor windows.

## Optional glow (experimental desktop feature)

Run **Neon Dreams: Enable Glow (Desktop, Experimental)**, choose **Enable Glow + DOM Rendering** for consistent editor and terminal support, and reload each VS Code window. The DOM option sets `editor.experimentalGpuAcceleration` and `terminal.integrated.gpuAcceleration` to `off` in user settings; terminal output can render slower. **Enable Glow Only** leaves rendering settings alone. Glow follows each token's `currentColor`; it never replaces the text foreground, changes text opacity, or blurs the editor. High contrast OS settings suppress the glow.

### Strength and surfaces

Run **Neon Dreams: Configure Glow Strength** for presets, or open Settings and search for **Neon Dreams** to choose any strength from 0 to 100 and switch individual surfaces on or off:

```json
{
  "neondreams.glow.strength": 60,
  "neondreams.glow.editorBoost": 2,
  "neondreams.glow.editor": true,
  "neondreams.glow.terminal": true,
  "neondreams.glow.explorer": true,
  "neondreams.glow.debugConsole": true
}
```

Strength 0 removes text and decorative glow; 25 is subtle, 60 balanced, 80 strong, and 100 maximum. At 60 the three text halos have radii of 2, 6, and 14 pixels. Strength changes their spread and opacity together while preserving each token's foreground. Function tokens use the same rule regardless of their TextMate or semantic-token class, including nested spans. Explorer filenames, highlighted filename matches, Debug Console text, and terminal DOM text each use their own foreground color for the halo. File icons stay sharp.

**Editor Boost** independently increases the density of the editor's colored halos, without increasing terminal or explorer glow. The default is **2×**; choose **1×** for the previous editor intensity, or increase up to **4×** if it remains faint on your display. It adds color-matched halo layers instead of whitening the text or blurring the editor. Strength 0 and the editor toggle still disable it. Reload each window after changing the boost.

When glow is already installed, changes and extension updates automatically regenerate its stylesheet; **reload every open window** to apply it. These settings never install a disabled patch. If startup refresh fails or the status shows outdated CSS, run **Enable Glow** again. Settings apply to the VS Code installation, so different profiles cannot maintain different installed strengths at the same time; the last applied settings win.

### Missing glow and rendering modes

If glow remains invisible, run **Neon Dreams: Check Glow Status**. The dialog reports the selected theme, strength and surfaces, missing or outdated stylesheet, VS Code version, and editor/terminal GPU settings. It checks the patch on disk; it cannot inspect the renderer's loaded CSS.

Use the dialog's **Copy Status** button to copy the results for troubleshooting.

GPU-rendered editor text and WebGL-rendered terminal text do not use DOM spans and cannot receive CSS text shadows. Run **Neon Dreams: Use Compatible Text Rendering** to opt into DOM rendering, then reload all windows. Existing terminals may need to be recreated. Workspace settings can override user rendering preferences; check the effective GPU modes in Glow Status if a particular project still differs. You can switch `terminal.integrated.gpuAcceleration` back to `auto` and `editor.experimentalGpuAcceleration` back to your preferred value in Settings; disabling glow does not undo rendering preferences. Windows contrast themes / forced colors intentionally suppress glow. Check that Neon Dreams is selected in the affected window.

VS Code has no supported theme API for text shadows. This command adds one local stylesheet link to the desktop workbench HTML; it does not weaken the Content Security Policy, alter checksums, or suppress integrity checks. VS Code may report the modified installation as corrupt. Do not enable glow if this is unacceptable. It requires a writable installation; the extension does not elevate privileges. Managed, read-only, signed, or platform-restricted installations may prevent it or reject the modified application. Theme colors still work.

The stylesheet is scoped to this theme. Separate VS Code windows load it on restart. VS Code's auxiliary-window service clones workbench stylesheets into detached windows, covering both existing and subsequently opened detached editors. This depends on VS Code internals and needs manual verification for each supported release. Extension webviews, native OS menus/dialogs, and other applications are outside its scope.

Run **Neon Dreams: Disable Glow** and quit/reopen **all** windows to remove it. **Disable before uninstalling the extension**: uninstalling cannot automatically restore the application. VS Code updates usually replace the modified workbench, requiring glow to be enabled again. A clean VS Code reinstall also removes the patch. Never run VS Code as administrator for this feature. Do not concurrently patch the same installation from multiple windows.

## Development and verification

Uses Node.js 22 or newer for development tools. Runtime extension code has no production dependencies and makes no network requests.

`npm test` validates the palette and exercises installation, repeat installation, removal, preservation of unrelated edits, and refusal to overwrite unknown files. `npm run check` also validates JavaScript syntax. `npm run test:browser` checks the CSS in Chromium, including a second document with copied stylesheets. `npm run test:editor` additionally loads the real Monaco DOM editor and checks rendered tokens and pixel changes at multiple strengths. These checks do not replace testing in the actual Electron application.

For browser checks, either install Playwright's Chromium with `npx playwright install chromium`, or use an existing browser:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
CHROMIUM_PATH=/usr/bin/chromium npm run test:editor
```

Manual release check in desktop VS Code:

1. Try JS/TS, Python, JSON, CSS, and Markdown with semantic highlighting on and off. Inspect selections, search matches, diagnostics, terminal colors, autocomplete, hover, quick pick, and menus.
2. Open another full window. Move an editor into a new detached window, before and after enabling glow. Quit/reopen all windows after toggling glow, then check token colors and menus in each.
3. Switch away from Neon Dreams; its glow should disappear. Disable glow, restart, and confirm the original workbench remains functional.

This initial version has not yet been validated in an interactive desktop VS Code session. No Marketplace publication is performed by the build commands. The `accelleon` publisher ID must belong to you before publishing there.
