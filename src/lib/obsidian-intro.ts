// First-download Obsidian explainer state.
//
// Mods are played in Obsidian, so the first time a user taps download/play we
// show a one-time explainer that teaches the Obsidian context. A localStorage
// flag (`seenObsidianIntro`) makes it once-only; returning users go straight to
// the folder picker and write. The same explainer is also reachable on demand
// from the persistent "Playable in Obsidian" chrome label.

import { writable } from 'svelte/store';
import { getStorageItem, setStorageItem, removeStorageItem } from '$lib/safe-storage.js';

const SEEN_KEY = 'seenObsidianIntro';

/** Where the "Get Obsidian (free)" affordances point. */
export const OBSIDIAN_DOWNLOAD_URL = 'https://obsidian.md/download';

/** Whether the user has already been shown the Obsidian explainer. */
export function hasSeenObsidianIntro(): boolean {
	return getStorageItem(SEEN_KEY) === 'true';
}

/** Record that the user has now seen the Obsidian explainer. */
export function markObsidianIntroSeen(): void {
	// On failure the flag is never written, so the explainer shows again next time.
	setStorageItem(SEEN_KEY, 'true');
}

/** Forget that the user has seen the explainer, so it shows again next download. */
export function clearObsidianIntroSeen(): void {
	removeStorageItem(SEEN_KEY);
}

/** Whether the shared explainer modal is currently open. */
export const obsidianIntroOpen = writable(false);

// Continuation to run when the user confirms the explainer from a download flow.
// Held at module scope so the single modal instance in the layout can drive an
// install started by any InstallButton on the page.
let proceedCallback: (() => void) | null = null;

/**
 * Entry point for the first-download flow. If the explainer has already been
 * seen, runs `onProceed` immediately (synchronously, so it stays inside the
 * originating user gesture -- required for showDirectoryPicker). Otherwise opens
 * the explainer and defers `onProceed` until the user confirms it.
 */
export function requestObsidianIntro(onProceed: () => void): void {
	if (hasSeenObsidianIntro()) {
		onProceed();
		return;
	}
	proceedCallback = onProceed;
	obsidianIntroOpen.set(true);
}

/** Open the explainer informationally (from the chrome label). No continuation. */
export function showObsidianIntro(): void {
	proceedCallback = null;
	obsidianIntroOpen.set(true);
}

/**
 * The "I already have it" action. Marks the explainer seen, closes it, and runs
 * any pending download continuation synchronously so the folder picker still
 * fires inside the click gesture.
 */
export function confirmObsidianIntro(): void {
	markObsidianIntroSeen();
	obsidianIntroOpen.set(false);
	const cb = proceedCallback;
	proceedCallback = null;
	cb?.();
}

/**
 * Dismiss the explainer without continuing (Escape, backdrop). Does not mark it
 * seen, so the explainer stays mandatory until the user explicitly confirms it
 * with "I already have it"; the next download attempt shows it again.
 */
export function dismissObsidianIntro(): void {
	obsidianIntroOpen.set(false);
	proceedCallback = null;
}
