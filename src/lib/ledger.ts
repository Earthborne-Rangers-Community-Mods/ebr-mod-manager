// Download ledger: a localStorage-backed map of every mod the user has
// downloaded, keyed by mod id. Each entry records the version that was
// downloaded and when. The ledger is the source of truth for update
// detection -- comparing a recorded version against the registry's
// latestVersion -- and requires no folder read, so it works on every
// platform including zip-download users who have no stored directory handle.

import { getStorageItem, setStorageItem, removeStorageItem } from '$lib/safe-storage.js';

const LEDGER_KEY = 'ebr-download-ledger';

// Keys that, if used to index a plain object, mutate its prototype or shadow
// inherited members instead of creating a normal entry. Mod ids are arbitrary
// strings from the registry, so they are screened before being used as keys.
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isReservedKey(key: string): boolean {
	return RESERVED_KEYS.has(key);
}

/** One ledger entry: the version downloaded and the timestamp it was recorded. */
export interface LedgerEntry {
	version: string;
	downloadedAt: string;
}

/** The full ledger: a map from mod id to its most recent download entry. */
export type DownloadLedger = Record<string, LedgerEntry>;

/** Read the whole ledger. Returns an empty ledger on missing or corrupt data. */
export function getLedger(): DownloadLedger {
	const raw = getStorageItem(LEDGER_KEY);
	if (!raw) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

	const ledger: DownloadLedger = {};
	for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
		if (isReservedKey(id)) continue;
		if (!value || typeof value !== 'object') continue;
		const entry = value as Record<string, unknown>;
		if (typeof entry.version === 'string' && typeof entry.downloadedAt === 'string') {
			ledger[id] = { version: entry.version, downloadedAt: entry.downloadedAt };
		}
	}
	return ledger;
}

/**
 * Safely look up one mod's entry in an already-loaded ledger. Returns null for
 * reserved keys and for ids that are not own properties, so a bracket access
 * can never surface an inherited member as if it were a ledger entry.
 */
export function entryFor(ledger: DownloadLedger, modId: string): LedgerEntry | null {
	if (isReservedKey(modId)) return null;
	return Object.hasOwn(ledger, modId) ? ledger[modId] : null;
}

/** Read a single ledger entry. Returns null if the mod has never been downloaded. */
export function getLedgerEntry(modId: string): LedgerEntry | null {
	return entryFor(getLedger(), modId);
}

/**
 * Record (or overwrite) the ledger entry for a mod after a successful download.
 * Overwriting with the just-downloaded version is what clears an update badge.
 */
export function recordDownload(modId: string, version: string): void {
	if (isReservedKey(modId)) return;
	const ledger = getLedger();
	ledger[modId] = { version, downloadedAt: new Date().toISOString() };
	// On failure (storage full or unavailable) update awareness degrades silently.
	setStorageItem(LEDGER_KEY, JSON.stringify(ledger));
}

/** Erase the whole download ledger, clearing every mod's update badge. */
export function clearLedger(): void {
	removeStorageItem(LEDGER_KEY);
}

/**
 * Whether the registry's latestVersion is newer than the version the user
 * last downloaded. False when the mod has never been downloaded (no badge for
 * mods the user has not installed) or when the registry is not ahead.
 */
export function hasUpdate(modId: string, latestVersion: string): boolean {
	const entry = getLedgerEntry(modId);
	if (!entry) return false;
	return compareVersions(latestVersion, entry.version) > 0;
}

/**
 * Compare two semver strings by their numeric major.minor.patch core.
 * Returns 1 if a > b, -1 if a < b, 0 if equal. Pre-release and build
 * metadata (anything after `-` or `+`) and a leading `v` are ignored, which
 * is sufficient for the registry's plain semver versions and avoids badge
 * flapping on metadata-only differences.
 */
export function compareVersions(a: string, b: string): number {
	const pa = parseVersionCore(a);
	const pb = parseVersionCore(b);
	for (let i = 0; i < 3; i++) {
		if (pa[i] > pb[i]) return 1;
		if (pa[i] < pb[i]) return -1;
	}
	return 0;
}

/** Parse the numeric [major, minor, patch] core of a version string. */
function parseVersionCore(version: string): [number, number, number] {
	const core = version.trim().replace(/^v/i, '').split(/[-+]/, 1)[0];
	const parts = core.split('.');
	const major = Number.parseInt(parts[0], 10);
	const minor = Number.parseInt(parts[1], 10);
	const patch = Number.parseInt(parts[2], 10);
	return [
		Number.isFinite(major) ? major : 0,
		Number.isFinite(minor) ? minor : 0,
		Number.isFinite(patch) ? patch : 0,
	];
}
