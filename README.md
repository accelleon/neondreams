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

[Download Neon Dreams 0.1.1 (.vsix)](https://github.com/accelleon/neondreams/raw/refs/heads/main/releases/neondreams-0.1.1.vsix), then run **Extensions: Install from VSIX…** in VS Code and select the downloaded file.

Open this folder in desktop VS Code and press **F5** to launch the Extension Development Host. Select **Preferences: Color Theme → Neon Dreams**. No dependency installation is required to run the theme or extension source.

To install a packaged build:

```sh
npm ci
npm run check
npm test
npm run package
code --install-extension neondreams-0.1.1.vsix
```

Select Neon Dreams separately in any profile or workspace that overrides `workbench.colorTheme`. The default user theme applies to ordinary new windows. Native colors also follow detached editor windows.

## Optional glow (experimental desktop feature)

Run **Neon Dreams: Enable Glow (Desktop, Experimental)**, accept the installation modification dialog, then **quit and reopen all VS Code windows**. Glow follows each token's `currentColor`, with a tight halo and a faint outer halo. It never replaces the text foreground, changes text opacity, or blurs the editor. High contrast OS settings suppress the glow.

VS Code has no supported theme API for text shadows. This command adds one local stylesheet link to the desktop workbench HTML; it does not weaken the Content Security Policy, alter checksums, or suppress integrity checks. VS Code may report the modified installation as corrupt. Do not enable glow if this is unacceptable. It requires a writable installation; the extension does not elevate privileges. Managed, read-only, signed, or platform-restricted installations may prevent it or reject the modified application. Theme colors still work.

The stylesheet is scoped to this theme. Separate VS Code windows load it on restart. VS Code's auxiliary-window service clones workbench stylesheets into detached windows, covering both existing and subsequently opened detached editors. This depends on VS Code internals and needs manual verification for each supported release. Extension webviews, native OS menus/dialogs, and other applications are outside its scope.

Run **Neon Dreams: Disable Glow** and quit/reopen **all** windows to remove it. **Disable before uninstalling the extension**: uninstalling cannot automatically restore the application. VS Code updates usually replace the modified workbench, requiring glow to be enabled again. A clean VS Code reinstall also removes the patch. Never run VS Code as administrator for this feature. Do not concurrently patch the same installation from multiple windows.

## Development and verification

Uses Node.js 22 or newer for development tools. Runtime extension code has no production dependencies and makes no network requests.

`npm test` validates the palette and exercises installation, repeat installation, removal, preservation of unrelated edits, and refusal to overwrite unknown files. `npm run check` also validates JavaScript syntax. `npm run test:browser` checks the CSS in Chromium, including a second document with copied stylesheets. These checks do not replace testing in the actual Electron application.

For browser checks, either install Playwright's Chromium with `npx playwright install chromium`, or use an existing browser:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Manual release check in desktop VS Code:

1. Try JS/TS, Python, JSON, CSS, and Markdown with semantic highlighting on and off. Inspect selections, search matches, diagnostics, terminal colors, autocomplete, hover, quick pick, and menus.
2. Open another full window. Move an editor into a new detached window, before and after enabling glow. Quit/reopen all windows after toggling glow, then check token colors and menus in each.
3. Switch away from Neon Dreams; its glow should disappear. Disable glow, restart, and confirm the original workbench remains functional.

This initial version has not yet been validated in an interactive desktop VS Code session. No Marketplace publication is performed by the build commands. The `accelleon` publisher ID must belong to you before publishing there.
