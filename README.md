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
| File writes (desktop) | File System Access API (`showDirectoryPicker()`) |
| File writes (Android) | Capacitor (custom `ebr-vault-plugin` via SAF) |
| Hosting | GitHub Pages |
| Supported browsers | Chrome/Edge desktop (full support). Firefox/Safari (browse-only, zip download fallback). |

## Development Setup

### Prerequisites

- **Node.js** (LTS) - `winget install OpenJS.NodeJS.LTS`
- **Android Studio** (for Android app builds) - `winget install Google.AndroidStudio`

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

### Testing on Android (physical phone via browser)

The File System Access API requires a secure context (HTTPS or `localhost`). When testing the **web app** on a phone connected via USB, use ADB port forwarding so the phone sees `localhost`:

```powershell
# Build and start the preview server, bound to all interfaces so adb can reach it
npm run build
npm run preview -- --host 0.0.0.0

# Forward phone's localhost:4173 to your PC's localhost:4173
adb reverse tcp:4173 tcp:4173

# Then on the phone, open Chrome and go to:
# http://localhost:4173
```

### Android App (Capacitor)

The Android app wraps the same SvelteKit web app in a native shell and uses a custom Capacitor plugin (`ebr-vault-plugin`) for reliable file writes. The plugin wraps Android's Storage Access Framework (SAF), letting the user pick any directory and persisting write permissions across app restarts. This bypasses Chrome Android's broken File System Access API (Chromium bug #393681327 -- `createWritable()` fails for long file paths typical in EBR mods) and avoids `@capacitor/filesystem`'s incompatibility with SAF content URIs.

#### Building the Android App

```powershell
# Build the web app and sync into the Android project
npm run cap:sync

# Open the Android project in Android Studio
npm run cap:open
```

From Android Studio, click **Run** (green play button) to build and deploy to a connected device or emulator.

#### Development with Live Reload

To get hot-reload on a physical device while developing:

1. Start the Vite dev server:

   ```powershell
   npm run dev -- --host 0.0.0.0
   ```

2. Edit `capacitor.config.ts` -- uncomment the `server` block and set the URL to your machine's local IP:

   ```ts
   server: {
     url: 'http://192.168.x.x:5173',  // your machine's LAN IP
     cleartext: true,
   },
   ```

   For the Android emulator, use `http://10.0.2.2:5173` instead (the emulator's alias for the host machine).

3. Sync and run:

   ```powershell
   npx cap sync android
   npm run cap:open
   ```

4. Run the app from Android Studio. It will load from your dev server with hot-reload.

5. **Remember to comment out the `server` block** in `capacitor.config.ts` before building a production APK.

#### Building a Release APK

```powershell
# Build and sync web assets
npm run cap:sync

# Open Android Studio
npm run cap:open

# In Android Studio: Build -> Build Bundle(s) / APK(s) -> Build APK(s)
# The APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

To sideload the APK onto a phone, copy it via USB or use:

```powershell
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
