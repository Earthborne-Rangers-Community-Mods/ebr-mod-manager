// --- Types ---

import {
	RegistryFetchError,
	ModDetailFetchError,
	DescriptionFetchError,
	RegistryParseError,
	ModParseError,
	InvalidRepoUrlError,
	NetworkError,
} from './errors.js';

import type { ModType, BrowseMod, ModDetail, Registry } from './types.js';

export type { ModType, BrowseMod, IncludedMod, ModDetail, Registry } from './types.js';

// --- Configuration ---

const REGISTRY_OWNER = 'Earthborne-Rangers-Community-Mods';
const REGISTRY_REPO = 'ebr-mod-registry';
const REGISTRY_BRANCH = 'main';

const RAW_BASE = `https://raw.githubusercontent.com/${REGISTRY_OWNER}/${REGISTRY_REPO}/${REGISTRY_BRANCH}`;

// --- Campaign display names (derived from registry) ---

/** Map from campaign slug to display name, built from campaign-type mods in the registry. */
let campaignNameMap: Record<string, string> = {};

/** Get the display name for a campaign ID. Returns the slug if unknown. */
export function getRegistryCampaignName(id: string): string {
	return campaignNameMap[id] ?? id;
}

/** Rebuild the campaign name map from registry mods. Called after fetching the registry. */
function buildCampaignNameMap(mods: BrowseMod[]): void {
	const map: Record<string, string> = {};
	for (const mod of mods) {
		if (mod.type === 'campaign' || mod.type === 'one-day-mission') {
			map[mod.id] = mod.name;
		}
	}
	campaignNameMap = map;
}

// --- Caching ---
//
// The browse-tier registry.json is fetched on the home screen. Without caching
// it is re-downloaded on every visit. These helpers store the most recent
// successful fetch in the Cache API and stamp it with the time it was written,
// so a fresh copy can be served without a network round trip and only
// revalidated past a timed interval or on an explicit refresh.
//
// A service worker is intentionally not used here. Capacitor's native WebViews
// do not register one, and the Cache API is reachable from the page context in
// modern browsers and WebViews, so the caching logic can live in app code as a
// single path. Where the Cache API is unavailable, every entry point degrades
// to a no-op and the app simply fetches from the network.

const CACHE_NAME = 'ebr-registry-cache-v1';

/** Custom response header recording when an entry was stored, as epoch ms. */
const CACHED_AT_HEADER = 'x-ebr-cached-at';

/**
 * How long a cached registry is served before the next fetch revalidates it.
 * The registry changes infrequently (mods are published occasionally), so an
 * hour keeps the browse screen instant on repeat visits without letting a new
 * publish go unseen for long. A manual refresh bypasses this entirely.
 */
export const REGISTRY_TTL_MS = 60 * 60 * 1000;

/** A cached registry body plus the time it was stored. */
export interface CachedRegistry {
	/** Parsed registry JSON. */
	data: unknown;
	/** Epoch milliseconds when this copy was stored. */
	cachedAt: number;
}

/** True when the Cache API is usable in the current context. */
function cacheAvailable(): boolean {
	return typeof caches !== 'undefined';
}

/**
 * Read the cached registry for a URL. Returns null when the Cache API is
 * unavailable, nothing is stored, or the stored entry cannot be read. A corrupt
 * or unreadable entry is treated as a miss so the caller falls through to the
 * network.
 */
export async function readRegistryCache(url: string): Promise<CachedRegistry | null> {
	if (!cacheAvailable()) return null;
	try {
		const cache = await caches.open(CACHE_NAME);
		const response = await cache.match(url);
		if (!response) return null;
		const stamp = Number(response.headers.get(CACHED_AT_HEADER));
		const cachedAt = Number.isFinite(stamp) ? stamp : 0;
		const data = await response.json();
		return { data, cachedAt };
	} catch {
		return null;
	}
}

/**
 * Store a freshly fetched registry body, stamped with the current time.
 * Caching is best-effort: a write failure (quota, unavailable cache) is
 * swallowed so it can never break the fetch that produced the body.
 */
export async function writeRegistryCache(url: string, body: string): Promise<void> {
	if (!cacheAvailable()) return;
	try {
		const cache = await caches.open(CACHE_NAME);
		const stamped = new Response(body, {
			headers: {
				'content-type': 'application/json',
				[CACHED_AT_HEADER]: String(Date.now()),
			},
		});
		await cache.put(url, stamped);
	} catch {
		// Best-effort: nothing to do when the write fails.
	}
}

/** True when a cached copy is still within the timed-refresh interval. */
export function isRegistryFresh(cachedAt: number, now: number = Date.now()): boolean {
	return now - cachedAt < REGISTRY_TTL_MS;
}

/**
 * Delete the entire registry cache. Best-effort: a no-op where the Cache API is
 * unavailable, and any failure is swallowed. The next fetchRegistry repopulates
 * it from the network.
 */
export async function clearRegistryCache(): Promise<void> {
	if (!cacheAvailable()) return;
	try {
		await caches.delete(CACHE_NAME);
	} catch {
		// Best-effort: nothing to do when the delete fails.
	}
}

// --- Fetching ---

/** Options controlling how the browse-tier registry is fetched. */
export interface FetchRegistryOptions {
	/**
	 * Bypass the timed-interval cache check and always revalidate against the
	 * network. Used for the manual "refresh" affordance. A successful refresh
	 * still updates the cache; a failed one still falls back to any cached copy.
	 */
	forceRefresh?: boolean;
}

/**
 * Fetch and parse the browse-tier registry.
 *
 * Results are cached via the Cache API (see the Caching section above). A cached copy
 * that is still within the timed-refresh interval is served without a network
 * request, so the registry is not re-downloaded on every page load. Past the
 * interval, or when `forceRefresh` is set, the network is consulted and the
 * cache refreshed. When the network is unreachable or errors, any cached copy
 * (even a stale one) is served before the error is surfaced.
 */
export async function fetchRegistry(options: FetchRegistryOptions = {}): Promise<Registry> {
	const url = `${RAW_BASE}/registry.json`;

	// Serve a still-fresh cached copy without touching the network, unless the
	// caller asked for an explicit refresh.
	if (!options.forceRefresh) {
		const cached = await readRegistryCache(url);
		if (cached && isRegistryFresh(cached.cachedAt)) {
			return parseRegistry(cached.data);
		}
	}

	let response: Response;
	try {
		response = await fetch(url);
	} catch (err) {
		// Offline or DNS failure: prefer a cached copy, even a stale one, over an
		// error so the browse screen stays usable without a connection.
		const cached = await readRegistryCache(url);
		if (cached) return parseRegistry(cached.data);
		throw new NetworkError(`Network error fetching registry: ${url}`, err);
	}
	if (!response.ok) {
		const cached = await readRegistryCache(url);
		if (cached) return parseRegistry(cached.data);
		throw new RegistryFetchError(url, response.status, response.statusText);
	}
	let body: string;
	let data: unknown;
	try {
		// Read and parse in one guarded step so a mid-stream body-read failure is
		// normalized to the same RegistryParseError the old response.json() path
		// produced, rather than escaping raw.
		body = await response.text();
		data = JSON.parse(body);
	} catch (err) {
		throw new RegistryParseError('root', `Registry response is not valid JSON`);
	}
	const registry = parseRegistry(data);
	// Only cache after a successful parse so a malformed payload is never stored.
	await writeRegistryCache(url, body);
	return registry;
}

/** Fetch the detail-tier data for a specific mod. */
export async function fetchModDetail(modId: string): Promise<ModDetail> {
	const url = `${RAW_BASE}/mods/${encodeURIComponent(modId)}.json`;
	let response: Response;
	try {
		response = await fetch(url);
	} catch (err) {
		throw new NetworkError(`Network error fetching mod detail for '${modId}': ${url}`, err);
	}
	if (!response.ok) {
		throw new ModDetailFetchError(modId, url, response.status, response.statusText);
	}
	let data: unknown;
	try {
		data = await response.json();
	} catch (err) {
		throw new RegistryParseError('root', `Mod detail response for '${modId}' is not valid JSON`);
	}
	validateModObject(data, modId);
	return data as ModDetail;
}

/** Filename of the per-mod description page. Lives at the repo root. */
export const DESCRIPTION_FILENAME = 'About this Mod.md';

/**
 * Fetch the About this Mod.md description page for a mod. Returns null if not found.
 *
 * The file is fetched anonymously from raw.githubusercontent.com, which works
 * for public repos.
 */
export async function fetchDescription(
	mod: { repoUrl: string; commitHash: string },
): Promise<string | null> {
	const url = modFileUrl(mod, DESCRIPTION_FILENAME);
	let response: Response;
	try {
		response = await fetch(url);
	} catch (err) {
		throw new NetworkError(`Network error fetching mod description`, err);
	}
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new DescriptionFetchError(url, response.status, response.statusText);
	}
	return response.text();
}

// --- URL helpers ---

/** Build a raw GitHub URL for a file in a mod repo at a pinned commit. */
export function modFileUrl(
	mod: { repoUrl: string; commitHash: string },
	filePath: string,
): string {
	const { owner, repo } = parseRepoUrl(mod.repoUrl);
	// Encode each path segment so spaces and other reserved characters in
	// filenames (e.g. "About this Mod.md") produce valid URLs. We split on
	// '/' and encode segments individually so the path separators are
	// preserved.
	const encodedPath = filePath
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `https://raw.githubusercontent.com/${owner}/${repo}/${mod.commitHash}/${encodedPath}`;
}

/** Rewrite relative image paths in markdown to absolute raw GitHub URLs. */
export function rewriteImagePaths(
	markdown: string,
	mod: { repoUrl: string; commitHash: string },
): string {
	return markdown.replace(
		/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
		(_, alt: string, path: string) => `![${alt}](${modFileUrl(mod, path)})`,
	);
}

// --- Parsing and validation ---

export function parseRegistry(data: unknown): Registry {
	if (!data || typeof data !== 'object') {
		throw new RegistryParseError('root', 'Registry data is not an object');
	}
	const obj = data as Record<string, unknown>;
	if (typeof obj.schemaVersion !== 'number') {
		throw new RegistryParseError('schemaVersion', 'Missing or invalid schemaVersion');
	}
	if (!Array.isArray(obj.mods)) {
		throw new RegistryParseError('mods', 'Missing or invalid mods array');
	}
	const mods: BrowseMod[] = [];
	for (let i = 0; i < obj.mods.length; i++) {
		try {
			mods.push(parseBrowseMod(obj.mods[i], i));
		} catch (err) {
			if (err instanceof ModParseError) {
				console.warn(`Skipping malformed mod at index ${i}: ${err.message}`);
				continue;
			}
			throw err;
		}
	}
	buildCampaignNameMap(mods);
	return { schemaVersion: obj.schemaVersion, mods };
}

const REQUIRED_STRING_FIELDS = [
	'id',
	'name',
	'repoUrl',
	'type',
	'commitHash',
] as const;

function parseBrowseMod(data: unknown, index: number): BrowseMod {
	if (!data || typeof data !== 'object') {
		throw new ModParseError(index, 'root');
	}
	const mod = data as Record<string, unknown>;
	for (const field of REQUIRED_STRING_FIELDS) {
		if (typeof mod[field] !== 'string') {
			throw new ModParseError(index, field);
		}
	}
	return {
		id: mod.id as string,
		name: mod.name as string,
		repoUrl: mod.repoUrl as string,
		type: mod.type as ModType,
		commitHash: mod.commitHash as string,
		author: typeof mod.author === 'string' ? mod.author : '',
		description: typeof mod.description === 'string' ? mod.description : '',
		tags: Array.isArray(mod.tags) ? (mod.tags as string[]) : [],
		campaigns: Array.isArray(mod.campaigns) ? (mod.campaigns as string[]) : [],
		requiredProducts: Array.isArray(mod.requiredProducts) ? (mod.requiredProducts as string[]) : [],
		safeToAddMidCampaign: typeof mod.safeToAddMidCampaign === 'boolean' ? mod.safeToAddMidCampaign : false,
		icon: typeof mod.icon === 'string' ? mod.icon : undefined,
		language: typeof mod.language === 'string' ? mod.language : 'en',
		latestVersion: typeof mod.latestVersion === 'string' ? mod.latestVersion : '',
		updatedAt: typeof mod.updatedAt === 'string' ? mod.updatedAt : '',
	};
}

function validateModObject(data: unknown, modId: string): void {
	if (!data || typeof data !== 'object') {
		throw new RegistryParseError('root', `Mod detail for '${modId}' is not an object`);
	}
	const obj = data as Record<string, unknown>;
	if (typeof obj.id !== 'string') {
		throw new RegistryParseError('id', `Mod detail for '${modId}': missing 'id'`);
	}
}

export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
	const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
	if (!match) {
		throw new InvalidRepoUrlError(repoUrl);
	}
	return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}
