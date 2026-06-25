# Vendored: Read Only View

Trusted, version-pinned copy of the "Read Only View" Obsidian community plugin.
The app injects it into every written vault (see `src/lib/obsidian-plugins.ts`) so
mod content opens read-only in Obsidian. It ships with the app and never travels
with downloaded mod content.

- Upstream: https://github.com/mrKazzila/obsidian-read-only-plugin
- Version: 1.0.7
- Vendored: 2026-06-24
- Files: `main.js`, `manifest.json`, `styles.css`, `data.json` (verbatim from the
  release; `data.json` carries the plugin settings that force read-only on all
  files: `enabled: true`, `includeRules: ["*"]`).
- `main.js` SHA-256: `ba56871955967e3c367e344810d0e09fdb59e5b45e47177dd62fd2ea8394fe76`

## Updating

1. Install the plugin in Obsidian and locate its folder.
2. Set the read-only files to all ("*").
3. Locate the new release's `main.js`, `manifest.json`, `styles.css`, and
   `data.json` and drop them in this folder, replacing the existing files.
4. Update the version, date, and `main.js` SHA-256 above.
5. Rebuild. The files are inlined via Vite `?raw`, so no other change is needed.
