# Contributing to ebr-mod-manager

The mod manager is a SvelteKit web app that lets players browse, download, and
play community mods for Earthborne Rangers. Contributions that improve the app
are welcome.

## Getting Started

### Prerequisites

- Node.js (LTS)
- Android Studio (for Android builds only)

### Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. See the [README](README.md) for
full build and testing instructions.

## How to Contribute

1. Fork this repository
2. Create a feature branch from `main`
3. Make your changes
4. Run `npm run check` and verify no TypeScript errors
5. Test manually in the browser (desktop Chrome/Edge)
6. Open a pull request against `main`

### What We Accept

- Bug fixes
- Accessibility improvements
- Performance improvements
- i18n translations (add locale files under `messages/`)
- Documentation improvements

### What Requires Discussion First

Open an issue before working on:

- New features or UI changes
- Dependency additions or upgrades
- Architecture changes
- Changes to the security model (extraction, allowlists, blocklists)

## Code Style

- TypeScript for all source files
- Svelte 5 component syntax
- Use existing design tokens (CSS custom properties) for colors, spacing, and
  typography - do not introduce raw values
- i18n: all user-facing strings go through paraglide-js message functions
  (`m.key_name()`) - no hardcoded English in components

## Testing

- Run tests with `npm test`
- UI changes are tested manually

## Commit Messages

Use clear, descriptive commit messages.

## Android / Capacitor

Changes to the custom `ebr-vault-plugin` (Kotlin in `android/app/src/`) should
be tested on a physical Android device. See the README for setup instructions.

## Questions

Open a GitHub issue for questions about the codebase or contribution process.
