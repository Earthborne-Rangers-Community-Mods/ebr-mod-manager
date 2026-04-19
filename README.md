# ebr-mod-manager

A lightweight web app for browsing, downloading, and playing community mods for Earthborne Rangers. Built with **SvelteKit + adapter-static**, hosted on GitHub Pages.

## What it does

1. Fetches the mod registry from GitHub
2. Lets users browse, search, and filter mods
3. Downloads a mod (by pinned commit hash) and writes it to a local Obsidian vault folder
4. Launches Obsidian to play

## Tech stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit + adapter-static (static site) |
| Frontend | Svelte 5, TypeScript |
| i18n | paraglide-js (compile-time, typed) |
| File writes | File System Access API (`showDirectoryPicker()`) |
| Hosting | GitHub Pages |
| Supported browsers | Chrome/Edge desktop, Android Chrome 132+ (full support). Firefox/Safari (browse-only, zip download fallback). |

## Development Setup

### Prerequisites

- **Node.js** (LTS)  - `winget install OpenJS.NodeJS.LTS`

### Build & Run

```powershell
# Install dependencies
npm install

# Run dev server (hot-reload)
npm run dev

# Build static site
npm run build

# Preview the production build locally
npm run preview
```

The dev server runs at `http://localhost:5173` by default. The preview server runs at `http://localhost:4173`.

### Testing on Android (physical phone)

The File System Access API requires a secure context (HTTPS or `localhost`). When testing on a phone connected via USB, use ADB port forwarding so the phone sees `localhost`:

```powershell
# Forward phone's localhost:4173 to your PC's localhost:4173
adb reverse tcp:4173 tcp:4173

# Then on the phone, open Chrome and go to:
# http://localhost:4173
```
